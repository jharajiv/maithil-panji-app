import { NextResponse } from "next/server";
import { sanitizeFamily } from "@/lib/sanitize";
import { customRefs, getStore, hashToken, newMemberId, newToken, newTreeId } from "@/lib/store";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** GET → is sharing available on this deployment? */
export async function GET() {
  return NextResponse.json({ enabled: !!getStore() });
}

/** POST { family, ownerName } → create a shared tree; the response holds the owner's private token (shown once). */
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
  const token = newToken();
  const id = newTreeId();
  const now = new Date().toISOString();
  await store.createTree({
    id, family, rev: 1, updated_at: now,
    members: [{ id: newMemberId(), name: name || "Owner", role: "owner", token_hash: hashToken(token), person_id: family.persons.find((p) => p.is_me)?.id, created_at: now }],
  });
  store.addRefs(customRefs(family)).catch(() => {});
  return NextResponse.json({ id, token, rev: 1 });
}
