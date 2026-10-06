/* Nidi's scenario: uncles and aunts must never be mixed up, and a correction must never silently rebuild the tree. */
import assert from "node:assert/strict";
import { applyOps, changeRelation, childrenOf, emptyFamily, fatherOf, me, siblingsOf, spousesOf, type DFamily } from "../src/lib/family";
import { goalById, nextGoal } from "../src/lib/interview";
import { takeTurn } from "../src/lib/turn";
import type { ListInput } from "../src/lib/list-turn";

const byName = (f: DFamily, n: string) => f.persons.find((p) => p.name_roman === n)!;

async function say(f: DFamily, text: string, extra: Partial<ListInput> = {}, deps: any = null) {
  const out = await takeTurn(deps, { family: f, history: [], text, repeats: 0, ...extra });
  return out;
}
/** answer questions one by one, using the first script entry whose regex matches the question */
async function interview(script: [RegExp, string][], deps: any = null, max = 80) {
  let f = emptyFamily(); const asked: string[] = []; const sections: string[] = []; let repeats = 0;
  for (let i = 0; i < max; i++) {
    const g = nextGoal(f, { batch: false });
    if (!g) break;
    asked.push(g.question); sections.push(g.section);
    const hit = script.find(([rx]) => rx.test(g.question));
    const out = await say(f, hit ? hit[1] : "skip", { repeats }, deps);
    f = out.family; repeats = out.repeats;
  }
  return { f, asked, sections };
}

const base: [RegExp, string][] = [
  [/full name/, "Nidi Jha"], [/male or female/, "female"], [/gotra/, "skip"], [/mool/, "skip"], [/date of birth/, "skip"], [/where do you live/, "skip"],
  [/father’s name/, "Subodh Jha"], [/mother’s name/, "Yogmaya"], [/Subodh.*living/, "skip"],
  [/Subodh.s father/, "Harinath Jha"], [/Subodh.s mother/, "skip"], [/Harinath.*living/, "skip"], [/Harinath.s father/, "I don’t know any further"],
];

(async () => {
  /* 1. the exact failure: uncles and aunts entered for the father */
  const script: [RegExp, string][] = [
    ...base,
    [/Did Subodh.*have brothers/, "Ramesh, Suresh"],
    [/Did Subodh.*have sisters/, "Sushma, Kamla"],
    [/Is Ramesh.*married/, "Pooja"], [/Is Suresh.*married/, "Neha"],
    [/whom Sushma/, "Rajesh Jha, Darbhanga"], [/whom Kamla/, "skip"],
    [/Does Ramesh.*have sons/, "Aarav"], [/Does Ramesh.*have daughters/, "Anika"],
    [/Does Suresh.*have sons/, "none"], [/Does Suresh.*have daughters/, "Riya"],
  ];
  const r = await interview(script);
  const f = r.f;
  const sub = byName(f, "Subodh Jha");
  const uncles = siblingsOf(f, sub.id).filter((p) => p.gender === "male").map((p) => p.name_roman).sort();
  const aunts = siblingsOf(f, sub.id).filter((p) => p.gender === "female").map((p) => p.name_roman).sort();
  assert.deepEqual(uncles, ["Ramesh", "Suresh"]); assert.deepEqual(aunts, ["Kamla", "Sushma"]);
  for (const a of aunts) assert.equal(spousesOf(f, byName(f, a).id).length, 0, `${a} must not become anyone's wife`);
  assert.equal(spousesOf(f, byName(f, "Ramesh").id)[0]!.name_roman, "Pooja");
  assert.equal(byName(f, "Sushma").married_to, "Rajesh Jha, Darbhanga");
  assert.equal(byName(f, "Kamla").married_to, undefined);
  assert.deepEqual(childrenOf(f, byName(f, "Ramesh").id).map((c) => c.name_roman).sort(), ["Aarav", "Anika"]);
  assert.equal(byName(f, "Aarav").gender, "male"); assert.equal(byName(f, "Anika").gender, "female");
  assert.equal(fatherOf(f, byName(f, "Sushma").id)?.name_roman, "Harinath Jha");
  assert.ok(!f.persons.some((p) => p.name_roman === "Rajesh Jha"), "a sister's husband is only a note, never a node");
  // order of the steps
  const idx = (rx: RegExp) => r.asked.findIndex((x) => rx.test(x));
  assert.ok(idx(/Subodh.*have brothers/) < idx(/Subodh.*have sisters/) && idx(/Subodh.*have sisters/) < idx(/Is Ramesh/) && idx(/Is Suresh/) < idx(/whom Sushma/) && idx(/whom Kamla/) < idx(/Ramesh.*have sons/), "fixed order");
  assert.ok(r.sections.some((s) => /^Step 3 of 5 · Your father’s brothers’ wives$/.test(s)), "step label: " + [...new Set(r.sections)].join(" | "));
  console.log([...new Set(r.sections)].join("\n"));

  /* 2. a name that sounds like the wrong step is not added to this one */
  let g = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Me", gender: "male" }]).family;
  g = applyOps(g, [{ op: "set_flag", id: "p1", flag: "father", value: "unknown" }, { op: "set_flag", id: "p1", flag: "mother", value: "unknown" }, { op: "set_flag", id: "p1", flag: "gotra", value: "unknown" }, { op: "set_flag", id: "p1", flag: "mool", value: "unknown" }, { op: "set_flag", id: "p1", flag: "birth", value: "skipped" }, { op: "set_flag", id: "p1", flag: "place", value: "skipped" }]).family;
  assert.equal(nextGoal(g)!.id, "brothers:p1");
  let out = await say(g, "my sister Sunita");
  assert.equal(siblingsOf(out.family, "p1").length, 0, "a sister is not added at the brothers question");
  assert.ok(/sister/i.test(out.reply));
  out = await say(g, "Vikram, Anil (brother)");
  assert.deepEqual(siblingsOf(out.family, "p1").map((p) => p.gender), ["male", "male"]);

  /* 3. the AI path: it only reads names; roles come from the question; its hints are checked */
  const calls: any[] = [];
  const fake = (answer: any) => ({ messages: { create: async (p: any) => { calls.push(p); return { content: [{ type: "tool_use", id: "t", name: "record_answer", input: answer }], stop_reason: "tool_use" }; } } });
  const deps = (a: any) => ({ client: fake(a) as any, model: "x" });
  out = await say(g, "mere do bhai hain Ramesh aur Suresh", {}, deps({ answer: "names", people: [{ name_roman: "Ramesh", name_dev: "रमेश", looks_like: "male" }, { name_roman: "Suresh" }] }));
  assert.deepEqual(siblingsOf(out.family, "p1").map((p) => `${p.name_roman}:${p.gender}`), ["Ramesh:male", "Suresh:male"]);
  assert.equal(byName(out.family, "Ramesh").name_dev, "रमेश");
  assert.equal(out.mode, "ai");
  assert.ok(calls[0].tool_choice.name === "record_answer" && /QUESTION THAT WAS ASKED/.test(JSON.stringify(calls[0].system)));
  // the model tags someone as a woman at the brothers question → held back
  out = await say(g, "Ramesh and my bua Sushma", {}, deps({ answer: "names", people: [{ name_roman: "Ramesh", looks_like: "male" }, { name_roman: "Sushma", looks_like: "female" }] }));
  assert.deepEqual(siblingsOf(out.family, "p1").map((p) => p.name_roman), ["Ramesh"]);
  // a complaint is not an answer and changes nothing
  out = await say(g, "no no, you got it wrong!", {}, deps({ answer: "not_an_answer" }));
  assert.equal(out.family.persons.length, g.persons.length); assert.ok(/Reply|tree/.test(out.reply));
  // AI failure → plain reader, still correct
  out = await say(g, "Vikram", {}, { client: { messages: { create: async () => { throw new Error("boom"); } } } as any, model: "x" });
  assert.equal(siblingsOf(out.family, "p1")[0]!.name_roman, "Vikram");

  /* 4. replying to an earlier question: add vs replace, never a silent rebuild */
  let h = (await say(g, "Vikram, Anil")).family;
  const asked = goalById(h, "brothers:p1")!;
  assert.equal(asked.kind, "brothers");
  const before = h.persons.length;
  let o2 = await say(h, "Mohan", { answerGoal: "brothers:p1", mode: "add" });
  assert.equal(siblingsOf(o2.family, "p1").length, 3); assert.equal(o2.family.persons.length, before + 1);
  assert.ok(/Back to where we were/.test(o2.reply));
  o2 = await say(h, "Mohan", { answerGoal: "brothers:p1", mode: "replace" });
  assert.deepEqual(siblingsOf(o2.family, "p1").map((p) => p.name_roman), ["Mohan"]);
  // an unclear message while replying changes nothing
  o2 = await say(h, "hmm what?", { answerGoal: "brothers:p1", mode: "replace" });
  assert.equal(o2.family.persons.length, h.persons.length);
  // replying to a tree box: "add sons to Vikram"
  const vik = byName(h, "Vikram").id;
  o2 = await say(h, "Kabir", { answerGoal: `sons:${vik}`, mode: "add" });
  assert.equal(childrenOf(o2.family, vik)[0]!.name_roman, "Kabir"); assert.equal(childrenOf(o2.family, vik)[0]!.gender, "male");

  /* 5. skip the rest of a step */
  let s = (await say(g, "Vikram, Anil, Mohan")).family;
  s = (await say(s, "No sisters")).family;
  assert.equal(nextGoal(s)!.kind, "wife");
  o2 = await say(s, "Skip the rest of this step");
  assert.notEqual(nextGoal(o2.family)!.kind, "wife");
  assert.equal(spousesOf(o2.family, byName(o2.family, "Anil").id).length, 0);

  /* 6. changing a wrong relationship (Nidi's already-wrong tree) */
  let w = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Me", gender: "male" }]).family;
  w = applyOps(w, [{ op: "add_person", name_roman: "Dad", relation: { type: "father_of", to: "p1" } }, { op: "add_person", name_roman: "Uncle", gender: "male", relation: { type: "sibling_of", to: "p2" } }]).family;
  const uncle = byName(w, "Uncle").id;
  w = applyOps(w, [{ op: "add_person", name_roman: "Aunt", gender: "female", relation: { type: "spouse_of", to: uncle } }, { op: "add_person", name_roman: "Cousin", relation: { type: "child_of", to: uncle } }]).family;
  const aunt = byName(w, "Aunt").id;
  assert.equal(spousesOf(w, uncle).length, 1); assert.equal(childrenOf(w, aunt).length, 1);
  const fix = changeRelation(w, aunt, byName(w, "Dad").id, "sister");
  assert.ok(fix.ok, fix.message);
  assert.equal(spousesOf(fix.family, uncle).length, 0);
  assert.equal(fatherOf(fix.family, aunt)?.name_roman, "Dad".length ? fatherOf(fix.family, byName(w, "Dad").id)?.name_roman ?? fatherOf(fix.family, aunt)?.name_roman : "");
  assert.ok(siblingsOf(fix.family, byName(w, "Dad").id).some((p) => p.id === aunt && p.gender === "female"));
  assert.deepEqual(childrenOf(fix.family, aunt), [], "she is no longer a parent of the cousin");
  assert.equal(childrenOf(fix.family, uncle).length, 1, "the cousin stays with the uncle");
  assert.ok(!changeRelation(w, byName(w, "Dad").id, me(w)!.id, "son").ok, "no cycles");
  assert.ok(!changeRelation(w, me(w)!.id, uncle, "son").ok, "cannot change yourself");
  /* 7. replying to an EARLIER opening question corrects just that answer */
  {
    let c = emptyFamily();
    for (const t of ["Rajiv Jha", "male", "skip", "skip", "skip", "skip", "Subodh Jha", "Yogmaya"]) c = (await say(c, t)).family;
    const dad = byName(c, "Subodh Jha").id;
    let o = await say(c, "Subodh Narayan Jha", { answerGoal: `father:p1`, mode: "replace" });
    assert.equal(fatherOf(o.family, "p1")!.name_roman, "Subodh Narayan Jha"); assert.equal(o.family.persons.length, c.persons.length, "renamed, not duplicated");
    assert.ok(/Updated the father/.test(o.reply) && /Back to where we were/.test(o.reply));
    o = await say(c, "Jayanti", { answerGoal: "mother:p1" });
    assert.equal(o.family.persons.find((p) => p.name_roman === "Jayanti") !== undefined, true); assert.equal(o.family.persons.length, c.persons.length);
    o = await say(c, "Rajiv Kumar Jha", { answerGoal: "self_name" });
    assert.equal(o.family.persons[0]!.name_roman, "Rajiv Kumar Jha");
    o = await say(c, "1985", { answerGoal: "self_birth" });
    assert.equal(o.family.persons[0]!.birth, "1985");
    o = await say(c, "what??", { answerGoal: "father:p1" });
    assert.equal(o.family.persons.length, c.persons.length); assert.equal(fatherOf(o.family, "p1")!.name_roman, "Subodh Jha");
    assert.equal(dad, fatherOf(c, "p1")!.id);
  }
  console.log("steps tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
