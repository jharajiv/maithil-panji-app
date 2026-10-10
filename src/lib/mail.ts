/**
 * Sending email through Resend (resend.com). One place for the sign-in code, the newsletter confirmation and the newsletter itself.
 * Needs RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend, e.g. "PAAG Foundation <hello@paag.org.in>").
 * RESEND_API_URL can point at a test server.
 */
import { isStaging, stagingMailAllowed } from "./env";

const cfg = () => {
  const key = process.env.RESEND_API_KEY?.trim(), from = process.env.EMAIL_FROM?.trim();
  return key && from ? { key, from } : null;
};
export const mailConfigured = () => !!cfg();
const url = () => process.env.RESEND_API_URL ?? "https://api.resend.com/emails";
const replyTo = () => process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || undefined;

export interface Mail { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }
const body = (from: string, m: Mail) => ({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(m.headers ? { headers: m.headers } : {}), ...(replyTo() ? { reply_to: replyTo() } : {}) });

export async function sendMail(m: Mail): Promise<boolean> {
  const c = cfg();
  if (!c) return false;
  if (isStaging() && !stagingMailAllowed(m.to)) { console.log("[staging] email not sent (address is not in STAGING_MAIL_ALLOW):", m.to.replace(/^(.).*(@.*)$/, "$1…$2")); return true; }
  try {
    const res = await fetch(url(), { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${c.key}`, "content-type": "application/json" }, body: JSON.stringify(body(c.from, m)) });
    if (!res.ok) console.error("email send failed", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) { console.error("email send failed", (e as Error).message); return false; }
}

/** many separate emails (each person gets their own, with their own unsubscribe link); 50 per request, one request after the other */
export async function sendBatch(mails: Mail[]): Promise<{ sent: number; failed: number }> {
  const c = cfg();
  if (!c) return { sent: 0, failed: mails.length };
  if (isStaging()) mails = mails.filter((m) => stagingMailAllowed(m.to)); // a test copy never writes to anyone who is not on the list
  let sent = 0, failed = 0;
  for (let i = 0; i < mails.length; i += 50) {
    const chunk = mails.slice(i, i + 50);
    try {
      const res = await fetch(`${url().replace(/\/+$/, "")}/batch`, { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${c.key}`, "content-type": "application/json" }, body: JSON.stringify(chunk.map((m) => body(c.from, m))) });
      if (res.ok) sent += chunk.length; else { failed += chunk.length; console.error("batch send failed", res.status, (await res.text()).slice(0, 200)); }
    } catch (e) { failed += chunk.length; console.error("batch send failed", (e as Error).message); }
  }
  return { sent, failed };
}
