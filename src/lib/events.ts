import { getStore } from "./store";

/**
 * Simple, anonymous usage counts — enough to see where people drop off, nothing more.
 * Only a name and a time are stored: no tree, no person, no IP address, no cookie.
 *  sample_opened   someone opened the sample tree
 *  tree_started    someone answered the first question
 *  tree_saved      a tree was saved online (account created or tree imported)
 *  pdf_downloaded  someone downloaded their tree as a PDF (our "finished")
 *  share_clicked   someone used a share button (WhatsApp, Facebook, X, copy)
 *  view_opened     someone opened a shared view-only link
 *  correction_suggested  a viewer suggested a correction to a tree
 *  woman_linked    a married woman was linked to her other family's tree
 *  tree_connect_requested / tree_connect_accepted   two owners of similar trees were put in touch
 *  google_signin   someone signed in with Google
 *  tree_combined   two owners combined their trees
 *  newsletter_confirmed   someone confirmed a newsletter subscription
 *  invite_shared   someone used the "invite family" button
 *  tree_from_invite   a tree was saved by someone who came through an invitation link
 *  save_card_shown    the "save your tree" reminder was shown (once per visit)
 *  save_card_clicked  someone tapped "Save my tree" (on the reminder or in the header)
 *  community_clicked  someone tapped "Join our WhatsApp community"
 *  tree_3_people / tree_8_people / tree_complete   a tree that is NOT saved online reached 3 people, 8 people, or the end of the questions (counted once per browser)
 */
export const EVENT_NAMES = ["sample_opened", "tree_started", "tree_saved", "pdf_downloaded", "share_clicked", "view_opened", "correction_suggested", "woman_linked", "tree_connect_requested", "tree_connect_accepted", "google_signin", "tree_combined", "newsletter_confirmed", "invite_shared", "tree_from_invite", "save_card_shown", "save_card_clicked", "community_clicked", "tree_3_people", "tree_8_people", "tree_complete"] as const;
export type EventName = (typeof EVENT_NAMES)[number];
/**
 * Counts only the server writes (a browser can never post these, so they cannot be faked):
 *  ai_turn       one answer was written by the AI model
 *  ai_call       one call to an AI model (an answer can need several); ai_call_light = the part that went to the smaller, cheaper model
 *  ai_save_gate  the AI helper stepped aside because the tree is not saved yet
 *  ai_day_limit  the AI helper stepped aside because this device used its day's answers
 *  story_added   a family member added a photo or memory to a person on a tree
 *  story_approved  a waiting story was approved (by the person or on their behalf)
 *  ai_alert_70 / ai_alert_100   the "AI use today" email was sent (so it is sent once a day)
 */
export const SERVER_EVENTS = ["ai_turn", "ai_call", "ai_call_light", "ai_save_gate", "ai_day_limit", "ai_alert_70", "ai_alert_100", "story_added", "story_approved"] as const;
/** "faq:<id>" = the ready-made answer with that id was given; "faq_unanswered" = a typed question we had no answer for (never the words themselves) */
export type ServerEvent = (typeof SERVER_EVENTS)[number] | "faq_unanswered" | `faq:${string}`;
export const isEvent = (n: unknown): n is EventName => typeof n === "string" && (EVENT_NAMES as readonly string[]).includes(n);

/** best effort: counting must never break (or slow down) anything else */
export function logEvent(name: EventName | ServerEvent): void {
  try { void getStore()?.addEvent(name).catch(() => {}); } catch { /* ignore */ }
}
