import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getStore } from "@/lib/store";
import { viewMode, viewState } from "@/lib/view";
import { clientIp, limited } from "@/lib/ratelimit";
import { cleanSuggestion } from "@/lib/suggest";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** POST { v, person, field, value, note?, from_name? } — someone viewing the tree says something is wrong. Needs a valid view link. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Not available." }, { status: 503 });
  if (limited("tree-suggest", clientIp(req), 12, 60 * 60_000)) return NextResponse.json({ error: "Too many suggestions from this device. Please try again later." }, { status: 429 });
  const { id } = await params;
  const text = await req.text();
  if (text.length > 4000) return NextResponse.json({ error: "That is too long." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const row = await store.getTree(id);
  if (!row || !viewMode(id, typeof body.v === "string" ? body.v : null, viewState(row))) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  const c = cleanSuggestion(body);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  if (!row.family.persons.some((p) => p.id === c.person)) return NextResponse.json({ error: "That person is not in this tree." }, { status: 404 });
  if ((await store.listSuggestions(id)).length >= 100) return NextResponse.json({ error: "The family already has many suggestions waiting. Please try again in a few days." }, { status: 429 });
  await store.addSuggestion({ id: randomBytes(6).toString("hex"), tree_id: id, person_id: c.person, field: c.field, value: c.value, note: c.note, from_name: c.from_name, created_at: new Date().toISOString(), status: "new" });
  logEvent("correction_suggested");
  return NextResponse.json({ ok: true });
}
