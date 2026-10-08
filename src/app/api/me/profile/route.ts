import { NextResponse } from "next/server";
import { authEnabled, currentAccount, normalizePhone } from "@/lib/auth";
import { cleanProfile, completeness } from "@/lib/profile";
import { getStore } from "@/lib/store";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** gotra and mool as recorded for the signed-in person in the trees they own (they are asked once, in the tree) */
async function stockOf(accountId: string) {
  const store = getStore()!;
  for (const t of (await store.listTreesFor(accountId)).slice(0, 5)) {
    const me = t.members.find((m) => m.account_id === accountId);
    if (me?.role !== "owner") continue;
    const row = await store.getTree(t.id);
    const root = row?.family.persons.find((p) => p.is_me);
    if (root?.gotra || root?.mool) return { gotra: root.gotra?.roman, mool: root.mool?.roman, tree: t.id };
  }
  return {};
}

const shape = (a: { name: string; email: string; phone?: string; profile?: unknown }) => {
  const profile = cleanProfile(a.profile);
  return { account: { name: a.name, email: a.email, phone: a.phone ?? "" }, profile, complete: completeness(profile, !!a.phone) };
};

/** GET → the profile, the account's name / mobile / email, and gotra + mool from their tree */
export async function GET(req: Request) {
  if (!authEnabled() || !getStore()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const a = await currentAccount(req);
  if (!a) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ ...shape(a), stock: await stockOf(a.id) });
}

/** PUT { name?, phone?, profile } → saves. An empty phone removes the number. */
export async function PUT(req: Request) {
  const store = getStore();
  if (!store || !authEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const a = await currentAccount(req);
  if (!a) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (limited("profile-save", clientIp(req), 60, 60 * 60_000)) return NextResponse.json({ error: "Too many changes. Please wait a little." }, { status: 429 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const patch: { name?: string; phone?: string | null; profile?: ReturnType<typeof cleanProfile> } = {};
  if (typeof body.name === "string") {
    const n = body.name.replace(/[<>]/g, "").trim().slice(0, 80);
    if (!n) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    patch.name = n;
  }
  if (typeof body.phone === "string") {
    if (!body.phone.trim()) patch.phone = null;
    else { const p = normalizePhone(body.phone); if (!p) return NextResponse.json({ error: "That mobile number does not look right." }, { status: 400 }); patch.phone = p; }
  }
  if (body.profile !== undefined) patch.profile = cleanProfile(body.profile);
  const next = await store.updateAccount(a.id, patch);
  if (!next) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true, ...shape(next), stock: await stockOf(a.id) });
}
