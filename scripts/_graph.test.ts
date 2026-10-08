import assert from "node:assert/strict";
import { applyOps, emptyFamily, type DFamily, type Op } from "../src/lib/family";
import { withLink } from "../src/lib/connect-server";
import { around, buildGraph, nid, otherFamilies, searchPeople, seenAs, shortestPath, stats } from "../src/lib/graph";

const build = (ops: Op[]): DFamily => applyOps(emptyFamily(), ops).family;
const id = (f: DFamily, n: string) => f.persons.find((p) => p.name_roman === n)!.id;

// Tree A: Rohan's family. Wife Sita is a wife here. Tree B: Sita's father's family; she is "Seeta", a daughter. Tree C: unrelated.
let A = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", status: "deceased", gotra: { roman: "Shandilya" }, mool: { roman: "Sarisab" }, place: "Sarisab, Madhubani, Bihar" },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", relation: { type: "child_of", to: "f" }, is_me: true },
  { op: "add_person", ref: "w", name_roman: "Sita Devi", gender: "female", birth: "1985", relation: { type: "spouse_of", to: "me" } },
]);
let B = build([
  { op: "add_person", ref: "me", name_roman: "Mohan Mishra", gender: "male", birth: "1955", is_me: true, gotra: { roman: "Kashyap" }, mool: { roman: "Pandaul" } },
  { op: "add_person", name_roman: "Seeta", gender: "female", birth: "1985", married_to: "Rohan Jha", relation: { type: "child_of", to: "me" } },
  { op: "add_person", name_roman: "Anil Mishra", gender: "male", birth: "1982", relation: { type: "child_of", to: "me" } },
]);
const C = build([{ op: "add_person", name_roman: "Lonely Singh", gender: "male", is_me: true }]);
const rows = (a: DFamily, b: DFamily) => [{ id: "A", title: "Rohan’s family", family: a }, { id: "B", title: "Mohan’s family", family: b }, { id: "C", title: "Lonely", family: C }];

let g = buildGraph(rows(A, B));
const rohan = nid("A", id(A, "Rohan Jha")), anil = nid("B", id(B, "Anil Mishra"));
assert.equal(shortestPath(g, rohan, anil), null, "no link yet: not connected");
assert.equal(stats(g).groups, 3);

// confirm the link on both sides
A = withLink(A, id(A, "Sita Devi"), { tree: "B", person: id(B, "Seeta"), at: "2026-01-01" });
B = withLink(B, id(B, "Seeta"), { tree: "A", person: id(A, "Sita Devi"), at: "2026-01-01" });
g = buildGraph(rows(A, B));
assert.equal(g.links, 1, "a link stored on both sides counts once");
const p = shortestPath(g, rohan, anil)!;
// Rohan → wife Sita → (same woman) Seeta → father Mohan → son Anil: 3 relationship steps, the link is free
assert.equal(p.steps, 3); assert.equal(p.degree, "3rd connection"); assert.equal(p.trees, 2);
assert.deepEqual(p.path.map((s) => [s.node.name, s.via]), [["Rohan Jha", undefined], ["Sita Devi", "wife"], ["Seeta", "the same woman, in another family’s tree"], ["Mohan Mishra", "father"], ["Anil Mishra", "son"]]);
assert.equal(shortestPath(g, anil, rohan)!.steps, 3, "symmetrical");
assert.equal(shortestPath(g, rohan, rohan)!.steps, 0);
assert.equal(shortestPath(g, rohan, nid("C", C.persons[0]!.id)), null, "an unconnected tree");
assert.equal(shortestPath(g, rohan, nid("A", id(A, "Shivnath Jha")))!.degree, "1st connection");
assert.equal(shortestPath(g, rohan, nid("A", id(A, "Ramnath Jha")))!.steps, 2);
const s = stats(g); assert.equal(s.groups, 2); assert.equal(s.treesLinked, 2); assert.equal(s.largestGroup, 7);

// attributes
assert.deepEqual(searchPeople(g, { gotra: "shandilya" }).map((n) => n.name).sort(), ["Ramnath Jha", "Rohan Jha", "Shivnath Jha", "Sita Devi"].sort(), "everyone in a tree inherits the root's gotra");
assert.deepEqual(searchPeople(g, { place: "Sarisab", gender: "male" }).map((n) => n.name), ["Ramnath Jha"]);
assert.deepEqual(searchPeople(g, { q: "mishra", from: 1980, to: 1990 }).map((n) => n.name), ["Anil Mishra"]);
assert.equal(searchPeople(g, { q: "" , limit: 3 }).length, 3);
assert.deepEqual(around(g, rohan, 1).map((x) => x.node.name).sort(), ["Seeta", "Shivnath Jha", "Sita Devi"].sort(), "within one step (the other tree's Seeta is the same woman, free)");

// what an ordinary signed-in person may see: other trees only, living people by first name
const others = otherFamilies(g, rohan);
assert.ok(others.length >= 2 && others.every((o) => o.id.startsWith("B:")), "only people of other trees");
const anilSeen = others.find((o) => o.id === anil)!;
assert.equal(anilSeen.name, "Anil", "living: first name only"); assert.equal(anilSeen.years, undefined); assert.equal(anilSeen.steps, 3);
assert.ok(!JSON.stringify(others).includes("Mishra") || others.some((o) => o.living === false), "no surnames of living people leak");
assert.ok(!JSON.stringify(others.filter((o) => o.living)).includes("Mishra"));
assert.equal(otherFamilies(g, nid("C", C.persons[0]!.id)).length, 0, "an unconnected tree sees nobody");
assert.deepEqual(seenAs(g.nodes.get(nid("A", id(A, "Ramnath Jha")))!), { id: nid("A", id(A, "Ramnath Jha")), name: "Ramnath Jha", years: "1920", gotra: "Shandilya", mool: "Sarisab", living: false }, "passed away: full name and year");
console.log("graph OK");
