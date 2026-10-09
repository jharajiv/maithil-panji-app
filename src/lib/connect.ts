/**
 * Connecting trees through married women.
 * A Maithil woman appears in two trees: as a daughter in her father's family, and as a wife in her husband's. When someone
 * records a married woman, we look for the same woman in other trees that have agreed to be found, and show the owner enough
 * of that other tree (her husband, parents, children — living people by first name only) to judge whether it is the same person.
 * Nothing is linked until a person confirms it.
 */
import { childrenOf, fatherOf, motherOf, siblingsOf, spousesOf, type DFamily, type DPerson } from "./family";
import { fold } from "./lookup";

export interface Woman {
  id: string;
  /** "wife": appears as someone's wife (her own father may or may not be drawn in this tree). "daughter": appears as a daughter whose marriage is noted. */
  kind: "wife" | "daughter";
  name: string;
  birthYear?: number;
  gotra?: string;
  mool?: string;
  /** the husband's name (wife) or the note about her marriage (daughter) */
  husband?: string;
  husbandPlace?: string;
  father?: string;
}

export const TITLES = /\b(smt|shrimati|mrs|ms|devi|dai|daiji|kumari|babuain|musammat|mst|w\/o|d\/o)\b\.?/gi;
export const givenName = (n: string) => n.replace(TITLES, " ").trim().split(/\s+/)[0] ?? "";
export const yearOf = (p: DPerson) => { const y = Number(/^\d{4}/.exec(p.birth ?? "")?.[0]); return y || undefined; };

/**
 * Married women in this tree who are not linked yet. The woman is the connector between two family trees:
 * a wife (mother, grandmother…) is looked for as a daughter in her father's tree; a married daughter is looked for as a wife in her husband's.
 */
export function womenToMatch(f: DFamily): Woman[] {
  const out: Woman[] = [];
  for (const p of f.persons) {
    if (p.gender !== "female" || p.placeholder || p.links?.length || !givenName(p.name_roman) || p.name_roman.startsWith("(")) continue;
    const base = { id: p.id, name: p.name_roman, birthYear: yearOf(p), gotra: p.gotra?.roman, mool: p.mool?.roman };
    const husbands = spousesOf(f, p.id).filter((s) => s.gender !== "female");
    const dad = fatherOf(f, p.id);
    const dadName = dad && !dad.placeholder && !dad.name_roman.startsWith("(") ? dad.name_roman : undefined;
    // a wife is looked for in her father's tree whether or not her own parents are drawn here (a mother is usually entered with her father's name)
    if (husbands.length) out.push({ ...base, kind: "wife", husband: husbands[0]!.name_roman, husbandPlace: husbands[0]!.place, ...(dadName ? { father: dadName } : {}) });
    else if (dad && p.married_to?.trim()) out.push({ ...base, kind: "daughter", husband: p.married_to, father: dad.name_roman });
  }
  return out;
}

/** first letters a woman's name could start with in another spelling (Bandana/Vandana, Jaya/Zaya) — used to narrow the search */
export function prefixesFor(name: string): string[] {
  const c = fold(givenName(name))[0];
  if (!c) return [];
  return c === "v" ? ["v", "b", "w"] : c === "j" ? ["j", "z"] : [c];
}

export function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n]!;
}
/** 3 = same, 2 = one letter apart (spelling), 0 = different */
export function nameSim(a: string, b: string): number {
  const x = fold(givenName(a)), y = fold(givenName(b));
  if (!x || !y) return 0;
  if (x === y) return 3;
  return Math.min(x.length, y.length) >= 4 && lev(x, y) <= 1 ? 2 : 0;
}

export interface MatchResult { score: number; strength: "strong" | "possible"; reasons: string[] }

/** compare a wife in one tree with a daughter in another (either way round); null when they cannot be the same woman */
export function scoreMatch(a: Woman, b: Woman): MatchResult | null {
  if (a.kind === b.kind) return null;
  const wife = a.kind === "wife" ? a : b;
  const dau = a.kind === "wife" ? b : a;
  const ns = nameSim(wife.name, dau.name);
  if (ns < 2) return null;
  let score = ns, reasons: string[] = [ns === 3 ? "same first name" : "very similar first name"];
  const add = (n: number, why?: string) => { score += n; if (why && n > 0) reasons.push(why); };

  if (wife.birthYear && dau.birthYear) {
    const d = Math.abs(wife.birthYear - dau.birthYear);
    if (d === 0) add(3, "same year of birth"); else if (d <= 2) add(1, "birth years within 2"); else if (d > 4) return null;
  }
  if (wife.gotra && dau.gotra) { if (fold(wife.gotra) === fold(dau.gotra)) add(2, "same gotra"); else add(-1); }
  if (wife.mool && dau.mool && fold(wife.mool) === fold(dau.mool)) add(2, "same mool");

  if (wife.husband && dau.husband) {
    const hs = nameSim(wife.husband, dau.husband.split(",")[0] ?? "");
    if (hs === 3) add(3, "husband’s name matches"); else if (hs === 2) add(2, "husband’s name is nearly the same"); else add(-2);
    const hp = fold(wife.husbandPlace ?? "").split(" ")[0];
    if (hp && hp.length >= 3 && fold(dau.husband).includes(hp)) add(1, "husband’s village matches");
  }
  const wf = wife.father; // a wife whose own father is recorded in her husband's tree is rare, but compare when it happens
  if (wf && dau.father && nameSim(wf, dau.father) >= 2) add(3, "father’s name matches");

  if (score < 5) return null;
  reasons = [...new Set(reasons)];
  return { score, strength: score >= 8 ? "strong" : "possible", reasons };
}

export interface Candidate {
  /** my woman */
  person: string;
  personName: string;
  /** the same woman, perhaps, in another tree */
  tree: string;
  treePerson: string;
  treeTitle: string;
  name: string;
  strength: "strong" | "possible";
  score: number;
  reasons: string[];
}

/* ───────── what the owner of one tree may see of another tree, to judge a match ───────── */

export interface PreviewPerson { relation: string; name: string; years?: string }
export interface Preview {
  treeTitle: string;
  gotra?: string; mool?: string;
  /** the woman herself */
  person: { name: string; year?: string };
  /** her husband, parents, brothers and sisters, children — living people by first name only */
  connects: PreviewPerson[];
}

export const living = (p: DPerson) => {
  if (p.status === "deceased") return false;
  if (p.status === "living") return true;
  const y = yearOf(p);
  return !(y && y <= new Date().getFullYear() - 100);
};
export const firstOf = (n: string) => n.trim().split(/\s+/)[0] ?? n;

export function previewOf(f: DFamily, personId: string, treeTitle: string): Preview | null {
  const p = f.persons.find((x) => x.id === personId);
  if (!p) return null;
  const show = (q: DPerson, relation: string): PreviewPerson => {
    if (living(q)) return { relation, name: firstOf(q.name_roman) };
    const years = [q.birth?.slice(0, 4), q.death?.slice(0, 4)].filter(Boolean).join(" – ");
    return { relation, name: q.name_roman, ...(years ? { years } : {}) };
  };
  const rel = (q: DPerson, male: string, female: string) => (q.gender === "female" ? female : male);
  const connects: PreviewPerson[] = [
    ...spousesOf(f, p.id).map((q) => show(q, rel(q, "husband", "wife"))),
    ...[fatherOf(f, p.id), motherOf(f, p.id)].filter((q): q is DPerson => !!q).map((q) => show(q, rel(q, "father", "mother"))),
    ...siblingsOf(f, p.id).map((q) => show(q, rel(q, "brother", "sister"))),
    ...childrenOf(f, p.id).map((q) => show(q, rel(q, "son", "daughter"))),
  ].filter((c) => c.name && !c.name.startsWith("("));
  if (p.married_to?.trim() && !spousesOf(f, p.id).length) connects.unshift({ relation: "married to", name: firstOf(p.married_to.split(",")[0]!) });
  const root = f.persons.find((x) => x.is_me) ?? p;
  const year = living(p) ? p.birth?.slice(0, 4) : undefined;
  return { treeTitle, gotra: root.gotra?.roman ?? p.gotra?.roman, mool: root.mool?.roman ?? p.mool?.roman, person: { name: living(p) ? firstOf(p.name_roman) : p.name_roman, year }, connects: connects.slice(0, 14) };
}
