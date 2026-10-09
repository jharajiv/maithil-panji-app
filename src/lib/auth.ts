/**
 * Accounts = an email address proven with a one-time code. No passwords.
 *  - Production: the code is emailed through Resend — set RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend).
 *  - Development (NODE_ENV != production): a fixed code (123456) so the whole flow can be tried without sending anything.
 *  - Production without Resend: accounts are switched off and the app keeps its device-only guest mode.
 * A mobile number is collected at sign-up (needed for WhatsApp invitations) but is NOT verified — only the email is.
 * A signed-in browser holds an opaque random token in an httpOnly cookie; only its SHA-256 hash is stored.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { googleEnabled } from "./google";
import { getStore, hashToken, newAccountId, type AccountRow, type Member, type Store, type TreeRow } from "./store";

export const SESSION_COOKIE = "pj_session";
export const SESSION_DAYS = 180;
export const DEV_CODE = "123456";
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 6;

const resend = () => {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  return key && from ? { key, from } : null;
};

export const otpProvider = (): "resend" | "dev" | null => (resend() ? "resend" : process.env.NODE_ENV !== "production" ? "dev" : null);
/**
 * Tester list: friends you approve can sign in WITHOUT an email. Set TEST_LOGIN_EMAILS (comma separated) and TEST_LOGIN_CODE
 * (6–10 digits; 8 or more is better) and hand the code to each person yourself. Everyone else still gets a normal email code.
 */
const testerCode = () => { const c = (process.env.TEST_LOGIN_CODE ?? "").trim(); return /^\d{6,10}$/.test(c) ? c : null; };
const testerEmails = () => new Set((process.env.TEST_LOGIN_EMAILS ?? "").split(/[,;\s]+/).map((e) => normalizeEmail(e)).filter((e): e is string => !!e));
export const isTester = (email: string) => !!testerCode() && testerEmails().has(email);

/** can people sign in with an emailed code (or the tester code)? false when Google is the only way in */
export const emailLoginEnabled = () => !!otpProvider() || !!testerCode();

/** AUTH_OFF=1 switches accounts off (used to test the guest/private-link flow) */
export const authEnabled = () => !process.env.AUTH_OFF && !!getStore() && (!!otpProvider() || !!testerCode() || googleEnabled());

/** any way of typing an email → lower-case address, or null when it cannot be one */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/.test(e) ? e : null;
}
export const maskEmail = (e: string) => { const [u = "", d = ""] = e.split("@"); return `${u.slice(0, 1)}${"•".repeat(Math.min(5, Math.max(2, u.length - 1)))}@${d}`; };

/** a mobile number in any common format → E.164 ("+919876543210"), or null (the number is not verified — only checked for shape) */
export function normalizePhone(raw: unknown, defaultCountry: "IN" = "IN"): string | null {
  if (typeof raw !== "string" || raw.length > 30) return null;
  const p = parsePhoneNumberFromString(raw.trim(), defaultCountry);
  return p?.isValid() ? p.number : null;
}
export const maskPhone = (e164: string) => `${e164.slice(0, 3)} ••••• ${e164.slice(-3)}`;

const codeHash = (email: string, code: string) => createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}|${email}|${code}`).digest("hex");

async function sendEmail(to: string, code: string): Promise<boolean> {
  const r = resend()!;
  const html = `<div style="font-family:Georgia,serif;max-width:420px;margin:auto;padding:24px;color:#1f2a5c">
<p style="letter-spacing:.2em;font-size:12px;color:#b5482a;margin:0 0 12px">PAAG FOUNDATION</p>
<p style="font-size:16px;margin:0 0 8px">Your sign-in code is</p>
<p style="font-size:34px;letter-spacing:.35em;font-weight:bold;margin:0 0 16px">${code}</p>
<p style="font-size:14px;color:#555;margin:0">It works for ${CODE_MINUTES} minutes. If you did not ask for it, you can ignore this email.</p>
<p style="font-size:12px;color:#888;margin:16px 0 0">PAAG Foundation (Panji Ancestry &amp; Graph) · paag.org.in</p></div>`;
  const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST", cache: "no-store",
    headers: { Authorization: `Bearer ${r.key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: r.from, to: [to], subject: `Your PAAG Foundation sign-in code: ${code}`, html, text: `Your PAAG Foundation sign-in code is ${code}. It works for ${CODE_MINUTES} minutes.` }),
  });
  if (!res.ok) console.error("email send failed", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

export async function sendLoginCode(store: Store, email: string): Promise<{ ok: boolean; error?: string; tester?: boolean }> {
  if (isTester(email)) return { ok: true, tester: true }; // approved tester: no email, they use the access code they were given
  const prov = otpProvider();
  if (!prov) return { ok: false, error: "Sign-in is not switched on yet." };
  const code = prov === "dev" ? DEV_CODE : String(randomInt(0, 1_000_000)).padStart(6, "0");
  await store.putLoginCode({ email, code_hash: codeHash(email, code), expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), attempts: 0 });
  if (prov === "dev") return { ok: true };
  return (await sendEmail(email, code)) ? { ok: true } : { ok: false, error: "We could not send the email. Please check the address and try again." };
}

/** true once, for the right unexpired code; the code is used up on success and after too many wrong guesses */
export async function checkLoginCode(store: Store, email: string, code: string): Promise<boolean> {
  if (isTester(email)) {
    const want = Buffer.from(testerCode()!), got = Buffer.from(code);
    return want.length === got.length && timingSafeEqual(want, got);
  }
  const row = await store.getLoginCode(email);
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_ATTEMPTS) return false;
  if (row.code_hash !== codeHash(email, code)) { await store.setLoginAttempts(email, row.attempts + 1); return false; }
  await store.deleteLoginCode(email);
  return true;
}

/* ───────── sessions ───────── */
export const readCookie = (req: Request, name: string) => {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
};

export async function startSession(store: Store, accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await store.createSession({ token_hash: hashToken(token), account_id: accountId, created_at: new Date(now).toISOString(), expires_at: new Date(now + SESSION_DAYS * 86_400_000).toISOString() });
  return token;
}

export const cookieOptions = (maxAgeDays = SESSION_DAYS) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: maxAgeDays * 86_400 });

/** the signed-in account for this request, or null */
export async function currentAccount(req: Request): Promise<AccountRow | null> {
  const store = getStore();
  const token = readCookie(req, SESSION_COOKIE);
  if (!store || !token) return null;
  const s = await store.getSession(hashToken(token));
  if (!s || new Date(s.expires_at).getTime() < Date.now()) return null;
  return store.getAccount(s.account_id);
}
export const sessionToken = (req: Request) => readCookie(req, SESSION_COOKIE);

export async function findOrCreateAccount(store: Store, email: string, name: string, phone: string | undefined, consentVersion: string): Promise<{ account: AccountRow; created: boolean }> {
  const existing = await store.getAccountByEmail(email);
  if (existing) return { account: existing, created: false };
  const account: AccountRow = { id: newAccountId(), email, phone, name: name.trim().slice(0, 80), created_at: new Date().toISOString(), consent_version: consentVersion };
  try { await store.createAccount(account); } catch (e) {
    const again = await store.getAccountByEmail(email); // a parallel sign-up won the race
    if (again) return { account: again, created: false };
    throw e;
  }
  return { account, created: true };
}

/* ───────── who may touch a tree ───────── */
export interface Access { member: Member; via: "account" | "token" }

/** A person gets in with a private-link token (legacy) or as a joined member of their signed-in account. */
export function accessFor(row: TreeRow, account: AccountRow | null, token: string | null | undefined): Access | null {
  if (token) {
    const h = hashToken(token);
    const m = row.members.find((x) => x.token_hash === h);
    if (m) return { member: m, via: "token" };
  }
  if (account) {
    const m = row.members.find((x) => x.account_id === account.id && x.status !== "invited");
    if (m) return { member: m, via: "account" };
  }
  return null;
}

/** what the browser may see about members: never hashes; contact details only to the owner, and shortened */
export const publicMember = (m: Member, forOwner: boolean) => ({
  id: m.id, name: m.name, role: m.role, person_id: m.person_id, status: m.status ?? "joined",
  ...(forOwner && m.status === "invited" && m.phone ? { phone_hint: maskPhone(m.phone) } : {}),
  ...(forOwner && m.status !== "invited" && m.email ? { email_hint: maskEmail(m.email) } : {}),
});

/** the secret in an invitation link: random, single-use, stored only as a hash */
export const newInviteSecret = () => randomBytes(18).toString("base64url");
export const inviteHash = (secret: string) => hashToken(secret);

/** operators of the site: the emails in ADMIN_EMAILS (comma separated). They must still be signed in with that address. */
export const isAdmin = (a: AccountRow | null) => {
  if (!a) return false;
  const list = (process.env.ADMIN_EMAILS ?? "").split(/[,;\s]+/).map((e) => normalizeEmail(e)).filter(Boolean);
  return list.includes(a.email);
};
