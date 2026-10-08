/**
 * The people of every tree as one graph — who is connected to whom, and in how many steps.
 *  - a node is a person in a tree ("<tree>:<person>");
 *  - edges: parent ↔ child and spouse ↔ spouse inside a tree, and "same woman" links between two trees (a daughter in one, a wife in the other);
 *  - crossing a "same woman" link costs nothing: she is one person, so only real relationships are counted.
 * A step count of 1 means directly related (parent, child, spouse); 2 = one person in between, and so on — the "2nd / 3rd connection" idea.
 * Plain Postgres + this module is enough at this size (tens of thousands of people). A dedicated graph database is worth considering
 * only when there are millions of people or live "who do we both know" queries for every visitor.
 * Admin tools only for now: it reads every tree, living people included.
 */
import type { DFamily, DPerson } from "./family";
import { living as isLiving } from "./connect";
import { fold } from "./lookup";
import type { TreeRow } from "./store";

export type NodeId = string;
export interface GNode { id: NodeId; tree: string; person: string; title: string; name: string; gender?: string; birthYear?: number; deceased: boolean; living: boolean; gotra?: string; mool?: string; place?: string; isMe: boolean }
export type EdgeKind = "parent" | "child" | "spouse" | "link";
interface Edge { to: NodeId; kind: EdgeKind }
export interface Graph { nodes: Map<NodeId, GNode>; adj: Map<NodeId, Edge[]>; trees: number; links: number }

export const nid = (tree: string, person: string): NodeId => `${tree}:${person}`;
const yearOf = (p: DPerson) => { const y = Number(/^\d{4}/.exec(p.birth ?? "")?.[0]); return y || undefined; };

export function buildGraph(rows: Pick<TreeRow, "id" | "title" | "family">[]): Graph {
  const nodes = new Map<NodeId, GNode>(), adj = new Map<NodeId, Edge[]>();
  const add = (a: NodeId, b: NodeId, ka: EdgeKind, kb: EdgeKind) => { (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, kind: ka }); (adj.get(b) ?? adj.set(b, []).get(b)!).push({ to: a, kind: kb }); };
  let links = 0;
  for (const t of rows) {
    const f: DFamily = t.family;
    const root = f.persons.find((p) => p.is_me);
    for (const p of f.persons) {
      if (p.placeholder || p.name_roman.startsWith("(")) continue;
      nodes.set(nid(t.id, p.id), {
        id: nid(t.id, p.id), tree: t.id, person: p.id, title: t.title ?? "Family tree", name: p.name_roman, gender: p.gender, birthYear: yearOf(p), deceased: p.status === "deceased", living: isLiving(p),
        gotra: p.gotra?.roman ?? root?.gotra?.roman, mool: p.mool?.roman ?? root?.mool?.roman, place: p.place, isMe: !!p.is_me,
      });
    }
    for (const r of f.rels) {
      const a = nid(t.id, r.a), b = nid(t.id, r.b);
      if (!nodes.has(a) || !nodes.has(b)) continue;
      if (r.type === "parent_of") add(a, b, "child", "parent"); // from the parent, the other person is a child; from the child, a parent
      else add(a, b, "spouse", "spouse");
    }
  }
  for (const t of rows) for (const p of t.family.persons) for (const l of p.links ?? []) {
    const a = nid(t.id, p.id), b = nid(l.tree, l.person);
    if (!nodes.has(a) || !nodes.has(b) || a >= b) continue; // each link is stored on both sides: add it once
    add(a, b, "link", "link"); links++;
  }
  return { nodes, adj, trees: rows.length, links };
}

export interface Filters { q?: string; gotra?: string; mool?: string; place?: string; gender?: string; tree?: string; from?: number; to?: number; limit?: number }

/** people matching every given attribute (names and places by sound-alike folding, so "Shyam" finds "Syam") */
export function searchPeople(g: Graph, f: Filters): GNode[] {
  const q = fold(f.q ?? ""), gotra = fold(f.gotra ?? ""), mool = fold(f.mool ?? ""), place = fold(f.place ?? "");
  const out: GNode[] = [];
  for (const n of g.nodes.values()) {
    if (q && !fold(n.name).includes(q)) continue;
    if (gotra && !fold(n.gotra ?? "").includes(gotra)) continue;
    if (mool && !fold(n.mool ?? "").includes(mool)) continue;
    if (place && !fold(n.place ?? "").includes(place)) continue;
    if (f.gender && n.gender !== f.gender) continue;
    if (f.tree && n.tree !== f.tree) continue;
    if (f.from && (!n.birthYear || n.birthYear < f.from)) continue;
    if (f.to && (!n.birthYear || n.birthYear > f.to)) continue;
    out.push(n);
    if (out.length >= (f.limit ?? 50)) break;
  }
  return out;
}

export interface Step { node: GNode; /** how this person is related to the one before ("father", "wife", "same woman in another tree", …) */ via?: string }
export interface PathResult { found: boolean; /** number of relationship steps (links between trees are free) */ steps: number; /** "2nd connection" style label */ degree: string; path: Step[]; trees: number }

const VIA: Record<EdgeKind, (n: GNode) => string> = {
  parent: (n) => (n.gender === "female" ? "mother" : "father"),
  child: (n) => (n.gender === "female" ? "daughter" : n.gender === "male" ? "son" : "child"),
  spouse: (n) => (n.gender === "female" ? "wife" : n.gender === "male" ? "husband" : "spouse"),
  link: () => "the same woman, in another family’s tree",
};
const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
export const degreeLabel = (steps: number) => (steps === 0 ? "the same person" : `${ordinal(steps)} connection`);

/** shortest chain of relationships between two people (0-1 BFS: a link between trees costs nothing); null when they are not connected */
export function shortestPath(g: Graph, from: NodeId, to: NodeId, maxSteps = 60): PathResult | null {
  if (!g.nodes.has(from) || !g.nodes.has(to)) return null;
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, { from: NodeId; kind: EdgeKind }>();
  const dq: NodeId[] = [from];
  const seen = new Set<NodeId>();
  while (dq.length) {
    const u = dq.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    if (u === to) break;
    const du = dist.get(u)!;
    for (const e of g.adj.get(u) ?? []) {
      const w = e.kind === "link" ? 0 : 1;
      if (du + w > maxSteps) continue;
      if (du + w < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, du + w); prev.set(e.to, { from: u, kind: e.kind });
        if (w === 0) dq.unshift(e.to); else dq.push(e.to);
      }
    }
  }
  if (!dist.has(to)) return null;
  const path: Step[] = [];
  for (let at: NodeId | undefined = to; at; at = prev.get(at)?.from) {
    const p = prev.get(at);
    path.unshift({ node: g.nodes.get(at)!, ...(p ? { via: VIA[p.kind](g.nodes.get(at)!) } : {}) });
    if (at === from) break;
  }
  const steps = dist.get(to)!;
  return { found: true, steps, degree: degreeLabel(steps), path, trees: new Set(path.map((s) => s.node.tree)).size };
}

/** how the data holds together: separate "islands" of trees that no link joins, and how big the largest one is */
export function stats(g: Graph) {
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; for (let c = x; c !== r;) { const n = parent.get(c)!; parent.set(c, r); c = n; } return r; };
  for (const n of g.nodes.values()) parent.set(n.id, n.id);
  for (const [a, es] of g.adj) for (const e of es) { const ra = find(a), rb = find(e.to); if (ra !== rb) parent.set(ra, rb); }
  const size = new Map<string, number>(); for (const n of g.nodes.keys()) { const r = find(n); size.set(r, (size.get(r) ?? 0) + 1); }
  // trees that are tied to another tree by at least one link
  const linked = new Set<string>();
  for (const [a, es] of g.adj) for (const e of es) if (e.kind === "link") { linked.add(g.nodes.get(a)!.tree); linked.add(g.nodes.get(e.to)!.tree); }
  return { trees: g.trees, people: g.nodes.size, links: g.links, treesLinked: linked.size, groups: size.size, largestGroup: Math.max(0, ...size.values()) };
}

/** people within `depth` steps of one person (for "who is around me"), nearest first */
export function around(g: Graph, from: NodeId, depth = 3, cap = 300): { node: GNode; steps: number }[] {
  if (!g.nodes.has(from)) return [];
  const dist = new Map<NodeId, number>([[from, 0]]);
  const dq: NodeId[] = [from]; const seen = new Set<NodeId>();
  while (dq.length) {
    const u = dq.shift()!; if (seen.has(u)) continue; seen.add(u);
    for (const e of g.adj.get(u) ?? []) {
      const w = e.kind === "link" ? 0 : 1, d = dist.get(u)! + w;
      if (d > depth || d >= (dist.get(e.to) ?? Infinity)) continue;
      dist.set(e.to, d); if (w === 0) dq.unshift(e.to); else dq.push(e.to);
    }
  }
  return [...dist].filter(([id]) => id !== from).sort((a, b) => a[1] - b[1]).slice(0, cap).map(([id, steps]) => ({ node: g.nodes.get(id)!, steps }));
}

/* ───────── what an ordinary signed-in person may see of someone else's family ───────── */

export interface SeenPerson { id: NodeId; name: string; years?: string; gotra?: string; mool?: string; living: boolean }
/** living people by first name only (no birth year, no village); people who have passed away with their full name and years */
export function seenAs(n: GNode): SeenPerson {
  const first = n.name.trim().split(/\s+/)[0] ?? n.name;
  if (n.living) return { id: n.id, name: first, gotra: n.gotra, mool: n.mool, living: true };
  return { id: n.id, name: n.name, years: n.birthYear ? String(n.birthYear) : undefined, gotra: n.gotra, mool: n.mool, living: false };
}

/** people in OTHER trees that are connected to `me`, nearest first */
export function otherFamilies(g: Graph, me: NodeId, limit = 100): (SeenPerson & { steps: number; degree: string })[] {
  const mine = g.nodes.get(me)?.tree;
  return around(g, me, 10, 5000)
    .filter((x) => x.node.tree !== mine)
    .slice(0, limit)
    .map((x) => ({ ...seenAs(x.node), steps: x.steps, degree: degreeLabel(x.steps) }));
}
