/**
 * Guided combining of two family trees that are (probably) the same family entered twice — after both owners have talked and agreed.
 *
 * The receiving tree gets everything the giving tree knows:
 *  - people who look the same in both (see similar.ts) are treated as ONE person: blanks are filled, differences are only reported, never overwritten;
 *  - people only the giving tree has are added, together with their relations, as long as they hang on to someone both trees have;
 *  - nothing that would break the tree is added (a second father, a person who would become their own ancestor) — it is reported instead.
 * The giving tree is never changed. Everything this does is recorded in a small "delta" so the owner can undo it.
 * Pure functions only; the owners' consent, rights and notes are handled by the route.
 */
import { normalizeCouples, type DFamily, type DPerson, type DRel } from "./family";
import { fold } from "./lookup";
import { pairPeople, type PairScore } from "./similar";

export const MIN_COMBINE_PAIRS = 3;
const MAX_PEOPLE = 3000;

export interface CombinePair { /** the person's id in the GIVING tree (what the owner ticks off) */ id: string; mine: string; theirs: string; reasons: string[]; score: number }
export interface Conflict { person: string; field: string; mine: string; theirs: string }
export interface Filled { id: string; field: string; prev?: unknown; now: unknown }
/** everything needed to take a combine back */
export interface CombineDelta { added: string[]; addedRels: DRel[]; removedPersons: DPerson[]; removedRels: DRel[]; filled: Filled[] }
export interface CombinePlan {
  ok: boolean; reason?: string;
  pairs: CombinePair[];
  /** how many of the pairs are used (not ticked off) */
  used: number;
  family: DFamily;
  added: { name: string; place?: string; years?: string }[];
  filled: { person: string; field: string; value: string }[];
  conflicts: Conflict[];
  /** relations that were not copied because they would break the tree */
  skippedRelations: number;
  /** people of the giving tree that are not connected to anyone both trees have */
  leftOut: number;
  delta: CombineDelta;
}

const FIELDS = ["name_dev", "gender", "birth", "death", "status", "place", "married_to", "notes", "photo"] as const;
const relKey = (r: DRel) => (r.type === "spouse_of" ? `s|${[r.a, r.b].sort().join("|")}` : `p|${r.a}|${r.b}`);
const num = (id: string) => { const n = Number(id.replace(/^p/, "")); return Number.isFinite(n) ? n : 0; };
const isReal = (p: DPerson) => !p.placeholder && !p.name_roman.startsWith("(");
const show = (v: unknown) => (v && typeof v === "object" && "roman" in v ? String((v as { roman: string }).roman) : String(v ?? ""));
const first = (s: string) => fold(s.split(",")[0] ?? "");
const years = (p: DPerson) => [p.birth?.slice(0, 4), p.death?.slice(0, 4)].filter(Boolean).join("–") || undefined;

/** fill blanks of a matched person; collect differences */
function fillPerson(mine: DPerson, theirs: DPerson, filled: Filled[], conflicts: Conflict[]) {
  const set = (field: string, value: unknown) => { filled.push({ id: mine.id, field, prev: (mine as unknown as Record<string, unknown>)[field], now: value }); (mine as unknown as Record<string, unknown>)[field] = value; };
  const differ = (field: string, a: string, b: string) => conflicts.push({ person: mine.name_roman, field, mine: a, theirs: b });
  if (fold(mine.name_roman) !== fold(theirs.name_roman) && mine.name_roman !== theirs.name_roman) differ("name", mine.name_roman, theirs.name_roman);
  for (const f of FIELDS) {
    const m = mine[f], t = theirs[f];
    if (t === undefined || t === "") continue;
    if (m === undefined || m === "") { set(f, t); continue; }
    if (m === t || f === "notes" || f === "photo") continue;
    if (f === "birth" || f === "death") {
      // "1958" and "1958-03-14" agree; the more exact one is welcome
      if (String(t).slice(0, 4) === String(m).slice(0, 4)) { if (String(m).length === 4 && String(t).length > 4) set(f, t); continue; }
    } else if (f === "place" || f === "married_to") { if (first(String(m)) === first(String(t))) continue; }
    else if (f === "name_dev") continue;
    differ(f, String(m), String(t));
  }
  for (const k of ["gotra", "mool"] as const) {
    const m = mine[k], t = theirs[k];
    if (!t?.roman) continue;
    if (!m?.roman) set(k, t); else if (fold(m.roman) !== fold(t.roman)) differ(k, show(m), show(t));
  }
}

export function planCombine(mine: DFamily, theirs: DFamily, exclude: ReadonlySet<string> = new Set()): CombinePlan {
  const all = pairPeople(mine, theirs);
  const pairs: CombinePair[] = all.map((c: { a: DPerson; b: DPerson; r: PairScore }) => ({ id: c.b.id, mine: c.a.name_roman, theirs: c.b.name_roman, reasons: c.r.reasons, score: c.r.score }));
  const active = all.filter((c) => !exclude.has(c.b.id));
  const empty = (reason: string): CombinePlan => ({ ok: false, reason, pairs, used: active.length, family: mine, added: [], filled: [], conflicts: [], skippedRelations: 0, leftOut: 0, delta: { added: [], addedRels: [], removedPersons: [], removedRels: [], filled: [] } });
  if (active.length < MIN_COMBINE_PAIRS) return empty(`At least ${MIN_COMBINE_PAIRS} people must be the same in both trees. Only ${active.length} are ticked.`);

  const persons: DPerson[] = mine.persons.map((p) => ({ ...p, flags: { ...p.flags } }));
  const byId = new Map(persons.map((p) => [p.id, p]));
  const theirsById = new Map(theirs.persons.map((p) => [p.id, p]));
  const toMine = new Map<string, string>(active.map((c) => [c.b.id, c.a.id]));
  let next = Math.max(mine.next, ...mine.persons.map((p) => num(p.id) + 1));

  // 1. people of the giving tree that hang on to a shared person (walk the relations outward from the matched people)
  const adj = new Map<string, string[]>();
  for (const r of theirs.rels) { (adj.get(r.a) ?? adj.set(r.a, []).get(r.a)!).push(r.b); (adj.get(r.b) ?? adj.set(r.b, []).get(r.b)!).push(r.a); }
  const reach = new Set<string>(toMine.keys());
  const q = [...toMine.keys()];
  while (q.length) {
    const u = q.pop()!;
    for (const v of adj.get(u) ?? []) {
      const p = theirsById.get(v);
      if (!p || reach.has(v) || !isReal(p)) continue;
      reach.add(v); q.push(v);
    }
  }
  const leftOut = theirs.persons.filter((p) => isReal(p) && !reach.has(p.id)).length;

  // 2. add the new people (without anything private to the other tree: links, WhatsApp number, "this is me")
  const addedIds: string[] = [];
  for (const p of theirs.persons) {
    if (toMine.has(p.id) || !reach.has(p.id)) continue;
    const { links: _l, whatsapp: _w, is_me: _m, ...rest } = p; void _l; void _w; void _m;
    const np: DPerson = { ...rest, id: `p${next++}`, flags: { ...p.flags } };
    persons.push(np); byId.set(np.id, np); toMine.set(p.id, np.id); addedIds.push(np.id);
  }
  if (persons.length > MAX_PEOPLE) return empty("The combined tree would be too large.");

  // 3. matched people: fill blanks, report differences
  const filled: Filled[] = [], conflicts: Conflict[] = [];
  for (const c of active) fillPerson(byId.get(c.a.id)!, c.b, filled, conflicts);

  // 4. relations, parents first
  let rels: DRel[] = mine.rels.map((r) => ({ ...r }));
  const has = new Set(rels.map(relKey));
  const parentsOf = (id: string) => rels.filter((r) => r.type === "parent_of" && r.b === id).map((r) => byId.get(r.a)).filter((p): p is DPerson => !!p);
  const isAncestor = (anc: string, of: string) => { // is `anc` already an ancestor of `of`?
    const seen = new Set<string>(), st = [of];
    while (st.length) { const u = st.pop()!; for (const r of rels) if (r.type === "parent_of" && r.b === u && !seen.has(r.a)) { if (r.a === anc) return true; seen.add(r.a); st.push(r.a); } }
    return false;
  };
  const removedPersons: DPerson[] = [], removedRels: DRel[] = [];
  /** a parent whose name nobody knows ("(name not known)") gives way to the real one */
  const absorb = (placeholder: DPerson, into: string) => {
    removedPersons.push(placeholder);
    const keep: DRel[] = [];
    for (const r of rels) {
      if (r.a !== placeholder.id && r.b !== placeholder.id) { keep.push(r); continue; }
      removedRels.push(r); has.delete(relKey(r));
      const moved: DRel = { ...r, a: r.a === placeholder.id ? into : r.a, b: r.b === placeholder.id ? into : r.b };
      if (moved.a !== moved.b && !has.has(relKey(moved))) { keep.push(moved); has.add(relKey(moved)); }
    }
    rels = keep;
    persons.splice(persons.findIndex((p) => p.id === placeholder.id), 1); byId.delete(placeholder.id);
  };
  let skipped = 0;
  const wanted = theirs.rels.filter((r) => toMine.has(r.a) && toMine.has(r.b)).sort((x, y) => (x.type === y.type ? 0 : x.type === "parent_of" ? -1 : 1));
  for (const r of wanted) {
    const a = toMine.get(r.a)!, b = toMine.get(r.b)!;
    if (a === b) continue;
    const out: DRel = { type: r.type, a, b };
    if (has.has(relKey(out))) continue;
    if (r.type === "parent_of") {
      const pa = byId.get(a)!;
      if (isAncestor(b, a)) { skipped++; continue; } // would make someone their own ancestor
      const clash = parentsOf(b).find((x) => x.id !== a && (pa.gender === "male" ? x.gender === "male" : x.gender !== "male"));
      if (clash) {
        if (clash.placeholder && clash.id !== a && !addedIds.includes(clash.id)) absorb(clash, a);
        else { skipped++; continue; }
      }
    }
    rels.push(out); has.add(relKey(out));
  }

  let family: DFamily = normalizeCouples({ persons, rels, next });
  family = { ...family, next: Math.max(family.next, next) };

  const before = new Set(mine.rels.map(relKey)), after = new Set(family.rels.map(relKey));
  const delta: CombineDelta = {
    added: addedIds,
    addedRels: family.rels.filter((r) => !before.has(relKey(r))),
    removedPersons, removedRels: mine.rels.filter((r) => !after.has(relKey(r))),
    filled,
  };
  return {
    ok: true, pairs, used: active.length, family,
    added: addedIds.map((id) => { const p = byId.get(id)!; return { name: p.name_roman, place: p.place, years: years(p) }; }),
    filled: filled.map((f) => ({ person: byId.get(f.id)?.name_roman ?? "", field: f.field, value: show(f.now) })),
    conflicts, skippedRelations: skipped, leftOut, delta,
  };
}

/** take a combine back: the people and relations it added go, placeholders it replaced return, blanks it filled become blank again (only if nobody changed them since) */
export function undoCombine(current: DFamily, d: CombineDelta): DFamily {
  const gone = new Set(d.added);
  let persons = current.persons.filter((p) => !gone.has(p.id));
  const dropRel = new Set(d.addedRels.map(relKey));
  let rels = current.rels.filter((r) => !gone.has(r.a) && !gone.has(r.b) && !dropRel.has(relKey(r)));
  for (const p of d.removedPersons) if (!persons.some((x) => x.id === p.id)) persons = [...persons, p];
  const have = new Set(rels.map(relKey));
  for (const r of d.removedRels) if (!have.has(relKey(r)) && persons.some((p) => p.id === r.a) && persons.some((p) => p.id === r.b)) { rels = [...rels, r]; have.add(relKey(r)); }
  persons = persons.map((p) => {
    const mine = d.filled.filter((f) => f.id === p.id);
    if (!mine.length) return p;
    const o = { ...p } as unknown as Record<string, unknown>;
    for (const f of mine) if (JSON.stringify(o[f.field] ?? null) === JSON.stringify(f.now ?? null)) { if (f.prev === undefined) delete o[f.field]; else o[f.field] = f.prev; }
    return o as unknown as DPerson;
  });
  return { ...current, persons, rels };
}
