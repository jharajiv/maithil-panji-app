/** Chat signals: anonymous counts of what happened in a turn, and the admin "How the chat is doing" numbers built from them */
import assert from "node:assert/strict";
import { turnSignals, GOAL_ORDER } from "../src/lib/turn-signals";
import { buildQuality } from "../src/lib/admin-queue";
import { EVENT_NAMES, SERVER_EVENTS, isEvent } from "../src/lib/events";

const g = (id: string) => ({ id, kind: id.split(":")[0], text: "", chips: [] }) as never;
const out = (o: Record<string, unknown> = {}) => ({ reply: "Next question?", ...o }) as Parameters<typeof turnSignals>[1];

// reaching a question is counted by KIND (the person number is dropped)
assert.deepEqual(turnSignals({ text: "Ram" }, out({ goal: g("father:p3") })), ["goal:father"]);
assert.deepEqual(turnSignals({ text: "Ram" }, out()), [], "no question → nothing");
// an unknown question kind is never counted (no free text can reach the database)
assert.deepEqual(turnSignals({ text: "x" }, out({ goal: g("weird_thing:p1") })), []);
// skipping the question that was asked
assert.ok(turnSignals({ text: "skip", prevGoalId: "self_mool" }, out({ goal: g("self_birth") })).includes("skip:self_mool"));
assert.ok(turnSignals({ text: "I don't know", prevGoalId: "mother:p2" }, out({ goal: g("father:p1") })).includes("skip:mother"));
assert.ok(!turnSignals({ text: "Mohan", prevGoalId: "mother:p2" }, out({ goal: g("father:p1") })).some((e) => e.startsWith("skip:")), "a real answer is not a skip");
assert.ok(!turnSignals({ text: "skip", prevGoalId: "self_mool", detour: "ask" }, out()).some((e) => e.startsWith("skip:")), "an answer to the 'go back?' question is not a skip");
assert.ok(!turnSignals({ text: "skip", prevGoalId: "self_mool", answerGoal: "father" }, out()).some((e) => e.startsWith("skip:")), "a reply to an old message is not a skip");
// fallback, off-topic, loop skip
assert.ok(turnSignals({ text: "?!" }, out({ reply: "Sorry, I did not catch that." })).includes("chat_fallback"));
assert.ok(turnSignals({ text: "?!" }, out({ reply: "माफ़ कीजिए, मैं समझ नहीं पाया।" })).includes("chat_fallback"));
assert.ok(turnSignals({ text: "weather" }, out({ offTopic: true })).includes("chat_offtopic"));
assert.ok(turnSignals({ text: "x" }, out({ loopSkipped: true })).includes("chat_loop_skip"));
// the command step
assert.ok(turnSignals({ text: "change gotra A to B" }, out({ detour: "ask" })).includes("cmd_run"));
assert.ok(turnSignals({ text: "Yes, continue", detour: "ask" }, out()).includes("cmd_resume_yes"));
assert.ok(turnSignals({ text: "हाँ", detour: "ask" }, out()).includes("cmd_resume_yes"));
assert.ok(turnSignals({ text: "No, not now", detour: "ask" }, out({ detour: "paused" })).includes("cmd_resume_no"));
assert.ok(!turnSignals({ text: "Ram", detour: "paused" }, out()).some((e) => e.startsWith("cmd_")));

// every event the signals can emit is a server event the store accepts, and the browser cannot post any of them
const kinds = new Set(GOAL_ORDER.map((q) => q.kind));
assert.equal(kinds.size, GOAL_ORDER.length, "no question twice");
for (const e of ["chat_fallback", "chat_offtopic", "chat_loop_skip", "cmd_run", "cmd_resume_yes", "cmd_resume_no", "ai_timeout", "ai_error", "fb_up", "fb_down", "fb_shared"]) {
  assert.ok((SERVER_EVENTS as readonly string[]).includes(e), `${e} is a server event`);
  assert.ok(!isEvent(e), `${e} cannot be posted from a browser`);
}
for (const e of ["pace3_10m", "pace3_1h", "pace3_1d", "pace3_later", "pace8_1h", "pace8_1d", "pace8_1w", "pace8_later"]) assert.ok(isEvent(e) && (EVENT_NAMES as readonly string[]).includes(e), `${e} can be posted by the app`);
assert.ok(!isEvent("goal:father") && !isEvent("fb_up"));

// the admin numbers
assert.equal(buildQuality({}), undefined, "nothing counted → no block, the page says so");
const q = buildQuality({ tree_started: 10, "goal:father": 6, "goal:mother": 3, "skip:mother": 1, chat_fallback: 2, chat_offtopic: 1, chat_loop_skip: 1, ai_timeout: 2, ai_error: 1, cmd_run: 4, cmd_resume_yes: 3, cmd_resume_no: 1, fb_up: 5, fb_down: 2, fb_shared: 1, pace3_1h: 4, pace8_1d: 2 })!;
assert.equal(q.turns, 9, "answers counted by chat turns (the name question is asked by the greeting)"); assert.equal(q.questions[0]!.reached, 10); assert.equal(q.fallback, 2); assert.equal(q.timeouts, 2); assert.equal(q.errors, 1);
assert.equal(q.cmdRun, 4); assert.equal(q.cmdYes, 3); assert.equal(q.cmdNo, 1);
assert.equal(q.up, 5); assert.equal(q.down, 2); assert.equal(q.shared, 1);
assert.equal(q.questions.length, GOAL_ORDER.length);
assert.deepEqual(q.questions.find((x) => x.kind === "mother"), { kind: "mother", label: "Mother", reached: 3, skipped: 1 });
assert.equal(q.pace.three.find((x) => x.label === "within an hour")!.count, 4);
assert.equal(q.pace.eight.find((x) => x.label === "within a day")!.count, 2);
console.log("signals ok");
