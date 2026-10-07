import type { AgentDeps, TurnOutput } from "./agent";
import { runTurn } from "./agent";
import { basicTurn } from "./basic-turn";
import { correctionTurn } from "./correction";
import { isListGoal, nextGoal, replyGoal } from "./interview";
import { listTurn, type ListInput } from "./list-turn";
import { hiReply } from "./hi";

export type TurnResult = TurnOutput & { mode: "ai" | "basic" };

/**
 * One chat turn. The fixed step-by-step questions go through list-turn (the AI only reads names); everything else
 * (name, gender, gotra, mool, the father chain) is the AI interview, or the plain interviewer when there is no `deps`.
 */
export async function takeTurn(deps: AgentDeps | null, input: ListInput): Promise<TurnResult> {
  const out = await takeTurnEn(deps, input);
  if (input.lang !== "hi") return out;
  // Hindi: the app's own wording is replaced; anything the AI wrote itself is already Hindi
  return { ...out, reply: hiReply(out.reply, out.family, [out.goal, input.answerGoal ? replyGoal(input.family, input.answerGoal) : null, nextGoal(input.family, { batch: false })]) };
}

async function takeTurnEn(deps: AgentDeps | null, input: ListInput): Promise<TurnResult> {
  const asked = input.answerGoal ? replyGoal(input.family, input.answerGoal) : null;
  if (asked && !isListGoal(asked)) return { ...correctionTurn(input, asked), mode: deps ? "ai" : "basic" };
  const goal = asked ?? nextGoal(input.family, { batch: false });
  if (isListGoal(goal)) return { ...(await listTurn(deps, input, goal)), mode: deps ? "ai" : "basic" };
  if (deps) return { ...(await runTurn(deps, input)), mode: "ai" };
  return { ...(await basicTurn(input)), mode: "basic" };
}
