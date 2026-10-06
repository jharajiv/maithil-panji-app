import { NextResponse } from "next/server";
import { authEnabled, currentAccount, otpProvider } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET → is sign-in available, and who is signed in? */
export async function GET(req: Request) {
  if (!authEnabled()) return NextResponse.json({ enabled: false, account: null });
  const a = await currentAccount(req);
  return NextResponse.json({ enabled: true, dev: otpProvider() === "dev", account: a ? { id: a.id, name: a.name, email: a.email, phone: a.phone } : null });
}
