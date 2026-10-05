/**
 * Three-way merge of two edited copies of the same family.
 *   base   = the last copy both sides agreed on
 *   mine   = my edited copy
 *   theirs = the copy someone else saved meanwhile
 * Rules: a field I changed wins, otherwise theirs; people either side added are kept (my new ids are renumbered if they
 * clash with theirs); a person deleted by either side is gone unless the other side edited them; relations are
 * unioned minus anything either side removed.
 */
import type { DFamily, DPerson, DRel } from "./family";

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const relKey = (r: DRel) => (r.type === "spouse_of" ? `s|${[r.a, r.b].sort().join("|")}` : `p|${r.a}|${r.b}`);
const num = (id: string) => { const n = Number(id.replace(/^p/, "")); return Number.isFinite(n) ? n : 0; };

function mergePerson(base: DPerson | undefined, mine: DPerson, theirs: DPerson): DPerson {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(mine), ...Object.keys(theirs), ...(base ? Object.keys(base) : [])]);
  for (const k of keys) {
    if (k === "flags") continue;
    const b = base ? (base as unknown as Record<string, unknown>)[k] : undefined;
    const m = (mine as unknown as Record<string, unknown>)[k];
    const t = (theirs as unknown as Record<string, unknown>)[k];
    const v = base ? (!same(m, b) ? m : t) : (m !== undefined ? m : t);
    if (v !== undefined) out[k] = v;
  }
  const flags: DPerson["flags"] = {};
  const fk = new Set([...Object.keys(mine.flags), ...Object.keys(theirs.flags), ...Object.keys(base?.flags ?? {})]) as Set<keyof DPerson["flags"]>;
  for (const k of fk) {
    const b = base?.flags[k], m = mine.flags[k], t = theirs.flags[k];
    const v = base ? (!same(m, b) ? m : t) : (m ?? t);
    if (v) flags[k] = v;
  }
  out.flags = flags;
  return out as unknown as DPerson;
}

export function mergeFamilies(base: DFamily, mine: DFamily, theirs: DFamily): DFamily {
  const baseP = new Map(base.persons.map((p) => [p.id, p]));
  const theirP = new Map(theirs.persons.map((p) => [p.id, p]));

  // renumber people I added whose ids clash with people they added
  let counter = Math.max(base.next, mine.next, theirs.next, ...mine.persons.map((p) => num(p.id) + 1), ...theirs.persons.map((p) => num(p.id) + 1));
  const idMap = new Map<string, string>();
  for (const p of mine.persons) if (!baseP.has(p.id) && theirP.has(p.id)) idMap.set(p.id, `p${counter++}`);
  const mapId = (id: string) => idMap.get(id) ?? id;
  const mineP = new Map(mine.persons.map((p) => [mapId(p.id), idMap.has(p.id) ? { ...p, id: mapId(p.id) } : p]));

  const persons: DPerson[] = [];
  const seen = new Set<string>();
  const take = (id: string) => {
    seen.add(id);
    const b = baseP.get(id), m = mineP.get(id), t = theirP.get(id);
    if (m && t) return persons.push(mergePerson(b, m, t));
    if (b && !m) return; // I deleted them
    if (b && !t) { if (m && !same(m, b)) persons.push(m); return; } // they deleted; keep only if I edited
    persons.push((m ?? t)!); // added by one side
  };
  for (const p of theirs.persons) take(p.id);
  for (const id of mineP.keys()) if (!seen.has(id)) take(id);
  const alive = new Set(persons.map((p) => p.id));

  const B = new Map(base.rels.map((r) => [relKey(r), r]));
  const M = new Map(mine.rels.map((r) => { const x = { ...r, a: mapId(r.a), b: mapId(r.b) }; return [relKey(x), x] as const; }));
  const T = new Map(theirs.rels.map((r) => [relKey(r), r]));
  const rels: DRel[] = [];
  const all = new Map([...T, ...M]);
  for (const [k, r] of all) {
    if (B.has(k) && (!M.has(k) || !T.has(k))) continue; // removed by either side
    if (alive.has(r.a) && alive.has(r.b)) rels.push(r);
  }
  const next = Math.max(counter, ...persons.map((p) => num(p.id) + 1));
  return { persons, rels, next };
}
