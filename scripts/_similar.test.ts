import assert from "node:assert/strict";
import { applyOps, emptyFamily, type DFamily, type Op } from "../src/lib/family";
import { compareTrees, sameStock, scorePair } from "../src/lib/similar";
import { cleanProfile, completeness, profileForOwner } from "../src/lib/profile";

const build = (ops: Op[]): DFamily => applyOps(emptyFamily(), ops).family;
const G = { roman: "Shandilya" }, M = { roman: "Sarisab" };

// One real family, entered twice by two cousins. Family A (Rohan's side).
const A = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", status: "deceased", death: "1990", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" }, gotra: G, mool: M },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1952", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", relation: { type: "child_of", to: "f" }, is_me: true, gotra: G, mool: M },
  { op: "add_person", name_roman: "Mohan Jha", gender: "male", birth: "1983", status: "living", relation: { type: "child_of", to: "f" } },
  { op: "add_person", name_roman: "Vikas Jha", gender: "male", birth: "1985", status: "living", relation: { type: "child_of", to: "u" } },
]);
// Family B: the same people, spelt a little differently, one year off, one person missing, plus someone new.
const B = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1921", status: "deceased", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivanath Jha", gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1951", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: "Vikas Jha", gender: "male", birth: "1985", status: "living", relation: { type: "child_of", to: "u" }, is_me: true, gotra: G, mool: M },
  { op: "add_person", name_roman: "Mohan Jha", gender: "male", birth: "1983", status: "living", relation: { type: "child_of", to: "f" } },
  { op: "add_person", name_roman: "Pankaj Jha", gender: "male", birth: "1990", status: "living", relation: { type: "child_of", to: "u" } },
]);
// An unrelated family with the same surname, gotra and mool (very common): different first names and years.
const C = build([
  { op: "add_person", ref: "gf", name_roman: "Dwarika Jha", gender: "male", birth: "1930", status: "deceased", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Bhola Jha", gender: "male", birth: "1955", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: "Amit Jha", gender: "male", birth: "1982", status: "living", relation: { type: "child_of", to: "f" }, is_me: true, gotra: G, mool: M },
  { op: "add_person", name_roman: "Sumit Jha", gender: "male", birth: "1986", status: "living", relation: { type: "child_of", to: "f" } },
]);
// Same names as A but a different mool: filtered out before anything is scored.
const D = build([{ op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", is_me: true, gotra: G, mool: { roman: "Pandaul" } }]);

assert.ok(sameStock(A, B), "same gotra and mool");
assert.ok(!sameStock(A, D), "different mool is not the same stock");
assert.ok(!sameStock(A, build([{ op: "add_person", ref: "me", name_roman: "X", is_me: true }])), "a tree without gotra/mool cannot qualify");

const m = compareTrees(A, B)!;
assert.ok(m, "A and B are the same family");
assert.ok(m.matched >= 4 && m.percent >= 50, `A/B: ${m.matched} pairs, ${m.percent}%`);
assert.deepEqual(compareTrees(B, A)?.matched, m.matched, "symmetrical");
assert.equal(compareTrees(A, C), null, "an unrelated family with the same gotra and mool is not suggested");
// a living person is shown by first name only
assert.ok(m.pairs.some((p) => p.mine === "Shivnath Jha" && p.theirs === "Shivanath"), "spelling variants pair up, living by first name");
assert.ok(m.pairs.some((p) => p.theirs === "Ramnath Jha"), "deceased by full name");

// pair scoring
const f = A, pa = (n: string) => f.persons.find((p) => p.name_roman === n)!;
assert.equal(scorePair(pa("Rohan Jha"), { ...pa("Rohan Jha"), gender: "female" }, f, f), null, "gender must agree");
assert.equal(scorePair(pa("Rohan Jha"), { ...pa("Rohan Jha"), birth: "1960" }, f, f), null, "birth years far apart");
assert.ok(scorePair(pa("Rohan Jha"), pa("Rohan Jha"), f, f)!.score >= 1);

// profile
assert.deepEqual(cleanProfile({ pravar: "  Bharadwaj,   Angiras ", marital_status: "married", about: "x".repeat(900), hack: "<b>", share_contact: true, native_village: "<script>" }),
  { pravar: "Bharadwaj, Angiras", marital_status: "married", about: "x".repeat(400), share_contact: true, native_village: "script" });
assert.equal(cleanProfile({ marital_status: "alien" }).marital_status, undefined);
assert.equal(completeness({}, false), 0);
assert.equal(completeness({ pravar: "a", native_village: "b", current_city: "c", marital_status: "single", occupation: "d" }, true), 100);
const card = profileForOwner("Rajiv", "+919876543210", "r@x.in", { pravar: "P", current_address: "12 Street", share_contact: false });
assert.equal(card.phone, undefined, "contact stays private unless shared");
assert.equal(profileForOwner("Rajiv", "+919876543210", "r@x.in", { current_address: "12 Street" }, true).address, "12 Street");
console.log("similar + profile OK");
if (process.env.SHOW) console.log(JSON.stringify(m, null, 1));
