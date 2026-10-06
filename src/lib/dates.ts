/** Dates in the tree are partial ISO strings: "1958", "1958-03" or "1958-03-14". */
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON_RX = MONTHS.map((m) => m.slice(0, 3).toLowerCase());

const pad = (n: number) => String(n).padStart(2, "0");
export const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();

/** Pull the first date out of free text ("14 March 1958", "14/03/1958", "March 1958", "born 1958"). Day first, as is usual in India. */
export function parseDateText(text: string): string | undefined {
  const t = text.toLowerCase();
  const ok = (y: number) => y >= 1700 && y <= new Date().getFullYear();
  let m = t.match(/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})\b/);
  if (m) { const d = +m[1]!, mo = +m[2]!, y = +m[3]!; if (ok(y) && mo >= 1 && mo <= 12 && d >= 1 && d <= daysIn(y, mo)) return `${y}-${pad(mo)}-${pad(d)}`; }
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) { const y = +m[1]!, mo = +m[2]!, d = +m[3]!; if (ok(y) && mo >= 1 && mo <= 12 && d >= 1 && d <= daysIn(y, mo)) return `${y}-${pad(mo)}-${pad(d)}`; }
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})[a-z]*\.?,?\s+(\d{4})\b/);
  if (m) { const mo = MON_RX.indexOf(m[2]!.slice(0, 3)) + 1, d = +m[1]!, y = +m[3]!; if (mo && ok(y) && d >= 1 && d <= daysIn(y, mo)) return `${y}-${pad(mo)}-${pad(d)}`; }
  m = t.match(/\b([a-z]{3,9})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m) { const mo = MON_RX.indexOf(m[1]!.slice(0, 3)) + 1, d = +m[2]!, y = +m[3]!; if (mo && ok(y) && d >= 1 && d <= daysIn(y, mo)) return `${y}-${pad(mo)}-${pad(d)}`; }
  m = t.match(/\b([a-z]{3,9})[a-z]*\.?,?\s+(\d{4})\b/);
  if (m) { const mo = MON_RX.indexOf(m[1]!.slice(0, 3)) + 1, y = +m[2]!; if (mo && ok(y)) return `${y}-${pad(mo)}`; }
  m = t.match(/\b(1[789]\d\d|20[0-2]\d)\b/);
  return m && ok(+m[1]!) ? m[1] : undefined;
}

/** "1958-03-14" → "14 March 1958"; partial dates stay partial. */
export function formatDate(v?: string): string {
  const m = v?.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return v ?? "";
  const mo = m[2] ? MONTHS[+m[2] - 1] : undefined;
  return [m[3] ? String(+m[3]) : "", mo, m[1]].filter(Boolean).join(" ");
}
