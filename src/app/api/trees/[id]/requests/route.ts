import { NextResponse } from "next/server";
import { logEvent } from "@/lib/events";
import { load, mutateTree } from "@/lib/connect-server";
import { checkSimilar } from "@/lib/similar-server";
import { profileForOwner } from "@/lib/profile";
import type { ConnectRequest, Member, Store, TreeRow } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_KEPT = 40;
const DAY = 86_400_000;
const withRequest = (members: Member[], r: ConnectRequest, note?: string): Member[] =>
  members.map((m) => (m.role !== "owner" ? m : {
    ...m,
    requests: [...(m.requests ?? []).filter((x) => x.id !== r.id), r].slice(-MAX_KEPT),
    ...(note ? { activity: [...(m.activity ?? []), { at: new Date().toISOString(), by: "Connect", text: note.slice(0, 200) }].slice(-30) } : {}),
  }));
const setStatus = (members: Member[], id: string, status: ConnectRequest["status"], who?: ConnectRequest["who"], note?: string): Member[] =>
  members.map((m) => (m.role !== "owner" ? m : {
    ...m,
    requests: (m.requests ?? []).map((x) => (x.id === id ? { ...x, status, ...(who ? { who } : {}) } : x)),
    ...(note ? { activity: [...(m.activity ?? []), { at: new Date().toISOString(), by: "Connect", text: note.slice(0, 200) }].slice(-30) } : {}),
  }));

/** the signed-in owner's own details, to show to the other owner (contact details only because they ticked "share" for this request) */
async function ownerCard(store: Store, me: Member) {
  const a = me.account_id ? await store.getAccount(me.account_id) : null;
  if (!a) return null;
  return a.phone ? profileForOwner(a.name, a.phone, a.email, a.profile, true) : "no-phone" as const;
}

/** GET [?k=] → the owner's requests (sent and received). Helpers see none. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await load(req, id, new URL(req.url).searchParams.get("k"), "tree-requests", 120);
  if (l instanceof NextResponse) return l;
  if (l.me.role !== "owner") return NextResponse.json({ requests: [] });
  const owner = l.row.members.find((m) => m.role === "owner");
  return NextResponse.json({ requests: [...(owner?.requests ?? [])].sort((a, b) => b.at.localeCompare(a.at)) });
}

/** POST { k?, to, message?, share: true } — the owner asks the owner of a similar tree to get in touch */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const l = await load(req, id, typeof body.k === "string" ? body.k : null, "tree-request-send", 20);
  if (l instanceof NextResponse) return l;
  if (l.me.role !== "owner") return NextResponse.json({ error: "Only the owner of this tree can contact another family." }, { status: 403 });
  if (typeof body.to !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (body.share !== true) return NextResponse.json({ error: "To be contacted, your mobile number and email must be shared with that owner. Please tick the box." }, { status: 400 });
  const card = await ownerCard(l.store, l.me);
  if (!card) return NextResponse.json({ error: "Please sign in with your account to contact another family." }, { status: 403 });
  if (card === "no-phone") return NextResponse.json({ error: "Please add your mobile number in My profile first, so the other owner can reach you.", needsPhone: true }, { status: 400 });

  const sim = await checkSimilar(l.store, l.row, body.to);
  if (!sim) return NextResponse.json({ error: "This tree is not available any more." }, { status: 404 });
  const mineOwner = l.row.members.find((m) => m.role === "owner")!;
  const prior = (mineOwner.requests ?? []).filter((r) => r.tree === sim.other.id);
  const blocked = prior.find((r) => r.status === "pending" || r.status === "accepted" || (r.status === "declined" && Date.now() - new Date(r.at).getTime() < 30 * DAY));
  if (blocked) return NextResponse.json({ error: blocked.status === "accepted" ? "You are already connected with this family." : blocked.status === "pending" ? "A request is already waiting for this family." : "This family declined recently. Please try again after a few weeks." }, { status: 409 });
  if ((mineOwner.requests ?? []).filter((r) => r.dir === "out" && r.status === "pending").length >= 10) return NextResponse.json({ error: "You already have 10 requests waiting." }, { status: 429 });

  const rid = Math.random().toString(36).slice(2, 10);
  const at = new Date().toISOString();
  const message = typeof body.message === "string" ? body.message.replace(/[<>]/g, "").trim().slice(0, 300) : "";
  const myTitle = l.row.title ?? "Family tree";
  const incoming: ConnectRequest = { id: rid, dir: "in", tree: id, title: myTitle, percent: sim.match.percent, ...(message ? { message } : {}), at, status: "pending", who: card };
  const theirs = await mutateTree(l.store, sim.other.id, (r: TreeRow) => ({ members: withRequest(r.members, incoming, `“${myTitle}” asked to connect with this tree — it looks ${sim.match.percent}% similar.`) }));
  if (!theirs) return NextResponse.json({ error: "The other tree is busy. Please try again." }, { status: 409 });
  const outgoing: ConnectRequest = { id: rid, dir: "out", tree: sim.other.id, title: sim.other.title ?? "Family tree", percent: sim.match.percent, ...(message ? { message } : {}), at, status: "pending" };
  const mine = await mutateTree(l.store, id, (r: TreeRow) => ({ members: withRequest(r.members, outgoing) }));
  if (!mine) return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 409 });
  logEvent("tree_connect_requested");
  return NextResponse.json({ ok: true, id: rid });
}

/** PATCH { k?, id, action: "accept" | "decline", share?: true } — the owner answers a received request. Accepting shares their contact details back. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const l = await load(req, id, typeof body.k === "string" ? body.k : null, "tree-request-answer", 40);
  if (l instanceof NextResponse) return l;
  if (l.me.role !== "owner") return NextResponse.json({ error: "Only the owner of this tree can answer." }, { status: 403 });
  if (typeof body.id !== "string" || (body.action !== "accept" && body.action !== "decline")) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const mineOwner = l.row.members.find((m) => m.role === "owner")!;
  const r = (mineOwner.requests ?? []).find((x) => x.id === body.id && x.dir === "in");
  if (!r) return NextResponse.json({ error: "This request is not available any more." }, { status: 404 });
  if (r.status !== "pending") return NextResponse.json({ ok: true, already: true, status: r.status });

  let card: Awaited<ReturnType<typeof ownerCard>> = null;
  if (body.action === "accept") {
    if (body.share !== true) return NextResponse.json({ error: "To accept, your mobile number and email are shared with that owner. Please tick the box." }, { status: 400 });
    card = await ownerCard(l.store, l.me);
    if (!card) return NextResponse.json({ error: "Please sign in with your account." }, { status: 403 });
    if (card === "no-phone") return NextResponse.json({ error: "Please add your mobile number in My profile first.", needsPhone: true }, { status: 400 });
  }
  const accepted = body.action === "accept";
  const myTitle = l.row.title ?? "Family tree";
  const other = await mutateTree(l.store, r.tree, (row: TreeRow) => ({
    members: setStatus(row.members, r.id, accepted ? "accepted" : "declined", accepted && card ? card : undefined, accepted ? `“${myTitle}” accepted your request. Their contact details are in Connections.` : `“${myTitle}” did not accept the request.`),
  }));
  if (!other) return NextResponse.json({ error: "The other tree is busy. Please try again." }, { status: 409 });
  const mine = await mutateTree(l.store, id, (row: TreeRow) => ({ members: setStatus(row.members, r.id, accepted ? "accepted" : "declined") }));
  if (!mine) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 409 });
  if (accepted) logEvent("tree_connect_accepted");
  return NextResponse.json({ ok: true, status: accepted ? "accepted" : "declined" });
}
