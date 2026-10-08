/**
 * Two families may have entered the same family tree twice. Finding that is done in two steps:
 *  1. FILTER — the trees must share gotra AND mool (this is checked first, by the store, so only a handful of trees are compared);
 *  2. SCORE — people are paired by first name, surname, year of birth, place and father's name. The score is the share of the
 *     smaller tree that was found in the other, as a percentage.
 * Nothing here decides anything: the owners look at the list, preview, talk to each other and decide together.
 */
import { fatherOf, type DFamily, type DPerson, type PanjiRef } from "./family";
import { firstOf, givenName, living, nameSim, yearOf, lev } from "./connect";
import { fold } from "./lookup";

export const stockOf = (f: DFamily): { gotra?: PanjiRef; mool?: PanjiRef } => {
  const me = f.persons.find((p) => p.is_me);
  return { gotra: me?.gotra, mool: me?.mool };
};

/** same gotra AND same mool (by seed id when both have one, otherwise by spelling); a tree missing either cannot qualify */
export function sameStock(a: DFamily, b: DFamily): boolean {
  const x = stockOf(a), y = stockOf(b);
  const eq = (p?: PanjiRef, q?: PanjiRef) => !!p && !!q && (p.id && q.id ? p.id === q.id : !!fold(p.roman) && fold(p.roman) === fold(q.roman));
  return eq(x.gotra, y.gotra) && eq(x.mool, y.mool);
}

const real = (p: DPerson) => !p.placeholder && !p.name_roman.startsWith("(") && !!givenName(p.name_roman);
const surname = (n: string) => { const t = n.trim().split(/\s+/); return t.length > 1 ? fold(t[t.length - 1]!) : ""; };

export interface PairScore { score: number; reasons: string[] }

/** how likely two people (one from each tree) are the same person: 0–1.35, "same" from 0.7 */
export function scorePair(a: DPerson, b: DPerson, fa: DFamily, fb: DFamily): PairScore | null {
  if (a.gender && b.gender && a.gender !== b.gender) return null;
  const ns = nameSim(a.name_roman, b.name_roman);
  if (ns < 2) return null;
  const reasons: string[] = [ns === 3 ? "same first name" : "first name spelt slightly differently"];
  let s = ns === 3 ? 0.5 : 0.35;
  const sa = surname(a.name_roman), sb = surname(b.name_roman);
  if (sa && sb) {
    if (sa === sb) { s += 0.25; reasons.push("same surname"); }
    else if (Math.min(sa.length, sb.length) >= 4 && lev(sa, sb) <= 1) { s += 0.15; reasons.push("surname nearly the same"); }
    else s -= 0.15;
  }
  const ya = yearOf(a), yb = yearOf(b);
  if (ya && yb) {
    const d = Math.abs(ya - yb);
    if (d === 0) { s += 0.25; reasons.push("same year of birth"); } else if (d <= 2) { s += 0.12; reasons.push("birth years within 2"); } else if (d > 5) return null;
  }
  const pa = fold(a.place ?? "").split(" ")[0], pb = fold(b.place ?? "").split(" ")[0];
  if (pa && pb && pa.length >= 3 && pa === pb) { s += 0.1; reasons.push("same village"); }
  const fa1 = fatherOf(fa, a.id), fb1 = fatherOf(fb, b.id);
  if (fa1 && fb1) {
    const fs = nameSim(fa1.name_roman, fb1.name_roman);
    if (fs >= 2) { s += 0.2; reasons.push("father’s name matches"); } else s -= 0.1;
  }
  return { score: s, reasons };
}

export interface TreeMatch {
  /** 0–100 */
  percent: number;
  strength: "very likely" | "likely" | "possible";
  matched: number;
  pairs: { mine: string; theirs: string; reasons: string[]; score: number }[];
}

const MATCHED_FROM = 0.7;
export const MIN_PAIRS = 3;
export const MIN_PERCENT = 30;

/** one-to-one pairs of people who look like the same person in both trees (score ≥ 0.7), best first */
export function pairPeople(mine: DFamily, theirs: DFamily): { a: DPerson; b: DPerson; r: PairScore }[] {
  const A = mine.persons.filter(real), B = theirs.persons.filter(real);
  const byGiven = new Map<string, DPerson[]>();
  for (const q of B) { const k = fold(givenName(q.name_roman)).slice(0, 1); (byGiven.get(k) ?? byGiven.set(k, []).get(k)!).push(q); }
  const cands: { a: DPerson; b: DPerson; r: PairScore }[] = [];
  for (const p of A) {
    for (const q of byGiven.get(fold(givenName(p.name_roman)).slice(0, 1)) ?? []) {
      const r = scorePair(p, q, mine, theirs);
      if (r && r.score >= MATCHED_FROM) cands.push({ a: p, b: q, r });
    }
  }
  cands.sort((x, y) => y.r.score - x.r.score);
  const usedA = new Set<string>(), usedB = new Set<string>();
  const out: typeof cands = [];
  for (const c of cands) {
    if (usedA.has(c.a.id) || usedB.has(c.b.id)) continue;
    usedA.add(c.a.id); usedB.add(c.b.id); out.push(c);
  }
  return out;
}

/** compare two trees that already share gotra and mool; null when they are not similar enough to mention */
export function compareTrees(mine: DFamily, theirs: DFamily): TreeMatch | null {
  const A = mine.persons.filter(real), B = theirs.persons.filter(real);
  if (A.length < 3 || B.length < 3) return null;
  const pairs: TreeMatch["pairs"] = [];
  let sum = 0;
  for (const c of pairPeople(mine, theirs)) {
    sum += Math.min(1, c.r.score);
    pairs.push({ mine: c.a.name_roman, theirs: living(c.b) ? firstOf(c.b.name_roman) : c.b.name_roman, reasons: c.r.reasons, score: c.r.score });
  }
  if (pairs.length < MIN_PAIRS) return null;
  // a very small tree matching three people is not proof: the share is taken against at least 5 people
  const percent = Math.min(100, Math.round((100 * sum) / Math.max(5, Math.min(A.length, B.length))));
  if (percent < MIN_PERCENT) return null;
  return { percent, strength: percent >= 70 ? "very likely" : percent >= 50 ? "likely" : "possible", matched: pairs.length, pairs };
}
