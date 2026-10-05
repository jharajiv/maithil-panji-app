export type Answers = Record<string, string>;

export type FieldKind =
  | "name" | "text" | "date" | "number" | "gotra" | "mool" | "moolgrama" | "pravara"
  | "yesno" | "gender" | "contact" | "textarea";

export interface FieldDef {
  key: string;
  kind: FieldKind;
  label: string;
  placeholder?: string;
  required?: boolean;
  helper?: string;
  /** mool autocomplete depends on this gotra answer key */
  gotraKey?: string;
  /** only show when sibling field `key` equals `equals` (resolved within the same step instance) */
  showIf?: { key: string; equals: string };
}

export interface StepDef {
  id: string;
  section: string;
  title: string;
  helper?: string;
  fields: FieldDef[];
  when?: (a: Answers) => boolean;
  /** repeat the field group N times, N read from this answer key */
  repeat?: { countKey: string; noun: string; max: number };
  /** prefill an empty answer from another answer when the step opens */
  prefill?: Record<string, string>;
}

const date = (key: string, label: string, helper?: string): FieldDef => ({
  key, kind: "date", label, placeholder: "YYYY or YYYY-MM-DD", helper,
});

export const STEPS: StepDef[] = [
  // ───────── About you
  {
    id: "you", section: "About you", title: "What is your name?",
    helper: "We will transliterate it to Devanagari automatically; you can correct it.",
    fields: [{ key: "name", kind: "name", label: "Name", required: true }],
  },
  { id: "dob", section: "About you", title: "When were you born?", fields: [date("dob", "Date of birth", "Year only is fine.")] },
  {
    id: "place", section: "About you", title: "Where do you live now?",
    fields: [{ key: "place", kind: "text", label: "Current village or city, country", placeholder: "e.g. Zurich, Switzerland", required: true }],
  },
  {
    id: "contact", section: "About you", title: "How can we reach you?",
    helper: "Used only to send you a link to return later. Not shared.",
    fields: [{ key: "contact", kind: "contact", label: "Mobile number or email", placeholder: "+41 … or name@example.com", required: true }],
  },

  // ───────── Panji identity
  {
    id: "gotra", section: "Your Panji identity", title: "What is your gotra?",
    fields: [{ key: "gotra", kind: "gotra", label: "Gotra", required: true }],
  },
  {
    id: "mool", section: "Your Panji identity", title: "What is your mool?",
    helper: "Suggestions depend on the gotra you chose.",
    fields: [{ key: "mool", kind: "mool", label: "Mool", required: true, gotraKey: "gotra.gotra" }],
  },
  {
    id: "moolgrama", section: "Your Panji identity", title: "Your moolgrama (ancestral village)",
    fields: [{ key: "moolgrama", kind: "moolgrama", label: "Moolgrama", required: true }],
  },
  {
    id: "pravara", section: "Your Panji identity", title: "Do you know your pravara?",
    helper: "Optional. Free text.",
    fields: [{ key: "pravara", kind: "pravara", label: "Pravara" }],
  },

  // ───────── Father
  { id: "father", section: "Your father", title: "What is your father’s name?", fields: [{ key: "name", kind: "name", label: "Father’s name" }] },
  {
    id: "father_gotra", section: "Your father", title: "Your father’s gotra",
    helper: "Pre-filled from your gotra — change it if different.",
    prefill: { "father_gotra.gotra": "gotra.gotra" },
    fields: [{ key: "gotra", kind: "gotra", label: "Father’s gotra" }],
  },
  {
    id: "father_dates", section: "Your father", title: "Your father’s dates",
    fields: [date("dob", "Date of birth"), date("dod", "Date of passing (if applicable)")],
  },
  { id: "father_village", section: "Your father", title: "Your father’s village", fields: [{ key: "village", kind: "text", label: "Village" }] },

  // ───────── Mother
  { id: "mother", section: "Your mother", title: "What was your mother’s name before marriage?", fields: [{ key: "name", kind: "name", label: "Mother’s name" }] },
  {
    id: "mother_panji", section: "Your mother", title: "Your mother’s gotra, mool and moolgrama",
    helper: "These come from her father.",
    fields: [
      { key: "gotra", kind: "gotra", label: "Gotra" },
      { key: "mool", kind: "mool", label: "Mool", gotraKey: "mother_panji.gotra" },
      { key: "moolgrama", kind: "moolgrama", label: "Moolgrama" },
    ],
  },
  { id: "mother_dates", section: "Your mother", title: "Your mother’s dates", fields: [date("dob", "Date of birth"), date("dod", "Date of passing (if applicable)")] },

  // ───────── Grandparents
  {
    id: "gf_p", section: "Grandparents", title: "Your father’s father",
    fields: [{ key: "name", kind: "name", label: "Name" }, { key: "village", kind: "text", label: "Village" }, date("dob", "Date of birth"), date("dod", "Date of passing")],
  },
  {
    id: "gm_p", section: "Grandparents", title: "Your father’s mother",
    helper: "Her maiden name, and her father’s gotra and mool.",
    fields: [{ key: "name", kind: "name", label: "Name (maiden)" }, { key: "gotra", kind: "gotra", label: "Her father’s gotra" }, { key: "mool", kind: "mool", label: "Her father’s mool", gotraKey: "gm_p.gotra" }],
  },
  {
    id: "gf_m", section: "Grandparents", title: "Your mother’s father",
    fields: [{ key: "name", kind: "name", label: "Name" }, { key: "village", kind: "text", label: "Village" }, date("dob", "Date of birth"), date("dod", "Date of passing")],
  },
  {
    id: "gm_m", section: "Grandparents", title: "Your mother’s mother",
    helper: "Her maiden name, and her father’s gotra and mool.",
    fields: [{ key: "name", kind: "name", label: "Name (maiden)" }, { key: "gotra", kind: "gotra", label: "Her father’s gotra" }, { key: "mool", kind: "mool", label: "Her father’s mool", gotraKey: "gm_m.gotra" }],
  },

  // ───────── Spouse & children
  { id: "married", section: "Spouse and children", title: "Are you married?", fields: [{ key: "married", kind: "yesno", label: "Married" }] },
  {
    id: "spouse", section: "Spouse and children", title: "Tell us about your spouse",
    helper: "Include her/his father’s gotra and mool.",
    when: (a) => a["married.married"] === "yes",
    fields: [{ key: "name", kind: "name", label: "Spouse’s name" }, date("dob", "Date of birth"), { key: "gotra", kind: "gotra", label: "Her/his father’s gotra" }, { key: "mool", kind: "mool", label: "Her/his father’s mool", gotraKey: "spouse.gotra" }],
  },
  { id: "kids_n", section: "Spouse and children", title: "How many children do you have?", fields: [{ key: "count", kind: "number", label: "Number of children", placeholder: "0" }] },
  {
    id: "kid", section: "Spouse and children", title: "Your children",
    when: (a) => Number(a["kids_n.count"] || 0) > 0,
    repeat: { countKey: "kids_n.count", noun: "Child", max: 10 },
    fields: [{ key: "name", kind: "name", label: "Name" }, date("dob", "Date of birth"), { key: "gender", kind: "gender", label: "Gender" }],
  },

  // ───────── Siblings
  { id: "sibs_n", section: "Siblings", title: "How many siblings do you have?", fields: [{ key: "count", kind: "number", label: "Number of siblings", placeholder: "0" }] },
  {
    id: "sib", section: "Siblings", title: "Your siblings",
    when: (a) => Number(a["sibs_n.count"] || 0) > 0,
    repeat: { countKey: "sibs_n.count", noun: "Sibling", max: 10 },
    fields: [
      { key: "name", kind: "name", label: "Name" }, date("dob", "Date of birth"), { key: "gender", kind: "gender", label: "Gender" },
      { key: "married", kind: "yesno", label: "Married?" },
      { key: "spouse", kind: "text", label: "Spouse’s name", showIf: { key: "married", equals: "yes" } },
    ],
  },

  // ───────── Wrap-up
  {
    id: "more", section: "Wrap-up", title: "Anyone else you remember?",
    helper: "Add one person per line, with how they are related. You can add more later.",
    fields: [{ key: "more", kind: "textarea", label: "People you remember", placeholder: "e.g. Shivnath Jha — father’s younger brother" }],
  },
];

/** Steps visible for the current answers. */
export const visibleSteps = (a: Answers) => STEPS.filter((s) => !s.when || s.when(a));

/** The tail screens (share, community, account) are rendered by the flow itself. */
export const TAIL_STEPS = ["share", "community", "finish"] as const;
