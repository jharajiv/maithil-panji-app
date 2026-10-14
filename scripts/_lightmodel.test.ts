/** The small model reads names; if it fails the main model does; if both fail the plain reader does. Every AI call is counted. */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, siblingsOf } from "../src/lib/family";
import { nextGoal } from "../src/lib/interview";
import { takeTurn } from "../src/lib/turn";

(async () => {
  let g = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Me", gender: "male" }]).family;
  g = applyOps(g, ["father", "mother", "gotra", "mool"].map((flag) => ({ op: "set_flag" as const, id: "p1", flag: flag as "father", value: "unknown" as const })).concat([{ op: "set_flag", id: "p1", flag: "birth" as "father", value: "skipped" as "unknown" }, { op: "set_flag", id: "p1", flag: "place" as "father", value: "skipped" as "unknown" }])).family;
  assert.equal(nextGoal(g)!.id, "brothers:p1");

  const names = { content: [{ type: "tool_use", id: "t", name: "record_answer", input: { answer: "names", people: [{ name_roman: "Vikram" }] } }], stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 } };
  const make = (failOn: string[]) => { const models: string[] = []; return { models, client: { messages: { create: async (p: { model: string }) => { models.push(p.model); if (failOn.includes(p.model)) throw new Error("model not found"); return names; } } } as never }; };

  // 1. the small model answers: the main model is never called
  let m = make([]); const used = { calls: 0 };
  let out = await takeTurn({ client: m.client, model: "big", lightModel: "small", used }, { family: g, history: [], text: "Vikram", repeats: 0 });
  assert.deepEqual(m.models, ["small"]); assert.equal(used.calls, 1); assert.equal(siblingsOf(out.family, "p1")[0]!.name_roman, "Vikram");

  // 2. the small model fails: the main model is tried, the answer is the same
  m = make(["small"]); const u2 = { calls: 0 };
  out = await takeTurn({ client: m.client, model: "big", lightModel: "small", used: u2 }, { family: g, history: [], text: "Vikram", repeats: 0 });
  assert.deepEqual(m.models, ["small", "big"]); assert.equal(siblingsOf(out.family, "p1")[0]!.name_roman, "Vikram"); assert.equal(u2.calls, 1, "only the call that answered is counted");

  // 3. both fail: the plain reader still gets it right, and nothing is counted
  m = make(["small", "big"]); const u3 = { calls: 0 };
  out = await takeTurn({ client: m.client, model: "big", lightModel: "small", used: u3 }, { family: g, history: [], text: "Vikram", repeats: 0 });
  assert.equal(siblingsOf(out.family, "p1")[0]!.name_roman, "Vikram"); assert.equal(u3.calls, 0);

  // 4. no small model set (or the same as the main one): one call, no retry loop
  m = make(["big"]);
  out = await takeTurn({ client: m.client, model: "big" }, { family: g, history: [], text: "Vikram", repeats: 0 });
  assert.deepEqual(m.models, ["big"]); assert.equal(siblingsOf(out.family, "p1")[0]!.name_roman, "Vikram");

  // 5. an answer the fixed rules handle (no AI needed) makes no call at all
  m = make([]); const u5 = { calls: 0 };
  await takeTurn({ client: m.client, model: "big", lightModel: "small", used: u5 }, { family: g, history: [], text: "what is a mool?", repeats: 0 });
  assert.equal(u5.calls, 0, "FAQ answers cost nothing");
  console.log("light model OK");
})().catch((e) => { console.error(e); process.exit(1); });
