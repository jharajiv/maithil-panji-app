/**
 * Replying to an EARLIER opening question (your name, gender, birth, place, a father's or mother's name, a parent's details)
 * corrects that one answer. Nothing else is rebuilt, and an answer that is not understood changes nothing.
 */
import { applyOps, fatherOf, motherOf, type DFamily, type Op } from "./family";
import { isNo, isSkip, parseNames } from "./basic";
import { basicParse } from "./basic";
import { parseDateText } from "./dates";
import { nextGoal, type Goal } from "./interview";
import { romanToDevanagari } from "./translit";
import { DONE_TEXT, type ListInput } from "./list-turn";
import type { TurnOutput } from "./agent";

export function correctionTurn(input: ListInput, goal: Goal): TurnOutput {
  const f: DFamily = input.family;
  const t = input.text.trim();
  const sub = goal.subjects[0]!;
  const done = (reply: string, fam: DFamily, ops: number): TurnOutput => {
    const next = nextGoal(fam, { batch: false });
    return { family: fam, reply: `${reply} ${ops ? "Back to where we were. " : ""}${next ? next.question : DONE_TEXT}`.replace(/\s+/g, " ").trim(), quick: next?.quick ?? [], goal: next, repeats: 0, offTopic: false, ops };
  };
  const again = (msg: string): TurnOutput => {
    const cur = nextGoal(f, { batch: false });
    return { family: f, reply: `${msg} ${goal.question}`, quick: [], goal: cur, repeats: input.repeats ?? 0, offTopic: false, ops: 0 };
  };
  if (!t || isSkip(t) || isNo(t)) return { ...done("Okay — nothing was changed.", f, 0) };

  let ops: Op[] = [];
  let what = "";
  switch (goal.kind) {
    case "self_name": {
      const name = t.replace(/^(my name is|i am|i'm|this is|mera naam|मेरा नाम)\s+/i, "").trim().slice(0, 80);
      if (!name) return again("I did not catch the name.");
      ops = [{ op: "update_person", id: sub, set: { name_roman: name, name_dev: romanToDevanagari(name) } }]; what = "your name"; break;
    }
    case "father": case "mother": {
      const [p] = parseNames(t);
      if (!p) return again("I did not catch the name.");
      const existing = goal.kind === "father" ? fatherOf(f, sub) : motherOf(f, sub);
      ops = existing
        ? [{ op: "update_person", id: existing.id, set: { name_roman: p.name, name_dev: romanToDevanagari(p.name) } }]
        : [{ op: "add_person", name_roman: p.name, name_dev: romanToDevanagari(p.name), relation: { type: goal.kind === "father" ? "father_of" : "mother_of", to: sub } }, { op: "set_flag", id: sub, flag: goal.kind, value: "done" }];
      what = `the ${goal.kind}’s name`; break;
    }
    case "self_birth": {
      const d = parseDateText(t);
      if (!d) return again("I could not read that date.");
      ops = [{ op: "update_person", id: sub, set: { birth: d } }]; what = "the date of birth"; break;
    }
    case "self_place":
      ops = [{ op: "update_person", id: sub, set: { place: t.slice(0, 120) } }]; what = "the place"; break;
    case "self_gender": case "gender": case "details": {
      const r = basicParse(f, goal, t);
      if (!r.ops.length) return again("I did not catch that.");
      ops = r.ops; what = goal.kind === "details" ? "those details" : "the gender"; break;
    }
    default:
      return again("That one can be changed by tapping the person in the tree.");
  }
  const r = applyOps(f, ops, { panji: true });
  if (!r.results.some((x) => x.ok)) return again(r.results[0]?.message ?? "That did not work.");
  return done(`Updated ${what}.`, r.family, ops.length);
}
