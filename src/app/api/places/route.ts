import { NextResponse } from "next/server";
import { clientIp, limited } from "@/lib/ratelimit";
import { hitFromPlace, rawHits, requestBody, searchBody, tidy, type GooglePlace, type PlaceHit } from "@/lib/places";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Village / town suggestions from Google Places. The key (GOOGLE_PLACES_API_KEY) lives only here, on the server.
 * Without a key the answer is { provider: "off" } and the page uses the free OpenStreetMap service instead.
 * GET ?q=<what was typed>&in=1 (India) | 0 (elsewhere)
 *
 * Like Google Maps: Autocomplete gives the names, and for a village whose line says only "India" the full address
 * (district, state, block) is looked up with Place Details. A query of several words ("behta benipatti madhubani") is also
 * sent to Text Search, which finds the one place that fits all the words. Lookups are remembered for a while so the same
 * village is not paid for twice.
 */
const base = () => (process.env.GOOGLE_PLACES_BASE || "https://places.googleapis.com/v1").replace(/\/+$/, "");
const endpoint = () => process.env.GOOGLE_PLACES_URL || `${base()}/places:autocomplete`;

const AUTO_MASK = "suggestions.placePrediction.placeId,suggestions.placePrediction.types,suggestions.placePrediction.structuredFormat";
const DETAIL_MASK = "id,displayName,types,addressComponents";
const SEARCH_MASK = "places.id,places.displayName,places.types,places.addressComponents";

async function post(key: string, url: string, mask: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key, "x-goog-fieldmask": mask },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  return { ok: res.ok, status: res.status, json: res.ok ? await res.json().catch(() => null) : null };
}

const ask = (key: string, input: string, india: boolean, typed: boolean) => post(key, endpoint(), AUTO_MASK, requestBody(input, india, typed));

/** remembered Place Details (by place id), so a village is looked up once */
const detailCache = new Map<string, { at: number; place: GooglePlace | null }>();
const KEEP_MS = 6 * 60 * 60 * 1000, KEEP_MAX = 800;
async function details(key: string, id: string): Promise<GooglePlace | null> {
  const hit = detailCache.get(id);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.place;
  let place: GooglePlace | null = null;
  try {
    const res = await fetch(`${base()}/places/${encodeURIComponent(id)}`, {
      headers: { "x-goog-api-key": key, "x-goog-fieldmask": DETAIL_MASK },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) place = (await res.json().catch(() => null)) as GooglePlace | null;
    else return null; // a failure is not remembered
  } catch { return null; }
  if (detailCache.size >= KEEP_MAX) detailCache.delete(detailCache.keys().next().value as string);
  detailCache.set(id, { at: Date.now(), place });
  return place;
}

async function textSearch(key: string, q: string, india: boolean): Promise<PlaceHit[]> {
  try {
    const r = await post(key, `${base()}/places:searchText`, SEARCH_MASK, searchBody(q, india));
    const places = (r.json as { places?: GooglePlace[] } | null)?.places ?? [];
    const out: PlaceHit[] = [];
    for (const p of places) { const h = hitFromPlace(p, india); if (h) out.push(h); }
    return out;
  } catch { return []; }
}

export async function GET(req: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ provider: "off" }, { headers: { "cache-control": "no-store" } });
  if (limited("places", clientIp(req), 150)) return NextResponse.json({ provider: "error", hits: [] }, { status: 429 });
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 3) return NextResponse.json({ provider: "google", hits: [] });
  const india = u.searchParams.get("in") !== "0";
  const manyWords = q.split(" ").length >= 2;
  try {
    const [auto, found] = await Promise.all([
      (async () => {
        let r = await ask(key, q, india, true);
        if (!r.ok && r.status === 400) r = await ask(key, q, india, false); // if Google does not accept the type filter, ask without it (shops are dropped afterwards)
        if (!r.ok) return null;
        let raw = rawHits(r.json, india);
        if (!raw.length) { const r2 = await ask(key, q, india, false); if (r2.ok) raw = rawHits(r2.json, india); } // a village Google files under another type
        return raw;
      })(),
      manyWords ? textSearch(key, q, india) : Promise.resolve([] as PlaceHit[]),
    ]);
    if (!auto && !found.length) return NextResponse.json({ provider: "error", hits: [] }, { headers: { "cache-control": "no-store" } });

    // "Behta, India": the line has no district, so ask Google for the full address of the few that lack it
    const list = auto ?? [];
    let lookups = 0;
    const filled = await Promise.all(list.map(async ({ id, hit }) => {
      if (!hit.in || (hit.b && hit.c) || !id || lookups >= 5) return hit;
      lookups++;
      const pl = await details(key, id);
      return (pl && hitFromPlace(pl, india)) || hit;
    }));
    const hits = tidy([...found, ...filled]);
    return NextResponse.json({ provider: "google", hits }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ provider: "error", hits: [] }, { headers: { "cache-control": "no-store" } });
  }
}
