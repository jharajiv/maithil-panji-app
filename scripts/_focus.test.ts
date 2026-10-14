/** What the AI sees of a big tree: full detail near the question, one short line for everyone else, never the whole tree twice. */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type DFamily, type Op } from "../src/lib/family";
import { describeFamily, focusIds, FULL_BELOW, nextGoal } from "../src/lib/interview";
import { runTurn } from "../src/lib/agent";

/** a realistic tree: you, parents, grandparents, 3 uncles with wives and children, brothers, your wife and children — with births, places, gotra */
function bigTree(): DFamily {
  const ops: Op[] = [
    { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1985-03-14", place: "Madhubani, Bihar", gotra: { id: "g1", roman: "Shandilya" }, mool: { roman: "Sarisaba" } },
    { op: "add_person", ref: "f", name_roman: "Subodh Jha", gender: "male", birth: "1955", place: "Madhubani, Bihar", relation: { type: "father_of", to: "me" } },
    { op: "add_person", ref: "m", name_roman: "Yogmaya Devi", gender: "female", birth: "1960", place: "Darbhanga, Bihar", relation: { type: "mother_of", to: "me" } },
    { op: "add_person", ref: "gf", name_roman: "Harinath Jha", gender: "male", status: "deceased", death: "1999", relation: { type: "father_of", to: "f" } },
    { op: "add_person", ref: "gm", name_roman: "Kamla Devi", gender: "female", status: "deceased", death: "2005", relation: { type: "mother_of", to: "f" } },
  ];
  for (let i = 1; i <= 3; i++) {
    ops.push({ op: "add_person", ref: `u${i}`, name_roman: `Uncle${i} Jha`, gender: "male", birth: `${1950 + i}`, place: "Madhubani, Bihar", relation: { type: "sibling_of", to: "f" } });
    ops.push({ op: "add_person", ref: `a${i}`, name_roman: `Aunt${i} Devi`, gender: "female", relation: { type: "spouse_of", to: `u${i}` } });
    for (let k = 1; k <= 3; k++) ops.push({ op: "add_person", name_roman: `Cousin${i}${k} Jha`, gender: k % 2 ? "male" : "female", birth: `${1980 + k}-0${k}-1${k}`, place: "Delhi", relation: { type: "child_of", to: `u${i}` } });
  }
  for (let i = 1; i <= 3; i++) ops.push({ op: "add_person", name_roman: `Brother${i} Jha`, gender: "male", birth: `${1980 + i}`, relation: { type: "sibling_of", to: "me" } });
  ops.push({ op: "add_person", ref: "w", name_roman: "Meera Jha", gender: "female", birth: "1990-10-19", gotra: { id: "g2", roman: "Kashyap" }, relation: { type: "spouse_of", to: "me" } });
  for (let i = 1; i <= 3; i++) ops.push({ op: "add_person", name_roman: `Child${i} Jha`, gender: i % 2 ? "male" : "female", birth: `201${i}-05-0${i}`, relation: { type: "child_of", to: "me" } });
  // a lot more cousins' children and distant relatives so the tree is about 60
  for (let i = 1; i <= 12; i++) ops.push({ op: "add_person", name_roman: `Distant${i} Jha`, gender: i % 2 ? "male" : "female", birth: `19${50 + i}`, place: "Patna", relation: { type: "sibling_of", to: "gf" } });
  return applyOps(emptyFamily(), ops).family;
}

(async () => {
  const f = bigTree();
  assert.ok(f.persons.length >= 40, `tree has ${f.persons.length} people`);
  const goal = nextGoal(f);
  const full = describeFamily(f);
  const focus = focusIds(f, [goal]);
  const view = describeFamily(f, focus);
  // what it used to be: gotra and mool written on every person of the line (before v11.13)
  const inherited = f.persons.filter((p) => p.gotra?.roman === "Shandilya").length;
  const before = full.length + inherited * ", gotra:Shandilya, mool:Sarisaba".length;
  console.log(`people ${f.persons.length}; before ${before} chars; now ${view.length} chars (${Math.round(100 - (view.length / before) * 100)}% smaller); in full detail: ${focus.size}; ${inherited} people inherit the gotra`);
  assert.ok(view.length < before * 0.7, "a big tree is clearly shorter");
  // everyone is still listed (so nobody is added twice), each with the relation
  // gotra and mool: the app passes them down the father's line, so they are said once at the top; only a person who differs (the wife) is marked
  assert.equal(f.persons.filter((p) => p.gotra?.roman === "Shandilya").length > 10, true, "the line inherits the gotra");
  assert.equal((view.match(/Shandilya/g) ?? []).length, 1, "the family gotra is written once");
  assert.equal((view.match(/Sarisaba/g) ?? []).length, 1, "the family mool is written once");
  assert.match(view, /\[id g1\]/);
  assert.match(view, /Meera Jha[^\n]*gotra:Kashyap/, "a wife with her own gotra is marked");
  const lines = view.split("\n").slice(1); // the first line is the family gotra / mool
  assert.match(view.split("\n")[0]!, /^FAMILY GOTRA/);
  assert.equal(lines.length, f.persons.length);
  for (const p of f.persons) assert.ok(lines.some((l) => l.startsWith(`${p.id} ${p.name_roman}`)), `${p.name_roman} is listed`);
  // the user and the user's close family are in full detail, a distant relative is a short line
  const me = f.persons.find((p) => p.is_me)!;
  const father = f.persons.find((p) => p.name_roman === "Subodh Jha")!, far = f.persons.find((p) => p.name_roman === "Distant5 Jha")!, cousin = f.persons.find((p) => p.name_roman === "Cousin23 Jha")!;
  assert.ok(focus.has(me.id) && focus.has(father.id)); assert.ok(!focus.has(far.id) && !focus.has(cousin.id));
  const line = (id: string) => lines.find((l) => l.startsWith(id + " "))!;
  assert.match(line(father.id), /b\.1955/); assert.ok(!/b\.|place:/.test(line(far.id)), "a distant relative is one short line");
  // the answer to a change carries only the people near the next question
  const only = describeFamily(f, focus, true);
  assert.equal(only.split("\n").length, focus.size); assert.ok(only.length < view.length / 2);

  // a small tree is described exactly as before
  const small = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Me", gender: "male" }, { op: "add_person", name_roman: "Dad", gender: "male", relation: { type: "father_of", to: "p1" } }]).family;
  assert.ok(small.persons.length <= FULL_BELOW);
  assert.equal(describeFamily(small, focusIds(small, [nextGoal(small)])), describeFamily(small));
  assert.equal(describeFamily(small, focusIds(small, [nextGoal(small)]), true), describeFamily(small));

  // end to end: what the model is actually sent for one turn of a big tree, before and after
  const seen: string[] = [];
  const reply = (name: string, input: unknown, id: string) => ({ content: [{ type: "tool_use", id, name, input }], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } });
  let step = 0;
  const client = { messages: { create: async (p: { system: { text: string }[]; messages: unknown[] }) => {
    seen.push(JSON.stringify(p.system) + JSON.stringify(p.messages));
    step++;
    return step === 1 ? reply("update_family", { ops: [{ op: "set_flag", id: me.id, flag: "gotra", value: "unknown" }] }, "t1") : reply("say", { message: "Thank you. Which is your mool?", quick_replies: [] }, "t2");
  } } } as never;
  const g = nextGoal(f);
  const out = await runTurn({ client, model: "x", used: { calls: 0 } }, { family: f, history: [], text: "skip", repeats: 0 });
  assert.ok(out.reply);
  const sent = seen.reduce((n, s) => n + s.length, 0);
  console.log(`one turn, ${seen.length} calls, ${sent} characters sent (goal ${g?.id})`);
  const tree = describeFamily(f).length;
  assert.ok(sent < tree * 2 + 30000, "the tree is not sent in full again and again");
  // after the change the second call must not contain the whole tree a second time
  assert.ok((seen[1]!.match(/Distant5 Jha/g) ?? []).length <= 1, "a distant relative appears once in the second call");
  console.log("focus OK");
})().catch((e) => { console.error(e); process.exit(1); });
