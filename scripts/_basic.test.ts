import assert from "node:assert/strict";
import { emptyFamily, me, type DFamily, type Pending } from "../src/lib/family";
import { basicTurn } from "../src/lib/basic-turn";
import { registerExtras, searchMools, classify } from "../src/lib/lookup";

function run(answers: string[]) {
  let family: DFamily = emptyFamily(); let pending: Pending | undefined; let prevGoalId: string | undefined; let repeats = 0;
  const log: string[] = [];
  for (const text of answers) {
    const out = basicTurn({ family, history: [], text, prevGoalId, repeats, pending });
    family = out.family; pending = out.pending; prevGoalId = out.goal?.id; repeats = out.repeats; log.push(out.reply);
  }
  return { family, pending, log };
}

// similar spelling → asks, "yes" accepts the dataset spelling
let r = run(["Rohan Jha", "Male", "Shandilya", "sarisabo"]);
console.log(r.log.at(-1));
assert.ok(/Did you mean/i.test(r.log.at(-1)!), "should ask to confirm");
assert.equal(me(r.family)!.mool, undefined);
r = run(["Rohan Jha", "Male", "Shandilya", "sarisabo", "yes"]);
assert.equal(me(r.family)!.mool?.roman, "Sarisaba"); assert.ok(!me(r.family)!.mool?.custom);

// "no" → asks to type exactly → saved as a custom entry, no more asking
r = run(["Rohan Jha", "Male", "Shandilya", "sarisabo", "no", "Sarisabo"]);
assert.equal(me(r.family)!.mool?.roman, "Sarisabo"); assert.equal(me(r.family)!.mool?.custom, true);

// totally different → added as new straight away
r = run(["Rohan Jha", "Male", "Shandilya", "Zzqxplo"]);
assert.equal(me(r.family)!.mool?.custom, true);
assert.ok(/new mool/i.test(r.log.at(-1)!) || /new mool/i.test(r.log.at(-2)!));

// exact → silent
r = run(["Rohan Jha", "Male", "Shandilya", "Sarisaba"]);
assert.equal(me(r.family)!.mool?.roman, "Sarisaba"); assert.equal(me(r.family)!.gotra?.roman, "Sandilya");

// user-added entries become searchable
registerExtras([{ kind: "mool", roman: "Zzqxplo", dev: "" }]);
const h = searchMools("zzqxplo");
assert.equal(classify(h).status, "exact"); assert.equal(h[0]!.item.extra, true);
console.log("basic tests passed");
