/** A command in the chat is done first; then "shall we go back?" (npx tsx scripts/_command.test.ts) */
import assert from "node:assert/strict";
import { applyOps, emptyFamily } from "../src/lib/family";
import { nextGoal } from "../src/lib/interview";
import { takeTurn } from "../src/lib/turn";
import { gapsOf, looksLikeCommand } from "../src/lib/command-turn";

(async () => {
  const { family } = applyOps(emptyFamily(), [
    { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", gotra: { roman: "Shandliya", custom: true }, mool: { roman: "Sarisab", custom: true } },
    { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", relation: { type: "father_of", to: "me" } },
  ]);
  const goal = nextGoal(family, { batch: false });
  assert.ok(goal, "the interview is still on a question");

  // detection: commands yes, answers no
  for (const t of ["change gotra Shandliya to Shandilya", "please fix the village of my father", "mass update the gotra", "gotra is wrong everywhere", "remove my uncle"]) assert.ok(looksLikeCommand(t), t);
  for (const t of ["Ramesh Jha", "yes", "Madhubani, Bihar", "Sarisaba", "1958", "no brothers"]) assert.ok(!looksLikeCommand(t), t);

  // 1. no AI: the spelling is fixed everywhere by rules, then the person is asked whether to go back
  let out = await takeTurn(null, { family, history: [], text: "change gotra Shandliya to Shandilya", repeats: 0 });
  assert.ok(out.family.persons.every((p) => p.gotra?.roman !== "Shandliya"), "typo gone");
  assert.equal(out.family.persons.length, 2);
  assert.equal(out.detour, "ask");
  assert.match(out.reply, /Shall we go back/);
  assert.deepEqual(out.quick, ["Yes, continue", "No, not now"]);
  assert.ok(!out.reply.includes(goal!.question), "the interview question is NOT repeated until the person says yes");

  // 2. yes → the question comes back
  const yes = await takeTurn(null, { family: out.family, history: [], text: "Yes, continue", repeats: 0, detour: "ask" });
  assert.equal(yes.reply, nextGoal(out.family, { batch: false })!.question); assert.equal(yes.detour, undefined);

  // 3. no → "anything else?" with what is missing, and the chat is paused
  const no = await takeTurn(null, { family: out.family, history: [], text: "No, not now", repeats: 0, detour: "ask" });
  assert.equal(no.detour, "paused"); assert.match(no.reply, /something else/); assert.match(no.reply, /•/);
  assert.ok(!no.reply.includes(goal!.question));
  assert.ok(no.quick.includes("Continue the questions"));

  // 4. paused: another command is done and the chat stays paused (no second "shall we go back?")
  const again = await takeTurn(null, { family: no.family, history: [], text: "change mool Sarisab to Sarisaba", repeats: 0, detour: "paused" });
  assert.equal(again.detour, "paused"); assert.ok(!/Shall we go back/.test(again.reply)); assert.ok(again.family.persons.every((p) => p.mool?.roman !== "Sarisab"));
  // …and "continue" goes back to the question
  const cont = await takeTurn(null, { family: again.family, history: [], text: "Continue the questions", repeats: 0, detour: "paused" });
  assert.equal(cont.reply, nextGoal(again.family, { batch: false })!.question);

  // 5. a normal answer in the middle is still an answer (no command handling)
  const ans = await takeTurn(null, { family, history: [], text: "Shivnath Jha", repeats: 0, prevGoalId: goal!.id });
  assert.equal(ans.detour, undefined); assert.ok(ans.ops >= 0);

  // 6. an unknown spelling is said plainly, nothing changes
  out = await takeTurn(null, { family, history: [], text: "change gotra Nothingsuch to Kashyap", repeats: 0 });
  assert.match(out.reply, /No one has the gotra/); assert.equal(out.family.persons[0]!.gotra!.roman, "Shandliya");

  // 7. with the AI: a command that is not a spelling goes to the AI in command mode; its reply is NOT followed by the interview question
  const calls: { system: string; tools: string[] }[] = [];
  const script = [
    { content: [{ type: "tool_use", id: "a", name: "update_family", input: { ops: [{ op: "update_person", id: "p2", set: { name_roman: "Shivanath Jha" } }] } }], usage: { input_tokens: 5, output_tokens: 5 } },
    { content: [{ type: "tool_use", id: "b", name: "say", input: { message: "Done — I changed his name to Shivanath Jha." } }], usage: { input_tokens: 5, output_tokens: 5 } },
  ];
  let i = 0;
  const client = { messages: { create: async (p: { system: { text: string }[]; tools: { name: string }[] }) => { calls.push({ system: p.system.map((x) => x.text).join("\n"), tools: p.tools.map((t) => t.name) }); return script[Math.min(i++, 1)]; } } } as never;
  const used = { calls: 0 };
  out = await takeTurn({ client, model: "big", used }, { family, history: [], text: "change my father's name to Shivanath Jha", repeats: 0, prevGoalId: goal!.id });
  assert.match(calls[0]!.system, /GIVEN YOU A COMMAND/); assert.ok(calls[0]!.tools.includes("bulk_change"));
  assert.equal(out.family.persons.find((p) => p.id === "p2")!.name_roman, "Shivanath Jha");
  assert.equal(out.detour, "ask"); assert.match(out.reply, /Done — I changed/); assert.match(out.reply, /Shall we go back/);
  assert.ok(!out.reply.includes(goal!.question));
  assert.equal(used.calls, 2);

  // 8. with the AI, a plain spelling fix still needs no AI call at all
  const u8 = { calls: 0 };
  out = await takeTurn({ client, model: "big", used: u8 }, { family, history: [], text: "replace gotra Shandliya with Shandilya", repeats: 0 });
  assert.equal(u8.calls, 0); assert.ok(out.family.persons.every((p) => p.gotra?.roman !== "Shandliya"));

  // 9. Hindi
  out = await takeTurn(null, { family, history: [], text: "change gotra Shandliya to Shandilya", repeats: 0, lang: "hi" });
  assert.match(out.reply, /आगे बढ़ें/); assert.ok(/[ऀ-ॿ]/.test(out.reply));
  assert.ok(gapsOf(family, "hi").every((g) => /[ऀ-ॿ]/.test(g)));
  console.log("command OK");
})().catch((e) => { console.error(e); process.exit(1); });
