/**
 * The interview plan. Deterministic: given what we know, what is the next thing to ask?
 * The AI parses answers and phrases questions, but THIS decides what is asked next,
 * which is what keeps the chat on-task and the family complete.
 */
import { WOMAN_GOTRA_QUICK } from "./faq";
import {
  childrenOf, fatherOf, labels, me, motherOf, siblingsOf, spousesOf,
  type DFamily, type DPerson, type Flag, type Op,
} from "./family";

export type GoalKind =
  | "self_name" | "self_gender" | "self_gotra" | "self_mool" | "self_birth" | "self_place"
  | "father" | "mother" | "details" | "gender"
  /** the fixed step-by-step questions (see LIST_SPEC) */
  | "brothers" | "sisters" | "wife" | "husband" | "sons" | "daughters";

export interface Goal {
  /** stable id; used to detect a question that keeps repeating */
  id: string;
  kind: GoalKind;
  section: string;
  subjects: string[];
  /** instruction for the AI */
  instruction: string;
  /** plain question for the offline/basic mode and as a fallback */
  question: string;
  quick: string[];
  optional: boolean;
  /** applied when the user skips / doesn't know, or the question has repeated too often */
  skip: Op[];
}

const FATHER = ["father", "grandfather", "great-grandfather", "great-great-grandfather"];
const MOTHER = ["mother", "grandmother", "great-grandmother", "great-great-grandmother"];
const up = (arr: string[], g: number) => arr[g] ?? `${g - 1}x-great-${arr === FATHER ? "grandfather" : "grandmother"}`;

const firstName = (p: DPerson) => (p.placeholder ? "he" : p.name_roman.split(" ")[0]);
const nm = (p: DPerson) => (p.placeholder ? "(name not known)" : p.name_roman);
const who = (p: DPerson, lab: Record<string, string>) => `${p.id} = ${nm(p)} [${lab[p.id] ?? "relative"}]`;
const flagOps = (ids: string[], flag: Flag, value: "unknown" | "skipped" | "done"): Op[] =>
  ids.map((id) => ({ op: "set_flag" as const, id, flag, value }));

/** How many generations above "me" is this person (me = 0, father = 1, …)? */
export function generation(f: DFamily, id: string): number {
  const m = me(f);
  let g = 0;
  for (let c = m; c; c = fatherOf(f, c.id)) { if (c.id === id) return g; g++; if (g > 20) break; }
  return -1;
}

export interface PlanOptions {
  /** kept for older callers; every step now asks about one person at a time */
  batch?: boolean;
}

export function nextGoal(f: DFamily, opts: PlanOptions = {}): Goal | null {
  void opts;
  const m = me(f);
  const lab = labels(f);

  if (!m) {
    return {
      id: "self_name", kind: "self_name", section: "About you", subjects: [], optional: false, quick: [], skip: [],
      question: "Let’s begin with you. What is your full name?",
      instruction: "No one has been added yet. Welcome the user warmly in one sentence, say you will interview them about their family step by step, then ask for THEIR OWN full name. When they answer, add them with add_person (no relation) — the first person added is the user.",
    };
  }
  const first = m.name_roman.split(" ")[0];

  if (!m.gender) return {
    id: "self_gender", kind: "self_gender", section: "About you", subjects: [m.id], optional: false, quick: ["Male", "Female"], skip: [],
    question: `Thank you, ${first}. Are you male or female?`,
    instruction: `Ask whether the user (${m.id}) is male or female. Set gender via update_person.`,
  };
  if (!m.gotra && !m.flags.gotra) return {
    id: "self_gotra", kind: "self_gotra", section: "Your Panji identity", subjects: [m.id], optional: true, quick: m.gender === "female" ? [WOMAN_GOTRA_QUICK, "I don’t know my gotra"] : ["I don’t know my gotra"], skip: flagOps([m.id], "gotra", "unknown"),
    question: m.gender === "female" ? "What is your gotra? Please give your father’s gotra, even if you are married. (for example Shandilya, Kashyap, Vatsa)" : "What is your gotra? (for example Shandilya, Kashyap, Vatsa)",
    instruction: `Ask for the user's gotra (${m.id}).${m.gender === "female" ? " She must give her FATHER'S gotra (not her husband's), even if married — say so in your question." : ""} Use lookup_gotra on their answer; if the match is not exact, confirm ("Did you mean …?") before saving with update_person {gotra:{id,roman,dev}}. If they don't know, set_flag gotra=unknown.`,
  };
  if (!m.mool && !m.flags.mool) return {
    id: "self_mool", kind: "self_mool", section: "Your Panji identity", subjects: [m.id], optional: true, quick: ["I don’t know my mool"], skip: flagOps([m.id], "mool", "unknown"),
    question: m.gender === "female" ? "What is your mool? Please give your father’s mool. You can type it in English or Devanagari." : "What is your mool? You can type it in English or Devanagari.",
    instruction: `Ask for the user's mool (${m.id})${m.gender === "female" ? " — her FATHER'S mool, even if married" : ""} — the lineage named after an ancestral village, e.g. Sarisaba, Sodarapura, Khandabala. Use lookup_mool (pass their gotra id if known). If lookup_mool finds a close match that is not exact, ask "Did you mean X?" and wait for a yes before saving it. If the user insists on their own spelling, or nothing in the list is close, save exactly what they said as a new entry: update_person mool:{roman, custom:true} — the Panji team reviews new entries later, so tell them: "I have noted it as a new mool — thank you." Never invent or force a match. If they don't know, set_flag mool=unknown.`,
  };
  if (!m.birth && !m.flags.birth) return {
    id: "self_birth", kind: "self_birth", section: "About you", subjects: [m.id], optional: true, quick: ["Skip"], skip: flagOps([m.id], "birth", "skipped"),
    question: "What is your date of birth? Day, month and year if you know it — or just the year. (optional)",
    instruction: `Ask for the user's date of birth (${m.id}). Optional; the full date is best (day, month, year) but a year alone is fine. Store as birth "YYYY-MM-DD" when the full date is given, "YYYY-MM" for month and year, otherwise "YYYY".`,
  };
  if (!m.place && !m.flags.place) return {
    id: "self_place", kind: "self_place", section: "About you", subjects: [m.id], optional: true, quick: ["Skip"], skip: flagOps([m.id], "place", "skipped"),
    question: "Where do you live now? Please tell me the village or town, district and state (or the city and country if you live abroad).",
    instruction: `Ask where the user lives now (${m.id}): village or town + district + state in India, or city + country abroad. Never ask for a street or house address. Store in place as one string "Village, District, State" (or "City, Country"); if they give only a village, ask once for the district; the state may be omitted for Bihar.`,
  };

  // ── 1. BACKWARDS FIRST: father, grandfather, great-grandfather … until the user says they do not know any further ──
  const chain: DPerson[] = [m];
  for (let c: DPerson | undefined = m, guard = 0; c && guard < 25; guard++) {
    const g = generation(f, c.id);
    const father = fatherOf(f, c.id);
    const mother = motherOf(f, c.id);
    const cLabel = lab[c.id] ?? "relative";
    const who_ = c.id === m.id ? "your" : `your ${cLabel}’s`;
    const sect = g === 0 ? "Your parents" : "Your ancestors";

    if (!father) {
      if (!c.flags.father) return {
        id: `father:${c.id}`, kind: "father", section: sect, subjects: [c.id], optional: g > 0,
        quick: g === 0 ? ["I don’t remember"] : ["I don’t know any further"],
        skip: flagOps([c.id], "father", "unknown"),
        question: g === 0 ? "What is your father’s name?" : `What was the name of ${firstName(c)}’s father (your ${up(FATHER, g)})? If you do not know any further back, just say so.`,
        instruction: `Ask the name of ${who_} father (${who(c, lab)}) — he is the user's ${up(FATHER, g)}. Add via add_person relation father_of ${c.id}. He inherits the family's gotra/mool automatically. We are tracing the lineage BACKWARDS as far as the user can remember: keep going one father at a time. If the user doesn't know (any further), set_flag father=unknown on ${c.id} — that ends the chain.`,
      };
      // the user cannot go back any further — the mother's name is still worth having (name only)
      if (!mother && !c.flags.mother && c.flags.father === "unknown") return {
        id: `mother:${c.id}`, kind: "mother", section: sect, subjects: [c.id], optional: true, quick: ["I don’t remember"],
        skip: flagOps([c.id], "mother", "unknown"),
        question: g === 0 ? "What is your mother’s name?" : `Do you remember ${firstName(c)}’s mother (your ${up(MOTHER, g)})? Her name only is enough.`,
        instruction: `Ask the name of ${who_} mother (your ${up(MOTHER, g)}) — name only. Panji does not record her parents; do NOT ask about her family. Add via add_person relation mother_of ${c.id}. If unknown, set_flag mother=unknown on ${c.id}.`,
      };
      break;
    }
    if (father.placeholder) break;
    if (!mother && !c.flags.mother) return {
      id: `mother:${c.id}`, kind: "mother", section: sect, subjects: [c.id], optional: true, quick: ["I don’t remember"],
      skip: flagOps([c.id], "mother", "unknown"),
      question: g === 0 ? "What is your mother’s name?" : `And ${firstName(c)}’s mother (your ${up(MOTHER, g)}) — do you remember her name?`,
      instruction: `Ask the name of ${who_} mother (your ${up(MOTHER, g)}) — name only. Panji does not record her parents; do NOT ask about her family. Add via add_person relation mother_of ${c.id}. If unknown, set_flag mother=unknown on ${c.id}.`,
    };
    if (!father.flags.details) return {
      id: `details:${father.id}`, kind: "details", section: sect, subjects: [father.id], optional: true, quick: ["Skip"],
      skip: flagOps([father.id], "details", "skipped"),
      question: `Is ${nm(father)} living? And do you know his date of birth (even just the year is fine) and his village (with district)?`,
      instruction: `Ask in ONE question whether ${who(father, lab)} is living or has passed away, and (if known) his date of birth/death — a full date, month and year, or just a year — and his village + district (never a street address). Update via update_person {status, birth, death, place} with place as "Village, District, State". Optional — set_flag details=done when answered, or skipped.`,
    };
    chain.push(father);
    c = father;
  }

  // anyone whose son/daughter is not known yet (the Panji treats them differently)
  const needGender = f.persons.find((p) => !p.placeholder && !p.gender);
  if (needGender) return {
    id: `gender:${needGender.id}`, kind: "gender", section: "Your family", subjects: [needGender.id], optional: true, quick: ["Male (son / brother)", "Female (daughter / sister)"],
    skip: [{ op: "update_person", id: needGender.id, set: { gender: "other" } }],
    question: `Is ${nm(needGender)} male (a son or brother) or female (a daughter or sister)?`,
    instruction: `Ask whether ${who(needGender, lab)} is male or female, and save it with update_person {gender}.`,
  };

  // ── 2. the user's own brothers and sisters: a fixed order of steps, one group at a time ──
  const g1 = siblingBlock(f, m, { lab, withChildren: true });
  if (g1) return g1;

  // ── 3. the user's own household (wife, sons, daughters, then the sons' households) ──
  if (m.gender !== "female") {
    const g0 = household(f, m, { lab, section: "Your family" }, 0);
    if (g0) return g0;
  }
  // ── 4. the households of the brothers' sons ──
  for (const b of bros(f, m.id)) {
    for (const son of sonsOf(f, b.id)) {
      const gs = household(f, son, { lab, section: "Your brothers’ families" }, 0);
      if (gs) return gs;
    }
  }

  // ── 5. the ancestors' brothers and sisters, one generation at a time, the same fixed steps ──
  for (let i = 1; i < chain.length; i++) {
    const c = chain[i]!;
    const gc = siblingBlock(f, c, { lab, withChildren: generation(f, c.id) <= 1 });
    if (gc) return gc;
  }
  return null;
}

/* ───────────────────────── the fixed steps ───────────────────────── */

/**
 * Every question about a group of relatives is its own step, and the app — not the AI — decides who that group is.
 * A reply to the "brothers" question can only ever add brothers; the "sisters" question only sisters; and so on.
 * That is what stops an aunt being filed as an uncle's wife.
 */
export type ListKind = "brothers" | "sisters" | "wife" | "husband" | "sons" | "daughters";
export const LIST_SPEC: Record<ListKind, { flag: Flag; gender?: "male" | "female"; relation?: "sibling_of" | "spouse_of" | "child_of"; note?: boolean }> = {
  brothers: { flag: "brothers", gender: "male", relation: "sibling_of" },
  sisters: { flag: "sisters", gender: "female", relation: "sibling_of" },
  wife: { flag: "spouse", gender: "female", relation: "spouse_of" },
  husband: { flag: "husband", note: true },
  sons: { flag: "sons", gender: "male", relation: "child_of" },
  daughters: { flag: "daughters", gender: "female", relation: "child_of" },
};
export const isListKind = (k: string): k is ListKind => k in LIST_SPEC;
export const isListGoal = (g: Goal | null | undefined): g is Goal & { kind: ListKind } => !!g && isListKind(g.kind);
export const SKIP_REST = "Skip the rest of this step";

/** a flag is "answered" — older saved trees used one flag for brothers+sisters and one for sons+daughters */
const answered = (p: DPerson, flag: Flag) =>
  !!p.flags[flag] || ((flag === "brothers" || flag === "sisters") && !!p.flags.siblings) || ((flag === "sons" || flag === "daughters") && !!p.flags.children);

export const bros = (f: DFamily, id: string) => siblingsOf(f, id).filter((s) => s.gender === "male" && !s.placeholder);
export const sis = (f: DFamily, id: string) => siblingsOf(f, id).filter((s) => s.gender === "female" && !s.placeholder);
export const sonsOf = (f: DFamily, id: string) => childrenOf(f, id).filter((c) => c.gender === "male" && !c.placeholder);
export const daughtersOf = (f: DFamily, id: string) => childrenOf(f, id).filter((c) => c.gender === "female" && !c.placeholder);

/** the people who already belong to this group (what "Replace this" clears) */
export function groupMembers(f: DFamily, kind: ListKind, id: string): DPerson[] {
  switch (kind) {
    case "brothers": return bros(f, id);
    case "sisters": return sis(f, id);
    case "wife": return spousesOf(f, id);
    case "sons": return sonsOf(f, id);
    case "daughters": return daughtersOf(f, id);
    default: return [];
  }
}

const rel = (lab: string | undefined) => (!lab || lab === "relative" ? "relative" : /^your\b/.test(lab) ? lab : `your ${lab}`);

interface Ctx { lab: Record<string, string>; withChildren?: boolean; section?: string }

/** Build one list question. `section` is the label shown above the chat (e.g. "Step 2 of 5 · Your sisters"). */
export function listGoal(f: DFamily, kind: ListKind, subject: DPerson, section: string, lab: Record<string, string>, more = 0): Goal {
  const spec = LIST_SPEC[kind];
  const isMe = !!subject.is_me;
  const you = isMe ? "you" : `${firstName(subject)} (${rel(lab[subject.id])})`;
  const your = isMe ? "your" : `${firstName(subject)}’s`;
  const qs: Record<ListKind, [string, string[]]> = {
    brothers: [isMe ? "Do you have brothers? Please type the names of all your brothers (sons of your father), separated by commas — or tap “No brothers”. Sisters come in the next step."
      : `Did ${you} have brothers? Please type the names of all his brothers, separated by commas — or tap “No brothers”. Sisters come in the next step.`, ["No brothers"]],
    sisters: [isMe ? "Do you have sisters? Please type the names of all your sisters, separated by commas — or tap “No sisters”."
      : `Did ${you} have sisters? Please type the names of all his sisters, separated by commas — or tap “No sisters”.`, ["No sisters"]],
    wife: [isMe ? "Are you married? Please type your wife’s name — or tap “Not married”."
      : `Is ${you} married? Please type his wife’s name — or tap “Not married”.`, ["Not married"]],
    husband: [`Do you know whom ${firstName(subject)} (${rel(lab[subject.id])}) is married to? Write his name and village in one line, for example “Rajesh Jha, Darbhanga” — it is kept as a short note on her card, and his own family is recorded on his chart. Or tap “Skip”.`, ["Skip"]],
    sons: [isMe ? "Do you have sons? Please type their names, separated by commas — or tap “No sons”. Daughters come next."
      : `Does ${you} have sons? Please type their names, separated by commas — or tap “No sons”. Daughters come next.`, ["No sons"]],
    daughters: [isMe ? "Do you have daughters? Please type their names, separated by commas — or tap “No daughters”."
      : `Does ${you} have daughters? Please type their names, separated by commas — or tap “No daughters”.`, ["No daughters"]],
  };
  const [question, quick0] = qs[kind];
  const quick = [...quick0];
  if (!isMe && (kind === "brothers" || kind === "sisters")) quick.push("I don’t know");
  if (more > 1) quick.push(SKIP_REST);
  return {
    id: `${kind}:${subject.id}`, kind, section, subjects: [subject.id], optional: true, quick,
    skip: flagOps([subject.id], spec.flag, kind === "brothers" || kind === "sisters" ? "unknown" : "skipped"),
    question,
    instruction: `Ask exactly this question, word for word, and nothing else: "${question}" (${your} ${kind}).`,
  };
}

/**
 * The fixed order for one man's brothers and sisters:
 *   1 brothers → 2 sisters → 3 the brothers' wives → 4 the sisters' husbands (a one-line note) → 5 the brothers' sons and daughters.
 * Ancestors' blocks have four steps (their brothers' children are not asked beyond the user's uncles).
 */
function siblingBlock(f: DFamily, owner: DPerson, o: Ctx): Goal | null {
  const { lab } = o;
  const total = o.withChildren ? 5 : 4;
  const poss = owner.is_me ? "Your" : `Your ${lab[owner.id] ?? "relative"}’s`;
  const sec = (n: number, title: string) => `Step ${n} of ${total} · ${poss} ${title}`;

  if (!answered(owner, "brothers") && bros(f, owner.id).length === 0) return listGoal(f, "brothers", owner, sec(1, "brothers"), lab);
  if (!answered(owner, "sisters") && sis(f, owner.id).length === 0) return listGoal(f, "sisters", owner, sec(2, "sisters"), lab);

  const brothers = bros(f, owner.id);
  const needW = brothers.filter((b) => !b.flags.spouse && spousesOf(f, b.id).length === 0);
  if (needW.length) return listGoal(f, "wife", needW[0]!, sec(3, "brothers’ wives"), lab, needW.length);

  const needH = sis(f, owner.id).filter((x) => !x.flags.husband && !x.married_to);
  if (needH.length) return listGoal(f, "husband", needH[0]!, sec(4, "sisters’ husbands"), lab, needH.length);

  if (o.withChildren) {
    for (const b of brothers) {
      const left = brothers.filter((x) => !answered(x, "sons") || !answered(x, "daughters")).length;
      if (!answered(b, "sons") && sonsOf(f, b.id).length === 0) return listGoal(f, "sons", b, sec(5, "brothers’ children"), lab, left);
      if (!answered(b, "daughters") && daughtersOf(f, b.id).length === 0) return listGoal(f, "daughters", b, sec(5, "brothers’ children"), lab, left);
    }
  }
  return null;
}

/** One man's household: wife, sons, daughters — then each son's household, and so on. */
function household(f: DFamily, man: DPerson, o: { lab: Record<string, string>; section: string }, depth: number): Goal | null {
  if (man.placeholder || man.gender === "female" || depth > 8) return null;
  const { lab, section } = o;
  if (!man.flags.spouse && spousesOf(f, man.id).length === 0) return listGoal(f, "wife", man, section, lab);
  if (!answered(man, "sons") && sonsOf(f, man.id).length === 0) return listGoal(f, "sons", man, section, lab);
  if (!answered(man, "daughters") && daughtersOf(f, man.id).length === 0) return listGoal(f, "daughters", man, section, lab);
  for (const son of sonsOf(f, man.id)) {
    const g = household(f, son, o, depth + 1);
    if (g) return g;
  }
  return null;
}

/** Rebuild the question behind an earlier chat message ("brothers:p3"), whether or not it is still open. */
export function goalById(f: DFamily, id: string): Goal | null {
  const [kind, subject] = id.split(":");
  if (!kind || !subject || !isListKind(kind)) return null;
  const p = f.persons.find((x) => x.id === subject);
  if (!p) return null;
  return listGoal(f, kind, p, "Earlier answer", labels(f));
}

/** Kinds of earlier questions that can be corrected by replying to them (everything except gotra and mool, which are picked from the Panji list in the edit sheet). */
export const CORRECTABLE = new Set(["self_name", "self_gender", "self_birth", "self_place", "father", "mother", "details", "gender"]);

/**
 * The question behind ANY earlier chat message the user may reply to. Fixed steps come back as full list goals;
 * the opening questions (name, gender, birth, place, father, mother, details) come back as a correction target.
 */
export function replyGoal(f: DFamily, id: string): Goal | null {
  const list = goalById(f, id);
  if (list) return list;
  const [kind, subject] = id.split(":");
  if (!kind || !CORRECTABLE.has(kind)) return null;
  const sid = subject ?? me(f)?.id;
  const p = f.persons.find((x) => x.id === sid);
  if (!p) return null;
  const q: Record<string, string> = {
    self_name: "What is your full name?", self_gender: "Are you male or female?", self_birth: "What is your date of birth?", self_place: "Where do you live now?",
    father: `What is ${p.is_me ? "your" : `${firstName(p)}’s`} father’s name?`, mother: `What is ${p.is_me ? "your" : `${firstName(p)}’s`} mother’s name?`,
    details: `Is ${nm(p)} living, and what are his dates and village?`, gender: `Is ${nm(p)} male or female?`,
  };
  return { id, kind: kind as GoalKind, section: "Earlier answer", subjects: [p.id], optional: true, quick: [], skip: [], question: q[kind]!, instruction: q[kind]! };
}

/** The operations for a list answer: add exactly these people, in exactly this role, and mark the question answered. */
export function listOps(goal: Goal, names: { name: string; dev?: string }[], note?: string): Op[] {
  if (!isListKind(goal.kind)) return [];
  const spec = LIST_SPEC[goal.kind];
  const sub = goal.subjects[0]!;
  const ops: Op[] = [];
  if (spec.note) {
    if (note) ops.push({ op: "update_person", id: sub, set: { married_to: note } });
  } else {
    for (const n of names) {
      ops.push({ op: "add_person", name_roman: n.name, ...(n.dev ? { name_dev: n.dev } : {}), gender: spec.gender, relation: { type: spec.relation!, to: sub } });
    }
  }
  ops.push({ op: "set_flag", id: sub, flag: spec.flag, value: "done" });
  return ops;
}

/** Short human summary of progress for the UI. */
export function progress(f: DFamily) {
  const people = f.persons.filter((p) => !p.placeholder).length;
  let gens = 1;
  const m = me(f);
  for (let c = m && fatherOf(f, m.id); c && gens < 20; c = fatherOf(f, c.id)) if (!c.placeholder) gens++;
  return { people, generations: m ? gens : 0 };
}

/** The family as compact text for the AI's context. */
export function describeFamily(f: DFamily): string {
  if (!f.persons.length) return "(empty — nobody added yet)";
  const lab = labels(f);
  return f.persons
    .map((p) => {
      const bits = [
        p.gender, p.birth && `b.${p.birth}`, p.status === "deceased" ? `d.${p.death ?? "?"}` : p.status === "living" ? "living" : "",
        p.place && `place:${p.place}`, p.gotra && `gotra:${p.gotra.roman}`, p.mool && `mool:${p.mool.roman}`,
        Object.entries(p.flags).length ? `flags:${Object.entries(p.flags).map(([k, v]) => `${k}=${v}`).join("|")}` : "",
      ].filter(Boolean).join(", ");
      return `${p.id} ${nm(p)}${p.name_dev ? ` (${p.name_dev})` : ""} — ${lab[p.id]}${p.is_me ? " [THE USER]" : ""}${bits ? ` — ${bits}` : ""}`;
    })
    .join("\n");
}
