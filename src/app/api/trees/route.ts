import { NextResponse } from "next/server";
import { sanitizeFamily } from "@/lib/sanitize";
import { getStore, hashToken, newMemberId, newToken, newTreeId, syncAll, treeMeta } from "@/lib/store";
import { authEnabled, currentAccount } from "@/lib/auth";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** GET → is sharing available on this deployment? */
export async function GET() {
  return NextResponse.json({ enabled: !!getStore() });
}

/**
 * POST { family, ownerName } → create a shared tree.
 *  - signed in: the tree belongs to the account; no link or token is needed ({ id, rev }).
 *  - not signed in (only possible while accounts are switched off): the response holds the owner's private token, shown once.
 */
export async function POST(req: Request) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Sharing is not set up yet." }, { status: 503 });
  if (limited("tree-create", clientIp(req), 10, 60 * 60_000)) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  const text = await req.text();
  if (text.length > 3_000_000) return NextResponse.json({ error: "Tree is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const family = sanitizeFamily(body.family, { stored: true });
  if (!family || !family.persons.length) return NextResponse.json({ error: "Add at least yourself to the tree first." }, { status: 400 });
  const name = typeof body.ownerName === "string" ? body.ownerName.trim().slice(0, 80) : "";
  const account = await currentAccount(req);
  if (!account && authEnabled()) return NextResponse.json({ error: "Please sign in to save your tree." }, { status: 401 });
  const id = newTreeId();
  const now = new Date().toISOString();
  const memberId = newMemberId();
  const personId = family.persons.find((p) => p.is_me)?.id;
  if (account) {
    await store.createTree({
      id, family, rev: 1, updated_at: now, ...treeMeta(family),
      members: [{ id: memberId, name: account.name, role: "owner", account_id: account.id, email: account.email, phone: account.phone, status: "joined", person_id: personId, created_at: now }],
    });
    await syncAll(store, id, family);
    return NextResponse.json({ id, rev: 1 });
  }
  const token = newToken();
  await store.createTree({
    id, family, rev: 1, updated_at: now, ...treeMeta(family),
    members: [{ id: memberId, name: name || "Owner", role: "owner", token_hash: hashToken(token), person_id: personId, created_at: now }],
  });
  await store.addConsent({ tree_id: id, member_id: memberId, kind: "share-and-store", version: typeof body.consentVersion === "string" ? body.consentVersion.slice(0, 20) : "v1", given_at: now }).catch(() => {});
  await syncAll(store, id, family);
  return NextResponse.json({ id, token, rev: 1 });
}
