/** The suggestion buttons must each be understood by the interview: tapping one has to record exactly that gotra / mool. */
import assert from "node:assert/strict";
import { gotraSuggestions, moolSuggestions } from "../src/lib/chips";
import { classify, GOTRAS, MOOLS, searchGotras, searchMools } from "../src/lib/lookup";

const g = gotraSuggestions();
assert.equal(g.top.length, 6); assert.equal(g.top.length + g.rest.length, GOTRAS.length, "all 20 are reachable");
assert.deepEqual(g.top.map((s) => s.label), ["Shandilya", "Vatsa", "Kashyap", "Parashar", "Bharadwaj", "Savarna"]);
for (const s of [...g.top, ...g.rest]) {
  const m = classify(searchGotras(s.send));
  assert.equal(m.status, "exact", `${s.send} is an exact match`);
  assert.ok(GOTRAS.find((x) => x.id === m.hits[0]!.item.id)!.dev === s.labelHi, `${s.send} → its own gotra`);
}
// mools: only those of the chosen gotra, every button understood
const shandilya = GOTRAS.find((x) => x.roman === "śāṇḍilya")!;
const m1 = moolSuggestions(shandilya.id);
assert.equal(m1.top.length, 8);
assert.equal(m1.top.length + m1.rest.length, MOOLS.filter((m) => m.gotras.includes(shandilya.id)).length);
for (const s of [...m1.top, ...m1.rest]) {
  const m = classify(searchMools(s.send, { gotraId: shandilya.id }));
  assert.equal(m.status, "exact", `${s.send} is an exact match`);
  assert.equal(m.hits[0]!.item.dev, s.labelHi, `${s.send} → its own mool`);
}
const none = moolSuggestions(undefined);
assert.equal(none.top.length + none.rest.length, MOOLS.length, "no gotra: the whole list");
console.log("chips OK");
