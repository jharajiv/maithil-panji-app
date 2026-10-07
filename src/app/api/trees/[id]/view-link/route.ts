import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { accessFor, currentAccount } from "@/lib/auth";
import { clientIp, limited } from "@/lib/ratelimit";
import { viewState } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * POST { k?, action: "stop" | "renew" | "start" } — owner only.
 *  stop  → every view-only link and printed QR code for this tree stops working (the tree itself is untouched)
 *  renew → all earlier view-only links stop working, and new ones are made
 *  start → switch view-only links back on (they are the same links as before the last "stop")
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Sharing is not set up yet." }, { status: 503 });
  if (limited("tree-viewlink", clientIp(req), 30, 60 * 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const row = await store.getTree(id);
  const me = row && accessFor(row, await currentAccount(req), typeof body.k === "string" ? body.k : null)?.member;
  if (!row || !me) return NextResponse.json({ error: "This link is not valid any more." }, { status: 404 });
  if (me.role !== "owner") return NextResponse.json({ error: "Only the owner can change the view links." }, { status: 403 });
  const st = viewState(row);
  const action = body.action;
  let next: { epoch: number; off: boolean };
  if (action === "stop") next = { epoch: st.epoch, off: true };
  else if (action === "start") next = { epoch: st.epoch, off: false };
  else if (action === "renew") next = { epoch: st.epoch + 1, off: false };
  else return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const members = row.members.map((m) => (m.role === "owner" ? { ...m, view_epoch: next.epoch, view_off: next.off } : m));
  const saved = await store.updateTree(id, row.rev, { members }, false);
  if (!saved) return NextResponse.json({ error: "The tree changed at the same moment. Please try again." }, { status: 409 });
  return NextResponse.json({ ok: true, off: next.off });
}
