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
  return paternalLineage(data);
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

/* ---------- conversion to family-chart's data format ---------- */

export function yearOf(d?: string) {
  return d ? d.slice(0, 4) : "";
}

export function lifespan(p: Person) {
  const b = yearOf(p.dob);
  const d = yearOf(p.dod);
  if (!b && !d) return "";
  return d ? `${b || "?"} – ${d}` : `b. ${b}`;
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
