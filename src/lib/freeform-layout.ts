/** Starting positions for the free-form editor: generations in rows, couples side by side, children under their parents. */
import type { DFamily } from "./family";

export interface Pos { x: number; y: number }
export const BOX_W = 156;
export const BOX_H = 64;
const GAP_X = 26;
const GAP_Y = 72;
const COUPLE_GAP = 10;

export function autoLayout(f: DFamily): Map<string, Pos> {
  const ids = f.persons.map((p) => p.id);
  const idset = new Set(ids);
  const parentsOf = new Map<string, string[]>();
  const spouseOf = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => { const a = m.get(k) ?? []; if (!a.includes(v)) a.push(v); m.set(k, a); };
  const connected = new Set<string>();
  for (const r of f.rels) {
    if (!idset.has(r.a) || !idset.has(r.b)) continue;
    connected.add(r.a); connected.add(r.b);
    if (r.type === "parent_of") push(parentsOf, r.b, r.a); else { push(spouseOf, r.a, r.b); push(spouseOf, r.b, r.a); }
  }

  // generation = depth below the oldest ancestor; a couple shares the lower generation of the two
  const level = new Map(ids.map((i) => [i, 0]));
  for (let pass = 0; pass < ids.length + 2; pass++) {
    let changed = false;
    for (const r of f.rels) {
      if (!idset.has(r.a) || !idset.has(r.b)) continue;
      const la = level.get(r.a)!, lb = level.get(r.b)!;
      if (r.type === "parent_of" && lb < la + 1) { level.set(r.b, la + 1); changed = true; }
      if (r.type === "spouse_of" && la !== lb) { const m = Math.max(la, lb); level.set(r.a, m); level.set(r.b, m); changed = true; }
    }
    if (!changed) break;
  }

  // units: a person alone, or a couple (people joined by spouse links) kept together
  const unitOf = new Map<string, string[]>();
  for (const id of ids) {
    if (unitOf.has(id)) continue;
    const group = [id]; const seen = new Set([id]);
    for (let i = 0; i < group.length; i++) for (const s of spouseOf.get(group[i]!) ?? []) if (!seen.has(s)) { seen.add(s); group.push(s); }
    const gender = (x: string) => f.persons.find((p) => p.id === x)?.gender;
    group.sort((a, b) => Number(gender(a) === "male" ? 0 : 1) - Number(gender(b) === "male" ? 0 : 1));
    for (const g of group) unitOf.set(g, group);
  }
  const units = [...new Set(unitOf.values())];
  const unitIndex = new Map(units.map((u, i) => [u, i]));
  const unitW = (u: string[]) => u.length * BOX_W + (u.length - 1) * COUPLE_GAP;

  // each unit hangs under ONE parent unit (its first parent); other parent links are still drawn, just not used for placement
  const primary = new Map<string[], string[]>();
  const kids = new Map<string[], string[][]>();
  for (const u of units) {
    const ps = u.flatMap((i) => parentsOf.get(i) ?? []).map((p) => unitOf.get(p)!).filter((pu) => pu !== u);
    const par = ps.sort((x, y) => unitIndex.get(x)! - unitIndex.get(y)!)[0];
    if (par) { primary.set(u, par); kids.set(par, [...(kids.get(par) ?? []), u]); }
  }
  for (const list of kids.values()) list.sort((x, y) => unitIndex.get(x)! - unitIndex.get(y)!);

  const left = new Map<string[], number>();
  const shift = (u: string[], dx: number) => { left.set(u, left.get(u)! + dx); for (const k of kids.get(u) ?? []) shift(k, dx); };
  /** places a family branch starting at x0; returns the width it uses */
  const place = (u: string[], x0: number): number => {
    const ks = kids.get(u) ?? [];
    const w = unitW(u);
    if (!ks.length) { left.set(u, x0); return w + GAP_X; }
    let cur = x0;
    for (const k of ks) cur += place(k, cur);
    const span = cur - x0 - GAP_X;                  // width taken by the children
    if (span >= w) { left.set(u, x0 + (span - w) / 2); }       // parents centred above the children
    else { for (const k of ks) shift(k, (w - span) / 2); left.set(u, x0); cur = x0 + w + GAP_X; } // children centred under the parents
    return cur - x0;
  };

  const out = new Map<string, Pos>();
  // family branches first, then lone people (not connected to anyone) in a row of their own at the end
  let cursor = 0;
  const roots = units.filter((u) => !primary.has(u));
  const lone = (u: string[]) => u.every((i) => !connected.has(i));
  for (const u of roots.filter((x) => !lone(x))) cursor += place(u, cursor);
  const loners = roots.filter(lone);
  let loneX = 0;
  const loneY = (Math.max(0, ...level.values()) + 1) * (BOX_H + GAP_Y);
  for (const u of loners) { left.set(u, loneX); loneX += unitW(u) + GAP_X; }
  void cursor;

  for (const u of units) {
    const x = left.get(u)!;
    const y = lone(u) ? loneY : level.get(u[0]!)! * (BOX_H + GAP_Y);
    u.forEach((id, i) => out.set(id, { x: x + i * (BOX_W + COUPLE_GAP), y }));
  }
  return out;
}

export function bounds(pos: Map<string, Pos>) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pos.values()) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + BOX_W); y1 = Math.max(y1, p.y + BOX_H); }
  return pos.size ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: BOX_W, y1: BOX_H };
}
