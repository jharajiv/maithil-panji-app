import { NextResponse } from "next/server";
import { sanitizeFamily } from "@/lib/sanitize";
import { authorize, customRefs, getStore } from "@/lib/store";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const publicMembers = (row: { members: { id: string; name: string; role: string; person_id?: string }[] }) =>
  row.members.map((m) => ({ id: m.id, name: m.name, role: m.role, person_id: m.person_id }));

/** GET ?k=token[&rev=N] → the tree (or {unchanged:true} when the caller already has rev N) */
export async function GET(req: Request, { params }: Ctx) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Sharing is not set up yet." }, { status: 503 });
  if (limited("tree-read", clientIp(req), 400)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  const url = new URL(req.url);
  const row = await store.getTree(id);
  const me = row && authorize(row, url.searchParams.get("k"));
  if (!row || !me) return NextResponse.json({ error: "This link is not valid any more." }, { status: 404 });
  const have = Number(url.searchParams.get("rev"));
  const base = { rev: row.rev, role: me.role, member: { id: me.id, name: me.name, person_id: me.person_id }, members: me.role === "owner" ? publicMembers(row) : undefined };
  if (have && have === row.rev) return NextResponse.json({ ...base, unchanged: true });
  return NextResponse.json({ ...base, family: row.family });
}

/** PUT { k, baseRev, family } → save if baseRev is current; otherwise 409 with the newest copy so the client can merge */
export async function PUT(req: Request, { params }: Ctx) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Sharing is not set up yet." }, { status: 503 });
  if (limited("tree-write", clientIp(req), 300)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  const text = await req.text();
  if (text.length > 3_000_000) return NextResponse.json({ error: "Tree is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const row = await store.getTree(id);
  const me = row && authorize(row, typeof body.k === "string" ? body.k : null);
  if (!row || !me) return NextResponse.json({ error: "This link is not valid any more." }, { status: 404 });
  const family = sanitizeFamily(body.family, { stored: true });
  if (!family || !family.persons.length) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const baseRev = Number(body.baseRev);
  if (baseRev !== row.rev) return NextResponse.json({ conflict: true, rev: row.rev, family: row.family }, { status: 409 });
  const saved = await store.updateTree(id, baseRev, { family }, true);
  if (!saved) { const cur = await store.getTree(id); return NextResponse.json({ conflict: true, rev: cur?.rev, family: cur?.family }, { status: 409 }); }
  store.addRefs(customRefs(family)).catch(() => {});
  return NextResponse.json({ rev: saved.rev });
}
