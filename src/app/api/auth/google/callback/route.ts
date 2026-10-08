import { NextResponse } from "next/server";
import { authEnabled, cookieOptions, readCookie, SESSION_COOKIE, startSession } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { exchangeCode, googleEnabled, NEW_COOKIE, redirectUri, sign, STATE_COOKIE, unsign } from "@/lib/google";
import { safeNextPath } from "@/lib/next-path";
import { clientIp, limited } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Google sends the browser back here with ?code&state. Existing account → signed in. New person → one more step (the agreement). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (why: string) => { const r = NextResponse.redirect(new URL(`/login?error=${why}`, url)); r.cookies.set(STATE_COOKIE, "", { ...cookieOptions(0), maxAge: 0 }); return r; };
  const store = getStore();
  if (!store || !authEnabled() || !googleEnabled()) return fail("google-off");
  if (limited("google-cb", clientIp(req), 40, 60 * 60_000)) return fail("google-busy");
  if (url.searchParams.get("error")) return fail("google-cancelled");

  const st = unsign<{ n: string; next: string }>(url.searchParams.get("state"));
  const nonce = readCookie(req, STATE_COOKIE);
  const code = url.searchParams.get("code");
  if (!st || !nonce || st.n !== nonce || !code) return fail("google-state"); // not a sign-in this browser started
  const g = await exchangeCode(code, redirectUri(req));
  if (!g) return fail("google-failed");

  const next = safeNextPath(st.next);
  const existing = await store.getAccountByEmail(g.email);
  let res: NextResponse;
  if (existing) {
    const token = await startSession(store, existing.id);
    res = NextResponse.redirect(new URL(next, url));
    res.cookies.set(SESSION_COOKIE, token, cookieOptions());
    logEvent("google_signin");
  } else {
    res = NextResponse.redirect(new URL(`/login?google=1&next=${encodeURIComponent(next)}`, url));
    res.cookies.set(NEW_COOKIE, sign({ email: g.email, name: g.name }, 20), { ...cookieOptions(0), maxAge: 20 * 60 });
  }
  res.cookies.set(STATE_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return res;
}
