/** "My connections" against a running DEV server (accounts on, dev code): BASE=http://localhost:3100 npx tsx scripts/_connections_api.test.ts */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type Op } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
type Res = { status: number; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
class Client {
  cookie = "";
  async call(path: string, method = "GET", body?: unknown): Promise<Res> {
    const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get("set-cookie");
    if (sc) { const v = sc.split(";")[0]!; this.cookie = v.endsWith("=") ? "" : v; }
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  async signIn(email: string, name: string, phone: string) {
    const s = await this.call("/api/auth/start", "POST", { email });
    const v = await this.call("/api/auth/verify", "POST", { email, code: s.body.devCode, name, phone, consent: true });
    assert.equal(v.status, 200, JSON.stringify(v.body));
  }
}
const fam = (ops: Op[]) => applyOps(emptyFamily(), ops).family;

(async () => {
  const t = String(Date.now()).slice(-8);
  const letters = t.replace(/\d/g, (d) => "abcdefghij"[Number(d)]!);
  const wife = `Sita${letters}`;
  const a = new Client(), b = new Client(), c = new Client(), anon = new Client();
  await a.signIn(`rohan.${t}@example.com`, "Rohan Jha", `+9198${t}`);
  await b.signIn(`mohan.${t}@example.com`, "Mohan Mishra", `+9197${t}`);
  await c.signIn(`lone.${t}@example.com`, "Lone Singh", `+9196${t}`);

  const A = fam([
    { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", status: "deceased", gotra: { roman: "Shandilya" }, mool: { roman: "Sarisab" } },
    { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980-02-10", status: "living", relation: { type: "child_of", to: "gf" } },
    { op: "add_person", ref: "w", name_roman: `${wife} Devi`, gender: "female", birth: "1985-05-01", status: "living", gotra: { roman: "Kashyap" }, relation: { type: "spouse_of", to: "me" } },
  ]);
  const B = fam([
    { op: "add_person", ref: "gf", name_roman: "Bhola Mishra", gender: "male", birth: "1925", status: "deceased", gotra: { roman: "Kashyap" }, mool: { roman: "Pandaul" } },
    { op: "add_person", ref: "me", name_roman: "Mohan Mishra", gender: "male", birth: "1955-01-01", status: "living", relation: { type: "child_of", to: "gf" } },
    { op: "add_person", name_roman: wife, gender: "female", birth: "1985-06-01", status: "living", married_to: "Rohan Jha, Sarisab", relation: { type: "child_of", to: "me" } },
    { op: "add_person", name_roman: "Anil Mishra", gender: "male", birth: "1982-03-03", status: "living", relation: { type: "child_of", to: "me" } },
  ]);
  const C = fam([{ op: "add_person", name_roman: "Lone Singh", gender: "male", status: "living" }]);
  const ia = (await a.call("/api/trees", "POST", { family: A })).body.id as string;
  const ib = (await b.call("/api/trees", "POST", { family: B })).body.id as string;
  const ic = (await c.call("/api/trees", "POST", { family: C })).body.id as string;

  assert.equal((await anon.call("/api/me/connections")).status, 401);
  // not switched on → nothing, and the page says so
  let r = await a.call("/api/me/connections");
  assert.equal(r.status, 200); assert.equal(r.body.on, false); assert.deepEqual(r.body.people, []);

  for (const [cl, id] of [[a, ia], [b, ib], [c, ic]] as const) assert.equal((await cl.call(`/api/trees/${id}/settings`, "POST", { discoverable: true })).status, 200);
  r = await a.call("/api/me/connections?fresh=1");
  assert.equal(r.body.on, true); assert.deepEqual(r.body.people, [], "nothing linked yet");

  // link the woman (what the matches page does)
  const wid = (await a.call(`/api/trees/${ia}`)).body.family.persons.find((p: { name_roman: string }) => p.name_roman.endsWith("Devi")).id as string;
  const mm = await a.call(`/api/trees/${ia}/matches`);
  const m = mm.body.matches.find((x: { tree: string }) => x.tree === ib);
  assert.ok(m, JSON.stringify(mm.body));
  assert.equal((await a.call(`/api/trees/${ia}/links`, "POST", { person: wid, tree: ib, p: m.treePerson })).status, 200);

  r = await a.call("/api/me/connections?fresh=1");
  assert.equal(r.status, 200); assert.ok(r.body.people.length >= 3, JSON.stringify(r.body));
  const txt = JSON.stringify(r.body.people);
  assert.ok(r.body.people.every((p: { id: string }) => p.id.startsWith(ib + ":")), "only people of other trees");
  assert.ok(!txt.includes("Mishra") || r.body.people.filter((p: { living: boolean; name: string }) => p.living && /Mishra/.test(p.name)).length === 0, "living people: first name only");
  assert.ok(r.body.people.some((p: { name: string; living: boolean }) => p.name === "Anil" && p.living));
  assert.ok(r.body.people.some((p: { name: string }) => p.name === "Bhola Mishra"), "someone who has passed away keeps the full name");
  assert.ok(r.body.people[0].steps <= r.body.people.at(-1).steps, "nearest first");

  // the path to Anil: You → wife → (same woman) → father → son
  const anil = r.body.people.find((p: { name: string }) => p.name === "Anil");
  const pth = await a.call(`/api/me/connections?to=${encodeURIComponent(anil.id)}`);
  assert.equal(pth.body.found, true); assert.equal(pth.body.steps, 4, "the tree root is Ramnath: son Rohan, wife, father, son"); assert.equal(pth.body.path[0].name, "You");
  assert.ok(pth.body.path.every((s: { name: string; living: boolean }) => !s.living || !/\s/.test(s.name)), "first names only");
  // someone in my own tree, or in an unconnected tree, is not a "connection"
  const mine = `${ia}:${(await a.call(`/api/trees/${ia}`)).body.family.persons[0].id}`;
  assert.equal((await a.call(`/api/me/connections?to=${encodeURIComponent(mine)}`)).body.found, false);
  const lone = `${ic}:${(await c.call(`/api/trees/${ic}`)).body.family.persons[0].id}`;
  assert.equal((await a.call(`/api/me/connections?to=${encodeURIComponent(lone)}`)).body.found, false);
  assert.deepEqual((await c.call("/api/me/connections")).body.people, [], "an unconnected tree sees nobody");

  // switching sharing off removes the tree from everyone's view, and hides the feature for its owner
  assert.equal((await b.call(`/api/trees/${ib}/settings`, "POST", { discoverable: false })).status, 200);
  r = await a.call("/api/me/connections?fresh=1");
  assert.deepEqual(r.body.people, [], "B opted out → invisible");
  console.log("connections API OK");
})().catch((e) => { console.error(e); process.exit(1); });
