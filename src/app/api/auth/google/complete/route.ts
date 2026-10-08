import { NextResponse } from "next/server";
import { authEnabled, cookieOptions, findOrCreateAccount, normalizePhone, readCookie, SESSION_COOKIE, startSession } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { googleEnabled, NEW_COOKIE, unsign } from "@/lib/google";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const CONSENT_VERSION = "v1";

/** POST { consent: true, name?, phone? } — a new person who came back from Google ticks the agreement and the account is created. The mobile number is optional here. */
export async function POST(req: Request) {
  const store = getStore();
  if (!store || !authEnabled() || !googleEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const pending = unsign<{ email: string; name: string }>(readCookie(req, NEW_COOKIE));
  if (!pending) return NextResponse.json({ error: "Your Google sign-in has timed out. Please start again.", expired: true }, { status: 400 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  if (body.consent !== true) return NextResponse.json({ error: "Please tick the agreement to create your account." }, { status: 400 });
  const name = (typeof body.name === "string" && body.name.trim()) || pending.name;
  const phone = typeof body.phone === "string" && body.phone.trim() ? normalizePhone(body.phone) : undefined;
  if (typeof body.phone === "string" && body.phone.trim() && !phone) return NextResponse.json({ error: "That mobile number does not look right." }, { status: 400 });
  const { account, created } = await findOrCreateAccount(store, pending.email, name, phone ?? undefined, CONSENT_VERSION);
  if (created) await store.addConsent({ tree_id: "", member_id: account.id, kind: "account-terms", version: CONSENT_VERSION, given_at: new Date().toISOString() }).catch(() => {});
  const token = await startSession(store, account.id);
  logEvent("google_signin");
  const res = NextResponse.json({ account: { id: account.id, name: account.name, email: account.email, phone: account.phone } });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  res.cookies.set(NEW_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return res;
}
