import type { TurnOutput } from "./agent";
import type { ListInput } from "./list-turn";
import { faqAnswer, faqMatch } from "./faq";
import { hiGoal, hiReply } from "./hi";
import { nextGoal } from "./interview";

/**
 * A typed QUESTION about gotra, mool or the app (for example "which gotra should a married woman write?") is answered with the
 * ready-made text from src/lib/faq.ts, and then the chat goes back to the question it was on. Nothing is saved and nothing changes.
 * It works the same with and without the AI, and in English and Hindi. Returns null when the text is not a question we know.
 */
export function faqTurn(input: ListInput): TurnOutput | null {
  const hit = faqMatch(input.text);
  if (!hit) return null;
  const hi = input.lang === "hi" || /[ऀ-ॿ]/.test(input.text);
  const answer = faqAnswer(hit, hi ? "hi" : "en");
  const goal = nextGoal(input.family, { batch: false });
  const pend = input.pending && !input.pending.rejected ? input.pending.ref : null;

  let back = "";
  let quick: string[] = [];
  if (pend) {
    const name = pend.dev ? `${pend.roman} (${pend.dev})` : pend.roman;
    back = hi ? `क्या आपका मतलब “${name}” से है?` : `Did you mean “${name}”?`;
    quick = ["Yes", "No"];
  } else if (goal) {
    back = input.lang === "hi" ? (hiGoal(input.family, goal)?.question ?? hiReply(goal.question, input.family, [goal])) : goal.question;
    quick = goal.quick;
  }
  return {
    family: input.family,
    reply: back ? `${answer}\n\n${back}` : answer,
    quick, goal, repeats: input.repeats ?? 0, offTopic: false, ops: 0,
    ...(input.pending ? { pending: input.pending } : {}),
    faq: hit.id,
  };
}
