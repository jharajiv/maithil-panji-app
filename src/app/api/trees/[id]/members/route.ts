import { NextResponse } from "next/server";
import { authorize, getStore, hashToken, newMemberId, newToken, type Member, type TreeRow } from "@/lib/store";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** member changes do not touch the family, so they retry on a rev clash instead of bumping it */
async function changeMembers(id: string, token: string | null, edit: (row: TreeRow) => Member[] | { error: string; status: number }) {
  const store = getStore();
  if (!store) return { error: "Sharing is not set up yet.", status: 503 } as const;
  for (let i = 0; i < 4; i++) {
    const row = await store.getTree(id);
    const me = row && authorize(row, token);
    if (!row || !me) return { error: "This link is not valid any more.", status: 404 } as const;
    if (me.role !== "owner") return { error: "Only the owner can do this.", status: 403 } as const;
    const next = edit(row);
    if (!Array.isArray(next)) return next;
    const saved = await store.updateTree(id, row.rev, { members: next }, false);
    if (saved) return { ok: true as const, members: next };
  }
  return { error: "Please try again.", status: 409 } as const;
}

/** POST { k, name, personId } → create an editor link. The new token is returned once and stored only as a hash. */
export async function POST(req: Request, { params }: Ctx) {
  if (limited("invite", clientIp(req), 40, 60 * 60_000)) return NextResponse.json({ error: "Too many invitations. Please try again later." }, { status: 429 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Please give the person’s name." }, { status: 400 });
  const token = newToken();
  const memberId = newMemberId();
  const res = await changeMembers(id, typeof body.k === "string" ? body.k : null, (row) => {
    if (row.members.length >= 40) return { error: "That is the maximum number of helpers for one tree.", status: 400 };
    return [...row.members, { id: memberId, name, role: "editor", token_hash: hashToken(token), person_id: typeof body.personId === "string" ? body.personId.slice(0, 20) : undefined, created_at: new Date().toISOString() }];
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ token, memberId, members: res.members.map(({ token_hash: _t, ...m }) => m) }); // eslint-disable-line @typescript-eslint/no-unused-vars
}

/** DELETE { k, memberId } → revoke an editor link */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const res = await changeMembers(id, typeof body.k === "string" ? body.k : null, (row) => {
    const target = row.members.find((m) => m.id === body.memberId);
    if (!target || target.role === "owner") return { error: "Nothing to remove.", status: 400 };
    return row.members.filter((m) => m.id !== target.id);
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ members: res.members.map(({ token_hash: _t, ...m }) => m) }); // eslint-disable-line @typescript-eslint/no-unused-vars
}
