import { NextResponse } from "next/server";
import { logEvent } from "@/lib/events";
import { load, mutateTree, noteTo } from "@/lib/connect-server";
import { planCombine, undoCombine, type CombinePlan } from "@/lib/combine";
import { sameStock } from "@/lib/similar";
import type { ConnectRequest, Member, TreeRow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Combine two connected trees — only after the owners have been in touch (an accepted connect request) and in three steps:
 *   1. the owner of the GIVING tree offers it (and agrees that everyone in it, living people included, may be copied into the other tree);
 *   2. the owner of the RECEIVING tree previews what would change, unticks any pair that is not really the same person, and applies;
 *   3. either can be undone by the receiving owner. The giving tree is never changed.
 * GET  ?req=<request id>[&preview=1&x=<their person ids to untick, comma separated>]  → state (and, with preview=1, for the receiver of an offer, what would change)
 * POST { req, action: "offer"(confirm:true) | "withdraw" | "decline" | "apply"(exclude?: string[]) | "undo" }
 */

const setCombine = (members: Member[], reqId: string, combine: ConnectRequest["combine"] | null): Member[] =>
  members.map((m) => (m.role !== "owner" ? m : {
    ...m,
    requests: (m.requests ?? []).map((r) => {
      if (r.id !== reqId) return r;
      const { combine: _c, ...rest } = r; void _c;
      return combine ? { ...rest, combine } : rest;
    }),
  }));
const ownerOf = (row: TreeRow) => row.members.find((m) => m.role === "owner");
const reqOf = (row: TreeRow, id: string) => ownerOf(row)?.requests?.find((r) => r.id === id);
const MAX_LIST = 80;
const cut = <T,>(a: T[], n = MAX_LIST) => a.slice(0, n);

/** what the receiver is shown (no family object, only the summary) */
const summarise = (p: CombinePlan) => ({
  ok: p.ok, reason: p.reason, used: p.used,
  pairs: p.pairs,
  added: cut(p.added), addedCount: p.added.length,
  filled: cut(p.filled), filledCount: p.filled.length,
  conflicts: cut(p.conflicts), conflictCount: p.conflicts.length,
  skippedRelations: p.skippedRelations, leftOut: p.leftOut,
});

async function context(req: Request, id: string, k: string | null, reqId: unknown, bucket: string) {
  const l = await load(req, id, k, bucket, 60);
  if (l instanceof NextResponse) return l;
  if (l.me.role !== "owner") return NextResponse.json({ error: "Only the owner of this tree can combine trees." }, { status: 403 });
  if (typeof reqId !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const mine = reqOf(l.row, reqId);
  if (!mine || mine.status !== "accepted") return NextResponse.json({ error: "You can combine trees only with a family you are connected to." }, { status: 404 });
  const other = await l.store.getTree(mine.tree);
  const theirs = other ? reqOf(other, reqId) : undefined;
  if (!other || !theirs || theirs.status !== "accepted") return NextResponse.json({ error: "The other tree is not available any more." }, { status: 404 });
  return { ...l, mine, other, theirs };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = new URL(req.url);
  const c = await context(req, id, u.searchParams.get("k"), u.searchParams.get("req"), "tree-combine-read");
  if (c instanceof NextResponse) return c;
  const { row, other, mine } = c;
  const cb = mine.combine;
  const role = !cb ? null : cb.from === id ? "giver" : "receiver";
  const undo = ownerOf(row)?.combine_undo;
  const base = { combine: cb ?? null, role, canUndo: !!undo && undo.req === mine.id, title: other.title ?? "Family tree" };
  // the preview is for the receiver of a standing offer only (the giver agreed to this when offering)
  if (u.searchParams.get("preview") === "1" && role === "receiver" && cb?.status === "offered" && reqOf(other, mine.id)?.combine?.from === cb.from) {
    if (!sameStock(row.family, other.family)) return NextResponse.json({ ...base, preview: { ok: false, reason: "The gotra or mool of the two trees no longer match, so they cannot be combined.", pairs: [], used: 0, added: [], addedCount: 0, filled: [], filledCount: 0, conflicts: [], conflictCount: 0, skippedRelations: 0, leftOut: 0 } });
    const x = new Set((u.searchParams.get("x") ?? "").split(",").filter(Boolean).slice(0, 500));
    return NextResponse.json({ ...base, preview: summarise(planCombine(row.family, other.family, x)) });
  }
  return NextResponse.json(base);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const c = await context(req, id, typeof body.k === "string" ? body.k : null, body.req, "tree-combine");
  if (c instanceof NextResponse) return c;
  const { store, row, other, mine } = c;
  const reqId = mine.id;
  const myTitle = row.title ?? "Family tree", theirTitle = other.title ?? "Family tree";
  const cb = mine.combine;
  const at = new Date().toISOString();
  const action = body.action;

  const note = (m: Member[], text?: string) => (text ? noteTo(m, text, "Combine") : m);
  /** take the offer off both trees' records (and tell the other owner) */
  const clearBoth = async (noteMine?: string, noteTheirs?: string) => {
    const o = await mutateTree(store, other.id, (r) => ({ members: note(setCombine(r.members, reqId, null), noteTheirs) }));
    const m = await mutateTree(store, id, (r) => ({ members: note(setCombine(r.members, reqId, null), noteMine) }));
    return !!o && !!m;
  };

  if (action === "offer") {
    if (body.confirm !== true) return NextResponse.json({ error: "Please tick the box to agree." }, { status: 400 });
    if (cb) return NextResponse.json({ error: cb.status === "applied" ? "These trees have already been combined." : "An offer to combine is already waiting." }, { status: 409 });
    const offer = { from: id, status: "offered" as const, at };
    const o = await mutateTree(store, other.id, (r) => ({ members: noteTo(setCombine(r.members, reqId, offer), `“${myTitle}” offered to combine its tree into yours. Open Connections to preview it.`, "Combine") }));
    if (!o) return NextResponse.json({ error: "The other tree is busy. Please try again." }, { status: 409 });
    const m = await mutateTree(store, id, (r) => ({ members: setCombine(r.members, reqId, offer) }));
    if (!m) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (action === "withdraw") {
    if (cb?.status !== "offered" || cb.from !== id) return NextResponse.json({ error: "There is no offer of yours to take back." }, { status: 404 });
    await clearBoth(undefined, `“${myTitle}” took back its offer to combine trees.`);
    return NextResponse.json({ ok: true });
  }

  if (action === "decline") {
    if (cb?.status !== "offered" || cb.from === id) return NextResponse.json({ error: "There is no offer to decline." }, { status: 404 });
    await clearBoth(undefined, `“${myTitle}” did not want to combine the trees.`);
    return NextResponse.json({ ok: true });
  }

  if (action === "apply") {
    if (cb?.status !== "offered" || cb.from === id || reqOf(other, reqId)?.combine?.from !== cb.from) return NextResponse.json({ error: "There is no offer to combine." }, { status: 404 });
    const x = new Set(Array.isArray(body.exclude) ? (body.exclude as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 500) : []);
    let plan: CombinePlan | null = null;
    let bad = "";
    const applied = { from: cb.from, status: "applied" as const, at };
    await mutateTree(store, id, (r) => {
      if (!sameStock(r.family, other.family)) { bad = "The gotra or mool of the two trees no longer match."; return null; }
      const p = planCombine(r.family, other.family, x);
      if (!p.ok) { bad = p.reason ?? "These trees cannot be combined."; return null; }
      plan = p;
      const withUndo = r.members.map((m) => (m.role === "owner" ? { ...m, combine_undo: { at, req: reqId, title: theirTitle, delta: p.delta } } : m));
      return { family: p.family, members: note(setCombine(withUndo, reqId, applied), `Combined “${theirTitle}” into this tree: ${p.added.length} people added, ${p.filled.length} blanks filled.`) };
    });
    if (bad || !plan) return NextResponse.json({ error: bad || "The tree changed at the same moment. Please try again." }, { status: bad ? 400 : 409 });
    const done = plan as CombinePlan;
    await mutateTree(store, other.id, (r) => ({ members: noteTo(setCombine(r.members, reqId, applied), `“${myTitle}” combined your tree into theirs (${done.added.length} people added).`, "Combine") }));
    logEvent("tree_combined");
    return NextResponse.json({ ok: true, added: done.added.length, filled: done.filled.length, conflicts: done.conflicts.length });
  }

  if (action === "undo") {
    const undo = ownerOf(row)?.combine_undo;
    if (!undo || undo.req !== reqId) return NextResponse.json({ error: "There is nothing to undo." }, { status: 404 });
    const r1 = await mutateTree(store, id, (r) => ({
      family: undoCombine(r.family, undo.delta),
      members: r.members.map((m) => { if (m.role !== "owner") return m; const { combine_undo: _u, ...rest } = m; void _u; return rest; }),
    }));
    if (!r1) return NextResponse.json({ error: "The tree changed at the same moment. Please try again." }, { status: 409 });
    await clearBoth(`Took back the combine with “${theirTitle}”.`, `“${myTitle}” took back the combine with your tree.`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
