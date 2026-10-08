/** Profile + similar trees + connect requests against a running DEV server (accounts on, dev code): BASE=http://localhost:3100 npx tsx scripts/_similar_api.test.ts */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type DFamily, type Op } from "../src/lib/family";

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
    assert.equal(s.status, 200, JSON.stringify(s.body));
    const v = await this.call("/api/auth/verify", "POST", { email, code: s.body.devCode, name, phone, consent: true });
    assert.equal(v.status, 200, JSON.stringify(v.body));
  }
}
const build = (ops: Op[]): DFamily => applyOps(emptyFamily(), ops).family;
const G = { roman: "Shandilya" }, M = { roman: "Sarisab" };
const mk = (rootName: string, rootBirth: string, extra: Op[], fatherName = "Shivnath Jha"): DFamily => build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", status: "deceased", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: fatherName, gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1952", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: rootName, gender: "male", birth: rootBirth, status: "living", relation: { type: "child_of", to: rootName.startsWith("Rohan") ? "f" : "u" }, is_me: true, gotra: G, mool: M },
  { op: "add_person", name_roman: "Mohan Jha", gender: "male", birth: "1983", status: "living", relation: { type: "child_of", to: "f" } },
  ...extra,
]);

(async () => {
  const t = String(Date.now()).slice(-8);
  const a = new Client(), b = new Client(), c = new Client(), anon = new Client();
  const [EA, EB, EC] = [`rohan.${t}@example.com`, `vikas.${t}@example.com`, `amit.${t}@example.com`];
  const [PA, PB, PC] = [`+9198${t}`, `+9197${t}`, `+9196${t}`];
  await a.signIn(EA, "Rohan Jha", PA); await b.signIn(EB, "Vikas Jha", PB); await c.signIn(EC, "Amit Jha", PC);

  /* ---------- profile ---------- */
  assert.equal((await anon.call("/api/me/profile")).status, 401);
  const p0 = await a.call("/api/me/profile");
  assert.equal(p0.status, 200); assert.equal(p0.body.account.email, EA); assert.equal(p0.body.complete, 17, "only the mobile number is filled in");
  assert.equal((await a.call("/api/me/profile", "PUT", { phone: "12345" })).status, 400, "bad mobile number");
  const p1 = await a.call("/api/me/profile", "PUT", { name: "Rohan K Jha", profile: { pravar: " Bharadwaj, Angiras ", native_village: "Sarisab", native_district: "Madhubani", native_state: "Bihar", current_city: "Delhi", marital_status: "married", occupation: "Engineer", evil: "x", share_contact: true } });
  assert.equal(p1.status, 200, JSON.stringify(p1.body));
  assert.equal(p1.body.account.name, "Rohan K Jha"); assert.equal(p1.body.profile.pravar, "Bharadwaj, Angiras"); assert.equal(p1.body.profile.evil, undefined); assert.equal(p1.body.complete, 100);
  assert.equal((await a.call("/api/auth/me")).body.account.name, "Rohan K Jha");
  assert.equal((await a.call("/api/me/profile", "PUT", { name: "  " })).status, 400);

  /* ---------- trees: A and B are the same family, C only shares gotra + mool ---------- */
  const A = mk("Rohan Jha", "1980", [{ op: "add_person", name_roman: "Vikas Jha", gender: "male", birth: "1985", status: "living", relation: { type: "child_of", to: "u" } }]);
  const B = mk("Vikas Jha", "1985", [{ op: "add_person", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", relation: { type: "child_of", to: "f" } }], "Shivanath Jha");
  const C = build([
    { op: "add_person", ref: "gf", name_roman: "Dwarika Jha", gender: "male", birth: "1930", status: "deceased", gotra: G, mool: M },
    { op: "add_person", ref: "f", name_roman: "Bhola Jha", gender: "male", birth: "1955", status: "living", relation: { type: "child_of", to: "gf" } },
    { op: "add_person", ref: "me", name_roman: "Amit Jha", gender: "male", birth: "1982", status: "living", relation: { type: "child_of", to: "f" }, is_me: true, gotra: G, mool: M },
    { op: "add_person", name_roman: "Sumit Jha", gender: "male", birth: "1986", status: "living", relation: { type: "child_of", to: "f" } },
  ]);
  const ia = (await a.call("/api/trees", "POST", { family: A })).body.id as string;
  const ib = (await b.call("/api/trees", "POST", { family: B })).body.id as string;
  const ic = (await c.call("/api/trees", "POST", { family: C })).body.id as string;
  assert.ok(ia && ib && ic);
  assert.equal((await a.call(`/api/me/profile`)).body.stock.gotra, "Shandilya", "gotra comes from the tree");

  // nothing is compared until both trees have agreed
  let s = await a.call(`/api/trees/${ia}/similar`);
  assert.equal(s.body.on, false); assert.deepEqual(s.body.trees, []);
  for (const [cl, id] of [[a, ia], [b, ib]] as const) assert.equal((await cl.call(`/api/trees/${id}/settings`, "POST", { discoverable: true })).status, 200);
  s = await a.call(`/api/trees/${ia}/similar`);
  assert.equal(s.body.on, true); assert.equal(s.body.trees.length, 1, "only B; C is not discoverable and not similar");
  assert.equal(s.body.trees[0].tree, ib); assert.ok(s.body.trees[0].percent >= 50, `percent ${s.body.trees[0].percent}`);
  // C joins: same gotra + mool but different people → still not listed
  assert.equal((await c.call(`/api/trees/${ic}/settings`, "POST", { discoverable: true })).status, 200);
  s = await a.call(`/api/trees/${ia}/similar`);
  assert.deepEqual(s.body.trees.map((x: { tree: string }) => x.tree), [ib]);
  assert.equal((await new Client().call(`/api/trees/${ia}/similar`)).status, 404, "strangers cannot ask");

  // preview: only for trees that currently look similar
  const gl = await a.call(`/api/trees/${ia}/similar?tree=${ib}`);
  assert.equal(gl.status, 200); assert.ok(gl.body.glance.pairs.length >= 3); assert.ok(gl.body.glance.ancestors.some((x: string) => x.startsWith("Ramnath Jha")));
  assert.ok(!JSON.stringify(gl.body.glance).includes("Shivanath Jha"), "living people appear by first name only");
  assert.equal((await a.call(`/api/trees/${ia}/similar?tree=${ic}`)).status, 404, "an unrelated tree cannot be previewed");
  assert.equal((await a.call(`/api/trees/${ia}/similar?tree=nope`)).status, 404);

  /* ---------- connect request ---------- */
  assert.equal((await a.call(`/api/trees/${ia}/requests`, "POST", { to: ib })).status, 400, "must agree to share contact details");
  assert.equal((await a.call(`/api/trees/${ia}/requests`, "POST", { to: ic, share: true })).status, 404, "cannot ask an unrelated tree");
  const sent = await a.call(`/api/trees/${ia}/requests`, "POST", { to: ib, share: true, message: "We may be cousins <b>" });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal((await a.call(`/api/trees/${ia}/requests`, "POST", { to: ib, share: true })).status, 409, "one at a time");
  const out = (await a.call(`/api/trees/${ia}/requests`)).body.requests;
  assert.equal(out.length, 1); assert.equal(out[0].dir, "out"); assert.equal(out[0].status, "pending"); assert.equal(out[0].who, undefined);
  const inc = (await b.call(`/api/trees/${ib}/requests`)).body.requests;
  assert.equal(inc.length, 1); assert.equal(inc[0].dir, "in"); assert.equal(inc[0].who.name, "Rohan K Jha"); assert.equal(inc[0].who.phone, PA); assert.equal(inc[0].who.pravar, "Bharadwaj, Angiras");
  assert.equal(inc[0].message, "We may be cousins b", "markup removed");
  // the other owner is told, and the helper-less tree says so in the activity list
  assert.ok((await b.call(`/api/trees/${ib}`)).body.activity.some((x: { text: string }) => /asked to connect/.test(x.text)));

  // only the owner of the receiving tree can answer; accepting needs the consent box
  assert.equal((await a.call(`/api/trees/${ib}/requests`, "PATCH", { id: inc[0].id, action: "accept", share: true })).status, 404, "not a member of that tree");
  assert.equal((await b.call(`/api/trees/${ib}/requests`, "PATCH", { id: inc[0].id, action: "accept" })).status, 400);
  assert.equal((await b.call(`/api/trees/${ib}/requests`, "PATCH", { id: "zzz", action: "accept", share: true })).status, 404);
  assert.equal((await b.call(`/api/trees/${ib}/requests`, "PATCH", { id: inc[0].id, action: "accept", share: true })).body.status, "accepted");
  const done = (await a.call(`/api/trees/${ia}/requests`)).body.requests[0];
  assert.equal(done.status, "accepted"); assert.equal(done.who.name, "Vikas Jha"); assert.equal(done.who.phone, PB, "the asker now has the other owner's number");
  assert.equal((await b.call(`/api/trees/${ib}/requests`, "PATCH", { id: inc[0].id, action: "decline" })).body.already, true);
  assert.equal((await a.call(`/api/trees/${ia}/requests`, "POST", { to: ib, share: true })).status, 409, "already connected");

  // contact stays private to the owners: viewers and other members never get requests
  const g = (await a.call(`/api/trees/${ia}`)).body;
  assert.ok(!JSON.stringify(g.members ?? []).includes(PB), "no phone numbers in the member list");
  console.log("similar + profile API OK");
})().catch((e) => { console.error(e); process.exit(1); });
