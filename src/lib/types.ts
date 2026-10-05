// v1 user-facing schema (mirrors the brief's Person / Relationship / Tree models).
export type Gender = "male" | "female" | "other";
export type TemplateId = "classic" | "madhubani" | "minimal";
export type ExportScope = "full" | "paternal";
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
  moolgrama?: string;
  pravara?: string;
  current_village?: string;
  notes?: string;
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
