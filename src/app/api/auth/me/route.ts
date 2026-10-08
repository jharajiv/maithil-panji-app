import { NextResponse } from "next/server";
import { authEnabled, currentAccount, emailLoginEnabled, otpProvider, readCookie } from "@/lib/auth";
import { googleEnabled, NEW_COOKIE, unsign } from "@/lib/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET → is sign-in available (and by which ways), and who is signed in? */
export async function GET(req: Request) {
  if (!authEnabled()) return NextResponse.json({ enabled: false, account: null });
  const a = await currentAccount(req);
  const google = googleEnabled();
  const pending = !a && google ? unsign<{ email: string; name: string }>(readCookie(req, NEW_COOKIE)) : null;
  return NextResponse.json({
    enabled: true, dev: otpProvider() === "dev", google, email: emailLoginEnabled(),
    pending: pending ? { name: pending.name, email: pending.email } : null,
    account: a ? { id: a.id, name: a.name, email: a.email, phone: a.phone } : null,
  });
}
