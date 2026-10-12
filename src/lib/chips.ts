/**
 * Suggestions shown as buttons next to the gotra and mool questions: help, never a form (the typing box is always there).
 * The six best-known gotras come first (by how many mools the Panji list holds for each); the rest of the 20 sit behind "All gotras".
 * After the gotra is known, the mool buttons are the mools of THAT gotra only.
 */
import { allGotras, allMools, classify, plainRoman, searchGotras, type Gotra, type Mool } from "./lookup";

export interface Sug { label: string; labelHi: string; /** what is sent to the interview */ send: string }
export interface SugSet { top: Sug[]; rest: Sug[] }

/** the way people usually spell them in English letters (the Panji list itself uses scholarly spelling) */
export const FRIENDLY: Record<string, string> = {
  g01: "Shandilya", g02: "Vatsa", g03: "Kashyap", g04: "Savarna", g05: "Parashar", g06: "Bharadwaj", g07: "Katyayan", g08: "Alambukaksha", g09: "Garga", g10: "Kaushik",
  g11: "Krishnatreya", g12: "Maudgalya", g13: "Gautam", g14: "Vashishtha", g15: "Kaundilya", g16: "Jatukarna", g17: "Tandi", g18: "Vishnuvriddhi", g19: "Upamanyu", g20: "Kapila",
};
/** shown first: the gotras with the most mools in the Panji list */
export const TOP_GOTRAS = ["g01", "g02", "g03", "g05", "g06", "g04"];
const TOP_MOOLS = 8;

/** the usual spelling is sent when the interview reads it as exactly this gotra; otherwise the Panji list’s own spelling, which always is */
const gSug = (g: Gotra): Sug => {
  const l = FRIENDLY[g.id] ?? plainRoman(g.roman);
  const m = classify(searchGotras(l));
  return { label: l, labelHi: g.dev || l, send: m.status === "exact" && m.hits[0]!.item.id === g.id ? l : g.roman };
};
/** the Devanagari spelling is sent: it always reads as exactly this mool (two mools in the list differ only by b/v) */
const mSug = (m: Mool): Sug => { const l = plainRoman(m.roman); return { label: l, labelHi: m.dev || l, send: m.dev || m.roman }; };

export function gotraSuggestions(): SugSet {
  const all = allGotras().filter((g) => !g.extra);
  const top = TOP_GOTRAS.map((id) => all.find((g) => g.id === id)).filter((g): g is Gotra => !!g).map(gSug);
  const rest = all.filter((g) => !TOP_GOTRAS.includes(g.id)).map(gSug);
  return { top, rest };
}

/** the mools of one gotra (all of the list when the gotra is not in it) */
export function moolSuggestions(gotraId?: string): SugSet {
  const all = allMools().filter((m) => !m.extra && (!gotraId || m.gotras.length === 0 || m.gotras.includes(gotraId)));
  const sorted = [...all].sort((a, b) => plainRoman(a.roman).localeCompare(plainRoman(b.roman)));
  return { top: sorted.slice(0, TOP_MOOLS).map(mSug), rest: sorted.slice(TOP_MOOLS).map(mSug) };
}
