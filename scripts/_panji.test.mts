import assert from "node:assert/strict";
import { applyOps, emptyFamily, childrenOf, parentsOf, spousesOf, normalizeCouples, type DFamily } from "../src/lib/family";
import { basicTurn } from "../src/lib/basic-turn";
import { nextGoal } from "../src/lib/interview";
import { autoLayout, BOX_W } from "../src/lib/freeform-layout";

/* 1. couples: a child recorded under one parent gets the parent's only spouse as second parent */
{
  let f = emptyFamily();
  f = applyOps(f, [{ op: "add_person", name_roman: "Rajiv Jha", gender: "male" }]).family;
  const me = f.persons[0]!.id;
  f = applyOps(f, [{ op: "add_person", name_roman: "Subodh", relation: { type: "father_of", to: me } }]).family;
  const dad = f.persons[1]!.id;
  f = applyOps(f, [{ op: "add_person", name_roman: "Sanjiv", gender: "male", relation: { type: "sibling_of", to: me } }]).family; // father only so far
  f = applyOps(f, [{ op: "add_person", name_roman: "Yogmaya", relation: { type: "mother_of", to: me } }]).family; // mother added AFTER the sibling
  const mom = f.persons.find((p) => p.name_roman === "Yogmaya")!.id;
  const sanjiv = f.persons.find((p) => p.name_roman === "Sanjiv")!.id;
  assert.ok(parentsOf(f, sanjiv).some((p) => p.id === mom), "Sanjiv must hang from the couple, not from his father alone");
  assert.equal(childrenOf(f, dad).length, 2);
  assert.equal(spousesOf(f, dad).length, 1);
  // old saved trees are fixed at render time too
  const old: DFamily = { ...f, rels: f.rels.filter((r) => !(r.type === "parent_of" && r.a === mom && r.b === sanjiv)) };
  assert.ok(normalizeCouples(old).rels.some((r) => r.type === "parent_of" && r.a === mom && r.b === sanjiv));
  // two wives: leave it alone (we cannot tell)
  const two = applyOps(f, [{ op: "add_person", name_roman: "Second Wife", relation: { type: "spouse_of", to: dad } }]).family;
  const kid = applyOps(two, [{ op: "add_person", name_roman: "Kid", relation: { type: "child_of", to: dad } }]);
  assert.equal(parentsOf(kid.family, kid.results[0]!.id!).length, 1);
}

/* 2. Panji guard: nothing is recorded under a sister/daughter */
{
  let f = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Me", gender: "male" }]).family;
  f = applyOps(f, [{ op: "add_person", name_roman: "Sita", gender: "female", relation: { type: "sibling_of", to: "p1" } }], { panji: true }).family;
  const sita = f.persons.find((p) => p.name_roman === "Sita")!.id;
  const r = applyOps(f, [
    { op: "add_person", name_roman: "Her Husband", relation: { type: "spouse_of", to: sita } },
    { op: "add_person", name_roman: "Her Son", relation: { type: "child_of", to: sita } },
  ], { panji: true });
  assert.ok(r.results.every((x) => !x.ok), "husband and children of a sister are refused in the interview");
  assert.equal(r.family.persons.length, f.persons.length);
  // …but allowed when the user edits by hand
  const manual = applyOps(f, [{ op: "add_person", name_roman: "Her Husband", relation: { type: "spouse_of", to: sita } }]);
  assert.ok(manual.results[0]!.ok);
  // a son's wife: her child goes under the husband and both are parents
  let g = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Me", gender: "male" }]).family;
  g = applyOps(g, [{ op: "add_person", name_roman: "Wife", gender: "female", relation: { type: "spouse_of", to: "p1" } }], { panji: true }).family;
  const wife = g.persons[1]!.id;
  const k = applyOps(g, [{ op: "add_person", name_roman: "Kid", relation: { type: "child_of", to: wife } }], { panji: true });
  assert.ok(k.results[0]!.ok);
  assert.equal(parentsOf(k.family, k.results[0]!.id!).length, 2);
}

/* 3. the interview goes BACKWARDS first, never asks about in-laws or daughters' families */
{
  const script: [RegExp, string][] = [
    [/full name/, "Rajiv Jha"], [/male or female/, "male"], [/gotra/, "skip"], [/mool/, "skip"], [/date of birth/, "skip"], [/where do you live/, "skip"],
    [/father’s name/, "Subodh Narayan Jha"],
    [/mother’s name/, "Yogmaya"],
    [/Subodh.*living/, "late, 1956 to 2017"],
    [/father of Subodh|Subodh.s father/, "Harinath Jha"],
    [/Subodh.s mother/, "skip"],
    [/Harinath.*living/, "skip"],
    [/Harinath.s father/, "I don’t know any further"],
    [/^Do you have brothers/, "Sanjiv"],
    [/^Do you have sisters/, "Sharda"],
    [/Sanjiv.*married|married.*Sanjiv/, "Pooja"],
    [/Are you married/, "Divya"],
  ];
  let f = emptyFamily(); let goalId: string | undefined; let repeats = 0;
  let q = "Let’s begin with you. What is your full name?";
  const asked: string[] = [];
  for (let i = 0; i < 80; i++) {
    const g = nextGoal(f, { batch: false });
    if (!g) break;
    asked.push(g.question);
    const hit = script.find(([rx]) => rx.test(g.question));
    const ans = hit ? hit[1] : g.kind === "sons" || g.kind === "daughters" ? "none" : "skip";
    const out = await basicTurn({ family: f, history: [], text: ans, prevGoalId: goalId, repeats });
    f = out.family; goalId = out.goal?.id; repeats = out.repeats; q = out.reply;
  }
  const idx = (rx: RegExp) => asked.findIndex((x) => rx.test(x));
  assert.ok(idx(/Harinath.s father/) >= 0, "asks for the grandfather's father");
  assert.ok(idx(/Harinath.s father/) < idx(/^Do you have brothers/), "ancestors come BEFORE brothers and sisters");
  assert.ok(idx(/Harinath.s father/) < idx(/Are you married/), "ancestors come BEFORE your own household");
  assert.ok(!asked.some((x) => /Sharda.*(children|sons|daughters)/.test(x) || /whom Sharda.*(son|child)/.test(x)), "no questions about a sister's children");
  assert.ok(asked.some((x) => /Sanjiv.*married/.test(x)), "a brother's wife is asked");
  console.log(asked.map((x, i) => `${i + 1}. ${x}`).join("\n"));
}
console.log("panji tests passed");

/* 4. free-form editor: link / unlink, cycles, two-parent limit, layout */
{
  let f = emptyFamily();
  for (const n of ["A", "B", "C", "D"]) f = applyOps(f, [{ op: "add_person", name_roman: n, gender: n === "B" ? "female" : "male" }]).family;
  const [A, B, C, D] = f.persons.map((p) => p.id) as [string, string, string, string];
  assert.ok(applyOps(f, [{ op: "link", type: "parent_of", a: A, b: C }]).results[0]!.ok);
  f = applyOps(f, [{ op: "link", type: "parent_of", a: A, b: C }]).family;
  // child hangs from the pair once the second parent is linked
  f = applyOps(f, [{ op: "link", type: "spouse_of", a: A, b: B }]).family;
  assert.equal(parentsOf(f, C).length, 2, "the only spouse becomes the second parent automatically");
  assert.ok(!applyOps(f, [{ op: "link", type: "parent_of", a: C, b: A }]).results[0]!.ok, "no cycles");
  assert.ok(!applyOps(f, [{ op: "link", type: "parent_of", a: D, b: C }]).results[0]!.ok, "a child cannot have three parents");
  assert.ok(!applyOps(f, [{ op: "link", type: "spouse_of", a: B, b: A }]).results[0]!.ok, "no duplicate couple");
  // removing a parent link stays removed
  const un = applyOps(f, [{ op: "unlink", type: "parent_of", a: B, b: C }]).family;
  assert.equal(parentsOf(un, C).length, 1);
  assert.equal(parentsOf(normalizeCouples(un), C).length, 1, "a deliberate unlink is not undone");
  // connecting works in both directions: "C is a child of D" == parent_of D→C is refused only by the two-parent rule
  const lay = autoLayout(f);
  assert.ok(lay.get(C)!.y > lay.get(A)!.y);
  assert.ok(Math.abs(lay.get(B)!.x - lay.get(A)!.x) >= BOX_W);
  assert.ok(lay.get(D)!.y > lay.get(C)!.y, "unconnected people get a row of their own below the family");
}
console.log("free-form tests passed");
