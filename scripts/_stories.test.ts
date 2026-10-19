/** Story board rules (no server): npx tsx scripts/_stories.test.ts */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type Op } from "../src/lib/family";
import { approverOf, canApprove, canRemove, canSee, cleanStory, startStatus, storyView, type Story } from "../src/lib/stories";
import type { Member } from "../src/lib/store";

const ops: Op[] = [
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", status: "deceased" },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", relation: { type: "child_of", to: "f" }, is_me: true },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1952", status: "living", relation: { type: "child_of", to: "gf" } },
];
const family = applyOps(emptyFamily(), ops).family;
const id = (n: string) => family.persons.find((p) => p.name_roman === n)!.id;
const [GF, F, ME, U] = [id("Ramnath Jha"), id("Shivnath Jha"), id("Rohan Jha"), id("Harinath Jha")];
const person = (pid: string) => family.persons.find((p) => p.id === pid)!;

const owner: Member = { id: "m-owner", name: "Rohan", role: "owner", person_id: ME, created_at: "", status: "joined" };
const dad: Member = { id: "m-dad", name: "Shivnath", role: "editor", person_id: F, created_at: "", status: "joined" };
const uncleInvited: Member = { id: "m-unc", name: "Harinath", role: "editor", person_id: U, created_at: "", status: "invited" };
const cousin: Member = { id: "m-cou", name: "Cousin", role: "editor", created_at: "", status: "joined" };
const row = { members: [owner, dad, uncleInvited, cousin], family };
const story = (o: Partial<Story>): Story => ({ id: "s1", tree_id: "t", person_id: GF, by_member: cousin.id, by_name: "Cousin", created_at: "2026-10-01T00:00:00Z", status: "shown", flags: [], text: "x", ...o });

// cleaning
assert.deepEqual(cleanStory({}), { ok: false, error: "Please choose a person." });
assert.equal(cleanStory({ person: "p1", text: "  " }).ok, false, "empty");
const c1 = cleanStory({ person: "p1", text: "  He <b>loved</b>   mangoes  " });
assert.ok(c1.ok && c1.text === "He b loved /b mangoes", JSON.stringify(c1));
assert.equal(cleanStory({ person: "p1", photo: "data:text/html;base64,AAAA" }).ok, false, "only pictures");
assert.equal(cleanStory({ person: "p1", photo: "data:image/jpeg;base64," + "A".repeat(80_000) }).ok, false, "too large");
assert.ok(cleanStory({ person: "p1", photo: "data:image/jpeg;base64,AAAA" }).ok);
assert.equal((cleanStory({ person: "p1", text: "a".repeat(2000) }) as { text: string }).text.length, 800);

// who approves
assert.equal(approverOf(row, person(F))?.member.id, dad.id, "a living person who joined approves for themselves");
assert.equal(approverOf(row, person(F))?.onBehalf, false);
assert.equal(approverOf(row, person(U))?.member.id, owner.id, "invited but not joined → owner, on behalf");
assert.equal(approverOf(row, person(U))?.onBehalf, true);
assert.equal(approverOf(row, person(GF))?.member.id, owner.id, "deceased → owner moderates");
assert.equal(approverOf(row, person(GF))?.onBehalf, false);

// first status
assert.equal(startStatus(person(GF), cousin), "shown", "deceased: at once");
assert.equal(startStatus(person(F), cousin), "pending", "living: waits");
assert.equal(startStatus(person(F), dad), "shown", "a person writing about themselves");
assert.equal(startStatus(person(U), owner), "pending", "even the owner waits for someone who has not joined");

// seeing and approving
const pend = story({ person_id: F, status: "pending" });
assert.ok(canSee(row, cousin, pend), "the writer sees it");
assert.ok(canSee(row, dad, pend), "the person sees it");
assert.ok(!canSee(row, owner, pend), "the owner does not read a waiting story about someone who has joined");
assert.ok(canApprove(row, dad, pend)); assert.ok(!canApprove(row, owner, pend)); assert.ok(!canApprove(row, cousin, pend));
const pendU = story({ person_id: U, status: "pending" });
assert.ok(canApprove(row, owner, pendU) && canSee(row, owner, pendU), "owner acts for someone who has not joined");
assert.ok(!canApprove(row, owner, story({ status: "shown" })), "nothing to approve once shown");

// removing
assert.ok(canRemove(row, owner, story({})), "owner removes anything");
assert.ok(canRemove(row, cousin, story({})), "the writer removes their own");
assert.ok(!canRemove(row, dad, story({ person_id: GF })), "a helper cannot remove someone else's story about the deceased");
assert.ok(canRemove(row, dad, story({ person_id: F })), "a living person removes stories about themselves");

// the view
const v = storyView(row, cousin, story({ person_id: F, status: "pending" }));
assert.equal(v.waitingFor, "Shivnath"); assert.equal(v.canApprove, false); assert.equal(v.mine, true); assert.equal(v.canFlag, false);
const v2 = storyView(row, dad, story({ flags: ["m-owner"] }));
assert.equal(v2.canFlag, true); assert.equal(v2.flagged, 1); assert.equal(v2.flaggedByMe, false);
console.log("stories rules: ok");
