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
  | "father" | "mother" | "details" | "siblings";

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

  // spouse + children of "me"
  if (!m.flags.spouse && spousesOf(f, m.id).length === 0) return {
    id: `spouse:${m.id}`, kind: "spouse", section: "Your family", subjects: [m.id], optional: true, quick: ["Not married"], skip: flagOps([m.id], "spouse", "done"),
    question: "Are you married? If yes, what is your spouse’s name?",
    instruction: `Ask if the user (${m.id}) is married and the spouse's name. Add with add_person relation spouse_of ${m.id}. Do NOT ask about the spouse's parents or family — Panji records only her/his name. If not married, set_flag spouse=done.`,
  };
  if (!m.flags.children && childrenOf(f, m.id).length === 0) return {
    id: `children:${m.id}`, kind: "children", section: "Your family", subjects: [m.id], optional: true, quick: ["No children"], skip: flagOps([m.id], "children", "done"),
    question: "Do you have children? Please tell me their names (and whether each is a son or a daughter).",
    instruction: `Ask about the user's children (${m.id}): names, son or daughter, and optionally birth years. Add each with add_person relation child_of ${m.id}. Accept several in one answer. Set_flag children=done after the user has listed them all (ask "any more?" if unsure). If none, set_flag children=done.`,
  };
  const kids = childrenOf(f, m.id).filter((k) => !k.placeholder);
  const kidsNoSpouse = kids.filter((k) => !k.flags.spouse && spousesOf(f, k.id).length === 0);
  if (kidsNoSpouse.length) {
    const subs = batch ? kidsNoSpouse : [kidsNoSpouse[0]!];
    return {
      id: `spouses_of:${subs.map((s) => s.id).join(",")}`, kind: "spouses_of", section: "Your family", subjects: subs.map((s) => s.id), optional: true,
      quick: ["None are married"], skip: flagOps(subs.map((s) => s.id), "spouse", "done"),
      question: subs.length === 1 ? `Is ${nm(subs[0]!)} married? If so, what is the spouse’s name?` : "Are any of your children married? Tell me each spouse’s name.",
      instruction: `Ask which of these children are married and their spouses' names: ${subs.map((s) => who(s, lab)).join("; ")}. Add each spouse via add_person relation spouse_of <child id>. Never ask about the spouse's parents. set_flag spouse=done on every child you have asked about (including unmarried ones).`,
    };
  }
  const kidsNoKids = kids.filter((k) => !k.flags.children && childrenOf(f, k.id).length === 0);
  if (kidsNoKids.length && kidsNoSpouse.length === 0) {
    const subs = batch ? kidsNoKids : [kidsNoKids[0]!];
    return {
      id: `children_of:${subs.map((s) => s.id).join(",")}`, kind: "children_of", section: "Your family", subjects: subs.map((s) => s.id), optional: true,
      quick: ["No grandchildren yet"], skip: flagOps(subs.map((s) => s.id), "children", "done"),
      question: subs.length === 1 ? `Does ${nm(subs[0]!)} have children?` : "Do any of your children have children of their own? Tell me names and whose child.",
      instruction: `Ask whether these people have children, and the children's names: ${subs.map((s) => who(s, lab)).join("; ")}. Add each child with add_person relation child_of <parent id> (pass to2 if the other parent is known and ambiguous). set_flag children=done for every person asked.`,
    };
  }

  // the patriline, generation by generation
  let c: DPerson | undefined = m;
  for (let guard = 0; c && guard < 10; guard++) {
    const g = generation(f, c.id);
    const father = fatherOf(f, c.id);
    const mother = motherOf(f, c.id);
    const cLabel = lab[c.id] ?? "relative";
    const who_ = c.id === m.id ? "your" : `your ${cLabel}’s`;

    if (!father) {
      if (!c.flags.father) return {
        id: `father:${c.id}`, kind: "father", section: g === 0 ? "Your parents" : "Your ancestors", subjects: [c.id], optional: g > 0, quick: ["I don’t remember"],
        skip: flagOps([c.id], "father", "unknown"),
        question: g === 0 ? "What is your father’s name?" : `Do you remember the name of ${firstName(c)}’s father (your ${up(FATHER, g)})?`,
        instruction: `Ask the name of ${who_} father (${who(c, lab)}) — he is the user's ${up(FATHER, g)}. Add via add_person relation father_of ${c.id}. He inherits the family's gotra/mool automatically. If the user doesn't remember, set_flag father=unknown on ${c.id} (this ends the ancestor chain).`,
      };
    }
    const chainEnds = !father || father.placeholder;
    if (!chainEnds && !mother && !c.flags.mother) return {
      id: `mother:${c.id}`, kind: "mother", section: g === 0 ? "Your parents" : "Your ancestors", subjects: [c.id], optional: true, quick: ["I don’t remember"],
      skip: flagOps([c.id], "mother", "unknown"),
      question: g === 0 ? "What is your mother’s name?" : `And ${firstName(c)}’s mother (your ${up(MOTHER, g)}) — do you remember her name?`,
      instruction: `Ask the name of ${who_} mother (your ${up(MOTHER, g)}) — name only. Panji does not record her parents; do NOT ask about her family. Add via add_person relation mother_of ${c.id}. If unknown, set_flag mother=unknown on ${c.id}.`,
    };
    if (!chainEnds && father && !father.flags.details) return {
      id: `details:${father.id}`, kind: "details", section: g === 0 ? "Your parents" : "Your ancestors", subjects: [father.id], optional: true, quick: ["Skip"],
      skip: flagOps([father.id], "details", "skipped"),
      question: `Is ${nm(father)} living? And do you know his date of birth (even just the year is fine) and his village (with district)?`,
      instruction: `Ask in ONE question whether ${who(father, lab)} is living or has passed away, and (if known) his date of birth/death — a full date, month and year, or just a year — and his village + district (never a street address). Update via update_person {status, birth, death, place} with place as "Village, District, State". Optional — set_flag details=done when answered, or skipped.`,
    };
    if (!c.flags.siblings) return {
      id: `siblings:${c.id}`, kind: "siblings", section: g === 0 ? "Your brothers and sisters" : "Your ancestors’ families", subjects: [c.id], optional: true,
      quick: [g === 0 ? "I have no brothers or sisters" : "He had no brothers or sisters", "I don’t know"],
      skip: flagOps([c.id], "siblings", "done"),
      question: g === 0 ? "Do you have brothers or sisters? Please tell me each name, and whether older or younger." : `Did ${firstName(c)} (your ${cLabel}) have brothers or sisters? Please list their names.`,
      instruction: g === 0
        ? `Ask for ALL of the user's brothers and sisters (${c.id}) — names and whether brother/sister (older/younger is nice but optional). Add each with add_person relation sibling_of ${c.id}. Then set_flag siblings=done on ${c.id}. If none, set_flag siblings=done.`
        : `Ask for ALL brothers and sisters of ${who(c, lab)} (the user's ${cLabel}'s siblings — i.e. ${g === 1 ? "the user's uncles and aunts on the father's side" : "great-uncles and great-aunts"}). Names and brother/sister. Add each with add_person relation sibling_of ${c.id}. Then set_flag siblings=done on ${c.id}. If none/unknown, set_flag siblings=done.`,
    };
    const sibs = siblingsOf(f, c.id).filter((s) => !s.placeholder);
    const needSp = sibs.filter((s) => !s.flags.spouse && spousesOf(f, s.id).length === 0);
    if (needSp.length) {
      const subs = batch ? needSp : [needSp[0]!];
      return {
        id: `spouses_of:${subs.map((s) => s.id).join(",")}`, kind: "spouses_of", section: g === 0 ? "Your brothers and sisters" : "Your ancestors’ families", subjects: subs.map((s) => s.id),
        optional: true, quick: ["None are married", "I don’t know"], skip: flagOps(subs.map((s) => s.id), "spouse", "done"),
        question: subs.length === 1 ? `Is ${nm(subs[0]!)} married? What is the spouse’s name?` : "Who among them is married? Tell me each spouse’s name (husband or wife).",
        instruction: `Ask which of these are married and their spouses' names: ${subs.map((s) => who(s, lab)).join("; ")}. Add each spouse with add_person relation spouse_of <person id> — both husband and wife must appear in the tree. NEVER ask about a spouse's parents or family. set_flag spouse=done on every person asked (including those unmarried).`,
      };
    }
    if (g <= 1) {
      const needCh = sibs.filter((s) => !s.flags.children && childrenOf(f, s.id).length === 0);
      if (needCh.length) {
        const subs = batch ? needCh : [needCh[0]!];
        return {
          id: `children_of:${subs.map((s) => s.id).join(",")}`, kind: "children_of", section: g === 0 ? "Your brothers and sisters" : "Your ancestors’ families", subjects: subs.map((s) => s.id), optional: true,
          quick: ["None / don’t know"], skip: flagOps(subs.map((s) => s.id), "children", "done"),
          question: subs.length === 1 ? `Does ${nm(subs[0]!)} have children? Please tell me their names.` : "Which of them have children? Please tell me the children’s names and whose they are.",
          instruction: `Ask for the children of: ${subs.map((s) => who(s, lab)).join("; ")}. Add each child with add_person relation child_of <parent id>. The user may not know; that is fine — set_flag children=done on everyone asked. Keep it light: names and son/daughter only.`,
        };
      }
    }
    if (chainEnds || !father) break;
    c = father;
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
