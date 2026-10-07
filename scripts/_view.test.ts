import assert from "node:assert/strict";
import { generations, publicFamily, viewKey, viewKeyOk, viewMode } from "../src/lib/view";
import { applyOps, emptyFamily, type DFamily } from "../src/lib/family";

// a small family: grandfather (passed away) → father (living, has a village, notes, phone) → me
let f: DFamily = emptyFamily();
f = applyOps(f, [
  { op: "add_person", ref: "me", name_roman: "Rajiv Kumar Jha", name_dev: "राजीव कुमार झा", gender: "male", is_me: true },
  { op: "add_person", ref: "dad", name_roman: "Subodh Kumar Jha", gender: "male", relation: { type: "father_of", to: "me" } },
  { op: "add_person", ref: "gf", name_roman: "Late Ramesh Jha", gender: "male", relation: { type: "father_of", to: "dad" } },
  { op: "update_person", id: "me", set: { birth: "1980-03-14", place: "Benipatti, Madhubani, Bihar", notes: "secret", whatsapp: "+41790000000" } },
  { op: "update_person", id: "dad", set: { birth: "1950", place: "Benipatti, Madhubani, Bihar", whatsapp: "+919800000000" } },
  { op: "update_person", id: "gf", set: { death: "1999", birth: "1920", place: "Benipatti, Madhubani, Bihar" } },
]).family;
const T = "tree-123";

// keys: two kinds, never interchangeable, nothing else works
const priv = viewKey(T), full = viewKey(T, "full");
assert.notEqual(priv, full);
assert.equal(priv.length, 22); assert.equal(full.length, 22);
assert.equal(viewMode(T, priv), "private");
assert.equal(viewMode(T, full), "full");
assert.equal(viewMode(T, "x".repeat(22)), null);
assert.equal(viewMode(T, ""), null);
assert.equal(viewMode(T, undefined), null);
assert.equal(viewMode("other-tree", priv), null);
assert.ok(viewKeyOk(T, priv) && viewKeyOk(T, full) && !viewKeyOk(T, "short"));
// the full key is the original derivation, so QR codes printed before this change still open
assert.equal(full, require("crypto").createHmac("sha256", process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "maithil-panji-dev-view-key").update(`view|${T}`).digest("base64url").slice(0, 22));

// protected view: living people by first name only, nothing that identifies them further; the deceased stay complete
const p = publicFamily(f, "private");
const me = p.persons.find((x) => x.is_me)!, dad = p.persons.find((x) => x.name_roman === "Subodh")!, gf = p.persons.find((x) => x.name_roman.includes("Ramesh"))!;
assert.equal(me.name_roman, "Rajiv"); assert.equal(me.name_dev, "राजीव");
assert.ok(dad && dad.birth === undefined && dad.place === undefined && dad.photo === undefined);
assert.equal(me.birth, undefined); assert.equal(me.place, undefined);
assert.equal(JSON.stringify(p).includes("+4179"), false); assert.equal(JSON.stringify(p).includes("secret"), false); assert.equal(JSON.stringify(p).includes("Kumar Jha"), false);
assert.equal(gf.name_roman, "Late Ramesh Jha"); assert.equal(gf.birth, "1920"); assert.equal(gf.death, "1999"); assert.equal(gf.place, "Benipatti, Madhubani, Bihar");
assert.equal(p.rels.length, f.rels.length);

// full view: everything except phone numbers and private notes
const q = publicFamily(f, "full");
const me2 = q.persons.find((x) => x.is_me)!;
assert.equal(me2.name_roman, "Rajiv Kumar Jha"); assert.equal(me2.birth, "1980-03-14"); assert.equal(me2.place, "Benipatti, Madhubani, Bihar");
assert.equal(JSON.stringify(q).includes("+4179"), false); assert.equal(JSON.stringify(q).includes("secret"), false);

// the original is never changed
assert.equal(f.persons.find((x) => x.is_me)!.name_roman, "Rajiv Kumar Jha");
// when in doubt (status not recorded) a person is treated as living
assert.equal(f.persons.find((x) => x.name_roman === "Subodh Kumar Jha")!.status, undefined);

assert.equal(generations(f), 3);
assert.equal(generations(emptyFamily()), 1);
// no status but born over 100 years ago → not living; an explicit "living" always wins
const old = applyOps(emptyFamily(), [
  { op: "add_person", ref: "a", name_roman: "Old Person Jha", gender: "male", is_me: true },
  { op: "add_person", ref: "b", name_roman: "Born Long Ago Jha", gender: "male", relation: { type: "father_of", to: "a" } },
  { op: "update_person", id: "b", set: { birth: "1890", place: "Benipatti" } },
]).family;
const oldP = publicFamily(old, "private").persons.find((x) => x.name_roman.startsWith("Born"))!;
assert.equal(oldP.name_roman, "Born Long Ago Jha"); assert.equal(oldP.birth, "1890");
const forced = applyOps(old, [{ op: "update_person", id: "p2", set: { status: "living" } }]).family;
assert.equal(publicFamily(forced, "private").persons.find((x) => x.name_roman.startsWith("Born"))!.name_roman, "Born");
console.log("view tests passed");
