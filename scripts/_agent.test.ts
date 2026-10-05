import assert from "node:assert/strict";
import { runTurn, cleanOps, TOOLS } from "../src/lib/agent";
import { applyOps, emptyFamily, type DFamily } from "../src/lib/family";
import { nextGoal } from "../src/lib/interview";

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
      return { content: [{ type: "tool_use", id: `tu_${i}`, name: s.name, input: s.input }], stop_reason: "tool_use" };
    } } } as any,
  };
}

(async () => {
  assert.ok(TOOLS.length === 4);
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
  assert.equal(m.seen[0].tool_choice.disable_parallel_tool_use, true);
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
  console.log("agent tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
