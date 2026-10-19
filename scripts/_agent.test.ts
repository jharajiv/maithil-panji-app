import assert from "node:assert/strict";
import { runTurn, cleanOps, TOOLS } from "../src/lib/agent";
import { applyOps, emptyFamily, type DFamily } from "../src/lib/family";
import { nextGoal } from "../src/lib/interview";
import { FAQ } from "../src/lib/faq";

type Step = { name: string; input: any };
const results = (p: any): string[] => p.messages.flatMap((m: any) => Array.isArray(m.content) ? m.content.filter((b: any) => b.type === 'tool_result').map((b: any) => String(b.content)) : []);
// fake model: replays a list of tool calls, one per API round
function fake(script: Step[]) {
  let i = 0; const seen: any[] = [];
  return {
    seen,
    client: { messages: { create: async (p: any) => {
      seen.push(p);
      const s = script[i++]; if (!s) throw new Error("script exhausted");
      const many: Step[] = (s as any).many ?? [s];
      return { content: many.map((x, k) => ({ type: "tool_use", id: `tu_${i}_${k}`, name: x.name, input: x.input })), stop_reason: "tool_use" };
    } } } as any,
  };
}

(async () => {
  assert.ok(TOOLS.length === 5 && TOOLS.some((t) => t.name === "get_faq"));
  // 1. first turn: user gives their name → add me → say next question
  let f: DFamily = emptyFamily();
  let m = fake([
    { name: "update_family", input: { ops: [{ op: "add_person", name_roman: "Rohan Jha", name_dev: "रोहन झा" }] } },
    { name: "say", input: { message: "Nice to meet you, Rohan. Are you male or female?", quick_replies: ["Male", "Female"] } },
  ]);
  let out = await runTurn({ client: m.client, model: "x" }, { family: f, history: [], text: "Rohan Jha" });
  assert.equal(out.family.persons.length, 1); assert.equal(out.family.persons[0]!.is_me, true);
  assert.equal(out.goal?.kind, "self_gender"); assert.deepEqual(out.quick, ["Male", "Female"]);
  // the 2nd request must contain the tool result with the next question
  const second = results(m.seen[1]).join("\n");
  assert.ok(second.includes("NEXT QUESTION") && second.includes("male or female"), "next question fed back");
  assert.equal(m.seen[0].tool_choice.disable_parallel_tool_use, undefined, "one reply may now carry update_family and say together");
  f = out.family;

  // 2. hallucinated mool id must be rejected → custom
  m = fake([
    { name: "update_family", input: { ops: [{ op: "update_person", id: "p1", set: { gender: "male", mool: { id: "m_madeup", roman: "Madeup" } } }] } },
    { name: "say", input: { message: "ok" } },
  ]);
  out = await runTurn({ client: m.client, model: "x" }, { family: f, history: [], text: "male" });
  assert.equal(out.family.persons[0]!.mool?.custom, true); assert.equal(out.family.persons[0]!.mool?.id, undefined);
  // 3. real mool id is canonicalised from the seed
  m = fake([
    { name: "lookup_mool", input: { query: "sarisab" } },
    { name: "update_family", input: { ops: [{ op: "update_person", id: "p1", set: { gotra: { id: "g01", roman: "x" }, mool: { id: "m_sarisaba", roman: "whatever" } } }] } },
    { name: "say", input: { message: "Got it." } },
  ]);
  out = await runTurn({ client: m.client, model: "x" }, { family: out.family, history: [], text: "Shandilya, Sarisab" });
  assert.equal(out.family.persons[0]!.mool?.dev, "सरिसब"); assert.equal(out.family.persons[0]!.gotra?.dev, "शाण्डिल्य");
  const lookup = JSON.parse(results(m.seen[1])[0]!);
  assert.equal(lookup.status, "exact"); assert.equal(lookup.candidates[0].id, "m_sarisaba");
  f = out.family;

  // 4. off-topic: model calls say directly with off_topic → no ops, flag returned
  m = fake([{ name: "say", input: { message: "I can only help with your family tree. Where were we — what is your mool?", off_topic: true } }]);
  out = await runTurn({ client: m.client, model: "x" }, { family: f, history: [], text: "write me a python script", prevGoalId: nextGoal(f)!.id });
  assert.equal(out.offTopic, true); assert.equal(out.ops, 0); assert.equal(out.repeats, 1);

  // 5. loop guard: same goal 3 times → auto-skip and next question forced
  const g0 = nextGoal(f)!;
  m = fake([
    { name: "say", input: { message: "Which is your ancestral village?" } },
    { name: "say", input: { message: "Which village do you come from, now that we skipped?" } },
  ]);
  out = await runTurn({ client: m.client, model: "x" }, { family: f, history: [], text: "hmm", prevGoalId: g0.id, repeats: 2 });
  assert.notEqual(out.goal?.id, g0.id, "goal advanced after auto-skip");
  assert.ok(results(m.seen[1]).join("").includes("skipped automatically"));

  // 6. unknown relation target is reported, not crashed
  const r = applyOps(f, cleanOps([{ op: "add_person", name_roman: "Ghost", relation: { type: "father_of", to: "p999" } }, { op: "evil" }, { op: "set_flag", id: "p1", flag: "nope", value: "done" }]));
  assert.equal(r.results.length, 1); assert.equal(r.results[0]!.ok, false);

  // 7. say with update in a *later* round after lookup, empty message rejected then retried
  m = fake([{ name: "say", input: { message: "  " } }, { name: "say", input: { message: "Hello" } }]);
  out = await runTurn({ client: m.client, model: "x" }, { family: f, history: [], text: "x" });
  assert.equal(out.reply, "Hello");

  /* ───── v12: save the answer AND ask the next question in ONE call ───── */
  const joint = (many: Step[]): Step => ({ name: "", input: {}, many } as any);
  const sys = (p: any) => p.system.map((b: any) => b.text).join("\n");
  let g: DFamily = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Rohan Jha" }]).family; // me, no gender yet
  assert.equal(nextGoal(g)?.id, "self_gender");
  // 8. a plain answer: the dynamic text announces the likely next step, and update_family + say in one reply is accepted — ONE call
  m = fake([joint([
    { name: "update_family", input: { ops: [{ op: "update_person", id: "p1", set: { gender: "male" } }] } },
    { name: "say", input: { message: "Thank you. What is your gotra?", quick_replies: ["Shandilya"] } },
  ])]);
  out = await runTurn({ client: m.client, model: "x" }, { family: g, history: [], text: "Male", prevGoalId: "self_gender" });
  assert.equal(m.seen.length, 1, "one API call for the whole turn");
  assert.ok(sys(m.seen[0]).includes("LIKELY NEXT STEP") && sys(m.seen[0]).includes("gotra"), "next step announced");
  assert.equal(out.goal?.id, "self_gotra"); assert.equal(out.reply, "Thank you. What is your gotra?"); assert.deepEqual(out.quick, ["Shandilya"]);
  // 9. the save leads somewhere else than predicted: the joint reply is thrown away and the model is asked again
  m = fake([
    joint([
      { name: "update_family", input: { ops: [{ op: "update_person", id: "p1", set: { gender: "male", gotra: { id: "g01", roman: "x" } } }] } },
      { name: "say", input: { message: "Thank you. What is your gotra?" } },
    ]),
    { name: "say", input: { message: "Got it. And your mool?" } },
  ]);
  out = await runTurn({ client: m.client, model: "x" }, { family: g, history: [], text: "Male", prevGoalId: "self_gender" });
  assert.equal(m.seen.length, 2); assert.ok(results(m.seen[1]).join("").includes("different question"));
  assert.equal(out.reply, "Got it. And your mool?"); assert.equal(out.goal?.id, "self_mool");
  // 10. a lookup together with a save: only the lookup runs, the save waits for its result
  m = fake([
    joint([{ name: "lookup_gotra", input: { query: "x" } }, { name: "update_family", input: { ops: [{ op: "update_person", id: "p1", set: { gender: "male" } }] } }]),
    { name: "say", input: { message: "ok" } },
  ]);
  out = await runTurn({ client: m.client, model: "x" }, { family: g, history: [], text: "Male", prevGoalId: "self_gender" });
  assert.ok(results(m.seen[1]).join("").includes("Wait for the lookup result"));
  assert.equal(out.family.persons[0]!.gender, undefined, "the save that did not wait was not applied");
  // 11. gotra answer: the lookup is done in advance, so no lookup round is needed
  let gg = applyOps(g, [{ op: "update_person", id: "p1", set: { gender: "male" } }]).family;
  assert.equal(nextGoal(gg)?.id, "self_gotra");
  m = fake([joint([
    { name: "update_family", input: { ops: [{ op: "update_person", id: "p1", set: { gotra: { id: "g01", roman: "Shandilya" } } }] } },
    { name: "say", input: { message: "Noted Shandilya. What is your mool?" } },
  ])]);
  out = await runTurn({ client: m.client, model: "x" }, { family: gg, history: [], text: "Shandilya", prevGoalId: "self_gotra" });
  assert.equal(m.seen.length, 1); assert.ok(sys(m.seen[0]).includes("LOOKUP RESULT") && sys(m.seen[0]).includes('"status":"exact"'));
  assert.equal(out.goal?.id, "self_mool");
  // 12. a joint reply with NO announced next step (an unusual answer) is not trusted
  m = fake([
    joint([{ name: "update_family", input: { ops: [{ op: "update_person", id: "p1", set: { gender: "male" } }] } }, { name: "say", input: { message: "x" } }]),
    { name: "say", input: { message: "Fine. What is your gotra?" } },
  ]);
  out = await runTurn({ client: m.client, model: "x" }, { family: g, history: [], text: "I have a long story to tell about my family and how we came to live in the village near the river long ago before the partition, ".repeat(3), prevGoalId: "self_gender" });
  assert.equal(m.seen.length, 2);
  // 13. the FAQ answers are no longer in every call: only the list of questions is; get_faq returns an answer
  assert.ok(!sys(m.seen[0]).includes(FAQ[0]!.a.en) && sys(m.seen[0]).includes(FAQ[0]!.q.en));
  m = fake([{ name: "get_faq", input: { id: FAQ[0]!.id } }, { name: "say", input: { message: "Short answer" } }]);
  out = await runTurn({ client: m.client, model: "x" }, { family: g, history: [], text: "why father's gotra?" });
  assert.ok(results(m.seen[1]).join("").includes(FAQ[0]!.a.en.slice(0, 30)));
  // 14. history sent again is short
  m = fake([{ name: "say", input: { message: "Hello" } }]);
  const hist = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i }) as any);
  await runTurn({ client: m.client, model: "x" }, { family: g, history: hist, text: "x" });
  assert.ok(m.seen[0].messages.length <= 6, "at most the last four messages plus the new one (and the reply added afterwards)");
  console.log("agent tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
