/** Mass updates: fix a spelling everywhere, set the whole family line (npx tsx scripts/_bulk.test.ts) */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type Op } from "../src/lib/family";
import { bulkRename, distinctValues, parseBulk, remapRef } from "../src/lib/bulk";

const G = { roman: "Shandliya", custom: true }, M = { roman: "Sarisab", custom: true };
const ops: Op[] = [
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", gotra: G, mool: M, place: "Madhubani, Bihar" },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", relation: { type: "father_of", to: "me" }, place: "Madhubani" },
  { op: "add_person", ref: "w", name_roman: "My Wife", gender: "female", relation: { type: "spouse_of", to: "me" } },
  { op: "add_person", ref: "son", name_roman: "My Son", gender: "male", relation: { type: "child_of", to: "me" } },
];
const { family } = applyOps(emptyFamily(), ops);

// parsing
assert.deepEqual(parseBulk("change gotra Shandliya to Shandilya"), { field: "gotra", from: "Shandliya", to: "Shandilya" });
assert.deepEqual(parseBulk("Please replace mool from Sarisab with Sarisaba"), { field: "mool", from: "Sarisab", to: "Sarisaba" });
assert.deepEqual(parseBulk("set gotra of everyone to Kashyap"), { field: "gotra", to: "Kashyap" });
assert.deepEqual(parseBulk("replace Madhubani with Madhepura in place"), { field: "place", from: "Madhubani", to: "Madhepura" });
assert.equal(parseBulk("who is my father's brother"), null);
assert.equal(parseBulk("add my brother Mohan"), null);

// distinct values
const dv = distinctValues(family, "gotra");
assert.equal(dv[0]!.value, "Shandliya"); assert.ok(dv[0]!.count >= 3);
assert.equal(distinctValues(family, "place").find((x) => x.value === "Madhubani")!.count, 2);

// rename
const r = bulkRename(family, { field: "gotra", from: "Shandliya", to: "Shandilya" });
assert.ok(r.count >= 3); assert.ok(r.family.persons.every((p) => !p.gotra || p.gotra.roman !== "Shandliya"));
assert.equal(family.persons[0]!.gotra!.roman, "Shandliya", "original untouched");
assert.equal(bulkRename(family, { field: "mool", from: "Nothing", to: "X" }).count, 0);
const pl = bulkRename(family, { field: "place", from: "Madhubani", to: "Madhepura" });
assert.equal(pl.count, 2); assert.equal(pl.family.persons[0]!.place, "Madhepura, Bihar");
const whole = bulkRename(family, { field: "gotra", to: "Kashyap" });
assert.ok(whole.count >= 3); assert.equal(whole.family.persons.find((p) => p.name_roman === "My Wife")!.gotra, undefined);
// review of a typed spelling: only "custom" entries with that spelling are replaced
const mapped = remapRef(family, "gotra", "shandliya", { id: "g01", roman: "Shandilya", dev: "शाण्डिल्य" });
assert.ok(mapped.count >= 3); assert.ok(mapped.family.persons.every((p) => !p.gotra || (p.gotra.id === "g01" && !p.gotra.custom)));
assert.equal(remapRef(mapped.family, "gotra", "Shandliya", { roman: "X" }).count, 0, "nothing left to replace");
assert.equal(remapRef(family, "mool", "Nothing", { roman: "X" }).count, 0);
console.log("bulk ok");
