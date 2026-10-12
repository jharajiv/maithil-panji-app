/**
 * Household cards: one card instead of three or four separate questions.
 *   step 1  Yes / No for each group (married? sons? daughters? — or brothers? sisters?), and a number for each "Yes"
 *   step 2  one form with one line per person
 * Nothing here talks to the AI. The people are added exactly as the typed questions would add them (same roles, same flags),
 * so the interview carries on from the same place whichever way a group was answered.
 */
import { DONE_TEXT, groupMembers, isListGoal, listGoal, listOps, nextGoal, type Goal, type ListKind } from "./interview";
import { applyOps, labels, spousesOf, type DFamily, type DPerson } from "./family";
import { romanToDevanagari } from "./translit";

export type HKind = Extract<ListKind, "wife" | "sons" | "daughters" | "brothers" | "sisters">;
export const MAX_PER_GROUP = 12;

export interface Bundle {
  /** the first question's id: the card answers this question and the ones after it */
  goalId: string;
  owner: { id: string; name: string; isMe: boolean; rel: string };
  groups: HKind[];
}
export interface HAnswer { kind: HKind; names: string[]; /** a "Yes" with no names filled in */ yesNoNames?: boolean }
export interface Added { id: string; name: string; role: string }
export interface HResult { family: DFamily; added: Added[]; /** what the person said, one line per group */ lines: string[]; reply: string; next: Goal | null }

const first = (p: DPerson) => p.name_roman.split(" ")[0] ?? p.name_roman;
const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 80);
const answeredFlag = (p: DPerson, k: HKind) => {
  const flag = k === "wife" ? "spouse" : k;
  return !!p.flags[flag] || ((k === "brothers" || k === "sisters") && !!p.flags.siblings) || ((k === "sons" || k === "daughters") && !!p.flags.children);
};
const open = (f: DFamily, p: DPerson, k: HKind) => !answeredFlag(p, k) && (k === "wife" ? spousesOf(f, p.id).length === 0 : groupMembers(f, k, p.id).length === 0);

/** Is the question being asked one of a group the card can answer together? (A single remaining question stays a typed question.) */
export function householdBundle(f: DFamily, g: Goal | null): Bundle | null {
  if (!g || !isListGoal(g)) return null;
  const owner = f.persons.find((p) => p.id === g.subjects[0]);
  if (!owner || owner.placeholder) return null;
  const k = g.kind as HKind;
  let order: HKind[] = [];
  if (k === "wife" && /^Your (brothers’ )?famil/.test(g.section)) order = ["wife", "sons", "daughters"];
  else if ((k === "sons" || k === "daughters") && (/^Your (brothers’ )?famil/.test(g.section) || /^Step 5 of/.test(g.section))) order = ["sons", "daughters"];
  else if (k === "brothers") order = ["brothers", "sisters"];
  else return null;
  const groups = order.slice(order.indexOf(k)).filter((x) => x === k || open(f, owner, x));
  if (groups.length < 2) return null;
  const lab = labels(f)[owner.id];
  return { goalId: g.id, owner: { id: owner.id, name: first(owner), isMe: !!owner.is_me, rel: owner.is_me ? "you" : (lab ?? "relative") }, groups };
}

const listOf = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** Record the card's answers. `answers` may leave a group out (nothing is recorded for it). */
export function applyHousehold(f: DFamily, b: Bundle, answers: HAnswer[]): HResult {
  let fam = f;
  const added: Added[] = [];
  const lines: string[] = [];
  const title: Record<HKind, string> = { wife: "Wife", sons: "Sons", daughters: "Daughters", brothers: "Brothers", sisters: "Sisters" };
  for (const kind of b.groups) {
    const a = answers.find((x) => x.kind === kind);
    if (!a) continue;
    const owner = fam.persons.find((p) => p.id === b.owner.id);
    if (!owner) break;
    const goal = listGoal(fam, kind, owner, "Household", labels(fam));
    const have = new Set(groupMembers(fam, kind, owner.id).map((p) => p.name_roman.toLowerCase()));
    const names: string[] = [];
    for (const raw of a.names) {
      const n = clean(raw);
      if (!n || /^\d+$/.test(n) || have.has(n.toLowerCase())) continue;
      have.add(n.toLowerCase()); names.push(n);
    }
    const said = kind === "wife" ? 1 : MAX_PER_GROUP;
    const take = names.slice(0, said);
    let ops;
    if (a.yesNoNames && !take.length) { ops = goal.skip; lines.push(`${title[kind]}: yes (names not given)`); }
    else if (!take.length) { ops = listOps(goal, []); lines.push(`${title[kind]}: none`); }
    else { ops = listOps(goal, take.map((n) => ({ name: n, dev: romanToDevanagari(n) }))); lines.push(`${title[kind]}: ${take.join(", ")}`); }
    const before = new Set(fam.persons.map((p) => p.id));
    fam = applyOps(fam, ops, { panji: true }).family;
    const lab = labels(fam);
    for (const p of fam.persons) if (!before.has(p.id) && !p.placeholder) added.push({ id: p.id, name: p.name_roman, role: lab[p.id] ?? "relative" });
  }
  const next = nextGoal(fam);
  const ack = added.length ? `Added ${listOf(added.map((x) => x.name))}.` : "Noted.";
  return { family: fam, added, lines, reply: `${ack} ${next ? next.question : DONE_TEXT}`.trim(), next };
}
