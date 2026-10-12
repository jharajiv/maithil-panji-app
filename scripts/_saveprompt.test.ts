import assert from "node:assert/strict";
import { pickSaveCard, saveCardText, stageOf } from "../src/lib/save-prompt";
import { buildUsage } from "../src/lib/admin-queue";
import type { Store } from "../src/lib/store";

const base = { people: 0, complete: false, dismissed: 0, returning: false, welcomed: false };
// stages
assert.equal(stageOf(2, false), 0); assert.equal(stageOf(3, false), 1); assert.equal(stageOf(7, false), 1); assert.equal(stageOf(8, false), 2); assert.equal(stageOf(12, true), 3); assert.equal(stageOf(2, true), 0);
// nothing before 3 people
assert.equal(pickSaveCard({ ...base, people: 2 }), null);
// first reminder at 3, "later" remembers the stage, the next comes at 8, then when complete
assert.deepEqual(pickSaveCard({ ...base, people: 3 }), { kind: "first", stage: 1 });
assert.equal(pickSaveCard({ ...base, people: 5, dismissed: 1 }), null);
assert.deepEqual(pickSaveCard({ ...base, people: 8, dismissed: 1 }), { kind: "more", stage: 2 });
assert.equal(pickSaveCard({ ...base, people: 9, dismissed: 2 }), null);
assert.deepEqual(pickSaveCard({ ...base, people: 9, complete: true, dismissed: 2 }), { kind: "done", stage: 3 });
assert.equal(pickSaveCard({ ...base, people: 9, complete: true, dismissed: 3 }), null);
// returning to an unsaved tree: welcome back once per visit, even after earlier dismissals
assert.deepEqual(pickSaveCard({ ...base, people: 6, dismissed: 1, returning: true }), { kind: "back", stage: 1 });
assert.equal(pickSaveCard({ ...base, people: 6, dismissed: 1, returning: true, welcomed: true }), null);
assert.equal(pickSaveCard({ ...base, people: 2, returning: true }), null);
// texts exist in both languages, never mention a password, signed-in wording differs
for (const lang of ["en", "hi"] as const) for (const k of ["first", "more", "done", "back"] as const) {
  const t = saveCardText(lang, k, 6, false); const u = saveCardText(lang, k, 6, true);
  assert.ok(t.title && t.body && t.cta && t.later); assert.notEqual(t.cta, u.cta);
}
assert.match(saveCardText("en", "first", 3, false).body, /Google or email/);
assert.match(saveCardText("hi", "more", 8, false).title, /8/);
(async () => {
// the admin usage table
const store = { countEvents: async (since: string) => { assert.ok(!Number.isNaN(Date.parse(since))); return { tree_started: 40, save_card_shown: 22, save_card_clicked: 5, tree_saved: 3 }; } } as unknown as Store;
const u = await buildUsage(store);
assert.equal(u.days, 30); assert.equal(u.rows.find((r) => r.name === "tree_started")?.count, 40); assert.equal(u.rows.find((r) => r.name === "pdf_downloaded")?.count, 0);
const broken = await buildUsage({ countEvents: async () => { throw new Error("db down"); } } as unknown as Store);
assert.ok(broken.rows.every((r) => r.count === 0)); assert.equal(broken.failed, true); assert.ok(!u.failed);
  console.log("saveprompt OK");
})();
