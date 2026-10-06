import { NextResponse } from "next/server";
import { authEnabled, DEV_CODE, normalizeEmail, otpProvider, sendLoginCode } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST { email } → emails a one-time code. The response says whether this address still needs a profile (name + mobile + consent). */
export async function POST(req: Request) {
  const store = getStore();
  if (!store || !authEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (limited("otp-ip", clientIp(req), 30, 60 * 60_000) || limited("otp-email", email, 5, 30 * 60_000))
    return NextResponse.json({ error: "Too many attempts. Please wait a little and try again." }, { status: 429 });
  const sent = await sendLoginCode(store, email);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
  const isNew = !(await store.getAccountByEmail(email));
  return NextResponse.json({ ok: true, isNew, email, ...(otpProvider() === "dev" ? { devCode: DEV_CODE } : {}) });
}
