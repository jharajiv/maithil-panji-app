import assert from "node:assert/strict";
import { applyOps, emptyFamily, fatherOf, parentsOf, type DFamily, type Op } from "../src/lib/family";
import { planCombine, undoCombine } from "../src/lib/combine";

const build = (ops: Op[]): DFamily => applyOps(emptyFamily(), ops).family;
const id = (f: DFamily, n: string) => f.persons.find((p) => p.name_roman === n)!.id;
const G = { roman: "Shandilya" }, M = { roman: "Sarisab" };

// MINE: Ramnath → Shivnath (father of Rohan), Harinath. Father of Harinath known. Rohan's mother unknown.
const mine = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", status: "deceased", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1952", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", relation: { type: "child_of", to: "f" } },
  { op: "add_person", name_roman: "Sumit Jha", gender: "male", relation: { type: "child_of", to: "u" } }, // only in mine
]);
// THEIRS: same family seen from Vikas. Has a village + exact birth dates, two more people (Vikas, his wife Gita), a wife of Shivnath, and a DIFFERENT death year for Ramnath.
const theirs = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920-04-02", death: "2001", status: "deceased", place: "Sarisab", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivanath Jha", gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "w", name_roman: "Kamla Devi", gender: "female", birth: "1952", relation: { type: "spouse_of", to: "f" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1953", status: "living", relation: { type: "child_of", to: "gf" }, whatsapp: "+919800000001" },
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", relation: { type: "child_of", to: "f", to2: "w" } },
  { op: "add_person", ref: "v", name_roman: "Vikas Jha", gender: "male", birth: "1985", status: "living", relation: { type: "child_of", to: "f", to2: "w" } },
  { op: "add_person", name_roman: "Gita Devi", gender: "female", birth: "1988", relation: { type: "spouse_of", to: "v" } },
]);
theirs.persons.find((p) => p.name_roman === "Gita Devi")!.links = [{ tree: "zzz", person: "p1", at: "2026" }];
theirs.persons.find((p) => p.name_roman === "Vikas Jha")!.is_me = true;
const before = JSON.stringify(mine), beforeT = JSON.stringify(theirs);

const plan = planCombine(mine, theirs);
assert.equal(plan.ok, true, plan.reason);
assert.equal(JSON.stringify(mine), before, "the receiving tree object is not changed in place"); assert.equal(JSON.stringify(theirs), beforeT, "the giving tree is never touched");
assert.ok(plan.pairs.length >= 4, "Ramnath, Shivnath~Shivanath, Harinath, Rohan");
assert.deepEqual(plan.added.map((a) => a.name).sort(), ["Gita Devi", "Kamla Devi", "Vikas Jha"], "only people mine did not have");
const F = plan.family;
assert.equal(F.persons.length, mine.persons.length + 3);
// no private details of the other tree come along; mine keeps its root
assert.ok(F.persons.every((p) => !p.links?.length && !p.whatsapp));
assert.equal(F.persons.filter((p) => p.is_me).length, mine.persons.filter((p) => p.is_me).length);
assert.equal(F.persons.find((p) => p.name_roman === "Vikas Jha")!.is_me, undefined);
// blanks filled: village, exact birth date, death; differences reported not applied
const ram = F.persons.find((p) => p.name_roman === "Ramnath Jha")!;
assert.equal(ram.place, "Sarisab"); assert.equal(ram.birth, "1920-04-02"); assert.equal(ram.death, "2001");
const har = F.persons.find((p) => p.name_roman === "Harinath Jha")!;
assert.equal(har.birth, "1952", "my value wins");
assert.ok(plan.conflicts.some((c) => c.person === "Harinath Jha" && c.field === "birth" && c.mine === "1952" && c.theirs === "1953"));
// relations: Vikas is Shivnath's son and Kamla's; Kamla is Shivnath's wife; Rohan now has both parents
const shiv = id(F, "Shivnath Jha"), kamla = id(F, "Kamla Devi"), vikas = id(F, "Vikas Jha"), rohan = id(F, "Rohan Jha");
assert.equal(fatherOf(F, vikas)?.id, shiv);
assert.ok(F.rels.some((r) => r.type === "spouse_of" && [r.a, r.b].includes(shiv) && [r.a, r.b].includes(kamla)));
assert.deepEqual(parentsOf(F, rohan).map((p) => p.id).sort(), [kamla, shiv].sort());
assert.ok(F.rels.some((r) => r.type === "spouse_of" && [r.a, r.b].includes(id(F, "Gita Devi")) && [r.a, r.b].includes(vikas)));
assert.equal(F.persons.find((p) => p.name_roman === "Sumit Jha") !== undefined, true, "mine-only people stay");
// ids are fresh
assert.equal(new Set(F.persons.map((p) => p.id)).size, F.persons.length); assert.ok(F.next > Math.max(...F.persons.map((p) => Number(p.id.slice(1)))));
// idempotent: combining again adds nothing
const again = planCombine(F, theirs); assert.equal(again.ok, true); assert.equal(again.added.length, 0); assert.equal(again.delta.addedRels.length, 0);

// undo restores exactly
const undone = undoCombine(F, plan.delta);
assert.deepEqual(undone.persons.map((p) => p.id).sort(), mine.persons.map((p) => p.id).sort());
assert.deepEqual(JSON.parse(JSON.stringify(undone.persons.find((p) => p.name_roman === "Ramnath Jha"))), JSON.parse(JSON.stringify(mine.persons.find((p) => p.name_roman === "Ramnath Jha"))));
assert.equal(undone.rels.length, mine.rels.length);
// …but edits made after the combine to a filled field are kept
const edited = { ...F, persons: F.persons.map((p) => (p.name_roman === "Ramnath Jha" ? { ...p, place: "Madhubani" } : p)) };
assert.equal(undoCombine(edited, plan.delta).persons.find((p) => p.name_roman === "Ramnath Jha")!.place, "Madhubani");

// ticking people off: a wrong pair becomes two people; fewer than 3 pairs → refused
const none = planCombine(mine, theirs, new Set(plan.pairs.map((p) => p.id)));
assert.equal(none.ok, false); assert.match(none.reason!, /At least 3/); assert.equal(none.family, mine);
const minusHari = planCombine(mine, theirs, new Set([plan.pairs.find((p) => p.mine === "Harinath Jha")!.id]));
assert.equal(minusHari.ok, true); assert.ok(minusHari.added.some((a) => a.name === "Harinath Jha"), "unticked → added as another Harinath");

// a second, different father is never added
const m2 = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1952", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", name_roman: "Rohan Jha", gender: "male", birth: "1980", relation: { type: "child_of", to: "f" } },
]);
const t2 = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1952", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "x", name_roman: "Mahesh Jha", gender: "male", birth: "1950", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", name_roman: "Rohan Jha", gender: "male", birth: "1980", relation: { type: "child_of", to: "x" } }, // here Mahesh is the father
]);
const p2 = planCombine(m2, t2);
assert.equal(p2.ok, true, p2.reason);
assert.equal(parentsOf(p2.family, id(p2.family, "Rohan Jha")).length, 1, "still one father");
assert.equal(fatherOf(p2.family, id(p2.family, "Rohan Jha"))!.name_roman, "Shivnath Jha");
assert.ok(p2.skippedRelations >= 1);
assert.ok(p2.added.some((a) => a.name === "Mahesh Jha"));

// an unknown father (placeholder) gives way to the real one, and undo brings the placeholder back
// build "Kishan with unknown father" directly
const m4 = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", gotra: G, mool: M },
  { op: "add_person", ref: "a", name_roman: "Anil Jha", gender: "male", birth: "1955", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "b", name_roman: "Bimal Jha", gender: "male", birth: "1958", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "k", name_roman: "Kishan Jha", gender: "male", birth: "1982", relation: { type: "child_of", to: "a" } },
  { op: "add_person", name_roman: "Kunal Jha", gender: "male", birth: "1984", relation: { type: "sibling_of", to: "k" } },
]);
// make Kishan's father a placeholder
const ph = { ...m4, persons: m4.persons.map((p) => (p.name_roman === "Anil Jha" ? { ...p, name_roman: "(name not known)", placeholder: true } : p)) };
const t4 = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", gotra: G, mool: M },
  { op: "add_person", ref: "a", name_roman: "Anil Jha", gender: "male", birth: "1955", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "b", name_roman: "Bimal Jha", gender: "male", birth: "1958", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "k", name_roman: "Kishan Jha", gender: "male", birth: "1982", relation: { type: "child_of", to: "a" } },
  { op: "add_person", name_roman: "Kunal Jha", gender: "male", birth: "1984", relation: { type: "sibling_of", to: "k" } },
]);
const p4 = planCombine(ph, t4);
assert.equal(p4.ok, true, p4.reason);
const anilId = id(p4.family, "Anil Jha");
assert.equal(fatherOf(p4.family, id(p4.family, "Kishan Jha"))!.id, anilId, "the real father replaces the unknown one");
assert.ok(!p4.family.persons.some((p) => p.placeholder), "placeholder gone");
assert.equal(p4.delta.removedPersons.length, 1);
const u4 = undoCombine(p4.family, p4.delta);
assert.ok(u4.persons.some((p) => p.placeholder) && !u4.persons.some((p) => p.name_roman === "Anil Jha"));
assert.equal(fatherOf(u4, id(u4, "Kishan Jha"))?.placeholder, true, "Kishan hangs from the unknown father again");

// people not connected to anybody both trees have are left out and counted
const t5 = { ...t4, persons: [...t4.persons, { id: "p99", name_roman: "Stranger Mishra", gender: "male" as const, flags: {} }, { id: "p98", name_roman: "Stranger Son", gender: "male" as const, flags: {} }], rels: [...t4.rels, { type: "parent_of" as const, a: "p99", b: "p98" }] };
const p5 = planCombine(m4, t5); assert.equal(p5.leftOut, 2); assert.ok(!p5.family.persons.some((p) => p.name_roman.startsWith("Stranger")));
// no cycles: a child can never become the ancestor of their own parent
const t6 = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", gotra: G, mool: M },
  { op: "add_person", ref: "a", name_roman: "Anil Jha", gender: "male", birth: "1955", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "b", name_roman: "Bimal Jha", gender: "male", birth: "1958", relation: { type: "child_of", to: "a" } },
  { op: "add_person", name_roman: "Kishan Jha", gender: "male", birth: "1982", relation: { type: "child_of", to: "b" } },
]);
const m6 = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", gotra: G, mool: M },
  { op: "add_person", ref: "b", name_roman: "Bimal Jha", gender: "male", birth: "1958", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "a", name_roman: "Anil Jha", gender: "male", birth: "1955", relation: { type: "child_of", to: "b" } }, // upside down here
  { op: "add_person", name_roman: "Kishan Jha", gender: "male", birth: "1982", relation: { type: "child_of", to: "a" } },
]);
const p6 = planCombine(m6, t6); assert.equal(p6.ok, true, p6.reason);
const anc = (f: DFamily, of: string, seen = new Set<string>()): Set<string> => { for (const p of parentsOf(f, of)) if (!seen.has(p.id)) { seen.add(p.id); anc(f, p.id, seen); } return seen; };
for (const p of p6.family.persons) assert.ok(!anc(p6.family, p.id).has(p.id), `${p.name_roman} is not their own ancestor`);
console.log("combine OK");
