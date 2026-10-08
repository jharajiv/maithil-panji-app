import { NextResponse } from "next/server";
import { authEnabled, cookieOptions } from "@/lib/auth";
import { safeNextPath } from "@/lib/next-path";
import { GOOGLE_AUTH_URL, googleEnabled, newNonce, redirectUri, sign, STATE_COOKIE } from "@/lib/google";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET ?next=/app → sends the browser to Google's sign-in page */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authEnabled() || !googleEnabled()) return NextResponse.redirect(new URL("/login?error=google-off", url));
  if (limited("google-start", clientIp(req), 40, 60 * 60_000)) return NextResponse.redirect(new URL("/login?error=google-busy", url));
  const nonce = newNonce();
  const state = sign({ n: nonce, next: safeNextPath(url.searchParams.get("next")) }, 15);
  const to = new URL(GOOGLE_AUTH_URL());
  to.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  to.searchParams.set("redirect_uri", redirectUri(req));
  to.searchParams.set("response_type", "code");
  to.searchParams.set("scope", "openid email profile");
  to.searchParams.set("state", state);
  to.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(to);
  res.cookies.set(STATE_COOKIE, nonce, { ...cookieOptions(0), maxAge: 15 * 60 }); // lax: it must come back with Google's redirect
  return res;
}
