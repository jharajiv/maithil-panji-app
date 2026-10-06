/**
 * Flattens a family draft into plain table rows (people + relations) so the data can be queried,
 * exported and analysed later in SQL. The JSON copy in `trees.family` stays the working copy;
 * these rows are rebuilt from it on every save. Photos and WhatsApp numbers are deliberately NOT copied here.
 */
import { fatherOf, motherOf, type DFamily, type DPerson } from "./family";

export interface PersonRow {
  tree_id: string;
  person_id: string;
  name_roman: string;
  name_dev: string | null;
  gender: string | null;
  birth: string | null;
  birth_year: number | null;
  status: string | null;
  death: string | null;
  place: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  gotra_id: string | null;
  gotra: string | null;
  gotra_dev: string | null;
  gotra_custom: boolean;
  mool_id: string | null;
  mool: string | null;
  mool_dev: string | null;
  mool_custom: boolean;
  father_id: string | null;
  mother_id: string | null;
  is_me: boolean;
  is_placeholder: boolean;
  has_photo: boolean;
  notes: string | null;
}
export interface RelRow { tree_id: string; type: "parent_of" | "spouse_of"; a: string; b: string }

/** ids are kept to a safe alphabet so they can sit inside a database filter */
const pid = (x: string) => x.replace(/[^A-Za-z0-9_-]/g, "");
const s = (v: string | undefined | null, max = 200) => { const t = (v ?? "").trim().slice(0, max); return t || null; };

/** "Village, District, State" → parts (best effort; older free-text places keep only `place`). */
export function splitPlace(place?: string): { village: string | null; district: string | null; state: string | null } {
  const parts = (place ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 3) return { village: s(parts[0], 80), district: s(parts[1], 80), state: s(parts.slice(2).join(", "), 80) };
  return { village: null, district: null, state: null };
}

export function personRow(treeId: string, f: DFamily, p: DPerson): PersonRow {
  const year = /^\d{4}/.exec(p.birth ?? "")?.[0];
  return {
    tree_id: treeId, person_id: pid(p.id),
    name_roman: s(p.name_roman, 120) ?? "",
    name_dev: s(p.name_dev, 120),
    gender: p.gender ?? null,
    birth: s(p.birth, 10), birth_year: year ? Number(year) : null,
    status: p.status ?? null, death: s(p.death, 10),
    place: s(p.place, 200), ...splitPlace(p.place),
    gotra_id: p.gotra?.id ?? null, gotra: s(p.gotra?.roman, 80), gotra_dev: s(p.gotra?.dev, 80), gotra_custom: !!p.gotra?.custom,
    mool_id: p.mool?.id ?? null, mool: s(p.mool?.roman, 80), mool_dev: s(p.mool?.dev, 80), mool_custom: !!p.mool?.custom,
    father_id: pid(fatherOf(f, p.id)?.id ?? "") || null, mother_id: pid(motherOf(f, p.id)?.id ?? "") || null,
    is_me: !!p.is_me, is_placeholder: !!p.placeholder, has_photo: !!p.photo,
    notes: s(p.notes, 500),
  };
}

export function flatten(treeId: string, f: DFamily): { persons: PersonRow[]; rels: RelRow[] } {
  const ids = new Set(f.persons.map((p) => p.id));
  return {
    persons: f.persons.map((p) => personRow(treeId, f, p)),
    rels: f.rels.filter((r) => ids.has(r.a) && ids.has(r.b)).map((r) => ({ tree_id: treeId, type: r.type, a: pid(r.a), b: pid(r.b) })),
  };
}
