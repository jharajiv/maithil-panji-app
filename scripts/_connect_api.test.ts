/** Two trees, one woman: BASE=http://localhost:3100 AUTH_OFF=1 npx tsx scripts/_connect_api.test.ts */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type Op } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
const j = async (path: string, init?: RequestInit) => { const r = await fetch(BASE + path, init); return { status: r.status, body: await r.json() as Record<string, any> }; }; // eslint-disable-line @typescript-eslint/no-explicit-any
const post = (path: string, body: unknown, method = "POST") => j(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const fam = (ops: Op[]) => applyOps(emptyFamily(), ops).family;

(async () => {
  const run = Math.random().toString(36).slice(2, 6);
  const sita = `Sita${run.replace(/[0-9]/g, "")}x`.slice(0, 5); // distinct per run so old test data never matches
  const A = fam([
    { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1988-02-10", status: "living", gotra: { roman: "Shandilya" } },
    { op: "add_person", ref: "w", name_roman: `${sita} Devi`, gender: "female", birth: "1992-05-01", status: "living", gotra: { roman: "Kashyap" }, relation: { type: "spouse_of", to: "me" } },
    { op: "add_person", name_roman: "Aarav", gender: "male", birth: "2018-01-01", status: "living", relation: { type: "child_of", to: "me", to2: "w" } },
  ]);
  const B = fam([
    { op: "add_person", ref: "me", name_roman: "Mohan Mishra", gender: "male", birth: "1960-01-01", status: "living", gotra: { roman: "Kashyap" } },
    { op: "add_person", name_roman: sita, gender: "female", birth: "1992-06-01", status: "living", married_to: "Rohan Jha, Sarisab", relation: { type: "child_of", to: "me" } },
  ]);
  const ca = await post("/api/trees", { family: A, ownerName: "Rohan" }); assert.equal(ca.status, 200);
  const cb = await post("/api/trees", { family: B, ownerName: "Mohan" }); assert.equal(cb.status, 200);
  const [a, b] = [ca.body as { id: string; token: string }, cb.body as { id: string; token: string }];
  const wifeId = A.persons.find((p) => p.name_roman.endsWith("Devi"))!.id;
  const dauId = B.persons.find((p) => p.name_roman === sita)!.id;

  // nobody has switched sharing on: no matches, and no peeking
  assert.deepEqual((await j(`/api/trees/${a.id}/matches?k=${a.token}`)).body, { on: false, women: 1, matches: [] });
  assert.equal((await j(`/api/trees/${a.id}/preview?k=${a.token}&person=${wifeId}&tree=${b.id}&p=${dauId}`)).status, 404);
  assert.equal((await post(`/api/trees/${a.id}/links`, { k: a.token, person: wifeId, tree: b.id, p: dauId })).status, 404);

  // only the owner can switch it on
  const inv = await post(`/api/trees/${a.id}/members`, { k: a.token, name: "Vikram" }); const helper = inv.body.token as string;
  assert.equal((await post(`/api/trees/${a.id}/settings`, { k: helper, discoverable: true })).status, 403);
  assert.equal((await post(`/api/trees/${a.id}/settings`, { k: a.token, discoverable: true })).status, 200);
  // A is on but B is not → still nothing (you see others only if they agreed too)
  assert.equal((await j(`/api/trees/${a.id}/matches?k=${a.token}`)).body.matches.length, 0);
  assert.equal((await post(`/api/trees/${b.id}/settings`, { k: b.token, discoverable: true })).status, 200);

  const ma = await j(`/api/trees/${a.id}/matches?k=${a.token}`);
  assert.equal(ma.body.on, true); assert.equal(ma.body.matches.length, 1, JSON.stringify(ma.body));
  const m = ma.body.matches[0];
  assert.equal(m.tree, b.id); assert.equal(m.treePerson, dauId); assert.equal(m.strength, "strong");
  const mb = await j(`/api/trees/${b.id}/matches?k=${b.token}`);
  assert.equal(mb.body.matches[0]?.tree, a.id, "found from the other side too");
  assert.equal((await j(`/api/trees/${a.id}/matches?k=wrong`)).status, 404);

  // preview: her connections in the other tree; living people by first name only
  const pv = await j(`/api/trees/${a.id}/preview?k=${a.token}&person=${wifeId}&tree=${b.id}&p=${dauId}`);
  assert.equal(pv.status, 200);
  assert.ok(pv.body.preview.connects.some((c: { relation: string; name: string }) => c.relation === "father" && c.name === "Mohan"));
  assert.ok(!JSON.stringify(pv.body).includes("Mishra"));
  // a pair that is not a match cannot be previewed
  assert.equal((await j(`/api/trees/${a.id}/preview?k=${a.token}&person=${wifeId}&tree=${b.id}&p=p1`)).status, 404);

  // a helper confirms: both women are linked, the owner is told
  const lk = await post(`/api/trees/${a.id}/links`, { k: helper, person: wifeId, tree: b.id, p: dauId });
  assert.equal(lk.status, 200);
  const ga = await j(`/api/trees/${a.id}?k=${a.token}`), gb = await j(`/api/trees/${b.id}?k=${b.token}`);
  assert.equal(ga.body.family.persons.find((p: { id: string }) => p.id === wifeId).links[0].tree, b.id);
  assert.equal(gb.body.family.persons.find((p: { id: string }) => p.id === dauId).links[0].tree, a.id);
  assert.match(ga.body.activity.at(-1).text, /Vikram linked/);
  assert.match(gb.body.activity.at(-1).text, /Another family tree linked/);
  assert.equal(ga.body.discoverable, true);
  assert.equal(ga.body.activity !== undefined && (await j(`/api/trees/${a.id}?k=${helper}`)).body.activity, undefined, "helpers do not see the owner's notes");
  // linked women are not offered again, but the linked tree can still be viewed
  assert.equal((await j(`/api/trees/${a.id}/matches?k=${a.token}`)).body.matches.length, 0);
  assert.equal((await j(`/api/trees/${a.id}/preview?k=${a.token}&person=${wifeId}&tree=${b.id}&p=${dauId}`)).status, 200);

  // the bridge: from A one may open B's tree read-only (living people by first name only); not without a key, not for a tree one is not linked to
  {
    const br = await j(`/api/trees/${a.id}/bridge?k=${a.token}&to=${b.id}`);
    assert.equal(br.status, 200);
    assert.equal(br.body.focus, dauId, "points at the linked woman");
    assert.equal(br.body.mode, "private");
    assert.ok(br.body.family.persons.length >= 2 && br.body.family.persons.every((p: { whatsapp?: string; notes?: string; links?: unknown }) => !p.whatsapp && !p.notes && !p.links));
    assert.ok(!JSON.stringify(br.body.family).includes("Mishra"), "living relatives by first name only");
    assert.equal((await j(`/api/trees/${a.id}/bridge?to=${b.id}`)).status, 404, "needs a key");
    assert.equal((await j(`/api/trees/${a.id}/bridge?k=${helper}&to=${b.id}`)).status, 200, "a helper of the tree may cross too");
    assert.equal((await j(`/api/trees/${a.id}/bridge?k=${a.token}&to=nope`)).status, 404);
    assert.equal((await j(`/api/trees/${a.id}/bridge?k=${a.token}&to=${a.id}`)).status, 404, "not to itself");
    assert.equal((await j(`/api/trees/${b.id}/bridge?k=${a.token}&to=${a.id}`)).status, 404, "a key of one tree opens nothing of another");
    assert.equal((await j(`/api/trees/${b.id}/bridge?k=${b.token}&to=${a.id}`)).status, 200, "and back again");
  }

  // a client cannot write or erase links through the normal save
  const forged = structuredClone(ga.body.family); forged.persons[0].links = [{ tree: "zzz", person: "p1", at: "2026-01-01" }];
  forged.persons.find((p: { id: string }) => p.id === wifeId).links = [];
  const put = await post(`/api/trees/${a.id}`, { k: a.token, baseRev: ga.body.rev, family: forged }, "PUT"); assert.equal(put.status, 200);
  const after = (await j(`/api/trees/${a.id}?k=${a.token}`)).body.family;
  assert.equal(after.persons[0].links, undefined);
  assert.equal(after.persons.find((p: { id: string }) => p.id === wifeId).links.length, 1);

  // unlink (either side's member), then she is offered again
  assert.equal((await post(`/api/trees/${a.id}/links`, { k: a.token, person: wifeId, tree: b.id }, "DELETE")).status, 200);
  const ua = (await j(`/api/trees/${a.id}?k=${a.token}`)).body, ub = (await j(`/api/trees/${b.id}?k=${b.token}`)).body;
  assert.equal(ua.family.persons.find((p: { id: string }) => p.id === wifeId).links, undefined);
  assert.equal(ub.family.persons.find((p: { id: string }) => p.id === dauId).links, undefined);
  assert.equal((await j(`/api/trees/${a.id}/matches?k=${a.token}`)).body.matches.length, 1);
  assert.equal((await j(`/api/trees/${a.id}/bridge?k=${a.token}&to=${b.id}`)).status, 404, "no link, no bridge");
  // switching sharing off hides the tree again
  assert.equal((await post(`/api/trees/${b.id}/settings`, { k: b.token, discoverable: false })).status, 200);
  assert.equal((await j(`/api/trees/${a.id}/matches?k=${a.token}`)).body.matches.length, 0);

  // corrections suggested by a viewer
  {
    const vk = (await j(`/api/trees/${a.id}?k=${a.token}`)).body.viewKey as string;
    const me = A.persons[0]!.id;
    const sug = (b: Record<string, unknown>) => post(`/api/trees/${a.id}/suggest`, { v: vk, person: me, ...b });
    assert.equal((await post(`/api/trees/${a.id}/suggest`, { v: "bad", person: me, field: "birth", value: "1960" })).status, 404, "needs a valid view link");
    assert.equal((await sug({ field: "nonsense", value: "x" })).status, 400);
    assert.equal((await sug({ field: "birth", value: "" })).status, 400);
    assert.equal((await sug({ field: "other", value: "see http://spam.example" })).status, 400, "no links");
    assert.equal((await post(`/api/trees/${a.id}/suggest`, { v: vk, person: "p999", field: "birth", value: "1960" })).status, 404);
    assert.equal((await sug({ field: "birth", value: "14 March 1990", from_name: "Aunt" })).status, 200);
    assert.equal((await sug({ field: "mool", value: "Sarisab", note: "I think it is Sarisab" })).status, 200);
    assert.equal((await sug({ field: "name", value: "Rohan Kumar Jha" })).status, 200);
    assert.equal((await j(`/api/trees/${a.id}/suggestions`)).status, 404, "inbox needs a key");
    const inbox = (await j(`/api/trees/${a.id}/suggestions?k=${a.token}`)).body.suggestions as { id: string; field: string; canApply: boolean }[];
    assert.equal(inbox.length, 3);
    assert.deepEqual(inbox.map((x) => [x.field, x.canApply]).sort(), [["birth", true], ["mool", false], ["name", true]]);
    assert.equal((await j(`/api/trees/${a.id}/suggestions?k=${helper}`)).body.suggestions.length, 3, "helpers see the inbox too");
    const byField = (f: string) => inbox.find((x) => x.field === f)!.id;
    assert.equal((await post(`/api/trees/${a.id}/suggestions`, { k: a.token, id: byField("mool"), action: "apply" })).status, 400, "mool is changed by hand");
    assert.equal((await post(`/api/trees/${a.id}/suggestions`, { k: helper, id: byField("birth"), action: "apply" })).status, 200);
    const after = (await j(`/api/trees/${a.id}?k=${a.token}`)).body.family.persons[0];
    assert.equal(after.birth, "1990-03-14"); assert.equal(after.links, undefined);
    assert.equal((await post(`/api/trees/${a.id}/suggestions`, { k: a.token, id: byField("name"), action: "dismiss" })).status, 200);
    assert.equal((await post(`/api/trees/${a.id}/suggestions`, { k: a.token, id: byField("mool"), action: "done" })).status, 200);
    assert.equal((await j(`/api/trees/${a.id}/suggestions?k=${a.token}`)).body.suggestions.length, 0);
    assert.equal((await j(`/api/trees/${a.id}?k=${a.token}`)).body.family.persons[0].name_roman, "Rohan Jha", "dismissed means unchanged");
  }

  await post(`/api/trees/${a.id}`, { k: a.token }, "DELETE"); await post(`/api/trees/${b.id}`, { k: b.token }, "DELETE");
  console.log("connect api ok");
})().catch((e) => { console.error(e); process.exit(1); });
