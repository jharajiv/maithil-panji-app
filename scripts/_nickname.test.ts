/** Nickname (ḍāk nām): saved, kept private for living people on shared links, used to match the same person across trees (npx tsx scripts/_nickname.test.ts) */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, toFamilyData } from "../src/lib/family";
import { cleanOps } from "../src/lib/agent";
import { sanitizeFamily } from "../src/lib/sanitize";
import { publicFamily } from "../src/lib/view";
import { compareTrees, scorePair } from "../src/lib/similar";

const base = applyOps(emptyFamily(), [
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", nickname: "Bunty", gender: "male", birth: "1980", place: "Madhubani" },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", nickname: "Babu", gender: "male", birth: "1948", status: "deceased", death: "2015", relation: { type: "father_of", to: "me" } },
]).family;
assert.equal(base.persons[0]!.nickname, "Bunty");
assert.equal(applyOps(base, [{ op: "update_person", id: "p1", set: { nickname: "  Guddu  " } }]).family.persons[0]!.nickname, "Guddu");
assert.equal(applyOps(base, [{ op: "update_person", id: "p1", set: { nickname: "" } }]).family.persons[0]!.nickname, undefined, "can be cleared");
assert.equal(applyOps(base, [{ op: "update_person", id: "p1", set: { nickname: "x".repeat(90) } }]).family.persons[0]!.nickname!.length, 40);

// the AI can save it, and the formal name stays
const ops = cleanOps([{ op: "update_person", id: "p1", set: { nickname: "Bunty", name_roman: "Rohan Jha" } }]);
assert.deepEqual((ops[0] as { set: Record<string, string> }).set, { nickname: "Bunty", name_roman: "Rohan Jha" });

// stored and read back safely
const back = sanitizeFamily(JSON.parse(JSON.stringify(base)), { stored: true })!;
assert.equal(back.persons[0]!.nickname, "Bunty");
assert.equal(toFamilyData(base)!.persons[0]!.nickname, "Bunty");

// a link that shows living relatives by first name only does not show their nickname; the late father's stays
const pub = publicFamily(base, "private");
assert.equal(pub.persons[0]!.nickname, undefined, "living: hidden");
assert.equal(pub.persons[1]!.nickname, "Babu", "passed away: kept");
assert.equal(publicFamily(base, "full").persons[0]!.nickname, "Bunty");

// the same man, written by his formal name in one tree and by his pet name in the other, is recognised
const a = applyOps(emptyFamily(), [
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", nickname: "Bunty", gender: "male", birth: "1980" },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", relation: { type: "father_of", to: "me" } },
  { op: "add_person", ref: "g", name_roman: "Ramnath Jha", gender: "male", birth: "1920", relation: { type: "father_of", to: "f" } },
  { op: "add_person", ref: "b", name_roman: "Mohan Jha", gender: "male", birth: "1983", relation: { type: "sibling_of", to: "me" } },
]).family;
const b = applyOps(emptyFamily(), [
  { op: "add_person", ref: "me", name_roman: "Bunty Jha", gender: "male", birth: "1980" },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", relation: { type: "father_of", to: "me" } },
  { op: "add_person", ref: "g", name_roman: "Ramnath Jha", gender: "male", birth: "1920", relation: { type: "father_of", to: "f" } },
  { op: "add_person", ref: "b", name_roman: "Mohan Jha", gender: "male", birth: "1983", relation: { type: "sibling_of", to: "me" } },
]).family;
const sc = scorePair(a.persons[0]!, b.persons[0]!, a, b);
assert.ok(sc && sc.score >= 0.7, "matched through the nickname"); assert.ok(sc!.reasons.some((r) => /nickname/.test(r)));
const noNick = structuredClone(a); delete noNick.persons[0]!.nickname;
assert.equal(scorePair(noNick.persons[0]!, b.persons[0]!, noNick, b), null, "without the nickname they are different names");
const tm = compareTrees(a, b)!;
assert.ok(tm && tm.pairs.length >= 4, "all four are paired, including Rohan = Bunty");
console.log("nickname ok");
