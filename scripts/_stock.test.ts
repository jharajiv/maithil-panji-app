/** The family's gotra and mool: who gets them automatically (npx tsx scripts/_stock.test.ts) */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, fillStock, type DFamily, type Op } from "../src/lib/family";

const G = { roman: "Shandilya", id: "g1" }, M = { roman: "Sarisab", id: "m1" }, M2 = { roman: "Dirdhosa", id: "m2" }, OTHERG = { roman: "Kashyap", id: "g2" };
const ops: Op[] = [
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", relation: { type: "father_of", to: "me" } },
  { op: "add_person", ref: "mo", name_roman: "Savitri Devi", gender: "female", relation: { type: "mother_of", to: "me" } },
  { op: "add_person", ref: "mf", name_roman: "Mother Father", gender: "male", relation: { type: "father_of", to: "mo" } },
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", relation: { type: "father_of", to: "f" } },
  { op: "add_person", ref: "un", name_roman: "Harinath Jha", gender: "male", relation: { type: "sibling_of", to: "f" } },
  { op: "add_person", ref: "unw", name_roman: "Uncle Wife", gender: "female", relation: { type: "spouse_of", to: "un" } },
  { op: "add_person", ref: "cou", name_roman: "Cousin Jha", gender: "male", relation: { type: "child_of", to: "un" } },
  { op: "add_person", ref: "br", name_roman: "Mohan Jha", gender: "male", relation: { type: "sibling_of", to: "me" } },
  { op: "add_person", ref: "brw", name_roman: "Brother Wife", gender: "female", relation: { type: "spouse_of", to: "br" } },
  { op: "add_person", ref: "brs", name_roman: "Brother Son", gender: "male", relation: { type: "child_of", to: "br" } },
  { op: "add_person", ref: "si", name_roman: "Meera Jha", gender: "female", relation: { type: "sibling_of", to: "me" } },
  { op: "add_person", ref: "sih", name_roman: "Sister Husband", gender: "male", relation: { type: "spouse_of", to: "si" } },
  { op: "add_person", ref: "sis", name_roman: "Sister Son", gender: "male", relation: { type: "child_of", to: "si" } },
  { op: "add_person", ref: "w", name_roman: "My Wife", gender: "female", relation: { type: "spouse_of", to: "me" } },
  { op: "add_person", ref: "son", name_roman: "My Son", gender: "male", relation: { type: "child_of", to: "me" } },
  { op: "add_person", ref: "dau", name_roman: "My Daughter", gender: "female", relation: { type: "child_of", to: "me" } },
  { op: "add_person", ref: "dauh", name_roman: "Daughter Husband", gender: "male", relation: { type: "spouse_of", to: "dau" } },
  { op: "add_person", ref: "daus", name_roman: "Daughter Child", gender: "male", relation: { type: "child_of", to: "dau" } },
  { op: "add_person", ref: "sonw", name_roman: "Son Wife", gender: "female", relation: { type: "spouse_of", to: "son" } },
  { op: "add_person", ref: "sonc", name_roman: "Son Child", gender: "male", relation: { type: "child_of", to: "son" } },
];
let { family } = applyOps(emptyFamily(), ops);
const by = (n: string) => family.persons.find((p) => p.name_roman === n)!;
const stock = (n: string) => [by(n).gotra?.roman, by(n).mool?.roman].join("/");

// 1. everyone on the father's line has it, spouses and the mother's and daughter's families do not
for (const n of ["Rohan Jha", "Shivnath Jha", "Ramnath Jha", "Harinath Jha", "Cousin Jha", "Mohan Jha", "Brother Son", "Meera Jha", "My Son", "My Daughter", "Son Child"]) assert.equal(stock(n), "Shandilya/Sarisab", n);
for (const n of ["Savitri Devi", "Mother Father", "Uncle Wife", "Brother Wife", "Sister Husband", "Sister Son", "My Wife", "Daughter Husband", "Daughter Child", "Son Wife"]) assert.equal(stock(n), "/", n + " keeps nothing");

// 2. a family from an older version: blanks are filled when it is loaded, and nothing is overwritten
const old: DFamily = structuredClone(family);
for (const p of old.persons) if (!p.is_me) { delete p.gotra; delete p.mool; }
by("Mohan Jha"); // brother has his own mool, set individually
old.persons.find((p) => p.name_roman === "Mohan Jha")!.mool = M2;
old.persons.find((p) => p.name_roman === "Savitri Devi")!.gotra = OTHERG; // the mother's own gotra stays
const fixed = fillStock(old);
assert.ok(fixed.filled > 0);
const get = (n: string) => fixed.family.persons.find((p) => p.name_roman === n)!;
assert.equal(get("Mohan Jha").mool?.roman, "Dirdhosa", "an individual exception is kept");
assert.equal(get("Mohan Jha").gotra?.roman, "Shandilya", "but the gotra is filled");
assert.equal(get("Brother Son").mool?.roman, "Dirdhosa", "his son follows him");
assert.equal(get("Brother Son").gotra?.roman, "Shandilya");
assert.equal(get("Savitri Devi").gotra?.roman, "Kashyap", "the mother's own gotra is not overwritten");
assert.equal(get("Savitri Devi").mool, undefined);
assert.equal(get("My Wife").gotra, undefined);
assert.equal(get("Sister Son").gotra, undefined);
assert.equal(get("Shivnath Jha").mool?.roman, "Sarisab", "ancestors take it from the user");
// idempotent and does not touch the original object
assert.equal(fillStock(fixed.family).filled, 0); assert.strictEqual(fillStock(fixed.family).family, fixed.family);
assert.equal(old.persons.find((p) => p.name_roman === "Shivnath Jha")!.gotra, undefined);

// 3. later additions also get it, wherever they are added; a woman user: her own line, not her husband's
const more = applyOps(family, [{ op: "add_person", name_roman: "New Nephew", gender: "male", relation: { type: "child_of", to: by("Mohan Jha").id } }, { op: "add_person", name_roman: "New Aunt", gender: "female", relation: { type: "sibling_of", to: by("Shivnath Jha").id } }]).family;
for (const n of ["New Nephew", "New Aunt"]) assert.equal(more.persons.find((p) => p.name_roman === n)!.gotra?.roman, "Shandilya", n);
let w = applyOps(emptyFamily(), [
  { op: "add_person", ref: "me", name_roman: "Anita Jha", gender: "female", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Her Father", gender: "male", relation: { type: "father_of", to: "me" } },
  { op: "add_person", ref: "h", name_roman: "Her Husband", gender: "male", relation: { type: "spouse_of", to: "me" } },
  { op: "add_person", name_roman: "Her Son", gender: "male", relation: { type: "child_of", to: "me" } },
]).family;
const wg = (n: string) => w.persons.find((p) => p.name_roman === n)!.gotra?.roman;
assert.equal(wg("Her Father"), "Shandilya"); assert.equal(wg("Her Husband"), undefined);
assert.equal(wg("Her Son"), undefined, "her son belongs to her husband's line, which is not hers to fill");
console.log("stock ok");
