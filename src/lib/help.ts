import type { DFamily } from "./family";
import { me } from "./family";

/** Small helpers for the chat: where to find a gotra or mool, asking a relative on WhatsApp, and what is still to be filled in. */

export const GOTRA_SOURCES = [
  "your Kundli or janam patri (birth chart)",
  "your parents or elders in the family",
  "your family purohit or pandit",
  "older relatives — or their old papers, such as a Panji extract or a puja sankalp",
];

/** the text added to the chat after someone says they do not know their gotra */
export const GOTRA_HELP_MESSAGE = `No problem — you can add it later. Your gotra is usually written or known in:\n\n${GOTRA_SOURCES.map((s) => `• ${s}`).join("\n")}\n\nTap “Still to fill in” below whenever you find it.`;

/** a Google search the person can open to look up their mool — only the gotra is in the link, never their name */
export function moolSearchUrl(gotra?: string): string {
  const q = `${gotra ? `${gotra} gotra ` : ""}mool Maithil Brahmin Panji`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** WhatsApp message to a relative who might know the answer; no phone number — the person picks who to send it to */
export function askRelativeUrl(question: string): string {
  const text = `Namaste! I am building our family tree on Maithil Panji. Could you help me with this one?\n\n${question}\n\nThank you!`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const HINT = "The better your answers, the better your tree. Take your time, and skip anything you don’t know.";
export const HINT_HI = "जितने सही उत्तर, उतनी सही आपकी वंशावली।";

export interface StillTo { field: "gotra" | "mool" | "birth" | "place"; label: string }

/** things the person skipped about themselves that can still be filled in */
export function stillToFill(f: DFamily): StillTo[] {
  const m = me(f);
  if (!m) return [];
  const out: StillTo[] = [];
  if (!m.gotra && m.flags.gotra) out.push({ field: "gotra", label: "Gotra" });
  if (!m.mool && m.flags.mool) out.push({ field: "mool", label: "Mool" });
  if (!m.birth && m.flags.birth) out.push({ field: "birth", label: "Birth date" });
  if (!m.place && m.flags.place) out.push({ field: "place", label: "Where you live" });
  return out;
}
