/**
 * The family draft built during the interview, plus the pure operations that change it.
 * The same reducer runs on the server (so the AI sees real results) and on the client (manual edits).
 */
import type { FamilyData, Person, Relationship } from "./types";

export type Gender = "male" | "female" | "other";
export type Flag =
  | "spouse" | "children" | "siblings" | "father" | "mother" | "details"
  | "gotra" | "mool" | "place" | "birth";
export type FlagVal = "done" | "unknown" | "skipped";

/** Simple mode only: a suggested gotra/mool waiting for the user's yes/no. */
export interface Pending { goalId: string; kind: "gotra" | "mool"; ref: PanjiRef; rejected?: boolean }

export interface PanjiRef {
  id?: string; // seed id when matched to the Panji dataset
  roman: string;
  dev?: string;
  custom?: boolean; // typed by the user, not in the seed — flagged for review
}

export interface DPerson {
  id: string;
  name_roman: string;
  name_dev?: string;
  gender?: Gender;
  birth?: string; // "1958" or "1958-03-14"
  status?: "living" | "deceased";
  death?: string;
  place?: string; // village / city
  gotra?: PanjiRef;
  mool?: PanjiRef;
  photo?: string; // data URL (Day 2, local) → storage URL (Day 3)
  notes?: string;
  /** E.164 number, only if the owner chose to invite this person on WhatsApp */
  whatsapp?: string;
  is_me?: boolean;
  /** true when the user doesn't know the name; shown as an empty card */
  placeholder?: boolean;
  flags: Partial<Record<Flag, FlagVal>>;
}

export interface DRel { type: "parent_of" | "spouse_of"; a: string; b: string }

export interface DFamily {
  persons: DPerson[];
  rels: DRel[];
  next: number;
}

export const emptyFamily = (): DFamily => ({ persons: [], rels: [], next: 1 });

/* ───────────────────────── operations ───────────────────────── */

export type RelationSpec = {
  type: "father_of" | "mother_of" | "child_of" | "spouse_of" | "sibling_of";
  /** person id (existing) or a `ref` from an earlier add_person in the same batch */
  to: string;
  /** child_of only: the other parent, when the first parent has several spouses */
  to2?: string;
};

export type PersonFields = Partial<
  Pick<DPerson, "name_roman" | "name_dev" | "gender" | "birth" | "status" | "death" | "place" | "notes">
> & { gotra?: PanjiRef | null; mool?: PanjiRef | null; /** client-only (never from the AI) */ photo?: string | null; whatsapp?: string | null };

export type Op =
  | ({ op: "add_person"; ref?: string; relation?: RelationSpec; placeholder?: boolean } & PersonFields & { name_roman: string })
  | { op: "update_person"; id: string; set: PersonFields }
  | { op: "set_flag"; id: string; flag: Flag; value: FlagVal }
  | { op: "remove_person"; id: string };

export interface OpResult { ok: boolean; message: string; id?: string }

const clean = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();
const get = (f: DFamily, id: string) => f.persons.find((p) => p.id === id);

export const fatherOf = (f: DFamily, id: string) =>
  f.rels.filter((r) => r.type === "parent_of" && r.b === id).map((r) => get(f, r.a)).find((p) => p?.gender === "male");
export const motherOf = (f: DFamily, id: string) =>
  f.rels.filter((r) => r.type === "parent_of" && r.b === id).map((r) => get(f, r.a)).find((p) => p && p.gender !== "male");
export const parentsOf = (f: DFamily, id: string) =>
  f.rels.filter((r) => r.type === "parent_of" && r.b === id).map((r) => get(f, r.a)!).filter(Boolean);
export const childrenOf = (f: DFamily, id: string) =>
  f.rels.filter((r) => r.type === "parent_of" && r.a === id).map((r) => get(f, r.b)!).filter(Boolean);
export const spousesOf = (f: DFamily, id: string) =>
  f.rels.filter((r) => r.type === "spouse_of" && (r.a === id || r.b === id)).map((r) => get(f, r.a === id ? r.b : r.a)!).filter(Boolean);
export const siblingsOf = (f: DFamily, id: string) => {
  const ps = new Set(parentsOf(f, id).map((p) => p.id));
  const out = new Map<string, DPerson>();
  for (const p of ps) for (const c of childrenOf(f, p)) if (c.id !== id) out.set(c.id, c);
  return [...out.values()];
};
export const me = (f: DFamily) => f.persons.find((p) => p.is_me);

const link = (f: DFamily, type: DRel["type"], a: string, b: string) => {
  const dup = f.rels.some((r) => r.type === type && (type === "spouse_of" ? (r.a === a && r.b === b) || (r.a === b && r.b === a) : r.a === a && r.b === b));
  if (!dup && a !== b) f.rels.push({ type, a, b });
};

const inherit = (from: DPerson | undefined, to: DPerson) => {
  if (!from) return;
  to.gotra ??= from.gotra;
  to.mool ??= from.mool;
};

function setFields(p: DPerson, s: PersonFields) {
  if (s.name_roman !== undefined) p.name_roman = clean(s.name_roman);
  if (s.name_dev !== undefined) p.name_dev = clean(s.name_dev) || undefined;
  if (s.gender) p.gender = s.gender;
  if (s.birth !== undefined) p.birth = clean(s.birth) || undefined;
  if (s.death !== undefined) p.death = clean(s.death) || undefined;
  if (s.status) p.status = s.status;
  if (s.death) p.status = "deceased";
  if (s.place !== undefined) p.place = clean(s.place) || undefined;
  if (s.notes !== undefined) p.notes = clean(s.notes) || undefined;
  if (s.gotra !== undefined) p.gotra = s.gotra ?? undefined;
  if (s.mool !== undefined) p.mool = s.mool ?? undefined;
  if (s.photo !== undefined) p.photo = s.photo ?? undefined;
  if (s.whatsapp !== undefined) p.whatsapp = s.whatsapp ?? undefined;
  if (p.placeholder && p.name_roman && !/^\(.*\)$/.test(p.name_roman)) p.placeholder = false;
}

/** Apply a batch of operations. Pure: returns a new family and one result per op. */
export function applyOps(prev: DFamily, ops: Op[]): { family: DFamily; results: OpResult[] } {
  const f: DFamily = structuredClone(prev);
  const refs = new Map<string, string>();
  const results: OpResult[] = [];
  const resolve = (x: string) => refs.get(x) ?? x;

  for (const op of ops) {
    try {
      if (op.op === "add_person") {
        const name = clean(op.name_roman);
        if (!name && !op.placeholder) { results.push({ ok: false, message: "name_roman is required" }); continue; }
        const rel = op.relation;
        const anchorId = rel ? resolve(rel.to) : undefined;
        const anchor = anchorId ? get(f, anchorId) : undefined;
        if (rel && !anchor) { results.push({ ok: false, message: `relation target "${rel.to}" not found` }); continue; }

        // The "me" person is the first one added without a relation.
        const isFirst = f.persons.length === 0;
        const p: DPerson = {
          id: `p${f.next++}`, name_roman: name || "(name not known)", flags: {},
          placeholder: !!op.placeholder || !name || undefined,
          is_me: isFirst || undefined,
        };
        setFields(p, { ...op, name_roman: name || p.name_roman });
        if (!name) p.placeholder = true;

        if (rel && anchor) {
          switch (rel.type) {
            case "father_of":
              p.gender ??= "male"; f.persons.push(p);
              link(f, "parent_of", p.id, anchor.id);
              inherit(anchor, p);
              { const m = motherOf(f, anchor.id); if (m) link(f, "spouse_of", p.id, m.id); }
              break;
            case "mother_of":
              p.gender ??= "female"; f.persons.push(p);
              link(f, "parent_of", p.id, anchor.id);
              { const fa = fatherOf(f, anchor.id); if (fa) link(f, "spouse_of", p.id, fa.id); }
              break;
            case "child_of": {
              f.persons.push(p);
              const other = op.relation?.to2 ? get(f, resolve(op.relation.to2)) : undefined;
              const second = other ?? (spousesOf(f, anchor.id).length === 1 ? spousesOf(f, anchor.id)[0] : undefined);
              link(f, "parent_of", anchor.id, p.id);
              if (second) link(f, "parent_of", second.id, p.id);
              inherit([anchor, second].find((x) => x?.gender === "male"), p);
              break;
            }
            case "spouse_of":
              p.gender ??= anchor.gender === "male" ? "female" : anchor.gender === "female" ? "male" : undefined;
              f.persons.push(p);
              link(f, "spouse_of", anchor.id, p.id);
              anchor.flags.spouse = "done";
              break;
            case "sibling_of": {
              f.persons.push(p);
              let parents = parentsOf(f, anchor.id);
              if (!parents.length) {
                // anchor has no recorded parents yet: create an unnamed father so the siblings share a parent
                const ph: DPerson = { id: `p${f.next++}`, name_roman: "(name not known)", gender: "male", placeholder: true, flags: { father: "unknown" } };
                inherit(anchor, ph); f.persons.push(ph); link(f, "parent_of", ph.id, anchor.id); parents = [ph];
                anchor.flags.father = "unknown";
              }
              for (const par of parents) link(f, "parent_of", par.id, p.id);
              inherit(anchor, p);
              break;
            }
          }
        } else {
          f.persons.push(p);
        }
        if (op.ref) refs.set(op.ref, p.id);
        results.push({ ok: true, message: `added ${p.name_roman}`, id: p.id });
      } else if (op.op === "update_person") {
        const p = get(f, resolve(op.id));
        if (!p) { results.push({ ok: false, message: `person "${op.id}" not found` }); continue; }
        setFields(p, op.set);
        results.push({ ok: true, message: `updated ${p.name_roman}`, id: p.id });
      } else if (op.op === "set_flag") {
        const p = get(f, resolve(op.id));
        if (!p) { results.push({ ok: false, message: `person "${op.id}" not found` }); continue; }
        p.flags[op.flag] = op.value;
        results.push({ ok: true, message: `${p.name_roman}.${op.flag}=${op.value}`, id: p.id });
      } else if (op.op === "remove_person") {
        const p = get(f, resolve(op.id));
        if (!p) { results.push({ ok: false, message: `person "${op.id}" not found` }); continue; }
        if (p.is_me) { results.push({ ok: false, message: "cannot remove the person who is filling this in" }); continue; }
        f.persons = f.persons.filter((x) => x.id !== p.id);
        f.rels = f.rels.filter((r) => r.a !== p.id && r.b !== p.id);
        results.push({ ok: true, message: `removed ${p.name_roman}` });
      }
    } catch (e) {
      results.push({ ok: false, message: String(e) });
    }
  }
  return { family: f, results };
}

/* ───────────────────────── labels (for prompts and cards) ───────────────────────── */

/** Relationship of every person to "me", e.g. "father", "grandfather", "father's brother". */
export function labels(f: DFamily): Record<string, string> {
  const out: Record<string, string> = {};
  const m = me(f);
  if (!m) return out;
  out[m.id] = "you";
  const up = ["father", "grandfather", "great-grandfather", "great-great-grandfather"];
  const upMother = ["mother", "grandmother", "great-grandmother", "great-great-grandmother"];
  let cur: DPerson | undefined = m;
  let gen = 0;
  const seen = new Set<string>([m.id]);
  while (cur && gen < 12) {
    const fa = fatherOf(f, cur.id);
    const label = (arr: string[], g: number) => arr[g] ?? `${g - 1}x-great-grandfather`;
    if (fa && !seen.has(fa.id)) {
      out[fa.id] = label(up, gen); seen.add(fa.id);
      const mo = motherOf(f, cur.id);
      if (mo) out[mo.id] = label(upMother, gen);
      // siblings of `cur`
      for (const s of siblingsOf(f, cur.id)) {
        if (out[s.id]) continue;
        const g = s.gender === "male" ? "brother" : s.gender === "female" ? "sister" : "sibling";
        out[s.id] = gen === 0 ? `your ${g}` : `${out[cur.id]}'s ${g}`;
      }
      cur = fa; gen++;
    } else break;
  }
  const bfs = [...f.persons];
  for (let i = 0; i < 4; i++) {
    for (const p of bfs) {
      if (out[p.id]) continue;
      const sp = spousesOf(f, p.id).find((s) => out[s.id]);
      if (sp) { out[p.id] = `${out[sp.id]}'s ${p.gender === "male" ? "husband" : "wife"}`.replace("you's", "your"); continue; }
      const par = parentsOf(f, p.id).find((s) => out[s.id]);
      if (par) out[p.id] = `${out[par.id].replace(/^you$/, "your")}'s ${p.gender === "male" ? "son" : p.gender === "female" ? "daughter" : "child"}`.replace("your's", "your");
    }
  }
  for (const p of f.persons) out[p.id] ??= "relative";
  return out;
}

/** Number of generations in the patriline above "me" that are named. */
export function patrilineDepth(f: DFamily): number {
  const m = me(f);
  let n = 0;
  for (let c = m && fatherOf(f, m.id); c && n < 20; c = fatherOf(f, c.id)) if (!c.placeholder) n++;
  return n;
}

/* ───────────────────────── conversion to the tree renderer's model ───────────────────────── */

const pj = (r?: PanjiRef) => (r ? r.roman : undefined);

export function toFamilyData(f: DFamily): FamilyData | null {
  const m = me(f);
  if (!m) return null;
  const persons: Person[] = f.persons.map((p) => ({
    person_id: p.id,
    name_roman: p.placeholder ? "Name not known" : p.name_roman,
    name_devanagari: p.placeholder ? undefined : p.name_dev,
    gender: p.gender ?? "male",
    dob: p.birth,
    dod: p.death,
    is_living: p.status !== "deceased",
    gotra: pj(p.gotra),
    mool: pj(p.mool),
    current_village: p.place,
    notes: p.notes,
    photo: p.photo,
    source: "user_input",
  }));
  const relationships: Relationship[] = f.rels.map((r, i) => ({
    rel_id: `r${i}`, person_a_id: r.a, person_b_id: r.b, type: r.type, confidence: "confirmed",
  }));
  return { persons, relationships, root_person_id: m.id };
}

/* ───────────────────────── persistence (local, per browser) ───────────────────────── */

const KEY = "maithil-panji.family.v1";
export function loadFamily(): DFamily | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DFamily) : null;
  } catch { return null; }
}
export function saveFamily(f: DFamily) {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* quota / private mode */ }
}
export function clearFamily() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
