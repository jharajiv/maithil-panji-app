import assert from "node:assert/strict";
import { darbhangaSample, portraitFor, PORTRAITS, SAMPLE_NOTICE } from "../src/data/darbhanga-sample";
import { toFamilyData } from "../src/lib/family";
import { generations } from "../src/lib/view";

const f = darbhangaSample();
const by = (n: string) => f.persons.find((p) => p.name_roman === n)!;
const kids = (n: string) => f.rels.filter((r) => r.type === "parent_of" && r.a === by(n).id).map((r) => f.persons.find((p) => p.id === r.b)!.name_roman).sort();

assert.equal(f.persons.length, 42);
assert.equal(f.persons.filter((p) => p.is_me).length, 1);
assert.ok(toFamilyData(f), "the chart can be drawn from the sample");
assert.ok(generations(f) >= 18, "a long line of descent");
assert.deepEqual(kids("Madho Singh"), ["Chhatra Singh", "Kishan Singh"]);
assert.deepEqual(kids("Chhatra Singh"), ["Bisdeo Singh", "Rudra Singh"]);
assert.equal(kids("Rudra Singh").length, 4);
assert.deepEqual(kids("Nitreshwar Singh"), ["Babu Ekradeswar Singh", "Babu Janeswar Singh"]);
assert.equal(kids("Vishweshwar Singh").length, 3);
// living people: first name only, and nothing that identifies them further
for (const p of f.persons.filter((x) => x.status === "living")) {
  assert.ok(!/\s/.test(p.name_roman), `${p.name_roman}: first name only`);
  assert.ok(!p.birth && !p.place && !p.notes && !p.photo && !p.whatsapp && !p.married_to, `${p.name_roman}: no details`);
}
assert.equal(f.persons.filter((p) => p.status === "living").length, 5);
assert.match(SAMPLE_NOTICE, /not an official or actual/);
for (const x of portraitFor(f)) assert.ok(x.credit.length > 10 && x.file, `${x.name}: a portrait needs a file and a credit`);
assert.equal(portraitFor(f).length, Object.keys(PORTRAITS).length, "every portrait key matches a person");
console.log("sample ok");
