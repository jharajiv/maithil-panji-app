import { applyOps } from "./family";
import { basicParse } from "./basic";
import { nextGoal } from "./interview";
import type { TurnInput, TurnOutput } from "./agent";

const DONE = "Thank you! Your family tree is ready. Tap anyone in the tree to correct details or add a photo, change the style, and download your PDF.";

/** Rule-based turn (no AI): used without an API key or when the AI is unavailable. */
export function basicTurn(input: TurnInput): TurnOutput {
  const goal = nextGoal(input.family, { batch: false });
  if (!goal) return { family: input.family, reply: DONE, quick: [], goal: null, repeats: 0, offTopic: false, ops: 0 };

  const r = basicParse(input.family, goal, input.text, input.pending);
  if (r.ask) return { family: input.family, reply: r.ask, quick: r.pending && !r.pending.rejected ? ["Yes", "No"] : [], goal, repeats: 0, offTopic: false, ops: 0, pending: r.pending };
  let family = applyOps(input.family, r.ops).family;
  let repeats = input.repeats ?? 0;
  let next = nextGoal(family, { batch: false });
  let prefix = r.ack;

  if (!r.ops.length) {
    repeats += 1;
    if (repeats >= 2) { family = applyOps(family, goal.skip).family; next = nextGoal(family, { batch: false }); repeats = 0; prefix = "Let’s move on."; }
    else prefix = "Sorry, I did not catch that.";
  } else {
    repeats = next && next.id === goal.id ? repeats + 1 : 0;
  }
  const reply = next ? `${prefix} ${next.question}`.trim() : `${prefix} ${DONE}`.trim();
  return { family, reply, quick: next?.quick ?? [], goal: next, repeats, offTopic: false, ops: r.ops.length };
}
