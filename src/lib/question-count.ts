import type { TurnOutput } from "./agent";
import { logEvent } from "./events";
import { faqById, isQuestion } from "./faq";

/**
 * Counts which questions people ask — only that a ready-made answer was given (by its id), or that a typed question had no answer.
 * The words people type are never stored, so the FAQ can grow from real questions without recording anyone's text.
 */
export function noteQuestion(text: string, out: Pick<TurnOutput, "faq">): void {
  try {
    if (out.faq) { if (faqById(out.faq)) logEvent(`faq:${out.faq}`); return; }
    if (isQuestion(text)) logEvent("faq_unanswered");
  } catch { /* counting must never break a chat turn */ }
}
