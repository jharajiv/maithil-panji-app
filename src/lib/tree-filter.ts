import type { Datum } from "family-chart";
import type { ExportScope, FamilyData, PaternalRole, Person } from "./types";

/* ---------- graph helpers ---------- */

function index(data: FamilyData) {
  const byId = new Map<string, Person>(data.persons.map((p) => [p.person_id, p]));
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const spouses = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const a = m.get(k) ?? [];
    if (!a.includes(v)) a.push(v);
    m.set(k, a);
  };
  for (const r of data.relationships) {
    if (r.type === "parent_of") {
      push(children, r.person_a_id, r.person_b_id);
      push(parents, r.person_b_id, r.person_a_id);
    } else if (r.type === "spouse_of") {
      push(spouses, r.person_a_id, r.person_b_id);
      push(spouses, r.person_b_id, r.person_a_id);
    }
  }
  return { byId, parents, children, spouses };
}

/* ---------- scoping (export is a graph traversal filter, not a new dataset) ---------- */

export interface ScopedData extends FamilyData {
  /** only set for the paternal scope */
  roles?: Record<string, PaternalRole>;
  /** person_id the chart should be centred on */
  main_id: string;
}

export function scopeData(data: FamilyData, scope: ExportScope): ScopedData {
  if (scope === "full") return { ...data, main_id: data.root_person_id };
  if (scope === "all") return { ...data, main_id: apexOf(data) };
  return paternalLineage(data);
}

/**
 * The oldest ancestor on the father's side (a mother when no father is recorded). The chart draws a person's ancestors and ALL their
 * descendants with spouses, so centring on this person draws every uncle, aunt and cousin as well.
 */
export function apexOf(data: FamilyData): string {
  const { byId, parents } = index(data);
  let apex = data.root_person_id;
  const seen = new Set<string>([apex]);
  for (;;) {
    const ps = (parents.get(apex) ?? []).filter((id) => byId.has(id));
    const up = ps.find((id) => byId.get(id)?.gender === "male") ?? ps[0];
    if (!up || seen.has(up)) return apex;
    seen.add(up); apex = up;
  }
}

/**
 * Paternal lineage (Panji-style):
 *  - patriline from root upward (father, father's father, …), with siblings at each generation
 *  - spouses of patriline males attached as nodes (no expansion into their family)
 *  - descendants of patriline males through sons, recursively; daughters are leaf nodes (no husband or children shown)
 *  - mother's side and in-married women's families are excluded
 */
export function paternalLineage(data: FamilyData): ScopedData {
  const { byId, parents, children, spouses } = index(data);
  const fatherOf = (id: string) =>
    (parents.get(id) ?? []).find((pid) => byId.get(pid)?.gender === "male");

  // walk up the patriline to the apex
  let apex = data.root_person_id;
  const seen = new Set<string>([apex]);
  for (let f = fatherOf(apex); f && !seen.has(f); f = fatherOf(f)) {
    apex = f;
    seen.add(f);
  }

  const roles: Record<string, PaternalRole> = {};
  const visit = (id: string) => {
    roles[id] = "patriline";
    for (const sp of spouses.get(id) ?? []) if (!roles[sp]) roles[sp] = "spouse";
    for (const c of children.get(id) ?? []) {
      if (roles[c]) continue;
      if (byId.get(c)?.gender === "male") visit(c);
      else roles[c] = "daughter"; // a "connect": the Panji stops at her name — her husband and children sit in her husband's family chart
    }
  };
  visit(apex);

  const keep = new Set(Object.keys(roles));
  return {
    persons: data.persons.filter((x) => keep.has(x.person_id)),
    relationships: data.relationships.filter(
      (r) => keep.has(r.person_a_id) && keep.has(r.person_b_id),
    ),
    root_person_id: data.root_person_id,
    roles,
    // Centre on the apex so the whole patriline (all brothers' lines) is drawn.
    main_id: apex,
  };
}

/** people who are in the family data but not drawn in a chart (for example the parents of someone's wife), and how each is connected to someone who is drawn */
export function outsideChart(data: FamilyData, shown: ReadonlySet<string>): { name: string; years: string; village: string; note: string }[] {
  const { byId, parents, children, spouses } = index(data);
  const nm = (id: string) => byId.get(id)?.name_roman ?? "";
  const out: { name: string; years: string; village: string; note: string; key: string }[] = [];
  for (const p of data.persons) {
    if (shown.has(p.person_id)) continue;
    const id = p.person_id, notes: string[] = [];
    for (const c of children.get(id) ?? []) if (shown.has(c)) notes.push(`${p.gender === "female" ? "mother" : p.gender === "male" ? "father" : "parent"} of ${nm(c)}`);
    for (const x of spouses.get(id) ?? []) if (shown.has(x)) notes.push(`${p.gender === "female" ? "wife" : p.gender === "male" ? "husband" : "spouse"} of ${nm(x)}`);
    for (const x of parents.get(id) ?? []) if (shown.has(x)) notes.push(`${p.gender === "female" ? "daughter" : p.gender === "male" ? "son" : "child"} of ${nm(x)}`);
    out.push({ name: p.name_roman, years: lifespan(p), village: p.current_village ?? "", note: notes.slice(0, 2).join("; "), key: notes[0]?.replace(/^.* of /, "") ?? "~" });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key) || a.name.localeCompare(b.name)).map(({ key: _k, ...r }) => (void _k, r));
}

/* ---------- conversion to family-chart's data format ---------- */

export function yearOf(d?: string) {
  return d ? d.slice(0, 4) : "";
}

export function lifespan(p: Person) {
  const b = yearOf(p.dob);
  const d = yearOf(p.dod);
  if (!b && !d) return "";
  return d ? (b ? `${b} – ${d}` : `d. ${d}`) : `b. ${b}`;
}

export function toChartData(scoped: ScopedData): Datum[] {
  const { byId, parents, children, spouses } = index(scoped);
  return scoped.persons.map((p) => ({
    id: p.person_id,
    data: {
      gender: p.gender === "female" ? "F" : "M",
      "first name": p.name_roman,
      "last name": "",
      devanagari: p.name_devanagari ?? "",
      years: lifespan(p),
      gotra: p.gotra ?? "",
      mool: p.mool ?? "",
      village: p.current_village ?? "",
      married: p.married_to ?? "",
      photo: p.photo ?? "",
      living: p.is_living,
      role: scoped.roles?.[p.person_id] ?? "",
    },
    rels: {
      parents: (parents.get(p.person_id) ?? []).filter((x) => byId.has(x)),
      spouses: (spouses.get(p.person_id) ?? []).filter((x) => byId.has(x)),
      children: (children.get(p.person_id) ?? []).filter((x) => byId.has(x)),
    },
  }));
}
