/**
 * Newsletter: people ask for occasional updates; a link in a confirmation email proves the address is theirs (double opt-in);
 * every email carries a one-click unsubscribe. Only the email, language and dates are kept (see supabase/schema.sql, section 9).
 */
import { sign, unsign, originOf } from "./google";
import { mailConfigured, type Mail } from "./mail";
import { ORG_LONG, ORG_NAME, SITE_DOMAIN, siteUrl } from "./site";
import { getStore, type Store, type Subscriber } from "./store";

export type Lang = "en" | "hi";
export const isLang = (x: unknown): x is Lang => x === "en" || x === "hi";

/** the links are signed with AUTH_SECRET (or the Google secret); without a real secret anyone could forge them, so the newsletter stays off */
const secretSet = () => !!(process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET) || process.env.NODE_ENV !== "production";
export const newsletterEnabled = () => !!getStore() && mailConfigured() && secretSet();

const CONFIRM_DAYS = 7;
export const confirmToken = (email: string) => sign({ k: "nl-confirm", e: email }, CONFIRM_DAYS * 24 * 60);
export const unsubToken = (email: string) => sign({ k: "nl-unsub", e: email }, 3 * 365 * 24 * 60);
export function emailFromToken(t: string | null | undefined, kind: "nl-confirm" | "nl-unsub"): string | null {
  const d = unsign<{ k?: string; e?: string }>(t);
  return d && d.k === kind && typeof d.e === "string" ? d.e : null;
}

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const base = () => siteUrl();
export const unsubscribeUrl = (email: string) => `${base()}/newsletter/unsubscribe?t=${encodeURIComponent(unsubToken(email))}`;
const oneClickUrl = (email: string) => `${base()}/api/newsletter/unsubscribe?t=${encodeURIComponent(unsubToken(email))}`;

const FRAME = (inner: string, foot: string) => `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:24px;color:#1f2a5c">
<p style="letter-spacing:.2em;font-size:12px;color:#b5482a;margin:0 0 16px">PAAG FOUNDATION</p>
${inner}
<hr style="border:none;border-top:1px solid #e8dcc0;margin:24px 0 12px">
<p style="font-size:12px;color:#888;margin:0;line-height:1.5">${foot}</p></div>`;

/** the confirmation email (English or Hindi) */
export function confirmMail(email: string, lang: Lang): Mail {
  const link = `${base()}/api/newsletter/confirm?t=${encodeURIComponent(confirmToken(email))}`;
  const hi = lang === "hi";
  const subject = hi ? `अपना ईमेल पक्का कीजिए — ${ORG_NAME}` : `Please confirm your email — ${ORG_NAME}`;
  const lead = hi ? `नमस्ते! ${ORG_NAME} के समाचार पाने के लिए नीचे के बटन से अपना ईमेल पक्का कीजिए।` : `Thank you for your interest in ${ORG_NAME}. Please confirm that this email address is yours to receive occasional updates.`;
  const btn = hi ? "ईमेल पक्का करें" : "Confirm my email";
  const note = hi ? "यदि आपने यह अनुरोध नहीं किया, तो इस ईमेल को छोड़ दीजिए; कुछ नहीं होगा।" : "If you did not ask for this, ignore this email and nothing will happen.";
  const html = FRAME(`<p style="font-size:16px;line-height:1.55;margin:0 0 20px">${lead}</p>
<p style="margin:0 0 20px"><a href="${esc(link)}" style="background:#c4452a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:16px;display:inline-block">${btn}</a></p>
<p style="font-size:13px;color:#555;margin:0">${note}</p>`, `${ORG_NAME} (${ORG_LONG}) · ${SITE_DOMAIN}`);
  return { to: email, subject, html, text: `${lead}\n\n${link}\n\n${note}` };
}

/** plain text typed by the operator → safe HTML: blank line = new paragraph, "## " = heading, web addresses become links */
export function textToHtml(text: string): string {
  const link = (s: string) => esc(s).replace(/https:\/\/[^\s<]+/g, (u) => { const clean = u.replace(/[.,;:!?)]+$/, ""), tail = u.slice(clean.length); return `<a href="${clean}" style="color:#c4452a">${clean}</a>${tail}`; });
  return text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map((b) =>
    b.startsWith("## ") ? `<h2 style="font-size:19px;margin:22px 0 8px">${link(b.slice(3))}</h2>` : `<p style="font-size:16px;line-height:1.6;margin:0 0 16px">${link(b).replace(/\n/g, "<br>")}</p>`).join("\n");
}

/** one copy of a newsletter for one subscriber */
export function newsletterMail(sub: Pick<Subscriber, "email" | "lang">, subject: string, text: string): Mail {
  const un = unsubscribeUrl(sub.email);
  const hi = sub.lang === "hi";
  const foot = hi
    ? `आपको यह ईमेल इसलिए मिला क्योंकि आपने ${SITE_DOMAIN} पर समाचार के लिए नाम लिखवाया था। <a href="${esc(un)}" style="color:#888">सदस्यता छोड़ें</a>`
    : `You receive this because you asked for updates at ${SITE_DOMAIN}. <a href="${esc(un)}" style="color:#888">Unsubscribe</a>`;
  return {
    to: sub.email, subject,
    html: FRAME(textToHtml(text), foot),
    text: `${text}\n\n—\n${hi ? "सदस्यता छोड़ें" : "Unsubscribe"}: ${un}`,
    headers: { "List-Unsubscribe": `<${oneClickUrl(sub.email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

/** a new request: remember it as pending and send the confirmation (not again within 10 minutes) */
export async function requestSubscription(store: Store, email: string, lang: Lang, source: string, send: (m: Mail) => Promise<boolean>): Promise<"sent" | "already" | "wait" | "error"> {
  const now = new Date();
  const cur = await store.getSubscriber(email);
  if (cur?.status === "confirmed") return "already";
  if (cur?.status === "pending" && cur.last_sent_at && now.getTime() - Date.parse(cur.last_sent_at) < 10 * 60_000) return "wait";
  await store.putSubscriber({ email, status: "pending", lang, source, created_at: cur?.created_at ?? now.toISOString(), last_sent_at: now.toISOString() });
  return (await send(confirmMail(email, lang))) ? "sent" : "error";
}

export async function confirmSubscription(store: Store, email: string): Promise<boolean> {
  const cur = await store.getSubscriber(email);
  if (!cur) return false;
  if (cur.status !== "confirmed") await store.putSubscriber({ ...cur, status: "confirmed", confirmed_at: new Date().toISOString(), unsubscribed_at: undefined });
  return true;
}

export async function unsubscribe(store: Store, email: string): Promise<void> {
  const cur = await store.getSubscriber(email);
  if (cur && cur.status !== "unsubscribed") await store.putSubscriber({ ...cur, status: "unsubscribed", unsubscribed_at: new Date().toISOString() });
}

export { originOf };
