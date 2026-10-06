import { NextResponse } from "next/server";
import { getStore, hashToken, newMemberId, newToken, type Member, type TreeRow } from "@/lib/store";
import { accessFor, currentAccount, inviteHash, newInviteSecret, normalizePhone, publicMember, type Access } from "@/lib/auth";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
type Edit = (row: TreeRow, me: Access) => Member[] | { error: string; status: number } | { members: Member[]; extra: object };

const list = (members: Member[]) => members.map((m) => publicMember(m, true));

/** member changes do not touch the family, so they retry on a rev clash instead of bumping it */
async function changeMembers(req: Request, id: string, token: string | null, edit: Edit) {
  const store = getStore();
  if (!store) return { error: "Sharing is not set up yet.", status: 503 } as const;
  const account = await currentAccount(req);
  for (let i = 0; i < 4; i++) {
    const row = await store.getTree(id);
    const me = row && accessFor(row, account, token);
    if (!row || !me) return { error: "This link is not valid any more.", status: 404 } as const;
    const next = edit(row, me);
    if (!Array.isArray(next) && "error" in next) return next;
    const members = Array.isArray(next) ? next : next.members;
    const saved = await store.updateTree(id, row.rev, { members }, false);
    if (saved) return { ok: true as const, members, extra: Array.isArray(next) ? {} : next.extra };
  }
  return { error: "Please try again.", status: 409 } as const;
}

/**
 * POST { name, personId?, phone? } (owner only)
 *  - with a mobile number (signed-in owner): creates an invitation. The owner sends the returned link from their own WhatsApp.
 *    The link holds a single-use secret; whoever opens it signs in with their email and joins. Asking again for the same number
 *    issues a fresh link and cancels the old one.
 *  - without (legacy private links only): creates an editor link token, returned once and stored only as a hash.
 */
export async function POST(req: Request, { params }: Ctx) {
  if (limited("invite", clientIp(req), 40, 60 * 60_000)) return NextResponse.json({ error: "Too many invitations. Please try again later." }, { status: 429 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Please give the person’s name." }, { status: 400 });
  const personId = typeof body.personId === "string" ? body.personId.slice(0, 20) : undefined;
  const phone = body.phone === undefined ? undefined : normalizePhone(body.phone);
  if (body.phone !== undefined && !phone) return NextResponse.json({ error: "That mobile number does not look right." }, { status: 400 });
  const token = newToken();
  const secret = newInviteSecret();
  const memberId = newMemberId();
  const now = new Date().toISOString();

  const res = await changeMembers(req, id, typeof body.k === "string" ? body.k : null, (row, me) => {
    if (me.member.role !== "owner") return { error: "Only the owner can do this.", status: 403 };
    if (phone) {
      if (me.via !== "account") return { error: "Please sign in to invite family members.", status: 401 };
      const dup = row.members.find((m) => m.phone === phone && m.status === "invited");
      if (row.members.some((m) => m.phone === phone && m.status !== "invited")) return { error: "Someone with this number already has access to this tree.", status: 400 };
      if (dup) return { members: row.members.map((m) => (m.id === dup.id ? { ...m, name, invite_hash: inviteHash(secret) } : m)), extra: { memberId: dup.id, secret, existing: true } };
      if (row.members.length >= 40) return { error: "That is the maximum number of helpers for one tree.", status: 400 };
      return { members: [...row.members, { id: memberId, name, role: "editor", phone, status: "invited", invite_hash: inviteHash(secret), person_id: personId, created_at: now }], extra: { memberId, secret } };
    }
    if (me.via === "account") return { error: "Please add the mobile number of the person you are inviting.", status: 400 };
    if (row.members.length >= 40) return { error: "That is the maximum number of helpers for one tree.", status: 400 };
    return { members: [...row.members, { id: memberId, name, role: "editor", token_hash: hashToken(token), person_id: personId, created_at: now }], extra: { token, memberId } };
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  const { secret: s, ...extra } = res.extra as { secret?: string };
  return NextResponse.json({ ...extra, ...(s ? { path: `/join/${id}?i=${s}` } : {}), members: list(res.members) });
}

/** DELETE { memberId } → the owner removes someone; anyone else can only remove themselves (leave the tree) */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const res = await changeMembers(req, id, typeof body.k === "string" ? body.k : null, (row, me) => {
    const target = row.members.find((m) => m.id === body.memberId);
    if (!target || target.role === "owner") return { error: "Nothing to remove.", status: 400 };
    if (me.member.role !== "owner" && me.member.id !== target.id) return { error: "Only the owner can do this.", status: 403 };
    return row.members.filter((m) => m.id !== target.id);
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ members: list(res.members) });
}
