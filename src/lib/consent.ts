import { isStaging } from "./env";

/**
 * Google Analytics (optional). It is only ever set up when NEXT_PUBLIC_GA_ID is set in Vercel (looks like G-XXXXXXXXXX), never on the staging copy,
 * and it measures nothing about a visitor until they tap "Allow" on the small banner (Consent Mode: "denied" is the starting point).
 * Pages that carry a private key in the address (shared trees, invitations, accounts) are reported to Google under a plain address with the key removed.
 */
export const CONSENT_KEY = "maithil-panji.consent.v1";
export type Consent = "granted" | "denied" | null;
export const CONSENT_EVENT = "paag-consent-change";

export const gaId = (): string | undefined => {
  const v = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";
  return /^G-[A-Z0-9]{6,14}$/.test(v) && !isStaging() ? v : undefined;
};

export function readConsent(): Consent {
  try { const v = localStorage.getItem(CONSENT_KEY); return v === "granted" || v === "denied" ? v : null; } catch { return null; }
}

type Gtag = (...a: unknown[]) => void;
export function setConsent(v: Consent): void {
  try { if (v) localStorage.setItem(CONSENT_KEY, v); else localStorage.removeItem(CONSENT_KEY); } catch { /* ignore */ }
  try { (window as unknown as { gtag?: Gtag }).gtag?.("consent", "update", { analytics_storage: v === "granted" ? "granted" : "denied" }); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(CONSENT_EVENT)); } catch { /* ignore */ }
}

/** pages where the banner may appear: the public ones. Never inside the chat / build screen, where room is precious. */
export const BANNER_PATHS = /^\/(?:$|about|faq|hi(?:\/|$)|gotra|mool|sample|privacy)/;

/** addresses that contain a tree id or a private key, and what Google is shown instead */
const PRIVATE: [RegExp, string][] = [
  [/^\/view\/[^/]+.*$/, "/view/[id]"],
  [/^\/join\/[^/]+.*$/, "/join/[id]"],
  [/^\/app\/tree\/[^/]+.*$/, "/app/tree/[id]"],
  [/^\/app\/bridge\/[^/]+(?:\/[^/]+)?.*$/, "/app/bridge/[id]/[id]"],
];
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/** the address that Google Analytics is shown: no private keys, no invitation codes; only the campaign labels of the link are kept */
export function analyticsAddress(pathname: string, search: string): { path: string; query: string } {
  for (const [rx, shown] of PRIVATE) if (rx.test(pathname)) return { path: shown, query: "" };
  if (pathname.startsWith("/app") || pathname.startsWith("/login")) return { path: pathname, query: "" };
  const keep = new URLSearchParams();
  const from = new URLSearchParams(search);
  for (const k of UTM) { const v = from.get(k); if (v) keep.set(k, v.slice(0, 80)); }
  const q = keep.toString();
  return { path: pathname, query: q ? `?${q}` : "" };
}
