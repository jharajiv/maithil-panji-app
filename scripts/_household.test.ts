/** Household cards: which questions can be answered together, and that the people land exactly as the typed questions would put them. */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, labels, type DFamily } from "../src/lib/family";
import { nextGoal } from "../src/lib/interview";
import { applyHousehold, householdBundle } from "../src/lib/household";

const start = (gender: "male" | "female"): DFamily => {
  let f = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Rohan Jha", gender, is_me: true, status: "living" }], { panji: true }).family;
  // skip the opening questions until the first question about the family
  for (let i = 0; i < 40; i++) {
    const g = nextGoal(f)!;
    if (["brothers", "sisters", "wife", "sons", "daughters"].includes(g.kind)) break;
    f = applyOps(f, g.skip, { panji: true }).family;
  }
  return f;
};

(async () => {
  let f = start("male");
  // 1. brothers + sisters of the user come as one card
  let g = nextGoal(f)!; assert.equal(g.kind, "brothers");
  let b = householdBundle(f, g)!; assert.ok(b); assert.deepEqual(b.groups, ["brothers", "sisters"]); assert.equal(b.owner.isMe, true);
  let r = applyHousehold(f, b, [{ kind: "brothers", names: ["Mohan Jha", "Sohan"] }, { kind: "sisters", names: [] }]);
  f = r.family;
  assert.deepEqual(r.added.map((x) => x.name), ["Mohan Jha", "Sohan"]);
  assert.ok(r.added.every((x) => x.role === "your brother"), "role comes from the block");
  assert.deepEqual(r.lines, ["Brothers: Mohan Jha, Sohan", "Sisters: none"]);
  assert.match(r.reply, /^Added Mohan Jha and Sohan\./);
  assert.equal(f.persons.find((p) => p.name_roman === "Sohan")!.name_dev, "सोहन", "Devanagari spelling is filled in like the typed answer");
  // the sisters question is answered, so the interview does not ask it again
  assert.ok(!["brothers", "sisters"].includes(nextGoal(f)!.kind) || nextGoal(f)!.subjects[0] !== b.owner.id);

  // 2. the next question is the brothers' wives (one per brother): not a card
  g = nextGoal(f)!; assert.equal(g.kind, "wife"); assert.equal(householdBundle(f, g), null, "a single question stays a typed question");
  // let the typed path finish the brothers' wives
  while (g && g.section.startsWith("Step")) { f = applyOps(f, g.skip, { panji: true }).family; g = nextGoal(f)!; }

  // 3. the user's own household: wife + sons + daughters as one card
  assert.equal(g.kind, "wife"); b = householdBundle(f, g)!; assert.deepEqual(b.groups, ["wife", "sons", "daughters"]);
  r = applyHousehold(f, b, [{ kind: "wife", names: ["Sunita"] }, { kind: "sons", names: ["Aarav", "Aarav", "  Rohit  ", "12"] }, { kind: "daughters", names: [] }]);
  f = r.family;
  const lab = labels(f);
  assert.deepEqual(r.added.map((x) => `${x.name}:${x.role}`), ["Sunita:your wife", "Aarav:your son", "Rohit:your son"], "duplicates, blanks and numbers are left out");
  assert.equal(lab[f.persons.find((p) => p.name_roman === "Sunita")!.id], "your wife");
  // a wife is never recorded as a sibling or child
  const sunita = f.persons.find((p) => p.name_roman === "Sunita")!;
  assert.ok(f.rels.some((x) => x.type === "spouse_of" && [x.a, x.b].includes(sunita.id)));
  // the interview moves on to the sons' households, not back to the user's
  const nx = nextGoal(f)!; assert.notEqual(nx.subjects[0], b.owner.id);
  assert.ok(nx.subjects[0] === f.persons.find((p) => p.name_roman === "Aarav")!.id);

  // 4. "Yes" with no names given → asked and answered, nobody invented
  f = start("male");
  g = nextGoal(f)!; b = householdBundle(f, g)!;
  r = applyHousehold(f, b, [{ kind: "brothers", names: [], yesNoNames: true }, { kind: "sisters", names: ["Radha"] }]);
  assert.equal(r.added.length, 1); assert.equal(r.added[0]!.role, "your sister");
  assert.match(r.lines[0]!, /names not given/);

  // 5. a woman's own question list has no household card (her husband's family is his chart)
  const w = start("female");
  assert.ok(!householdBundle(w, nextGoal(w))?.groups.includes("wife"));

  // 6. a group already answered is left out of the card
  f = start("male"); g = nextGoal(f)!; b = householdBundle(f, g)!;
  f = applyHousehold(f, b, [{ kind: "brothers", names: [] }]).family; // only brothers answered
  const nxt = nextGoal(f)!; assert.equal(nxt.kind, "sisters"); assert.equal(householdBundle(f, nxt), null, "only sisters left → typed question");
  console.log("household OK");
})().catch((e) => { console.error(e); process.exit(1); });
