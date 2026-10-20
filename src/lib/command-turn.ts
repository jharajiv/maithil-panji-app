/**
 * Commands in the chat. When someone types an instruction instead of answering the question ("change gotra Shandliya to Shandilya",
 * "remove my uncle", "fix the village of my father"), the chat does it first, and only then asks whether to go back to the questions:
 *
 *   command → done → "Shall we go back to where we left off?"  → yes: the question is asked again
 *                                                              → no:  "Can I help with something else?" + what is still missing
 *
 * One spelling fixed in many people is done by plain rules (bulk.ts), with no AI. Anything else goes to the AI in "command" mode
 * (agent.ts), or, with no AI, the person is told how to say it.
 */
import type { AgentDeps, TurnOutput } from "./agent";
import { runTurn } from "./agent";
import { isNo, isYes } from "./basic";
import { bulkRename, parseBulk } from "./bulk";
import { me, type DFamily } from "./family";
import { hiGoal, hiReply } from "./hi";
import { nextGoal, type Goal } from "./interview";
import type { ListInput } from "./list-turn";

export const RESUME_YES = "Yes, continue";
export const RESUME_NO = "No, not now";

const VERB = /^\s*(?:please\s+|pls\s+|can you\s+|could you\s+|i want to\s+|i would like to\s+|i need to\s+|kindly\s+)?(change|update|replace|rename|correct|fix|set|make|remove|delete|mark|swap|edit|merge|badal|badlo|sudhar|theek\s*kar)\b/i;
const VERB_HI = /^\s*(बदल|बदलो|बदलिए|सुधार|ठीक\s*कर|हटा|मिटा|अपडेट|गलत)/;
const MASS = /\b(mass update|bulk update|everywhere|all (?:the )?(?:people|members|persons)|whole family|entire family|every ?one|everybody)\b|\b(gotra|mool|village|place)\b[^.?!]{0,40}\b(wrong|typo|mistake|misspell\w*|incorrect|spelling)\b|\b(wrong|typo|mistake|misspell\w*|incorrect|spelling)\b[^.?!]{0,40}\b(gotra|mool|village|place)\b/i;
const GAPS = /\b(what(?:'s| is)? (?:still )?(?:missing|left|pending)|missing|gaps?|what else|still to fill|incomplete|show me what)\b|क्या बाकी|क्या\s*बाकी|अधूरा/i;
const SPELL_HELP = /\b(spelling|typo|mass update|bulk update)\b|गलत वर्तनी/i;

/** is this message a command rather than an answer? (never used for a reply to a question or a tree box — the caller checks that) */
export function looksLikeCommand(text: string): boolean {
  const t = text.trim();
  if (t.length < 6 || t.length > 400) return false;
  if (parseBulk(t)) return true;
  return VERB.test(t) || VERB_HI.test(t) || MASS.test(t);
}

const hi = (input: ListInput) => input.lang === "hi";
const goalText = (f: DFamily, g: Goal, lang: "en" | "hi") => (lang === "hi" ? (hiGoal(f, g)?.question ?? hiReply(g.question, f, [g])) : g.question);

/** the things that could still be filled in, in plain words (English / Hindi) */
export function gapsOf(f: DFamily, lang: "en" | "hi" = "en"): string[] {
  const people = f.persons.filter((p) => !p.placeholder);
  const out: string[] = [];
  const n = (k: number, en: string, hiT: string) => { if (k > 0) out.push(lang === "hi" ? hiT.replace("{n}", String(k)) : en.replace("{n}", String(k)).replace("{s}", k === 1 ? "" : "s")); };
  const m = me(f);
  const line = people.filter((p) => p.gender !== "female" || p.id === m?.id);
  const k = line.filter((p) => !p.gotra).length;
  if (k) out.push(lang === "hi" ? `${k} लोगों का गोत्र नहीं भरा है` : `${k} ${k === 1 ? "person has" : "people have"} no gotra`);
  n(people.filter((p) => !p.birth && p.flags.birth !== "unknown").length, "{n} birth year{s} not filled in", "{n} लोगों का जन्म वर्ष नहीं भरा है");
  n(people.filter((p) => !p.place).length, "{n} place{s} of living not filled in", "{n} लोगों का निवास स्थान नहीं भरा है");
  n(people.filter((p) => !p.name_dev).length, "{n} name{s} without a Devanagari spelling", "{n} नामों की देवनागरी वर्तनी नहीं है");
  const u = people.filter((p) => p.status === undefined && !p.death).length;
  if (u) out.push(lang === "hi" ? `${u} लोगों के आगे जीवित / दिवंगत नहीं लिखा है` : `${u} ${u === 1 ? "person is" : "people are"} not marked living or deceased`);
  const g = nextGoal(f, { batch: false });
  if (g) out.push(lang === "hi" ? "वंशावली के कुछ प्रश्न अभी बाकी हैं" : "some family questions are still open");
  return out;
}

const gapsReply = (f: DFamily, lang: "en" | "hi"): { reply: string; quick: string[] } => {
  const gaps = gapsOf(f, lang);
  if (lang === "hi") {
    return {
      reply: gaps.length
        ? `ठीक है। अभी ये बातें और भरी जा सकती हैं:\n\n${gaps.map((x) => `• ${x}`).join("\n")}\n\nआप कोई और काम बता सकते हैं, या प्रश्न आगे जारी करें।`
        : "ठीक है। आपकी वंशावली में अभी कुछ भी बाकी नहीं दिख रहा। मैं और किस काम में मदद करूँ?",
      quick: ["Continue the questions", "Fix a spelling everywhere"],
    };
  }
  return {
    reply: gaps.length
      ? `No problem. Can I help with something else? These are the things that could still be filled in:\n\n${gaps.map((x) => `• ${x}`).join("\n")}\n\nTell me what to do, or say “continue” to go back to the questions.`
      : "No problem. Nothing else looks missing in your tree right now. Can I help with something else?",
    quick: ["Continue the questions", "Fix a spelling everywhere"],
  };
};

const resumeAsk = (f: DFamily, lang: "en" | "hi"): { text: string; quick: string[] } | null => {
  if (!nextGoal(f, { batch: false })) return null;
  return { text: lang === "hi" ? "क्या हम वहीं से आगे बढ़ें जहाँ प्रश्न रुके थे?" : "Shall we go back to the questions where we left off?", quick: [RESUME_YES, RESUME_NO] };
};

const base = (input: ListInput, family: DFamily, reply: string, quick: string[], extra: Partial<TurnOutput> = {}): TurnOutput =>
  ({ family, reply, quick, goal: nextGoal(family, { batch: false }), repeats: input.repeats ?? 0, offTopic: false, ops: 0, ...extra });

const HOW_EN = "I can fix a spelling in every person at once. Say it like this:\n• change gotra Shandliya to Shandilya\n• change mool Sarisab to Sarisaba\n• change village Madhubni to Madhubani\n• set gotra of everyone to Kashyap";
const HOW_HI = "मैं एक गलत वर्तनी सभी लोगों में एक साथ ठीक कर सकता हूँ। ऐसे लिखिए:\n• change gotra Shandliya to Shandilya\n• change mool Sarisab to Sarisaba\n• change village Madhubni to Madhubani\n• set gotra of everyone to Kashyap";

/**
 * Handles the chat when it is in a detour or the message is a command. Returns null when the message is a normal answer
 * (the caller carries on with the interview).
 */
export async function commandTurn(deps: AgentDeps | null, input: ListInput): Promise<TurnOutput | null> {
  const lang = hi(input) ? "hi" : "en";
  const f = input.family;
  const t = input.text.trim();

  // 1. the person is answering "shall we go back?"
  if (input.detour === "ask" && !input.answerGoal) {
    if (isYes(t) || /^\s*(continue|ok(?:ay)?|sure|chalo|aage|आगे|ठीक)\b/i.test(t)) {
      const g = nextGoal(f, { batch: false });
      if (!g) return { ...gapsReply(f, lang), family: f, goal: null, repeats: 0, offTopic: false, ops: 0 };
      return { family: f, reply: goalText(f, g, lang), quick: g.quick, goal: g, repeats: 0, offTopic: false, ops: 0 };
    }
    if (isNo(t) || /^\s*(not now|later|abhi nahi|अभी नहीं|baad mein|बाद में)/i.test(t)) {
      const g = gapsReply(f, lang);
      return base(input, f, g.reply, g.quick, { detour: "paused" });
    }
  }
  if (input.detour === "paused" && !input.answerGoal) {
    if (/^\s*(continue the questions|continue|go on|resume|आगे|जारी)/i.test(t)) {
      const g = nextGoal(f, { batch: false });
      if (g) return { family: f, reply: goalText(f, g, lang), quick: g.quick, goal: g, repeats: 0, offTopic: false, ops: 0 };
    }
    if (GAPS.test(t)) { const g = gapsReply(f, lang); return base(input, f, g.reply, g.quick, { detour: "paused" }); }
  }
  if (input.answerGoal || input.pending) return null;

  // 2. a command
  if (/^\s*fix a spelling everywhere\s*$/i.test(t)) return base(input, f, lang === "hi" ? HOW_HI : HOW_EN, [], { detour: input.detour });
  if (GAPS.test(t) && t.length < 80 && !VERB.test(t)) { const g = gapsReply(f, lang); return base(input, f, g.reply, g.quick, { detour: "paused" }); }
  if (!looksLikeCommand(t)) return null;

  const resume = resumeAsk(f, lang);
  const finish = (out: TurnOutput): TurnOutput => {
    // after a command in the middle of the questions, ask whether to go back; after one made while paused, just ask what next
    if (input.detour === "paused" || !resume) return { ...out, quick: [], detour: input.detour === "paused" ? "paused" : undefined, reply: `${out.reply}\n\n${lang === "hi" ? "और कोई काम बताइए, या “Continue the questions” दबाइए।" : "Anything else I can do? Or say “continue” to go back to the questions."}`, ...(input.detour === "paused" ? { quick: ["Continue the questions", "Show me what’s missing"] } : {}) };
    return { ...out, reply: `${out.reply}\n\n${resume.text}`, quick: resume.quick, detour: "ask" };
  };

  const bulk = parseBulk(t);
  if (bulk) {
    const r = bulkRename(f, bulk);
    const msg = lang === "hi" && r.count ? `ठीक कर दिया: ${r.count} लोगों में “${bulk.from ?? "पूरी पितृ-रेखा"}” की जगह “${r.now}” हो गया।` : r.message;
    return finish(base(input, r.family, msg, [], { ops: r.count }));
  }
  if (SPELL_HELP.test(t) && !deps) return finish(base(input, f, lang === "hi" ? HOW_HI : HOW_EN, []));
  if (!deps) return finish(base(input, f, lang === "hi" ? `${HOW_HI}\n\nबाकी बदलाव के लिए पेड़ में उस व्यक्ति पर टैप कीजिए।` : `${HOW_EN}\n\nFor anything else, tap the person in the tree to change their details.`, []));
  const out = await runTurn(deps, { ...input, command: true });
  return finish(out);
}
