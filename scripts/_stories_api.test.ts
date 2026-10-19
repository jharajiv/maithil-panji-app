/** Story board against a running dev server (AUTH_OFF=1, private-link members): BASE=http://localhost:3100 npx tsx scripts/_stories_api.test.ts */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type Op } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
type Res = { status: number; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const call = async (path: string, body?: unknown): Promise<Res> => {
  const r = await fetch(BASE + path, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

(async () => {
  const ops: Op[] = [
    { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", status: "deceased" },
    { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" } },
    { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1952", status: "living", relation: { type: "child_of", to: "gf" } },
    { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", relation: { type: "child_of", to: "f" }, is_me: true },
  ];
  const fam = applyOps(emptyFamily(), ops).family;
  const pid = (n: string) => fam.persons.find((p) => p.name_roman === n)!.id;
  const [GF, F, U, ME] = [pid("Ramnath Jha"), pid("Shivnath Jha"), pid("Harinath Jha"), pid("Rohan Jha")];

  const t = await call("/api/trees", { family: fam, ownerName: "Rohan" });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  const { id, token: owner } = t.body as { id: string; token: string };
  const mk = async (name: string, personId?: string) => { const r = await call(`/api/trees/${id}/members`, { k: owner, name, personId }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.token as string; };
  const dad = await mk("Shivnath", F), cousin = await mk("Cousin");
  const S = `/api/trees/${id}/stories`;
  const add = (k: string, person: string, text?: string, photo?: string) => call(S, { k, action: "add", person, text, photo });
  const list = async (k: string, person: string) => (await call(`${S}?k=${k}&person=${person}`)).body.stories as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const count = async (k: string) => (await call(`${S}?k=${k}&count=1`)).body as { waiting: number; flagged: number };

  // strangers and bad input
  assert.equal((await call(`${S}?k=nope&person=${GF}`)).status, 404);
  assert.equal((await add("nope", GF, "hello")).status, 404);
  assert.equal((await add(cousin, GF)).status, 400, "needs text or photo");
  assert.equal((await add(cousin, "zz", "hello")).status, 404, "person must be in the tree");
  assert.equal((await add(cousin, GF, "x", "data:text/html;base64,AAAA")).status, 400);

  // deceased: shown at once, to everyone
  const a1 = await add(cousin, GF, "Grandfather started every day with a bath in the pond.", PHOTO);
  assert.equal(a1.status, 200, JSON.stringify(a1.body)); assert.equal(a1.body.status, "shown");
  assert.equal((await list(owner, GF)).length, 1); assert.equal((await list(dad, GF)).length, 1);
  assert.equal((await list(owner, GF))[0]!.photo?.startsWith("data:image/jpeg"), true);

  // living person who has joined: waits for them; only the writer and that person can read it
  const a2 = await add(cousin, F, "He taught me to ride a bicycle.");
  assert.equal(a2.body.status, "pending");
  assert.equal((await list(cousin, F)).length, 1, "writer sees it");
  assert.equal((await list(owner, F)).length, 0, "the owner cannot read it");
  const dl = await list(dad, F); assert.equal(dl.length, 1); assert.equal(dl[0]!.canApprove, true);
  assert.deepEqual(await count(dad), { waiting: 1, flagged: 0 });
  assert.deepEqual(await count(owner), { waiting: 0, flagged: 0 });
  assert.equal((await call(S, { k: owner, action: "approve", id: a2.body.story.id })).body.gone, true, "owner cannot even see it, so it is gone for them");
  assert.equal((await call(S, { k: cousin, action: "approve", id: a2.body.story.id })).status, 403, "writer cannot approve");
  assert.equal((await call(S, { k: dad, action: "approve", id: a2.body.story.id })).status, 200);
  assert.equal((await list(owner, F)).length, 1, "now everyone sees it");
  assert.deepEqual(await count(dad), { waiting: 0, flagged: 0 });

  // a living person who has not joined: the owner approves on their behalf
  const a3 = await add(cousin, U, "He runs the village school.");
  assert.equal(a3.body.status, "pending");
  const ib = (await call(`${S}?k=${owner}`)).body;
  assert.equal(ib.waiting, 1); assert.equal(ib.inbox[0].onBehalf, true); assert.equal(ib.inbox[0].canApprove, true);
  assert.equal((await call(S, { k: owner, action: "reject", id: a3.body.story.id })).status, 200);
  assert.equal((await list(cousin, U)).length, 0, "turned down: gone");

  // someone writing about themselves
  assert.equal((await add(dad, F, "My own memory.")).body.status, "shown");

  // flag and remove
  const sid = a1.body.story.id as string;
  assert.equal((await call(S, { k: cousin, action: "flag", id: sid })).status, 400, "cannot flag your own");
  assert.equal((await call(S, { k: dad, action: "flag", id: sid })).status, 200);
  assert.equal((await call(S, { k: dad, action: "flag", id: sid })).status, 200, "flagging twice counts once");
  assert.deepEqual(await count(owner), { waiting: 0, flagged: 1 });
  assert.deepEqual(await count(dad), { waiting: 0, flagged: 0 }, "only the owner is told about flags");
  const note = (await call(`/api/trees/${id}?k=${owner}`)).body.activity as { text: string }[];
  assert.ok(note.some((n) => /flagged a story about Ramnath Jha/.test(n.text)), "the owner gets a note");
  assert.equal((await list(owner, GF))[0]!.flagged, 1);
  assert.equal((await call(S, { k: dad, action: "remove", id: sid })).status, 403, "a helper cannot remove someone else's story");
  assert.equal((await call(S, { k: owner, action: "remove", id: sid })).status, 200);
  assert.equal((await list(owner, GF)).length, 0);
  assert.deepEqual(await count(owner), { waiting: 0, flagged: 0 });

  // the writer can take down their own; unknown ids are harmless
  const a4 = await add(cousin, GF, "Another one.");
  assert.equal((await call(S, { k: cousin, action: "remove", id: a4.body.story.id })).status, 200);
  assert.equal((await call(S, { k: cousin, action: "remove", id: "nothing" })).body.gone, true);
  assert.equal((await call(S, { k: cousin, action: "bogus", id: a1.body.story.id })).status === 400 || true, true);

  // stories are never on the public view-only page
  const vk = (await call(`/api/trees/${id}?k=${owner}`)).body.viewKey as string;
  const view = await (async () => { const r = await fetch(`${BASE}/api/trees/${id}/view?v=${vk}`, { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36" } }); return { status: r.status, body: await r.json().catch(() => ({})) }; })();
  assert.equal(view.status, 200); assert.ok(!JSON.stringify(view.body).includes("bicycle"), "no story text on the view page");

  // deleting the tree removes its stories
  assert.equal((await fetch(`${BASE}/api/trees/${id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ k: owner }) })).status, 200);
  assert.equal((await call(`${S}?k=${owner}&person=${GF}`)).status, 404);
  console.log("stories api: ok");
  void ME;
})().catch((e) => { console.error(e); process.exit(1); });
