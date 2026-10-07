import { NextResponse } from "next/server";
import { sanitizeFamily } from "@/lib/sanitize";
import { getStore, syncAll, treeMeta } from "@/lib/store";
import { accessFor, currentAccount, publicMember } from "@/lib/auth";
import { clientIp, limited } from "@/lib/ratelimit";
import { viewKey, viewState } from "@/lib/view";
import { keepLinks } from "@/lib/connect-server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** signed-in account first, private-link token second */
const access = async (req: Request, row: Parameters<typeof accessFor>[0], token: string | null | undefined) => accessFor(row, await currentAccount(req), token)?.member ?? null;

const publicMembers = (row: { members: Parameters<typeof publicMember>[0][] }) => row.members.map((m) => publicMember(m, true));

/** GET [?k=token][&rev=N] → the tree (or {unchanged:true} when the caller already has rev N) */
export async function GET(req: Request, { params }: Ctx) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Sharing is not set up yet." }, { status: 503 });
  if (limited("tree-read", clientIp(req), 400)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  const url = new URL(req.url);
  const row = await store.getTree(id);
  const me = row && (await access(req, row, url.searchParams.get("k")));
  if (!row || !me) return NextResponse.json({ error: "This link is not valid any more." }, { status: 404 });
  const have = Number(url.searchParams.get("rev"));
  const vs = viewState(row);
  const owner = row.members.find((m) => m.role === "owner");
  const base = { rev: row.rev, role: me.role, discoverable: owner?.discoverable === true, activity: me.role === "owner" ? (owner?.activity ?? []) : undefined, title: row.title, viewOff: vs.off, viewKey: vs.off ? "" : viewKey(row.id, "private", vs.epoch), viewKeyFull: me.role === "owner" && !vs.off ? viewKey(row.id, "full", vs.epoch) : undefined, member: { id: me.id, name: me.name, person_id: me.person_id }, members: me.role === "owner" ? publicMembers(row) : undefined };
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
  const me = row && (await access(req, row, typeof body.k === "string" ? body.k : null));
  if (!row || !me) return NextResponse.json({ error: "This link is not valid any more." }, { status: 404 });
  const family = sanitizeFamily(body.family, { stored: true });
  if (!family || !family.persons.length) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  keepLinks(family, row.family); // links to other trees are written by the server only
  const baseRev = Number(body.baseRev);
  if (baseRev !== row.rev) return NextResponse.json({ conflict: true, rev: row.rev, family: row.family }, { status: 409 });
  const saved = await store.updateTree(id, baseRev, { family, ...treeMeta(family) }, true);
  if (!saved) { const cur = await store.getTree(id); return NextResponse.json({ conflict: true, rev: cur?.rev, family: cur?.family }, { status: 409 }); }
  await syncAll(store, id, family);
  return NextResponse.json({ rev: saved.rev });
}

/** DELETE { k } → owner only: permanently removes the online copy (the device copy stays with the user). */
export async function DELETE(req: Request, { params }: Ctx) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Sharing is not set up yet." }, { status: 503 });
  if (limited("tree-delete", clientIp(req), 20, 60 * 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const row = await store.getTree(id);
  const me = row && (await access(req, row, typeof body.k === "string" ? body.k : null));
  if (!row || !me) return NextResponse.json({ error: "This link is not valid any more." }, { status: 404 });
  if (me.role !== "owner") return NextResponse.json({ error: "Only the owner can delete the tree." }, { status: 403 });
  await store.deleteTree(id);
  return NextResponse.json({ deleted: true });
}
