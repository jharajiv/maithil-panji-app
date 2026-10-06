/**
 * "Basic mode": a rule-based interviewer used when no AI key is configured or the AI is unavailable.
 * It understands the same goals as the AI, with plainer parsing (names separated by commas, yes/no, years).
 */
import { parseDateText } from "./dates";
import { classify, GOTRAS, searchGotras, searchMools, plainRoman } from "./lookup";
import { me, type DFamily, type Flag, type Op, type PanjiRef, type Pending, type PersonFields } from "./family";
import type { Goal } from "./interview";
import { romanToDevanagari } from "./translit";

const SKIP = /^\s*(i\s+)?(skip|pass|don'?t know|do not know|dont know|don'?t remember|do not remember|dont remember|not sure|no idea|pata nahi|pata nhi|nahi pata|नहीं पता|पता नहीं|याद नहीं|नहीं मालूम)\b/i;
const NO = /^\s*(no|none|nope|nahi|nahin|नहीं|not married|no children|no brothers|no sisters|none are married|no grandchildren|unmarried)\b/i;
const YES = /^\s*(yes|yeah|yep|ha|haan|हाँ|हां|married|same|same as (my )?mool)\b/i;
const FEMALE = /\b(daughters?|sisters?|girl|female|wife|beti|behen|bahan|didi|bua|बेटी|बहन|दीदी)\b/i;
const MALE = /\b(sons?|brothers?|boy|male|husband|beta|bhai|बेटा|भाई)\b/i;

export const isSkip = (t: string) => SKIP.test(t);
export const isNo = (t: string) => NO.test(t);

export interface ParsedName { name: string; gender?: "male" | "female" }

const NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|1|2|3|4|5|6|7|8|9|10";
/** words that are never part of a name — removed from the front/back/middle of a reply like "one son and he is Arihantt" */
const FILLER = new RegExp(`\\b(${NUMBER_WORDS}|my|his|her|their|our|its|it's|it|he|she|they|we|i|you|have|has|had|got|also|just|only|with|who|whose|which|that|this|there|here|is|are|am|was|were|named|called|name|names|naam|the|an|a|of|son|sons|daughter|daughters|brother|brothers|sister|sisters|elder|younger|older|bhai|beti|beta|behen|didi|child|children|kids|kid)\\b`, "gi");
/** a reply that talks about the conversation itself, not about names */
const TALKING = /\b(error|wrong|mistake|mistaken|please|what|why|how|because|should|would|could|can't|cannot|need|read|reading|saying|said|understand|listen|correct|again|sorry|stupid|bad)\b/i;
const CUE = /^([\s\S]*)\b(?:his name is|her name is|their names are|their name is|names are|name is|named|called|naam hai|he is|she is|they are)\s+([\s\S]+)$/i;

export function parseNames(text: string): ParsedName[] {
  const whole = text.trim();
  const tail = CUE.exec(whole)?.[2] ?? whole;
  const cued = tail !== whole;
  const cued0 = cued;
  // a gender word right at the start ("two daughters Anika and Riya", "my son Aarav") applies to every name in the reply
  const lead = /^\W*(?:\w+\s+){0,2}(sons?|daughters?|brothers?|sisters?|beta|beti|bhai|behen)\b/i.exec(whole)?.[1];
  const only = FEMALE.test(whole) !== MALE.test(whole) ? (FEMALE.test(whole) ? "female" : "male") : undefined;
  const wholeGender: "male" | "female" | undefined = lead ? (FEMALE.test(lead) ? "female" : "male") : cued0 ? only : undefined;
  // "I have one son and his name is Arihantt" → only the part after the cue holds names

  if (TALKING.test(tail) || (!cued && tail.split(/\s+/).length > 12 && !/[,;]/.test(tail))) return [];
  return tail
    .split(/[,;\n]| and | aur | और /i)
    .map((raw) => {
      const gender: "male" | "female" | undefined = FEMALE.test(raw) ? "female" : MALE.test(raw) ? "male" : wholeGender;
      const name = raw
        .replace(/\(.*?\)/g, " ").replace(/[-–—:].*$/, " ")
        .replace(FILLER, " ")
        .replace(/[.!?]+$/g, "")
        .replace(/\s+/g, " ").trim();
      return { name, gender };
    })
    .filter((x) => x.name && !/^\d+$/.test(x.name) && x.name.split(" ").length <= 5);
}

const ref = <T extends { id: string; roman: string; dev: string }>(x: T): PanjiRef => ({ id: x.id, roman: plainRoman(x.roman), dev: x.dev });

type Rel = { type: "father_of" | "mother_of" | "child_of" | "spouse_of" | "sibling_of"; to: string };
function personOp(p: ParsedName, relation: Rel, defaultGender?: "male" | "female"): Op {
  return {
    op: "add_person", name_roman: p.name, name_dev: romanToDevanagari(p.name),
    gender: p.gender ?? defaultGender, relation,
  } satisfies Op;
}

export interface BasicResult { ops: Op[]; ack: string; /** show this instead of the next question (a confirmation) */ ask?: string; pending?: Pending }

export function basicParse(f: DFamily, goal: Goal, text: string, pending?: Pending): BasicResult {
  const t = text.trim();
  const m = me(f);
  const sub = goal.subjects[0];
  const done = (id: string, flag: Flag): Op => ({ op: "set_flag", id, flag, value: "done" });

  switch (goal.kind) {
    case "self_name": {
      const name = t.replace(/^(my name is|i am|i'm|this is|mera naam|मेरा नाम)\s+/i, "").trim();
      return { ops: [{ op: "add_person", name_roman: name, name_dev: romanToDevanagari(name) }], ack: "Nice to meet you." };
    }
    case "self_gender": {
      const g = /^\s*(f|female|woman|lady|girl|महिला)/i.test(t) ? "female" : "male";
      return { ops: [{ op: "update_person", id: m!.id, set: { gender: g } }], ack: "Thank you." };
    }
    case "self_gotra":
    case "self_mool": {
      if (isSkip(t)) return { ops: goal.skip, ack: "No problem." };
      const kind = goal.kind === "self_gotra" ? "gotra" : "mool";
      const set = (r: PanjiRef): Op => ({ op: "update_person", id: m!.id, set: { [kind]: r } as PersonFields });
      const mine = pending && pending.goalId === goal.id && pending.kind === kind ? pending : undefined;
      if (mine && YES.test(t)) return { ops: [set(mine.ref)], ack: `Noted: ${kind} ${mine.ref.roman}${mine.ref.dev ? ` (${mine.ref.dev})` : ""}.` };
      if (mine && isNo(t)) return { ops: [], ack: "", ask: `No problem — please type your ${kind} exactly as you want it recorded.`, pending: { ...mine, rejected: true } };
      const hits: { item: { id: string; roman: string; dev: string }; score: number }[] = kind === "gotra" ? searchGotras(t) : searchMools(t, { gotraId: m!.gotra?.id });
      const hit = classify(hits);
      const top = hit.hits[0]?.item;
      if (top && hit.status === "exact") return { ops: [set(ref(top))], ack: `Noted: ${kind} ${plainRoman(top.roman)}${top.dev ? ` (${top.dev})` : ""}.` };
      if (top && !mine?.rejected) {
        const r = ref(top);
        return { ops: [], ack: "", ask: `Did you mean ${r.roman}${r.dev ? ` (${r.dev})` : ""}? Please answer Yes, or type it again.`, pending: { goalId: goal.id, kind, ref: r } };
      }
      return { ops: [set({ roman: t, custom: true })], ack: `I have noted “${t}” as a new ${kind} — our team will review it. Thank you.` };
    }
    case "self_birth": {
      const y = parseDateText(t);
      return y ? { ops: [{ op: "update_person", id: m!.id, set: { birth: y } }], ack: "Thank you." } : { ops: goal.skip, ack: "Okay." };
    }
    case "self_place":
      return isSkip(t) ? { ops: goal.skip, ack: "Okay." } : { ops: [{ op: "update_person", id: m!.id, set: { place: t } }], ack: "Noted." };
    case "spouse": {
      if (isNo(t) || isSkip(t)) return { ops: goal.skip, ack: "Noted." };
      const [p] = parseNames(t.replace(/^(yes|haan|हाँ)[,.]?\s*/i, ""));
      return p ? { ops: [personOp(p, { type: "spouse_of", to: sub! }), done(sub!, "spouse")], ack: `Noted — ${p.name}.` } : { ops: [], ack: "" };
    }
    case "children":
    case "children_of": {
      if (isNo(t) || isSkip(t)) return { ops: goal.skip, ack: "Noted." };
      const people = parseNames(t);
      if (!people.length) return { ops: [], ack: "" };
      return { ops: [...people.map((p) => personOp(p, { type: "child_of", to: sub! })), done(sub!, "children")], ack: `Added ${people.map((p) => p.name).join(", ")}.` };
    }
    case "spouses_of": {
      if (isNo(t) || isSkip(t)) return { ops: goal.skip, ack: "Noted." };
      const [p] = parseNames(t.replace(/^(yes|haan|हाँ)[,.]?\s*/i, ""));
      return p ? { ops: [personOp(p, { type: "spouse_of", to: sub! }), done(sub!, "spouse")], ack: `Noted — ${p.name}.` } : { ops: [], ack: "" };
    }
    case "father":
    case "mother": {
      if (isSkip(t) || isNo(t)) return { ops: goal.skip, ack: "That’s fine." };
      const [p] = parseNames(t);
      return p ? { ops: [personOp({ name: p.name }, { type: goal.kind === "father" ? "father_of" : "mother_of", to: sub! })], ack: `Noted — ${p.name}.` } : { ops: [], ack: "" };
    }
    case "details": {
      if (isSkip(t)) return { ops: goal.skip, ack: "Okay." };
      const years = [...t.matchAll(/\b(1[789]\d\d|20[0-2]\d)\b/g)].map((x) => x[1]!);
      const dead = /\b(late|passed|expired|died|deceased|no more|swargiya|स्वर्गीय)\b/i.test(t) || /not (alive|living)/i.test(t);
      const village = t.match(/(?:village|from|gaon|गाँव|गांव)\s*(?:is|:)?\s*([A-Za-zऀ-ॿ ]{3,30})/i)?.[1]?.trim();
      const set: PersonFields = {};
      if (dead) { set.status = "deceased"; if (years[1]) set.death = years[1]; else if (years[0] && years.length === 1 && /died|passed|expired|late/i.test(t) && false) set.death = years[0]; }
      else if (/\b(alive|living|yes)\b/i.test(t)) set.status = "living";
      const dt = parseDateText(t);
      if (dt) set.birth = dt;
      if (village) set.place = village;
      return { ops: [...(Object.keys(set).length ? [{ op: "update_person", id: sub!, set } as Op] : []), done(sub!, "details")], ack: "Thank you." };
    }
    case "siblings": {
      if (isNo(t) || isSkip(t)) return { ops: goal.skip, ack: "Noted." };
      const people = parseNames(t);
      if (!people.length) return { ops: [], ack: "" };
      return { ops: [...people.map((p) => personOp(p, { type: "sibling_of", to: sub! })), done(sub!, "siblings")], ack: `Added ${people.map((p) => p.name).join(", ")}.` };
    }
  }
}

export const KNOWN_GOTRAS = GOTRAS.length;
