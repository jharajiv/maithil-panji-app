/**
 * Voluntary contribution at download time. Amounts are suggested by country; nothing is ever required.
 * Set these in Vercel (all optional — with neither set, the contribution step is simply not shown):
 *   NEXT_PUBLIC_DONATE_UPI_ID    e.g. name@okaxis   (India: UPI link on phones, QR code on computers)
 *   NEXT_PUBLIC_DONATE_UPI_NAME  name shown in the UPI app, e.g. "Maithil Panji"
 *   NEXT_PUBLIC_DONATE_CARD_URL  a hosted payment link (Stripe / Razorpay / Buy Me a Coffee …) for everyone else.
 *                                May contain {amount} and {currency}; without them the amount is chosen on that page.
 */
export interface Tier { code: string; symbol: string; amounts: number[]; pick: number }

const T = (code: string, symbol: string, amounts: number[], pick: number): Tier => ({ code, symbol, amounts, pick });

export const INR = T("INR", "₹", [51, 101, 251, 501], 251);
const USD = T("USD", "$", [5, 11, 21], 11);
const EUR = T("EUR", "€", [5, 10, 20], 10);
const CHF = T("CHF", "CHF ", [10, 20, 50], 20);
const GBP = T("GBP", "£", [5, 10, 15], 10);
const AED = T("AED", "AED ", [20, 50, 100], 50);
const AUD = T("AUD", "A$", [8, 15, 30], 15);
const CAD = T("CAD", "C$", [7, 15, 25], 15);

const EURO = "AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK".split(" ");

export const tierFor = (country: string): Tier => {
  const c = country.toUpperCase();
  if (c === "IN") return INR;
  if (c === "CH" || c === "LI") return CHF;
  if (c === "GB") return GBP;
  if (c === "AE") return AED;
  if (c === "AU" || c === "NZ") return AUD;
  if (c === "CA") return CAD;
  if (EURO.includes(c)) return EUR;
  return USD;
};

/** best guess before the server answers: the browser's time zone, then its language */
export function guessCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (/^Asia\/(Kolkata|Calcutta)$/.test(tz)) return "IN";
    const m = /-([A-Z]{2})$/.exec(navigator.language ?? "");
    return m?.[1] ?? "";
  } catch { return ""; }
}

export interface DonateConfig { upiId: string; upiName: string; cardUrl: string }
export const donateConfig = (): DonateConfig => ({
  upiId: (process.env.NEXT_PUBLIC_DONATE_UPI_ID ?? "").trim(),
  upiName: (process.env.NEXT_PUBLIC_DONATE_UPI_NAME ?? "Maithil Panji").trim(),
  cardUrl: (process.env.NEXT_PUBLIC_DONATE_CARD_URL ?? "").trim(),
});

export const upiLink = (c: DonateConfig, amount: number) =>
  `upi://pay?pa=${encodeURIComponent(c.upiId)}&pn=${encodeURIComponent(c.upiName)}&am=${amount}&cu=INR&tn=${encodeURIComponent("Maithil Panji contribution")}`;

export const cardLink = (c: DonateConfig, amount: number, currency: string) =>
  /^https:\/\//.test(c.cardUrl) ? c.cardUrl.replace(/\{amount\}/g, String(amount)).replace(/\{currency\}/g, currency) : "";

const KEY = "maithil-panji.donated.v1";
/** someone who has contributed is not asked again for a while */
export const recentlyDonated = () => { try { return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < 45 * 86_400_000; } catch { return false; } };
export const markDonated = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
