/**
 * Birthday reminders. A person who is signed in can switch them on (My profile). Once a day a job looks at the family trees that person belongs to and
 * writes to THEM, and only them, at their own account email: "Aarav Jha's birthday is in 7 days / today". Nobody else is ever written to.
 * Only living people with a full birth date (day and month) are included. The email carries a name and a date: no phone number, no address.
 * The reminders are off until the person switches them on; every email carries a one-click "stop these" link.
 */
import { formatDate } from "./dates";
import type { DFamily, DPerson } from "./family";
import { sign, unsign } from "./google";
import type { Mail } from "./mail";
import type { Profile } from "./profile";
import { ORG_NAME, SITE_DOMAIN, siteUrl } from "./site";

export type Lead = "week" | "day";
export interface Ymd { y: number; m: number; d: number }

/** today's date in India (the job runs in the early morning, India time) */
export const todayIST = (now = new Date()): Ymd => {
  const t = new Date(now.getTime() + 5.5 * 3600_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const utc = (x: Ymd) => Date.UTC(x.y, x.m - 1, x.d);
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export interface Birthday { person: DPerson; tree: string; month: number; day: number; on: Ymd; daysAway: number; turns?: number }

/** "1958-03-14" → month and day; a year alone ("1958") or year and month ("1958-03") cannot be reminded about */
export function birthMonthDay(birth?: string): { y: number; m: number; d: number } | null {
  const m = birth?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1]!, mo = +m[2]!, d = +m[3]!;
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? { y, m: mo, d } : null;
}

/** is this person someone we may remind about: living (not marked deceased, no death date), has a real name, has a full birth date */
export const remindable = (p: DPerson) => !p.placeholder && p.status !== "deceased" && !p.death && !!p.name_roman?.trim() && !!birthMonthDay(p.birth);

/** the next time each person's birthday comes round (today counts as 0 days), only those within `within` days. 29 February is kept on 28 February in other years. */
export function upcoming(f: DFamily, tree: string, today: Ymd, within = 366): Birthday[] {
  const out: Birthday[] = [];
  for (const p of f.persons) {
    if (!remindable(p)) continue;
    const b = birthMonthDay(p.birth)!;
    for (const year of [today.y, today.y + 1]) {
      const day = b.m === 2 && b.d === 29 && !isLeap(year) ? 28 : b.d;
      const on = { y: year, m: b.m, d: day };
      const daysAway = Math.round((utc(on) - utc(today)) / 86_400_000);
      if (daysAway < 0) continue;
      if (daysAway <= within) out.push({ person: p, tree, month: b.m, day, on, daysAway, turns: year - b.y > 0 && year - b.y < 120 ? year - b.y : undefined });
      break;
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway || a.person.name_roman.localeCompare(b.person.name_roman));
}

/** how many people in the tree are living, and how many of them have a full birthday (the rest can be asked for) */
export function coverage(f: DFamily): { living: number; withDate: number } {
  const living = f.persons.filter((p) => !p.placeholder && p.status !== "deceased" && !p.death && p.name_roman?.trim());
  return { living: living.length, withDate: living.filter((p) => !!birthMonthDay(p.birth)).length };
}

/** living people with no full birthday yet, so the page can ask for them by name (the first few, the person themselves last) */
export function missingBirthdays(f: DFamily, tree: string, max = 6): { tree: string; id: string; name: string; partial: boolean }[] {
  return f.persons
    .filter((p) => !p.placeholder && p.status !== "deceased" && !p.death && p.name_roman?.trim() && !birthMonthDay(p.birth))
    .sort((a, b) => Number(!!a.is_me) - Number(!!b.is_me))
    .slice(0, max)
    .map((p) => ({ tree, id: p.id, name: p.name_roman.trim(), partial: !!p.birth }));
}

export type DueKind = "week" | "day";
export interface Due extends Birthday { kind: DueKind; key: string }

/** what to send today: birthdays that are today, and (for "week") birthdays exactly 7 days away; skips what was already sent */
export function dueToday(items: Birthday[], lead: Lead, sent: readonly string[]): Due[] {
  const done = new Set(sent);
  const out: Due[] = [];
  for (const b of items) {
    const kind: DueKind | null = b.daysAway === 0 ? "day" : b.daysAway === 7 && lead === "week" ? "week" : null;
    if (!kind) continue;
    const key = `${b.tree}:${b.person.id}:${b.on.y}:${kind}`;
    if (!done.has(key)) out.push({ ...b, kind, key });
  }
  return out;
}

/** the sent-log keeps only recent keys, so the account record stays small */
export const trimSent = (sent: readonly string[], add: readonly string[], keep = 80) => [...sent, ...add].slice(-keep);

/* ───────── links in the email ───────── */
export const remUnsubToken = (accountId: string) => sign({ k: "rem-unsub", a: accountId }, 3 * 365 * 24 * 60);
export function accountFromRemToken(t: string | null | undefined): string | null {
  const d = unsign<{ k?: string; a?: string }>(t);
  return d && d.k === "rem-unsub" && typeof d.a === "string" ? d.a : null;
}

/* ───────── the email ───────── */
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const inDays = (n: number) => (n === 1 ? "tomorrow" : `in ${n} days`);
const dm = (b: Birthday) => `${b.day} ${MON[b.month - 1]}`;
const nameOf = (p: DPerson) => p.name_roman.trim();
const wish = (p: DPerson) => `जन्मदिन की हार्दिक शुभकामनाएँ ${p.name_dev?.trim() || nameOf(p)}! Happy Birthday, ${nameOf(p)}!`;
const waLink = (p: DPerson) => `https://wa.me/?text=${encodeURIComponent(wish(p))}`;

export function reminderMail(to: string, accountId: string, due: Due[], opts: { test?: boolean } = {}): Mail {
  const base = siteUrl();
  const stop = `${base}/api/reminders/unsubscribe?t=${encodeURIComponent(remUnsubToken(accountId))}`;
  const manage = `${base}/app/profile#reminders`;
  const day = due.filter((d) => d.kind === "day"), week = due.filter((d) => d.kind === "week");
  const first = due[0]!;
  const subject = (opts.test ? "[Test] " : "") + (due.length === 1
    ? (first.kind === "day" ? `Today is ${nameOf(first.person)}’s birthday` : `${nameOf(first.person)}’s birthday is on ${dm(first)}, ${inDays(first.daysAway)}`)
    : `${due.length} family birthdays: ${due.slice(0, 3).map((d) => nameOf(d.person)).join(", ")}${due.length > 3 ? "…" : ""}`);
  const line = (b: Due) => {
    const age = b.turns ? ` (turns ${b.turns})` : "";
    const hi = b.person.name_dev?.trim() ? ` · ${b.person.name_dev.trim()}` : "";
    const wa = b.kind === "day" ? ` <a href="${esc(waLink(b.person))}" style="color:#c4452a">Send a WhatsApp wish · शुभकामना भेजें</a>` : "";
    return `<li style="margin:0 0 10px;line-height:1.5"><strong>${esc(nameOf(b.person))}</strong>${esc(hi)}${esc(age)} — ${dm(b)}${b.kind === "week" ? ` (${inDays(b.daysAway)})` : ""}.${wa}</li>`;
  };
  const block = (title: string, hi: string, xs: Due[]) => xs.length ? `<p style="margin:16px 0 6px;font-size:15px"><strong>${title}</strong> <span style="color:#666">· ${hi}</span></p><ul style="padding-left:18px;margin:0">${xs.map(line).join("")}</ul>` : "";
  const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:24px;color:#1f2a5c">
<p style="letter-spacing:.2em;font-size:12px;color:#b5482a;margin:0 0 16px">${ORG_NAME.toUpperCase()}</p>
<p style="font-size:16px;line-height:1.55;margin:0">${opts.test ? "This is a test of your birthday reminders. A real one looks like this." : "A family birthday is coming up in your family tree."}</p>
${block("Today", "आज", day)}${block("Coming up", "जल्द आ रहे", week)}
<hr style="border:none;border-top:1px solid #e8dcc0;margin:24px 0 12px">
<p style="font-size:12px;color:#888;margin:0;line-height:1.6">You get this because you switched on birthday reminders for your family tree at ${SITE_DOMAIN}. Only you receive it.<br>
<a href="${esc(manage)}" style="color:#888">Change reminders</a> · <a href="${esc(stop)}" style="color:#888">Stop these emails · ये ईमेल बंद करें</a></p></div>`;
  const text = [
    opts.test ? "This is a test of your birthday reminders." : "A family birthday is coming up in your family tree.", "",
    ...day.map((b) => `Today: ${nameOf(b.person)}${b.turns ? ` (turns ${b.turns})` : ""} — ${dm(b)}. WhatsApp wish: ${waLink(b.person)}`),
    ...week.map((b) => `Coming up (${inDays(b.daysAway)}): ${nameOf(b.person)}${b.turns ? ` (turns ${b.turns})` : ""} — ${dm(b)}`), "",
    `Change reminders: ${manage}`, `Stop these emails: ${stop}`,
  ].join("\n");
  return { to, subject, html, text, headers: { "List-Unsubscribe": `<${stop}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
}

/** a short plain description of a birthday for the profile page: "14 March" */
export const birthdayLabel = (b: Birthday) => formatDate(`${b.on.y}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`).replace(/ \d{4}$/, "");

export const remindersOn = (p?: Profile) => p?.reminders?.birthdays === true;
export const leadOf = (p?: Profile): Lead => (p?.reminders?.lead === "day" ? "day" : "week");
