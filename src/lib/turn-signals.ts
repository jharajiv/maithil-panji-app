/**
 * What happened in one chat turn, as anonymous counts. Nothing the person typed, no name, no tree: only the KIND of question that
 * was reached or skipped and a few yes/no facts about how the turn went. Used to see where people stop, where the chat struggles
 * and how the command step is used (Admin → Usage → “How the chat is doing”).
 */
import type { TurnOutput } from "./agent";
import { isSkip } from "./basic";
import type { GoalKind } from "./interview";
import type { ServerEvent } from "./events";

/** the order the questions are asked in (for the “where people stop” table) */
export const GOAL_ORDER: { kind: GoalKind; label: string }[] = [
  { kind: "self_name", label: "Your name" }, { kind: "self_gender", label: "Your gender" }, { kind: "self_gotra", label: "Your gotra" }, { kind: "self_mool", label: "Your mool" },
  { kind: "self_birth", label: "Your birth date" }, { kind: "self_place", label: "Where you live" }, { kind: "father", label: "Father (and his father…)" }, { kind: "mother", label: "Mother" },
  { kind: "details", label: "Details of a relative" }, { kind: "gender", label: "Gender of a relative" },
  { kind: "brothers", label: "Brothers" }, { kind: "sisters", label: "Sisters" }, { kind: "wife", label: "Wives" }, { kind: "husband", label: "Husbands" }, { kind: "sons", label: "Sons" }, { kind: "daughters", label: "Daughters" },
];
const KINDS = new Set<string>(GOAL_ORDER.map((g) => g.kind));
const kindOf = (id?: string) => { const k = id?.split(":")[0]; return k && KINDS.has(k) ? k : undefined; };

const FALLBACK = /did not catch that|समझ नहीं पाया/i;
const YES = /^\s*(yes|yeah|ha|haan|ok|okay|sure|continue|हाँ|हां|आगे|ठीक)/i;

export function turnSignals(input: { text: string; prevGoalId?: string; detour?: "ask" | "paused"; answerGoal?: string }, out: Pick<TurnOutput, "reply" | "goal" | "offTopic" | "detour" | "loopSkipped">): ServerEvent[] {
  const ev: ServerEvent[] = [];
  const reached = kindOf(out.goal?.id);
  if (reached) ev.push(`goal:${reached}`);
  const was = kindOf(input.prevGoalId);
  if (was && !input.detour && !input.answerGoal && isSkip(input.text)) ev.push(`skip:${was}`);
  if (FALLBACK.test(out.reply)) ev.push("chat_fallback");
  if (out.offTopic) ev.push("chat_offtopic");
  if (out.loopSkipped) ev.push("chat_loop_skip");
  if (out.detour === "ask") ev.push("cmd_run");
  if (input.detour === "ask" && out.detour === "paused") ev.push("cmd_resume_no");
  else if (input.detour === "ask" && !out.detour && YES.test(input.text)) ev.push("cmd_resume_yes");
  return ev;
}
