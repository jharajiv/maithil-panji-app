/**
 * "Continue with Google" — the OAuth 2.0 authorization-code flow, done on the server.
 *  - Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Google Cloud console → APIs & Services → Credentials → OAuth client ID, "Web application")
 *    and add  https://<your-domain>/api/auth/google/callback  as an authorised redirect URI (once per address the site is served from).
 *  - We ask only for the email address and name (scopes: openid email profile). Google tells us the address is verified; that is the same
 *    proof the emailed code gives, so a person who already has an account with that email lands in the same account.
 *  - A new person still ticks the agreement before an account is made (nothing is created on Google's say-so alone).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const googleEnabled = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
const dev = () => process.env.NODE_ENV !== "production";
/** the endpoints can be pointed at a test server — in development only */
export const GOOGLE_AUTH_URL = () => (dev() && process.env.GOOGLE_AUTH_URL) || "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = () => (dev() && process.env.GOOGLE_TOKEN_URL) || "https://oauth2.googleapis.com/token";

export const STATE_COOKIE = "pj_gstate";
export const NEW_COOKIE = "pj_gnew";

/** the address this request was made to, e.g. https://www.example.com — must match what is registered with Google */
export function originOf(req: Request): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site && /^https?:\/\//.test(site)) return site;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
export const redirectUri = (req: Request) => `${originOf(req)}/api/auth/google/callback`;

const secret = () => process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET || "dev-secret";
const sig = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

/** a small signed, expiring token (used for the state cookie and the "new person, agreement still to tick" cookie) */
export function sign(data: Record<string, unknown>, minutes: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + minutes * 60_000 })).toString("base64url");
  return `${body}.${sig(body)}`;
}
export function unsign<T extends Record<string, unknown>>(token: string | null | undefined): T | null {
  if (!token) return null;
  const [body, s] = token.split(".");
  if (!body || !s) return null;
  const want = Buffer.from(sig(body)), got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    return typeof d.exp === "number" && d.exp > Date.now() ? d : null;
  } catch { return null; }
}
export const newNonce = () => randomBytes(16).toString("base64url");

export interface GoogleUser { email: string; name: string }

/** swap the one-time code for the person's verified email and name; null when anything about it is not right */
export async function exchangeCode(code: string, redirect: string): Promise<GoogleUser | null> {
  const id = process.env.GOOGLE_CLIENT_ID!, key = process.env.GOOGLE_CLIENT_SECRET!;
  const res = await fetch(GOOGLE_TOKEN_URL(), {
    method: "POST", cache: "no-store",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: key, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  if (!res.ok) { console.error("google token exchange failed", res.status); return null; }
  const tok = (await res.json().catch(() => null)) as { id_token?: string } | null;
  // the id_token arrives straight from Google's token endpoint over TLS, so its contents can be trusted without checking the signature again
  const part = tok?.id_token?.split(".")[1];
  if (!part) return null;
  let c: { iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean | string; name?: string; given_name?: string };
  try { c = JSON.parse(Buffer.from(part, "base64url").toString("utf8")); } catch { return null; }
  const verified = c.email_verified === true || c.email_verified === "true";
  if (!["accounts.google.com", "https://accounts.google.com"].includes(c.iss ?? "") || c.aud !== id || !c.exp || c.exp * 1000 < Date.now() || !verified || !c.email) return null;
  return { email: c.email.toLowerCase(), name: (c.name || c.given_name || c.email.split("@")[0]!).slice(0, 80) };
}
