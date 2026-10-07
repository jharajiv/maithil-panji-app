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
 */
export const EVENT_NAMES = ["sample_opened", "tree_started", "tree_saved", "pdf_downloaded", "share_clicked", "view_opened", "correction_suggested", "woman_linked"] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export const isEvent = (n: unknown): n is EventName => typeof n === "string" && (EVENT_NAMES as readonly string[]).includes(n);

/** best effort: counting must never break (or slow down) anything else */
export function logEvent(name: EventName): void {
  try { void getStore()?.addEvent(name).catch(() => {}); } catch { /* ignore */ }
}
