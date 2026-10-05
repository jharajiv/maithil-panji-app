import gotrasJson from "@/data/seed/gotras.json";
import moolsJson from "@/data/seed/mools.json";
import villagesJson from "@/data/seed/villages.json";

export interface Gotra { id: string; dev: string; roman: string; seq: number; extra?: boolean }
export interface Mool { id: string; dev: string; roman: string; aka: string[]; gotras: string[]; extra?: boolean }
export interface Village { id: string; dev: string; roman: string }

export const GOTRAS = gotrasJson as Gotra[];
export const MOOLS = moolsJson as Mool[];
export const VILLAGES = villagesJson as Village[];

/* ───────── user-added entries ─────────
 * The seed comes from one panjikar, so people will bring names that are not in it. Entries a user typed that are
 * clearly new are collected (server table "custom_refs") and overlaid here, marked `extra`, until the Panji team
 * reviews them. Both the browser and the chat server call registerExtras().
 */
export interface ExtraRef { kind: "gotra" | "mool"; roman: string; dev?: string }
const extraGotras: Gotra[] = [];
const extraMools: Mool[] = [];
const slug = (s: string) => fold(s).replace(/\s+/g, "-") || "x";

export function registerExtras(list: ExtraRef[]) {
  for (const e of list) {
    const roman = e.roman.trim();
    if (!roman || roman.length > 60 || DEVANAGARI.test(roman) && !e.dev) continue;
    const id = `x-${e.kind}-${slug(roman)}`;
    const dev = e.dev || "";
    if (e.kind === "gotra") {
      if (GOTRAS.some((g) => fold(g.roman) === fold(roman)) || extraGotras.some((g) => g.id === id)) continue;
      extraGotras.push({ id, roman, dev, seq: 1000 + extraGotras.length, extra: true });
    } else {
      if (MOOLS.some((m) => fold(m.roman) === fold(roman)) || extraMools.some((m) => m.id === id)) continue;
      extraMools.push({ id, roman, dev, aka: [], gotras: [], extra: true });
    }
  }
}
export const allGotras = (): Gotra[] => (extraGotras.length ? [...GOTRAS, ...extraGotras] : GOTRAS);
export const allMools = (): Mool[] => (extraMools.length ? [...MOOLS, ...extraMools] : MOOLS);

/* ───────── normalisation: make "Sarisab", "sarisaba", "सरिसब" and "Shandilya"/"śāṇḍilya" meet ───────── */

const DEVANAGARI = /[ऀ-ॿ]/;

/** Fold a roman (IAST or casual) string to a loose phonetic key. */
export function fold(input: string): string {
  let s = input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  s = s.replace(/[^a-z\s]/g, " ");
  s = s
    .replace(/sh/g, "s").replace(/ch/g, "c").replace(/([kgcjtdpbsl])h/g, "$1")
    .replace(/w/g, "v").replace(/b/g, "v").replace(/z/g, "j").replace(/y(?=[^aeiou]|$)/g, "i")
    .replace(/ee/g, "i").replace(/oo/g, "u").replace(/aa/g, "a").replace(/(.)\1+/g, "$1");
  return s
    .split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/a$/, "") : w))
    .join(" ");
}
const skeleton = (f: string) => f.replace(/[aeiou]/g, "");

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]!);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Score one candidate label against a folded query, 0..1. */
function scoreOne(qf: string, qs: string, label: string): number {
  const f = fold(label);
  if (!f) return 0;
  if (f === qf) return 1;
  const words = f.split(" ");
  if (f.startsWith(qf)) return 0.86;
  if (words.some((w) => w === qf)) return 0.84;
  if (words.some((w) => w.startsWith(qf))) return 0.78;
  if (qf.length >= 3 && f.includes(qf)) return 0.66;
  if (qf.length >= 4 && skeleton(f) === qs) return 0.8;
  if (qf.length >= 4) {
    const d = Math.min(...words.map((w) => lev(qf, w, 2)), lev(qf, f, 2));
    if (d <= 1) return 0.74;
    if (d <= 2 && qf.length >= 7) return 0.58;
  }
  if (qs.length >= 3 && skeleton(f).includes(qs)) return 0.5;
  return 0;
}

function scoreDev(q: string, dev: string): number {
  const a = q.normalize("NFC").replace(/\s+/g, ""), b = dev.normalize("NFC").replace(/\s+/g, "");
  if (a === b) return 1;
  if (b.startsWith(a)) return 0.86;
  if (a.length >= 2 && b.includes(a)) return 0.66;
  return 0;
}

export interface Hit<T> { item: T; score: number }

function search<T>(q: string, items: T[], labels: (t: T) => { roman: string[]; dev: string[] }, limit: number, bonus?: (t: T) => number): Hit<T>[] {
  const query = q.trim();
  if (!query) return [];
  const isDev = DEVANAGARI.test(query);
  const qf = isDev ? "" : fold(query);
  const qs = skeleton(qf);
  const hits: Hit<T>[] = [];
  for (const it of items) {
    const l = labels(it);
    let s = isDev ? Math.max(0, ...l.dev.map((d) => scoreDev(query, d))) : Math.max(0, ...l.roman.map((r) => scoreOne(qf, qs, r)));
    if (s > 0 && bonus) s = Math.min(1, s + bonus(it));
    if (s >= 0.5) hits.push({ item: it, score: s });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export const searchGotras = (q: string, limit = 6) =>
  search(q, allGotras(), (g) => ({ roman: [g.roman], dev: [g.dev] }), limit);

export const searchMools = (q: string, opts: { gotraId?: string; limit?: number } = {}) =>
  search(q, allMools(), (m) => ({ roman: [m.roman, ...m.aka.filter((a) => !DEVANAGARI.test(a))], dev: [m.dev, ...m.aka.filter((a) => DEVANAGARI.test(a))] }),
    opts.limit ?? 8, (m) => (opts.gotraId && m.gotras.includes(opts.gotraId) ? 0.06 : 0));

export const searchVillages = (q: string, limit = 8) =>
  search(q, VILLAGES, (v) => ({ roman: [v.roman], dev: [v.dev] }), limit);

export type Match<T> = { status: "exact" | "likely" | "ambiguous" | "none"; hits: Hit<T>[] };

/** Decide whether to accept silently, ask "did you mean…?", or ask the user to pick. */
export function classify<T>(hits: Hit<T>[]): Match<T> {
  if (!hits.length) return { status: "none", hits };
  const [a, b] = hits;
  if (a!.score >= 0.95 && (!b || b.score < 0.95)) return { status: "exact", hits };
  if (a!.score >= 0.74 && (!b || a!.score - b.score >= 0.12)) return { status: "likely", hits };
  return { status: "ambiguous", hits };
}

/* ───────── display helpers ───────── */

export const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
/** IAST → plain Latin for display ("sarisaba" stays, "dirdhoṣa" → "Dirdhosa"). */
export const plainRoman = (iast: string) => titleCase(iast.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim());

export const gotraById = (id?: string) => allGotras().find((g) => g.id === id);
export const moolById = (id?: string) => allMools().find((m) => m.id === id);
