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
 */
export const EVENT_NAMES = ["sample_opened", "tree_started", "tree_saved", "pdf_downloaded", "share_clicked", "view_opened", "correction_suggested", "woman_linked", "tree_connect_requested", "tree_connect_accepted", "google_signin", "tree_combined", "newsletter_confirmed", "invite_shared", "tree_from_invite", "save_card_shown", "save_card_clicked"] as const;
export type EventName = (typeof EVENT_NAMES)[number];
/**
 * Counts only the server writes (a browser can never post these, so they cannot be faked):
 *  ai_turn       one answer was written by the AI model
 *  ai_save_gate  the AI helper stepped aside because the tree is not saved yet
 *  ai_day_limit  the AI helper stepped aside because this device used its day's answers
 *  ai_alert_70 / ai_alert_100   the "AI use today" email was sent (so it is sent once a day)
 */
export const SERVER_EVENTS = ["ai_turn", "ai_save_gate", "ai_day_limit", "ai_alert_70", "ai_alert_100"] as const;
export type ServerEvent = (typeof SERVER_EVENTS)[number];
export const isEvent = (n: unknown): n is EventName => typeof n === "string" && (EVENT_NAMES as readonly string[]).includes(n);

/** best effort: counting must never break (or slow down) anything else */
export function logEvent(name: EventName | ServerEvent): void {
  try { void getStore()?.addEvent(name).catch(() => {}); } catch { /* ignore */ }
}
