// v1 user-facing schema (mirrors the brief's Person / Relationship / Tree models).
export type Gender = "male" | "female" | "other";
export type TemplateId = "classic" | "madhubani" | "minimal";
/** full = my own line (parents, grandparents, children); paternal = Panji-style patriline; all = everyone descended from the oldest ancestor entered (uncles, cousins, every branch) */
export type ExportScope = "full" | "paternal" | "all";
/** poster paper: auto = one custom large page; a2/a1/a0 = a standard sheet for a print shop */
export type PosterPaper = "auto" | "a2" | "a1" | "a0";
export type PageFormat = "a3-landscape" | "a4-portrait";

export interface Person {
  person_id: string;
  name_roman: string;
  name_devanagari?: string;
  gender: Gender;
  dob?: string; // ISO, partial allowed ("1958" or "1958-03")
  dod?: string;
  is_living: boolean;
  gotra?: string;
  mool?: string;
  pravara?: string;
  current_village?: string;
  notes?: string;
  /** a sister's / daughter's husband, as one short note */
  married_to?: string;
  photo?: string; // data URL or storage URL
  source: "user_input" | "corpus" | "merged";
}

export interface Relationship {
  rel_id: string;
  person_a_id: string; // parent_of: a is parent of b
  person_b_id: string;
  type: "parent_of" | "spouse_of" | "sibling_of";
  confidence: "confirmed" | "inferred" | "disputed";
}

export interface FamilyData {
  persons: Person[];
  relationships: Relationship[];
  root_person_id: string;
}

/** Role of a person inside the paternal-lineage (Panji-style) view. */
export type PaternalRole = "patriline" | "spouse" | "daughter";
