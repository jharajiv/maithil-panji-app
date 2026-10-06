import { NextResponse } from "next/server";
import { authEnabled, checkLoginCode, cookieOptions, findOrCreateAccount, normalizeEmail, normalizePhone, SESSION_COOKIE, startSession } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const CONSENT_VERSION = "v1";

/** POST { email, code, name?, phone?, consent? } → signs the browser in (and creates the account on first sign-in). */
export async function POST(req: Request) {
  const store = getStore();
  if (!store || !authEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!email || code.length < 4 || code.length > 10) return NextResponse.json({ error: "Please enter the code from your email." }, { status: 400 });
  if (limited("otp-check", `${email}|${clientIp(req)}`, 12, 30 * 60_000)) return NextResponse.json({ error: "Too many attempts. Please wait a little and try again." }, { status: 429 });

  const existing = await store.getAccountByEmail(email);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = normalizePhone(body.phone) ?? undefined;
  if (!existing) {
    if (!name || !phone || body.consent !== true)
      return NextResponse.json({ error: "Please add your name and mobile number, and tick the agreement, to create your account.", needsProfile: true }, { status: 400 });
  }
  if (!(await checkLoginCode(store, email, code))) return NextResponse.json({ error: "That code is not right, or it has expired. Please try again." }, { status: 401 });

  const { account, created } = await findOrCreateAccount(store, email, name, phone, CONSENT_VERSION);
  if (created) await store.addConsent({ tree_id: "", member_id: account.id, kind: "account-terms", version: CONSENT_VERSION, given_at: new Date().toISOString() }).catch(() => {});
  const token = await startSession(store, account.id);
  const res = NextResponse.json({ account: { id: account.id, name: account.name, email: account.email, phone: account.phone } });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return res;
}
