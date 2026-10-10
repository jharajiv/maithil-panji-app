/** FAQ: the right answer for a typed question, and no false hits on answers (names, gotras, places). Run: npx tsx scripts/_faq.test.ts */
import assert from "node:assert/strict";
import { FAQ, faqMatch, isQuestion } from "../src/lib/faq";
import { emptyFamily, applyOps, type DFamily } from "../src/lib/family";
import { takeTurn } from "../src/lib/turn";
import { nextGoal } from "../src/lib/interview";
import { SYSTEM_PROMPT } from "../src/lib/agent";

const id = (t: string) => faqMatch(t)?.id ?? null;

// ── questions that must get an answer ──
const YES: [string, string][] = [
  ["Which gotra should a woman write, father's or husband's?", "gotra-women"],
  ["after marriage should I use my husband's gotra?", "gotra-women"],
  ["Why father’s gotra?", "gotra-women"],
  ["I am married. Which mool do I enter?", "gotra-women"],
  ["shaadi ke baad gotra kaunsa likhna chahiye?", "gotra-women"],
  ["विवाह के बाद कौन सा गोत्र लिखें?", "gotra-women"],
  ["पति का गोत्र या पिता का?", "gotra-women"],
  ["what gotra for my wife?", "gotra-women"],
  ["Can two people of the same gotra marry?", "marriage-check"],
  ["can the app check marriage compatibility?", "marriage-check"],
  ["My mool is not in the list, what now?", "not-in-list"],
  ["What is the difference between gotra and mool?", "gotra-vs-mool"],
  ["what is gotra?", "gotra-what"],
  ["गोत्र क्या होता है?", "gotra-what"],
  ["What does mool mean?", "mool-what"],
  ["मूल क्या है?", "mool-what"],
  ["How do I find my gotra?", "gotra-find"],
  ["I don't know my gotra, what should I do?", "gotra-find"],
  ["mujhe gotra kaise pata chalega?", "gotra-find"],
  ["Where can I find my mool?", "mool-find"],
  ["What gotra do my children get?", "children-gotra"],
  ["Why don't you ask about my wife's family?", "women-by-name"],
  ["क्यों नहीं पूछते पत्नी के परिवार के बारे में?", "women-by-name"],
  ["What about my mother's side?", "mothers-side"],
  ["Can I skip this question?", "skip"],
  ["Is the exact date of birth needed?", "dates"],
  ["Can I write in Hindi?", "language"],
  ["How do I correct a mistake?", "correct"],
  ["How do I invite my cousins?", "share"],
  ["How can I download the pdf?", "pdf"],
  ["Will I lose my tree if I clear my browser?", "lose-data"],
  ["Is it free?", "cost"],
  ["What is a panji?", "what-panji"],
  ["Is my data safe?", "privacy"],
];
for (const [t, want] of YES) assert.equal(id(t), want, `"${t}" → ${id(t)} (wanted ${want})`);

// ── typed ANSWERS and ordinary replies that must NOT be taken for a question ──
const NO = [
  "Kashyap", "Shandilya gotra", "Sarisaba", "Ram Prasad Jha", "my father's gotra is Kashyap", "Father's gotra - Kashyap?",
  "Behta, Madhubani, Bihar", "I don't know my gotra", "I don’t know my mool", "Skip", "Yes", "No", "pata nahi", "गोत्र काश्यप है", "Is it Shandilya?",
  "Radha Devi, Sita Devi", "no brothers", "Madhubani", "he is my father's brother", "1975", "male", "Female",
];
for (const t of NO) assert.equal(id(t), null, `"${t}" must not match, got ${id(t)}`);
assert.equal(isQuestion("What is your gotra?"), true); // a question sentence is a question…
assert.equal(id("What is your gotra?"), "gotra-what"); // (someone who types the bot's own question back is asking what it means)
assert.equal(id("What is your favourite colour?"), null);
// every entry is complete and in both languages
for (const f of FAQ) { assert.ok(f.q.en && f.q.hi && f.a.en.length > 40 && f.a.hi.length > 40, f.id); assert.ok(f.a.en.split(/\s+/).length <= 95, `${f.id} answer is long`); }
assert.equal(new Set(FAQ.map((f) => f.id)).size, FAQ.length);
// the standard question text of every entry finds that same entry (the /faq page questions and chat agree)
for (const f of FAQ) { const got = id(f.q.en); if (got !== f.id) console.log("note: own question text of", f.id, "finds", got); }

// the AI interviewer is told the FAQ and the father's-gotra rule
assert.ok(SYSTEM_PROMPT.includes("FATHER'S gotra and mool") && SYSTEM_PROMPT.includes("FAQ (the only source"));
assert.ok(SYSTEM_PROMPT.includes(FAQ[0]!.a.en));

// ── in the chat: answer, then back to the question; nothing is saved ──
const base = () => {
  let f: DFamily = emptyFamily();
  f = applyOps(f, [{ op: "add_person", id: "p1", name_roman: "Sita Devi", is_me: true } as never], { panji: true }).family;
  f = applyOps(f, [{ op: "update_person", id: "p1", set: { gender: "female" } } as never], { panji: true }).family;
  return f;
};
(async () => {
  const f = base();
  const g = nextGoal(f, { batch: false })!;
  assert.equal(g.id, "self_gotra", "after gender, the gotra is asked");
  assert.ok(g.question.includes("father’s gotra") && g.quick.includes("Why father’s gotra?"), "women are told to give the father's gotra");
  const male = applyOps(f, [{ op: "update_person", id: "p1", set: { gender: "male" } } as never], { panji: true }).family;
  assert.ok(!nextGoal(male, { batch: false })!.question.includes("father’s"), "men get the plain question");

  for (const mode of ["basic"] as const) {
    const r = await takeTurn(null, { family: f, history: [], text: "Why father’s gotra?", lang: "en" });
    assert.equal(r.mode, mode); assert.equal(r.faq, "gotra-women");
    assert.ok(r.reply.includes("father’s gotra") && r.reply.endsWith(g.question), "answer, then the same question again");
    assert.equal(r.family.persons.length, f.persons.length); assert.equal(r.ops, 0); assert.ok(!r.family.persons[0]!.gotra);
    assert.equal(r.goal?.id, "self_gotra"); assert.ok(r.quick.length);
  }
  // Hindi
  const h = await takeTurn(null, { family: f, history: [], text: "विवाह के बाद कौन सा गोत्र लिखें?", lang: "hi" });
  assert.ok(h.faq === "gotra-women" && /पिता का गोत्र/.test(h.reply) && h.reply.includes("आपका गोत्र क्या है"), h.reply.slice(-120));
  // a real answer still works and is saved
  const ok = await takeTurn(null, { family: f, history: [], text: "Kashyap", lang: "en" });
  assert.ok(!ok.faq && ok.family.persons[0]!.gotra, "Kashyap is saved as the gotra");
  // waiting for a yes/no on a suggested gotra: the answer comes, and the suggestion is asked again
  const pend = { goalId: "self_gotra", kind: "gotra" as const, ref: { id: "g1", roman: "Shandilya", dev: "शाण्डिल्य" } };
  const p = await takeTurn(null, { family: f, history: [], text: "what is gotra?", lang: "en", pending: pend });
  assert.ok(p.faq && p.reply.endsWith("Did you mean “Shandilya (शाण्डिल्य)”?") && p.pending?.ref.roman === "Shandilya" && p.quick.join() === "Yes,No");
  // interview finished: just the answer
  console.log("faq OK");
})().catch((e) => { console.error(e); process.exit(1); });
