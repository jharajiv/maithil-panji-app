/**
 * Server side of "this may be the same family tree" (see similar.ts for the comparison).
 * Both trees must have agreed to be found (the same opt-in as for matching married women). Nothing is merged here:
 * the owners preview, send a request to each other, share contact details they choose to, and decide together.
 */
import { fatherOf, type DFamily } from "./family";
import { living } from "./connect";
import { isDiscoverable } from "./connect-server";
import { compareTrees, stockOf, type TreeMatch } from "./similar";
import type { Store, TreeRow } from "./store";

export interface SimilarTree {
  tree: string; title: string; people: number; gotra?: string; mool?: string;
  percent: number; strength: TreeMatch["strength"]; matched: number;
  /** a few of the people found in both trees */
  pairs: TreeMatch["pairs"];
}

const summary = (other: TreeRow, m: TreeMatch): SimilarTree => {
  const s = stockOf(other.family);
  return { tree: other.id, title: other.title ?? "Family tree", people: other.family.persons.filter((p) => !p.placeholder).length, gotra: s.gotra?.roman, mool: s.mool?.roman, percent: m.percent, strength: m.strength, matched: m.matched, pairs: m.pairs.slice(0, 4) };
};

/** up to 10 other opt-in trees with the same gotra and mool that look like the same family, best first */
export async function findSimilar(store: Store, mine: TreeRow): Promise<SimilarTree[]> {
  if (!isDiscoverable(mine)) return [];
  const s = stockOf(mine.family);
  if (!s.gotra?.roman || !s.mool?.roman) return [];
  const ids = (await store.findTreesBySameStock(s.gotra, s.mool, 60)).filter((id) => id !== mine.id);
  const out: SimilarTree[] = [];
  for (const id of ids) {
    const other = await store.getTree(id);
    if (!other || !isDiscoverable(other)) continue;
    const m = compareTrees(mine.family, other.family);
    if (m) out.push(summary(other, m));
  }
  return out.sort((a, b) => b.percent - a.percent).slice(0, 10);
}

/** is this tree still similar to mine? (so preview and requests cannot be used to browse arbitrary trees) */
export async function checkSimilar(store: Store, mine: TreeRow, otherId: string): Promise<{ other: TreeRow; match: TreeMatch } | null> {
  if (otherId === mine.id || !isDiscoverable(mine)) return null;
  const s = stockOf(mine.family);
  if (!s.gotra?.roman || !s.mool?.roman) return null;
  const other = await store.getTree(otherId);
  if (!other || !isDiscoverable(other)) return null;
  const m = compareTrees(mine.family, other.family);
  return m ? { other, match: m } : null;
}

export interface Glance {
  title: string; gotra?: string; mool?: string; people: number;
  /** the oldest recorded ancestors (people with no recorded parents, no longer living) */
  ancestors: string[];
  /** villages that appear most often */
  places: string[];
  pairs: TreeMatch["pairs"];
}

/** enough of the other tree to judge whether it is the same family; living people by first name only */
export function glance(other: TreeRow, m: TreeMatch): Glance {
  const f: DFamily = other.family;
  const s = stockOf(f);
  const roots = f.persons.filter((p) => !p.placeholder && !p.name_roman.startsWith("(") && p.gender !== "female" && !fatherOf(f, p.id) && !living(p));
  const kids = (id: string) => f.rels.filter((r) => r.type === "parent_of" && r.a === id).length;
  const ancestors = roots.sort((a, b) => kids(b.id) - kids(a.id)).slice(0, 6).map((p) => [p.name_roman, [p.birth?.slice(0, 4), p.death?.slice(0, 4)].filter(Boolean).join("–")].filter(Boolean).join(" ").trim());
  const count = new Map<string, number>();
  for (const p of f.persons) { const v = (p.place ?? "").split(",")[0]?.trim(); if (v) count.set(v, (count.get(v) ?? 0) + 1); }
  const places = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v);
  return { title: other.title ?? "Family tree", gotra: s.gotra?.roman, mool: s.mool?.roman, people: f.persons.filter((p) => !p.placeholder).length, ancestors, places, pairs: m.pairs.slice(0, 20) };
}
