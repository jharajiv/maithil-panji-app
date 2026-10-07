/**
 * Server side of "connect trees through married women" (see connect.ts for the matching itself).
 *  - A tree takes part only when its owner has switched "let other families find this tree" on, and a tree can look for
 *    matches only when it takes part itself (you share to see).
 *  - Nothing is linked until a person confirms; a link is written on both women (both trees) and noted for the owners.
 */
import type { DFamily, PersonLink } from "./family";
import { prefixesFor, previewOf, scoreMatch, womenToMatch, type Candidate, type Preview, type Woman } from "./connect";
import { NextResponse } from "next/server";
import { accessFor, currentAccount } from "./auth";
import { getStore, type Member, type Store, type TreeRow } from "./store";
import { clientIp, limited } from "./ratelimit";

export const isDiscoverable = (row: TreeRow) => row.members.some((m) => m.role === "owner" && m.discoverable === true);
export const ownerOf = (row: TreeRow) => row.members.find((m) => m.role === "owner");

/** other tree's women who could be the same as the given woman of mine */
async function candidatesFor(store: Store, mine: TreeRow, women: Woman[]): Promise<Candidate[]> {
  const prefixes = [...new Set(women.flatMap((w) => prefixesFor(w.name)))];
  if (!prefixes.length) return [];
  const hits = (await store.findWomen(prefixes)).filter((h) => h.tree_id !== mine.id);
  const treeIds = [...new Set(hits.map((h) => h.tree_id))].slice(0, 60);
  const out: Candidate[] = [];
  for (const tid of treeIds) {
    const other = await store.getTree(tid);
    if (!other || !isDiscoverable(other)) continue;
    const theirs = womenToMatch(other.family);
    for (const w of women) for (const t of theirs) {
      const m = scoreMatch(w, t);
      if (m) out.push({ person: w.id, personName: w.name, tree: other.id, treePerson: t.id, treeTitle: other.title ?? "Family tree", name: t.name, strength: m.strength, score: m.score, reasons: m.reasons });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 30);
}

export async function findMatches(store: Store, mine: TreeRow): Promise<Candidate[]> {
  if (!isDiscoverable(mine)) return [];
  return candidatesFor(store, mine, womenToMatch(mine.family));
}

/** does this pair (my woman, her counterpart) still look like a match to the server? Prevents the preview from being used to browse other trees. */
export async function checkPair(store: Store, mine: TreeRow, personId: string, treeId: string, treePerson: string): Promise<{ other: TreeRow; strength?: "strong" | "possible" } | null> {
  const other = await store.getTree(treeId);
  if (!other || other.id === mine.id) return null;
  // already linked to each other → always allowed (so the link can be viewed again)
  const me = mine.family.persons.find((p) => p.id === personId);
  if (me?.links?.some((l) => l.tree === treeId && l.person === treePerson)) {
    // a link counts only when the other woman points back at mine (links are written by the server on both sides)
    const back = other.family.persons.find((p) => p.id === treePerson)?.links?.some((l) => l.tree === mine.id && l.person === personId);
    return back ? { other } : null;
  }
  if (!isDiscoverable(mine) || !isDiscoverable(other)) return null;
  const a = womenToMatch(mine.family).find((w) => w.id === personId);
  const b = womenToMatch(other.family).find((w) => w.id === treePerson);
  const m = a && b && scoreMatch(a, b);
  return m ? { other, strength: m.strength } : null;
}

export function previewFor(other: TreeRow, treePerson: string): Preview | null {
  return previewOf(other.family, treePerson, other.title ?? "Family tree");
}

const stamp = () => new Date().toISOString();

export function withLink(f: DFamily, personId: string, link: PersonLink | null, removeTree?: string): DFamily {
  return {
    ...f,
    persons: f.persons.map((p) => {
      if (p.id !== personId) return p;
      const rest = (p.links ?? []).filter((l) => (link ? !(l.tree === link.tree && l.person === link.person) : l.tree !== removeTree));
      const next = link ? [...rest, link] : rest;
      const { links: _drop, ...bare } = p; void _drop;
      return next.length ? { ...bare, links: next } : bare;
    }),
  };
}

export function noteTo(members: Member[], text: string, by: string): Member[] {
  return members.map((m) => (m.role === "owner" ? { ...m, activity: [...(m.activity ?? []), { at: stamp(), by, text: text.slice(0, 200) }].slice(-30) } : m));
}

/** compare-and-set with a few retries (another editor may save at the same moment) */
export async function mutateTree(store: Store, id: string, fn: (row: TreeRow) => Partial<Pick<TreeRow, "family" | "members">> | null): Promise<TreeRow | null> {
  for (let i = 0; i < 4; i++) {
    const row = await store.getTree(id);
    if (!row) return null;
    const patch = fn(row);
    if (!patch) return row;
    const saved = await store.updateTree(id, row.rev, patch, !!patch.family);
    if (saved) {
      if (patch.family) await store.syncPeople(id, patch.family).catch(() => {});
      return saved;
    }
  }
  return null;
}

/* ───────── shared by the route handlers ───────── */

export type Loaded = { store: Store; row: TreeRow; me: Member };
/** the store, the tree and the calling member (owner or helper); or the error response to return */
export async function load(req: Request, id: string, k: string | null | undefined, bucket: string, max: number): Promise<Loaded | NextResponse> {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Sharing is not set up yet." }, { status: 503 });
  if (limited(bucket, clientIp(req), max, 60 * 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const row = await store.getTree(id);
  const me = row && accessFor(row, await currentAccount(req), k)?.member;
  if (!row || !me) return NextResponse.json({ error: "This link is not valid any more." }, { status: 404 });
  return { store, row, me };
}

/** a client may not add, change or remove links to other trees: the stored ones are kept as they are */
export function keepLinks(next: DFamily, stored: DFamily) {
  const had = new Map(stored.persons.map((p) => [p.id, p.links]));
  next.persons = next.persons.map((p) => {
    const { links: _x, ...rest } = p; void _x;
    const l = had.get(p.id);
    return l?.length ? { ...rest, links: l } : rest;
  });
}
