import assert from "node:assert/strict";
import { applyOps, emptyFamily, fatherOf, childrenOf, type DFamily } from "../src/lib/family";
import { mergeFamilies } from "../src/lib/merge";

let base: DFamily = emptyFamily();
base = applyOps(base, [{ op: "add_person", name_roman: "Rohan Jha", gender: "male" }]).family;
base = applyOps(base, [{ op: "add_person", name_roman: "Mahesh", relation: { type: "father_of", to: "p1" } }]).family; // p2
const snap = structuredClone(base);

// I (owner) add a child; they add a different child at the same time (same new id!)
const mine = applyOps(structuredClone(snap), [{ op: "add_person", name_roman: "Aarav", relation: { type: "child_of", to: "p1" } }]).family;
const theirs = applyOps(structuredClone(snap), [{ op: "add_person", name_roman: "Vikram", relation: { type: "sibling_of", to: "p1" } }, { op: "update_person", id: "p2", set: { place: "Sarisab, Madhubani, Bihar" } }]).family;
assert.equal(mine.persons.at(-1)!.id, theirs.persons.at(-1)!.id); // clash on purpose

const m = mergeFamilies(snap, mine, theirs);
const names = m.persons.map((p) => p.name_roman).sort();
assert.deepEqual(names, ["Aarav", "Mahesh", "Rohan Jha", "Vikram"]);
assert.equal(new Set(m.persons.map((p) => p.id)).size, 4);
const rohan = m.persons.find((p) => p.name_roman === "Rohan Jha")!;
assert.equal(childrenOf(m, rohan.id).map((c) => c.name_roman).join(), "Aarav");
assert.equal(m.persons.find((p) => p.name_roman === "Mahesh")!.place, "Sarisab, Madhubani, Bihar");
assert.equal(childrenOf(m, m.persons.find((p) => p.name_roman === "Mahesh")!.id).length, 2); // Rohan + Vikram
assert.ok(fatherOf(m, rohan.id));

// field conflict: I change name, they change birth → both kept; same field → mine wins
const a = applyOps(structuredClone(snap), [{ op: "update_person", id: "p2", set: { name_roman: "Mahesh Kumar Jha" } }]).family;
const b = applyOps(structuredClone(snap), [{ op: "update_person", id: "p2", set: { birth: "1955", name_roman: "M. Jha" } }]).family;
const ab = mergeFamilies(snap, a, b).persons.find((p) => p.id === "p2")!;
assert.equal(ab.name_roman, "Mahesh Kumar Jha"); assert.equal(ab.birth, "1955");

// deletes: they delete Mahesh (unedited by me) → gone with its relations; I delete Aarav → gone
const del = applyOps(structuredClone(snap), [{ op: "remove_person", id: "p2" }]).family;
const md = mergeFamilies(snap, structuredClone(snap), del);
assert.equal(md.persons.length, 1); assert.equal(md.rels.length, 0);
// they delete, but I edited → kept
const keep = mergeFamilies(snap, a, del);
assert.equal(keep.persons.length, 2);
// identical → unchanged
assert.equal(mergeFamilies(snap, snap, snap).persons.length, 2);
console.log("merge ok");
