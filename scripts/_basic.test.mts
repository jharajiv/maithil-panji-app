import assert from "node:assert/strict";
import { emptyFamily, me, type DFamily, type Pending } from "../src/lib/family";
import { basicTurn } from "../src/lib/basic-turn";
import { registerExtras, searchMools, classify } from "../src/lib/lookup";

async function run(answers: string[]) {
  let family: DFamily = emptyFamily(); let pending: Pending | undefined; let prevGoalId: string | undefined; let repeats = 0;
  const log: string[] = [];
  for (const text of answers) {
    const out = await basicTurn({ family, history: [], text, prevGoalId, repeats, pending });
    family = out.family; pending = out.pending; prevGoalId = out.goal?.id; repeats = out.repeats; log.push(out.reply);
  }
  return { family, pending, log };
}

// similar spelling → asks, "yes" accepts the dataset spelling
let r = await run(["Rohan Jha", "Male", "Shandilya", "sarisabo"]);
console.log(r.log.at(-1));
assert.ok(/Did you mean/i.test(r.log.at(-1)!), "should ask to confirm");
assert.equal(me(r.family)!.mool, undefined);
r = await run(["Rohan Jha", "Male", "Shandilya", "sarisabo", "yes"]);
assert.equal(me(r.family)!.mool?.roman, "Sarisaba"); assert.ok(!me(r.family)!.mool?.custom);

// "no" → asks to type exactly → saved as a custom entry, no more asking
r = await run(["Rohan Jha", "Male", "Shandilya", "sarisabo", "no", "Sarisabo"]);
assert.equal(me(r.family)!.mool?.roman, "Sarisabo"); assert.equal(me(r.family)!.mool?.custom, true);

// totally different → added as new straight away
r = await run(["Rohan Jha", "Male", "Shandilya", "Zzqxplo"]);
assert.equal(me(r.family)!.mool?.custom, true);
assert.ok(/new mool/i.test(r.log.at(-1)!) || /new mool/i.test(r.log.at(-2)!));

// exact → silent
r = await run(["Rohan Jha", "Male", "Shandilya", "Sarisaba"]);
assert.equal(me(r.family)!.mool?.roman, "Sarisaba"); assert.equal(me(r.family)!.gotra?.roman, "Sandilya");

// user-added entries become searchable
registerExtras([{ kind: "mool", roman: "Zzqxplo", dev: "" }]);
const h = searchMools("zzqxplo");
assert.equal(classify(h).status, "exact"); assert.equal(h[0]!.item.extra, true);
// free-text replies: only the names are taken, sentences are never turned into people
import { parseNames } from "../src/lib/basic";
const names = (t: string) => parseNames(t).map((x) => `${x.name}${x.gender ? `/${x.gender[0]}` : ""}`).join("|");
assert.equal(names("One Son and he is Arihantt Bharadwaj"), "Arihantt Bharadwaj/m");
assert.equal(names("you have got an error - you need to read what I am saying. I have one son and his name is Arihantt bharadwaj"), "Arihantt bharadwaj/m");
assert.equal(names("you have got an error - you need to read what I am saying"), "");
assert.equal(names("I have one son"), "");
assert.equal(names("two daughters Anika and Riya"), "Anika/f|Riya/f");
assert.equal(names("Aarav - son, Anika - daughter"), "Aarav/m|Anika/f");
assert.equal(names("Aarav, Anika"), "Aarav|Anika");
console.log("basic tests passed");
