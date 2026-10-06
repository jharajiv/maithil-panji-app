/**
 * The interview plan. Deterministic: given what we know, what is the next thing to ask?
 * The AI parses answers and phrases questions, but THIS decides what is asked next,
 * which is what keeps the chat on-task and the family complete.
 */
import {
  childrenOf, fatherOf, labels, me, motherOf, siblingsOf, spousesOf,
  type DFamily, type DPerson, type Flag, type Op,
} from "./family";

export type GoalKind =
  | "self_name" | "self_gender" | "self_gotra" | "self_mool" | "self_birth" | "self_place"
  | "spouse" | "children" | "spouses_of" | "children_of"
  | "father" | "mother" | "details" | "siblings" | "gender";

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
function generation(f: DFamily, id: string): number {
  const m = me(f);
  let g = 0;
  for (let c = m; c; c = fatherOf(f, c.id)) { if (c.id === id) return g; g++; if (g > 20) break; }
  return -1;
}

export interface PlanOptions {
  /** group "which of them are married?" into one question (AI mode). Basic mode asks one person at a time. */
  batch?: boolean;
}

export function nextGoal(f: DFamily, opts: PlanOptions = {}): Goal | null {
  const batch = opts.batch ?? true;
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
    id: "self_gotra", kind: "self_gotra", section: "Your Panji identity", subjects: [m.id], optional: true, quick: ["I don’t know my gotra"], skip: flagOps([m.id], "gotra", "unknown"),
    question: "What is your gotra? (for example Shandilya, Kashyap, Vatsa)",
    instruction: `Ask for the user's gotra (${m.id}). Use lookup_gotra on their answer; if the match is not exact, confirm ("Did you mean …?") before saving with update_person {gotra:{id,roman,dev}}. If they don't know, set_flag gotra=unknown.`,
  };
  if (!m.mool && !m.flags.mool) return {
    id: "self_mool", kind: "self_mool", section: "Your Panji identity", subjects: [m.id], optional: true, quick: ["I don’t know my mool"], skip: flagOps([m.id], "mool", "unknown"),
    question: "What is your mool? You can type it in English or Devanagari.",
    instruction: `Ask for the user's mool (${m.id}) — the lineage named after an ancestral village, e.g. Sarisaba, Sodarapura, Khandabala. Use lookup_mool (pass their gotra id if known). If lookup_mool finds a close match that is not exact, ask "Did you mean X?" and wait for a yes before saving it. If the user insists on their own spelling, or nothing in the list is close, save exactly what they said as a new entry: update_person mool:{roman, custom:true} — the Panji team reviews new entries later, so tell them: "I have noted it as a new mool — thank you." Never invent or force a match. If they don't know, set_flag mool=unknown.`,
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

  // ── 2. brothers and sisters of the user ──
  if (!m.flags.siblings) return {
    id: `siblings:${m.id}`, kind: "siblings", section: "Your brothers and sisters", subjects: [m.id], optional: true,
    quick: ["I have no brothers or sisters"], skip: flagOps([m.id], "siblings", "done"),
    question: "Do you have brothers or sisters? Please tell me each name, and whether brother or sister.",
    instruction: `Ask for ALL of the user's brothers and sisters (${m.id}) — each name and whether brother or sister (older/younger is nice but optional). Add each with add_person relation sibling_of ${m.id}. Sisters are recorded by NAME ONLY: never ask about a sister's husband or children — the Panji keeps those in her husband's family chart. Then set_flag siblings=done on ${m.id}. If none, set_flag siblings=done.`,
  };

  // ── 3. the user's own household and the sons' lines (daughters stop at their own name) ──
  if (m.gender !== "female") {
    const g0 = lineGoal(f, [m], { batch, lab, section: "Your family", personal: true, withChildren: true });
    if (g0) return g0;
  }
  // brothers' households
  const brothers = siblingsOf(f, m.id).filter((s) => s.gender !== "female" && !s.placeholder);
  const gb = lineGoal(f, brothers, { batch, lab, section: "Your brothers’ families", withChildren: true });
  if (gb) return gb;

  // ── 4. the ancestors' brothers and sisters, one generation at a time ──
  for (let i = 1; i < chain.length; i++) {
    const c = chain[i]!;
    const g = generation(f, c.id);
    const cLabel = lab[c.id] ?? "relative";
    const sect = "Your ancestors’ families";
    if (!c.flags.siblings) return {
      id: `siblings:${c.id}`, kind: "siblings", section: sect, subjects: [c.id], optional: true,
      quick: ["He had no brothers or sisters", "I don’t know"], skip: flagOps([c.id], "siblings", "done"),
      question: `Did ${firstName(c)} (your ${cLabel}) have brothers or sisters? Please list their names.`,
      instruction: `Ask for ALL brothers and sisters of ${who(c, lab)} (the user's ${cLabel}'s siblings — i.e. ${g === 1 ? "the user's uncles and aunts on the father's side" : "great-uncles and great-aunts"}). Names and brother/sister. Add each with add_person relation sibling_of ${c.id}. Sisters by NAME ONLY — never ask about a sister's husband or children. Then set_flag siblings=done on ${c.id}. If none/unknown, set_flag siblings=done.`,
    };
    const bro = siblingsOf(f, c.id).filter((s) => s.gender !== "female" && !s.placeholder);
    const gl = lineGoal(f, bro, { batch, lab, section: sect, withChildren: g <= 1, oneLevel: true });
    if (gl) return gl;
  }
  return null;
}

interface LineOpts { batch: boolean; lab: Record<string, string>; section: string; personal?: boolean; withChildren: boolean; oneLevel?: boolean }

/**
 * The sons' lines. For these men (and then their sons, and so on) we ask: wife's name, then children. Daughters are recorded by
 * name and stop there; a wife is recorded by name only, with no questions about her family.
 */
function lineGoal(f: DFamily, roots: DPerson[], o: LineOpts): Goal | null {
  const { batch, lab } = o;
  let level = roots.filter((p) => !p.placeholder && p.gender !== "female");
  for (let depth = 0; level.length && depth < 10; depth++) {
    const needSp = level.filter((p) => !p.flags.spouse && spousesOf(f, p.id).length === 0);
    if (needSp.length) {
      const subs = o.personal && depth === 0 ? [needSp[0]!] : batch ? needSp : [needSp[0]!];
      const isMe = o.personal && depth === 0 && subs[0]!.id === me(f)?.id;
      return {
        id: isMe ? `spouse:${subs[0]!.id}` : `spouses_of:${subs.map((s) => s.id).join(",")}`, kind: isMe ? "spouse" : "spouses_of", section: o.section, subjects: subs.map((s) => s.id),
        optional: true, quick: isMe ? ["Not married"] : ["None are married", "I don’t know"], skip: flagOps(subs.map((s) => s.id), "spouse", "done"),
        question: isMe ? "Are you married? If yes, what is your wife’s (or husband’s) name?"
          : subs.length === 1 ? `Is ${nm(subs[0]!)} married? What is his wife’s name?` : "Who among them is married? Tell me each wife’s name.",
        instruction: `Ask ${isMe ? "if the user is married and the spouse's name" : "which of these men are married and their wives' names"}: ${subs.map((s) => who(s, lab)).join("; ")}. Add each with add_person relation spouse_of <person id>. Record the NAME only — NEVER ask about the wife's parents or family. set_flag spouse=done on every man you asked about (including unmarried ones).`,
      };
    }
    if (o.withChildren) {
      const needCh = level.filter((p) => !p.flags.children && childrenOf(f, p.id).length === 0);
      if (needCh.length) {
        const subs = o.personal && depth === 0 ? [needCh[0]!] : batch ? needCh : [needCh[0]!];
        const isMe = o.personal && depth === 0 && subs[0]!.id === me(f)?.id;
        return {
          id: isMe ? `children:${subs[0]!.id}` : `children_of:${subs.map((s) => s.id).join(",")}`, kind: isMe ? "children" : "children_of", section: o.section, subjects: subs.map((s) => s.id),
          optional: true, quick: isMe ? ["No children"] : ["None / don’t know"], skip: flagOps(subs.map((s) => s.id), "children", "done"),
          question: isMe ? "Do you have children? Please tell me their names, and whether each is a son or a daughter."
            : subs.length === 1 ? `Does ${nm(subs[0]!)} have children? Please tell me their names, and son or daughter.` : "Which of them have children? Please tell me the children’s names, son or daughter, and whose they are.",
          instruction: `Ask for the children of: ${subs.map((s) => who(s, lab)).join("; ")} — names, and son or daughter. Add each child with add_person relation child_of <father's id> (the app links the mother automatically when the father has one wife; pass to2 if he has several). Daughters are recorded by NAME ONLY: never ask about a daughter's husband or children. set_flag children=done on everyone asked${isMe ? "" : "; the user may not know — that is fine"}.`,
        };
      }
    }
    if (o.oneLevel) return null;
    level = [...new Map(level.flatMap((p) => childrenOf(f, p.id)).filter((k) => !k.placeholder && k.gender !== "female").map((k) => [k.id, k])).values()];
  }
  return null;
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
