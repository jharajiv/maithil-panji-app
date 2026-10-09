import { NextResponse } from "next/server";
import { clientIp, limited } from "@/lib/ratelimit";
import { hitsFrom, requestBody } from "@/lib/places";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Village / town suggestions from Google Places. The key (GOOGLE_PLACES_API_KEY) lives only here, on the server.
 * Without a key the answer is { provider: "off" } and the page uses the free OpenStreetMap service instead.
 * GET ?q=<what was typed>&in=1 (India) | 0 (elsewhere)
 */
const endpoint = () => process.env.GOOGLE_PLACES_URL || "https://places.googleapis.com/v1/places:autocomplete";

async function ask(key: string, input: string, india: boolean, typed: boolean) {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key, "x-goog-fieldmask": "suggestions.placePrediction.placeId,suggestions.placePrediction.types,suggestions.placePrediction.structuredFormat" },
    body: JSON.stringify(requestBody(input, india, typed)),
    signal: AbortSignal.timeout(6000),
  });
  return { ok: res.ok, status: res.status, json: res.ok ? await res.json().catch(() => null) : null };
}

export async function GET(req: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ provider: "off" }, { headers: { "cache-control": "no-store" } });
  if (limited("places", clientIp(req), 150)) return NextResponse.json({ provider: "error", hits: [] }, { status: 429 });
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 3) return NextResponse.json({ provider: "google", hits: [] });
  const india = u.searchParams.get("in") !== "0";
  try {
    let r = await ask(key, q, india, true);
    if (!r.ok && r.status === 400) r = await ask(key, q, india, false); // if Google does not accept the type filter, ask without it (shops are dropped afterwards)
    if (!r.ok) return NextResponse.json({ provider: "error", hits: [] }, { headers: { "cache-control": "no-store" } });
    let hits = hitsFrom(r.json, india);
    if (!hits.length) { const r2 = await ask(key, q, india, false); if (r2.ok) hits = hitsFrom(r2.json, india); } // a village Google files under another type
    return NextResponse.json({ provider: "google", hits }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ provider: "error", hits: [] }, { headers: { "cache-control": "no-store" } });
  }
}
