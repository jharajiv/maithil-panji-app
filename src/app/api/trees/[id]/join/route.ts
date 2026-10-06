import { NextResponse } from "next/server";
import { getStore, hashToken, type Member } from "@/lib/store";
import { authEnabled, currentAccount, inviteHash } from "@/lib/auth";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** GET ?i=<invitation secret> → what the invitation page shows before sign-in. Only a valid, unused invitation answers. */
export async function GET(req: Request, { params }: Ctx) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Not available." }, { status: 503 });
  if (limited("join-preview", clientIp(req), 60)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const i = new URL(req.url).searchParams.get("i");
  const row = await store.getTree((await params).id);
  const inv = row && i ? row.members.find((m) => m.status === "invited" && m.invite_hash === inviteHash(i)) : undefined;
  if (!row || !inv) return NextResponse.json({ error: "This invitation is not valid any more." }, { status: 404 });
  return NextResponse.json({ title: row.title ?? "Family tree", owner: row.members.find((m) => m.role === "owner")?.name ?? "", inviteName: inv.name, invitePhone: inv.phone });
}

/**
 * POST { i? , k? } (signed in) → accept an invitation (its secret `i` is the proof, and it works once), or — with a legacy
 * private link token `k` — move that link's access into the account.
 */
export async function POST(req: Request, { params }: Ctx) {
  const store = getStore();
  if (!store || !authEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const account = await currentAccount(req);
  if (!account) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (limited("join", `${account.id}|${clientIp(req)}`, 30, 60 * 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const secret = typeof body.i === "string" ? body.i : null;
  const token = typeof body.k === "string" ? body.k : null;

  for (let n = 0; n < 4; n++) {
    const row = await store.getTree(id);
    if (!row) return NextResponse.json({ error: "This invitation is not valid any more." }, { status: 404 });
    if (row.members.some((m) => m.account_id === account.id && m.status !== "invited")) return NextResponse.json({ ok: true, treeId: id, already: true });
    const byToken = token ? row.members.find((m) => m.token_hash === hashToken(token)) : undefined;
    const byInvite = secret ? row.members.find((m) => m.status === "invited" && m.invite_hash === inviteHash(secret)) : undefined;
    const target = byToken ?? byInvite;
    if (!target) return NextResponse.json({ error: "This invitation has already been used or is no longer valid. Please ask the person who invited you to send a new one." }, { status: 403 });
    const members: Member[] = row.members.map((m) => {
      if (m.id !== target.id) return m;
      const { invite_hash: _gone, ...rest } = m; // eslint-disable-line @typescript-eslint/no-unused-vars
      return { ...rest, account_id: account.id, email: account.email, status: "joined" as const };
    });
    if (await store.updateTree(id, row.rev, { members }, false)) return NextResponse.json({ ok: true, treeId: id });
  }
  return NextResponse.json({ error: "Please try again." }, { status: 409 });
}
