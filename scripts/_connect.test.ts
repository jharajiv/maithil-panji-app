import assert from "node:assert/strict";
import { applyOps, emptyFamily, type DFamily, type Op } from "../src/lib/family";
import { givenName, prefixesFor, previewOf, scoreMatch, womenToMatch } from "../src/lib/connect";
import { withLink } from "../src/lib/connect-server";

const build = (ops: Op[]): DFamily => applyOps(emptyFamily(), ops).family;
const named = (f: DFamily, n: string) => f.persons.find((p) => p.name_roman === n)!;

// Tree A: Rohan's family. His wife Sita (born 1992) is a wife here.
const A = build([
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1988-02-10", status: "living", gotra: { roman: "Shandilya" }, mool: { roman: "Sarisab" } },
  { op: "add_person", ref: "w", name_roman: "Sita Devi", gender: "female", birth: "1992-05-01", status: "living", gotra: { roman: "Kashyap" }, mool: { roman: "Pandaul" }, relation: { type: "spouse_of", to: "me" } },
  { op: "add_person", name_roman: "Aarav", gender: "male", birth: "2018-01-01", status: "living", relation: { type: "child_of", to: "me", to2: "w" } },
]);
// Tree B: Sita's father's family. She is a daughter there, married to "Rohan Jha of Sarisab".
const B = build([
  { op: "add_person", ref: "me", name_roman: "Mohan Mishra", gender: "male", birth: "1960-01-01", status: "living", gotra: { roman: "Kashyap" }, mool: { roman: "Pandaul" } },
  { op: "add_person", name_roman: "Seeta", gender: "female", birth: "1992-06-01", status: "living", married_to: "Rohan Jha, Sarisab", relation: { type: "child_of", to: "me" } },
  { op: "add_person", name_roman: "Gita", gender: "female", birth: "1995-01-01", status: "living", relation: { type: "child_of", to: "me" } },
  { op: "add_person", name_roman: "Anil", gender: "male", birth: "1990-01-01", status: "living", relation: { type: "child_of", to: "me" } },
]);

const wa = womenToMatch(A), wb = womenToMatch(B);
assert.deepEqual(wa.map((w) => [w.name, w.kind]), [["Sita Devi", "wife"]]);
assert.deepEqual(wb.map((w) => [w.name, w.kind]), [["Seeta", "daughter"]], "an unmarried daughter is not matched");

const m = scoreMatch(wa[0]!, wb[0]!)!;
assert.ok(m && m.strength === "strong", `Sita/Seeta should be a strong match: ${JSON.stringify(m)}`);
assert.deepEqual(scoreMatch(wb[0]!, wa[0]!)?.score, m.score, "symmetrical");

// different names / far birth years / same kind never match
assert.equal(scoreMatch({ ...wa[0]!, name: "Radha Devi" }, wb[0]!), null);
assert.equal(scoreMatch({ ...wa[0]!, birthYear: 1970 }, wb[0]!), null);
assert.equal(scoreMatch(wa[0]!, { ...wa[0]!, id: "x" }), null);
// same name but a different husband and a different gotra is no longer enough
assert.equal(scoreMatch({ ...wa[0]!, husband: "Vikram Jha", gotra: "Bharadwaj", birthYear: undefined }, { ...wb[0]!, birthYear: undefined }), null);
// name only, nothing else known → not enough to suggest
assert.equal(scoreMatch({ id: "a", kind: "wife", name: "Sita" }, { id: "b", kind: "daughter", name: "Sita" }), null);

assert.equal(givenName("Smt. Sita Devi"), "Sita");
assert.deepEqual(prefixesFor("Bandana"), ["v", "b", "w"]);
assert.deepEqual(prefixesFor("Sita"), ["s"]);

// preview: living people by first name only, her immediate connections
const pv = previewOf(B, named(B, "Seeta").id, "Mohan’s family")!;
assert.equal(pv.person.name, "Seeta");
assert.ok(pv.connects.some((c) => c.relation === "father" && c.name === "Mohan"), "father shown by first name (living)");
assert.ok(pv.connects.some((c) => c.relation === "brother" && c.name === "Anil"));
assert.ok(pv.connects.some((c) => c.relation === "married to" && c.name === "Rohan"));
assert.ok(!JSON.stringify(pv).includes("Mishra"), "no surname of living people");
const pa = previewOf(A, named(A, "Sita Devi").id, "Rohan’s family")!;
assert.ok(pa.connects.some((c) => c.relation === "husband") && pa.connects.some((c) => c.relation === "son" && c.name === "Aarav"));

// links: a linked woman is no longer offered; removing the link offers her again
const linked = withLink(A, named(A, "Sita Devi").id, { tree: "t2", person: "p2", at: "2026-10-01" });
assert.equal(womenToMatch(linked).length, 0);
assert.equal(womenToMatch(withLink(linked, named(A, "Sita Devi").id, null, "t2")).length, 1);
console.log("connect ok");
