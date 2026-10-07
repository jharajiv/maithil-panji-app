/**
 * The family draft built during the interview, plus the pure operations that change it.
 * The same reducer runs on the server (so the AI sees real results) and on the client (manual edits).
 */
import type { FamilyData, Person, Relationship } from "./types";

export type Gender = "male" | "female" | "other";
export type Flag =
  | "spouse" | "children" | "siblings" | "father" | "mother" | "details"
  | "gotra" | "mool" | "place" | "birth"
  /** the step-by-step interview asks these one group at a time (older saved trees used siblings/children for two of them) */
  | "brothers" | "sisters" | "sons" | "daughters" | "husband"
  /** set when someone deliberately removed a parent connection: stops the app re-adding the other parent's spouse */
  | "parents";
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
  /** a sister's or daughter's husband, kept as one short note ("Rajesh Jha, Darbhanga") — his own family is recorded on his chart */
  married_to?: string;
  /** the same woman in another family's tree (she appears as a daughter in one and as a wife in the other) — set only after someone confirmed the match */
  links?: PersonLink[];
  /** E.164 number, only if the owner chose to invite this person on WhatsApp */
  whatsapp?: string;
  is_me?: boolean;
  /** true when the user doesn't know the name; shown as an empty card */
  placeholder?: boolean;
  flags: Partial<Record<Flag, FlagVal>>;
}

export interface PersonLink { tree: string; person: string; title?: string; at: string; by?: string }

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
  Pick<DPerson, "name_roman" | "name_dev" | "gender" | "birth" | "status" | "death" | "place" | "notes" | "married_to">
> & { gotra?: PanjiRef | null; mool?: PanjiRef | null; /** client-only (never from the AI) */ photo?: string | null; whatsapp?: string | null };

export type Op =
  | ({ op: "add_person"; ref?: string; relation?: RelationSpec; placeholder?: boolean } & PersonFields & { name_roman: string })
  | { op: "update_person"; id: string; set: PersonFields }
  | { op: "set_flag"; id: string; flag: Flag; value: FlagVal }
  | { op: "remove_person"; id: string }
  /** free-form editor only (never from the AI): connect / disconnect two people. parent_of: a is a parent of b. */
  | { op: "link"; type: "parent_of" | "spouse_of"; a: string; b: string }
  | { op: "unlink"; type: "parent_of" | "spouse_of"; a: string; b: string };

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


/**
 * Brothers and sisters must share a father. If this person's father is not recorded yet (the user does not know his name),
 * create an unnamed one — and marry him to the mother when only she is known — so the siblings hang from the same couple.
 */
function ensureFather(f: DFamily, anchor: DPerson): DPerson[] {
  const parents = parentsOf(f, anchor.id);
  if (parents.some((x) => x.gender === "male")) return parents;
  const ph: DPerson = { id: `p${f.next++}`, name_roman: "(name not known)", gender: "male", placeholder: true, flags: { father: "unknown" } };
  inherit(anchor, ph); f.persons.push(ph);
  link(f, "parent_of", ph.id, anchor.id);
  const mother = parents.find((x) => x.gender !== "male");
  if (mother) link(f, "spouse_of", ph.id, mother.id);
  anchor.flags.father = "unknown";
  return [ph, ...parents];
}

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
  if (s.married_to !== undefined) p.married_to = clean(s.married_to).slice(0, 120) || undefined;
  if (s.gotra !== undefined) p.gotra = s.gotra ?? undefined;
  if (s.mool !== undefined) p.mool = s.mool ?? undefined;
  if (s.photo !== undefined) p.photo = s.photo ?? undefined;
  if (s.whatsapp !== undefined) p.whatsapp = s.whatsapp ?? undefined;
  if (p.placeholder && p.name_roman && !/^\(.*\)$/.test(p.name_roman)) p.placeholder = false;
}

/**
 * A child whose only recorded parent has exactly one spouse belongs to both of them — so the chart hangs the child from the
 * line between the couple, not from one parent's box. (With two or more spouses we cannot tell whose child it is, so we leave it.)
 */
export function normalizeCouples(f: DFamily): DFamily {
  const parents = new Map<string, string[]>();
  const spouses = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => { const a = m.get(k) ?? []; if (!a.includes(v)) a.push(v); m.set(k, a); };
  for (const r of f.rels) {
    if (r.type === "parent_of") push(parents, r.b, r.a);
    else { push(spouses, r.a, r.b); push(spouses, r.b, r.a); }
  }
  const ids = new Set(f.persons.map((p) => p.id));
  const keep = new Set(f.persons.filter((p) => p.flags.parents).map((p) => p.id));
  const add: DRel[] = [];
  for (const [child, ps] of parents) {
    if (ps.length !== 1 || !ids.has(child) || keep.has(child)) continue;
    const sp = (spouses.get(ps[0]!) ?? []).filter((x) => ids.has(x) && x !== child);
    if (sp.length === 1) add.push({ type: "parent_of", a: sp[0]!, b: child });
  }
  return add.length ? { ...f, rels: [...f.rels, ...add] } : f;
}

export const PANJI_FEMALE_NOTE =
  "Panji records a daughter or sister only by name — her husband and children belong to her husband's family chart. Do not add them.";

export interface ApplyOptions {
  /** interview mode: refuse to add a husband or children under a daughter/sister, as the Panji does */
  panji?: boolean;
}

/** Apply a batch of operations. Pure: returns a new family and one result per op. */
export function applyOps(prev: DFamily, ops: Op[], opts: ApplyOptions = {}): { family: DFamily; results: OpResult[] } {
  const f: DFamily = structuredClone(prev);
  const refs = new Map<string, string>();
  const results: OpResult[] = [];
  const resolve = (x: string) => refs.get(x) ?? x;

  for (const op of ops) {
    try {
      if (op.op === "add_person") {
        const name = clean(op.name_roman);
        if (!name && !op.placeholder) { results.push({ ok: false, message: "name_roman is required" }); continue; }
        let rel = op.relation;
        const anchorId = rel ? resolve(rel.to) : undefined;
        let anchor = anchorId ? get(f, anchorId) : undefined;
        if (rel && !anchor) { results.push({ ok: false, message: `relation target "${rel.to}" not found` }); continue; }
        if (opts.panji && rel && anchor && anchor.gender === "female" && (rel.type === "spouse_of" || rel.type === "child_of")) {
          // a wife's child is recorded under her husband; a daughter's or sister's husband/children are not recorded at all
          const husband = parentsOf(f, anchor.id).length === 0 && rel.type === "child_of" && spousesOf(f, anchor.id).length === 1 ? spousesOf(f, anchor.id)[0] : undefined;
          if (husband && husband.gender !== "female") { rel = { type: "child_of", to: husband.id, to2: anchor.id }; anchor = husband; }
          else { results.push({ ok: false, message: PANJI_FEMALE_NOTE }); continue; }
        }

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
              const other = rel.to2 ? get(f, resolve(rel.to2)) : undefined;
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
              const parents = ensureFather(f, anchor);
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
      } else if (op.op === "link") {
        const a = get(f, resolve(op.a)), b = get(f, resolve(op.b));
        if (!a || !b) { results.push({ ok: false, message: "person not found" }); continue; }
        if (a.id === b.id) { results.push({ ok: false, message: "A person cannot be connected to themselves." }); continue; }
        if (op.type === "parent_of") {
          if (f.rels.some((r) => r.type === "parent_of" && r.a === a.id && r.b === b.id)) { results.push({ ok: false, message: `${a.name_roman} is already a parent of ${b.name_roman}.` }); continue; }
          // would this make someone their own ancestor?
          const anc = new Set<string>(); const stack = [a.id];
          while (stack.length) { const x = stack.pop()!; for (const r of f.rels) if (r.type === "parent_of" && r.b === x && !anc.has(r.a)) { anc.add(r.a); stack.push(r.a); } }
          if (anc.has(b.id)) { results.push({ ok: false, message: `${b.name_roman} is already an ancestor of ${a.name_roman}, so they cannot also be a child.` }); continue; }
          if (parentsOf(f, b.id).length >= 2) { results.push({ ok: false, message: `${b.name_roman} already has two parents. Remove one connection first.` }); continue; }
          link(f, "parent_of", a.id, b.id);
          if (a.gender === "male") inherit(a, b);
        } else {
          if (f.rels.some((r) => r.type === "spouse_of" && ((r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id)))) { results.push({ ok: false, message: "They are already connected as husband and wife." }); continue; }
          link(f, "spouse_of", a.id, b.id);
        }
        results.push({ ok: true, message: `connected ${a.name_roman} and ${b.name_roman}` });
      } else if (op.op === "unlink") {
        const before = f.rels.length;
        f.rels = f.rels.filter((r) => !(r.type === op.type && (op.type === "spouse_of" ? (r.a === op.a && r.b === op.b) || (r.a === op.b && r.b === op.a) : r.a === op.a && r.b === op.b)));
        if (op.type === "parent_of") { const kid = get(f, op.b); if (kid) kid.flags.parents = "done"; }
        results.push({ ok: f.rels.length < before, message: f.rels.length < before ? "connection removed" : "no such connection" });
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
  return { family: normalizeCouples(f), results };
}

/* ───────────────────────── repairing a wrong tree ───────────────────────── */

/** Everyone below `id` in the family line: the person, their spouses and all descendants (and their spouses). */
export function familyOf(f: DFamily, ids: string[]): Set<string> {
  const out = new Set<string>();
  const stack = [...ids];
  while (stack.length) {
    const x = stack.pop()!;
    if (out.has(x)) continue;
    out.add(x);
    for (const r of f.rels) {
      if (r.type === "parent_of" && r.a === x) stack.push(r.b);
      else if (r.type === "spouse_of" && (r.a === x || r.b === x)) stack.push(r.a === x ? r.b : r.a);
    }
  }
  return out;
}

/** Remove people together with the spouses and descendants that hang from them. Never removes "me". */
export function removeWithFamily(prev: DFamily, ids: string[]): { family: DFamily; removed: string[] } {
  const f: DFamily = structuredClone(prev);
  const meId = me(f)?.id;
  const drop = familyOf(f, ids);
  if (meId) drop.delete(meId);
  // a spouse who also belongs to someone we keep (e.g. "me") stays
  f.persons = f.persons.filter((p) => !drop.has(p.id));
  f.rels = f.rels.filter((r) => !drop.has(r.a) && !drop.has(r.b));
  return { family: f, removed: [...drop] };
}

export type RelationWord = "brother" | "sister" | "wife" | "husband" | "son" | "daughter" | "father" | "mother";
export const RELATION_WORDS: RelationWord[] = ["brother", "sister", "wife", "husband", "son", "daughter", "father", "mother"];

const ancestorsOf = (f: DFamily, id: string) => {
  const anc = new Set<string>(); const stack = [id];
  while (stack.length) { const x = stack.pop()!; for (const r of f.rels) if (r.type === "parent_of" && r.b === x && !anc.has(r.a)) { anc.add(r.a); stack.push(r.a); } }
  return anc;
};

/**
 * Repair a wrong relationship: "this person is really the <word> of <other person>".
 * Their old connections to parents and spouses are removed and the new one is made. Children stay attached,
 * except children who have another parent when the person becomes a sibling or child (a sister is recorded as a leaf).
 */
export function changeRelation(prev: DFamily, id: string, toId: string, word: RelationWord): { family: DFamily; ok: boolean; message: string } {
  const f: DFamily = structuredClone(prev);
  const p = get(f, id), q = get(f, toId);
  if (!p || !q) return { family: prev, ok: false, message: "Person not found." };
  if (p.id === q.id) return { family: prev, ok: false, message: "Choose a different person." };
  if (p.is_me) return { family: prev, ok: false, message: "This is you — change the other person’s relationship instead." };
  if (word === "son" || word === "daughter") { if (ancestorsOf(f, q.id).has(p.id) || false) { /* p is q's ancestor: q cannot be p's parent */ return { family: prev, ok: false, message: `${p.name_roman} is an ancestor of ${q.name_roman}, so they cannot be a child.` }; } }
  if (word === "father" || word === "mother") { if (ancestorsOf(f, p.id).has(q.id)) return { family: prev, ok: false, message: `${q.name_roman} is an ancestor of ${p.name_roman}, so they cannot be a child.` }; }
  if ((word === "brother" || word === "sister") && (ancestorsOf(f, q.id).has(p.id) || ancestorsOf(f, p.id).has(q.id))) return { family: prev, ok: false, message: "They are in a parent–child line, so they cannot be brother or sister." };

  const keepKids = word === "wife" || word === "husband" || word === "father" || word === "mother";
  // 1. cut the old connections
  f.rels = f.rels.filter((r) => !(r.type === "spouse_of" && (r.a === p.id || r.b === p.id)) && !(r.type === "parent_of" && r.b === p.id));
  if (!keepKids) {
    const kids = childrenOf(f, p.id);
    for (const k of kids) if (parentsOf(f, k.id).some((x) => x.id !== p.id)) f.rels = f.rels.filter((r) => !(r.type === "parent_of" && r.a === p.id && r.b === k.id));
  }
  p.flags.parents = "done"; // do not let the app re-attach a parent automatically

  // 2. make the new one
  const gender: Gender = word === "brother" || word === "husband" || word === "son" || word === "father" ? "male" : "female";
  p.gender = gender;
  switch (word) {
    case "brother": case "sister": {
      const parents = ensureFather(f, q);
      for (const par of parents) link(f, "parent_of", par.id, p.id);
      delete p.flags.parents;
      inherit(parents.find((x) => x.gender === "male"), p);
      break;
    }
    case "wife": case "husband":
      link(f, "spouse_of", q.id, p.id); q.flags.spouse = "done"; delete p.flags.parents; break;
    case "son": case "daughter": {
      link(f, "parent_of", q.id, p.id);
      const sp = spousesOf(f, q.id); if (sp.length === 1) link(f, "parent_of", sp[0]!.id, p.id);
      inherit([q, ...sp].find((x) => x.gender === "male"), p); delete p.flags.parents; break;
    }
    case "father": case "mother": {
      if (parentsOf(f, q.id).some((x) => x.id !== p.id && (x.gender === "male") === (gender === "male"))) {
        // q already has a parent of that kind: remove the old link so the new one replaces it
        for (const old of parentsOf(f, q.id)) if (old.id !== p.id && (old.gender === "male") === (gender === "male")) f.rels = f.rels.filter((r) => !(r.type === "parent_of" && r.a === old.id && r.b === q.id));
      }
      link(f, "parent_of", p.id, q.id);
      const other = parentsOf(f, q.id).find((x) => x.id !== p.id);
      if (other) link(f, "spouse_of", p.id, other.id);
      break;
    }
  }
  const out = normalizeCouples(f);
  return { family: out, ok: true, message: `${p.name_roman} is now recorded as the ${word} of ${q.name_roman}.` };
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

export function toFamilyData(raw: DFamily): FamilyData | null {
  const f = normalizeCouples(raw);
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
    married_to: p.married_to,
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
