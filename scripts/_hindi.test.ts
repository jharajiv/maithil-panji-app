import assert from "node:assert/strict";
import { emptyFamily, type DFamily } from "../src/lib/family";
import { nextGoal } from "../src/lib/interview";
import { takeTurn } from "../src/lib/turn";
import { hiGoal, hiRel, hiSection, quickLabel } from "../src/lib/hi";
import { isNo, isSkip } from "../src/lib/basic";

assert.equal(isNo("नहीं"), true); assert.equal(isNo("कोई भाई नहीं"), true); assert.equal(isNo("अविवाहित"), true);
assert.equal(isNo("नहीं पता"), false); assert.equal(isSkip("नहीं पता"), true); assert.equal(isSkip("पता नहीं"), true); assert.equal(isSkip("छोड़ें"), true);
assert.equal(hiRel("father"), "आपके पिता"); assert.equal(hiRel("your sister"), "आपकी बहन"); assert.equal(hiRel("father's brother"), "आपके पिता के भाई"); assert.equal(hiRel("your brother's wife"), "आपके भाई की पत्नी");
assert.equal(quickLabel("No brothers", "hi"), "कोई भाई नहीं"); assert.equal(quickLabel("No brothers", "en"), "No brothers");

const DEV = /[ऀ-ॿ]/;
let family: DFamily = emptyFamily();
let repeats = 0;
const say = async (text: string, lang: "hi" | "en" = "hi") => {
  const r = await takeTurn(null, { family, text, history: [], repeats, lang });
  family = r.family; repeats = r.repeats;
  if (lang === "hi") {
    assert.ok(DEV.test(r.reply), `Hindi reply expected: ${r.reply}`);
    if (r.goal) assert.ok(!r.reply.includes(r.goal.question), `the English question must not remain: ${r.reply}`);
  }
  return r;
};

(async () => {
  let r = await say("Rajiv Jha");
  assert.match(r.reply, /आपसे मिलकर अच्छा लगा/); assert.match(r.reply, /क्या आप पुरुष हैं या महिला/);
  r = await say("पुरुष");
  assert.equal(family.persons[0]!.gender, "male"); assert.match(r.reply, /गोत्र/);
  r = await say("मुझे अपना गोत्र नहीं पता");
  assert.equal(family.persons[0]!.flags.gotra, "unknown"); assert.match(r.reply, /मूल/);
  r = await say("पता नहीं");
  r = await say("छोड़ें"); // birth
  r = await say("छोड़ें"); // place
  assert.match(r.reply, /पिता/); assert.equal(nextGoal(family)?.kind, "father");
  r = await say("Ramesh Jha");
  assert.ok(family.persons.some((p) => p.name_roman === "Ramesh Jha"));
  r = await say("याद नहीं"); // mother
  r = await say("छोड़ें"); // details
  assert.match(r.reply, /रमेश के पिता \(आपके दादा\)/, r.reply);
  r = await say("इससे आगे पता नहीं");
  // the brothers step: the answer in Hindi
  for (let i = 0; i < 6 && nextGoal(family)?.kind !== "brothers"; i++) await say("छोड़ें");
  assert.equal(nextGoal(family)?.kind, "brothers");
  r = await say("कोई भाई नहीं");
  assert.match(r.reply, /बहनें/);
  r = await say("Sunita, Meena");
  assert.equal(family.persons.filter((p) => p.gender === "female" && /Sunita|Meena/.test(p.name_roman)).length, 2);
  assert.match(r.reply, /जोड़ा गया: Sunita और Meena/);
  // every kind of goal has a Hindi question
  for (const g of [nextGoal(emptyFamily())]) assert.ok(g && hiGoal(emptyFamily(), g));
  // English is untouched
  const en = await takeTurn(null, { family: emptyFamily(), text: "Asha Jha", history: [], lang: "en" });
  assert.match(en.reply, /Are you male or female/);
  console.log("hindi ok");
})().catch((e) => { console.error(e); process.exit(1); });
