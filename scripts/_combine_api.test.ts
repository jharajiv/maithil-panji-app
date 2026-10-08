/** Combining two connected trees against a running DEV server (accounts on, dev code): BASE=http://localhost:3100 npx tsx scripts/_combine_api.test.ts */
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
  const a = new Client(), b = new Client(), c = new Client();
  const [EA, EB, EC] = [`rohan.${t}@example.com`, `vikas.${t}@example.com`, `amit.${t}@example.com`];
  await a.signIn(EA, "Rohan Jha", `+9198${t}`); await b.signIn(EB, "Vikas Jha", `+9197${t}`); await c.signIn(EC, "Amit Jha", `+9196${t}`);

  const A = mk("Rohan Jha", "1980", [{ op: "add_person", name_roman: "Sumit Jha", gender: "male", birth: "1990", status: "living", relation: { type: "child_of", to: "u" } }]);
  const B = mk("Vikas Jha", "1985", [
    { op: "add_person", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", place: "Sarisab", relation: { type: "child_of", to: "f" } },
    { op: "add_person", name_roman: "Gopal Jha", gender: "male", birth: "1991", status: "living", relation: { type: "child_of", to: "u" } },
  ], "Shivanath Jha");
  const ia = (await a.call("/api/trees", "POST", { family: A })).body.id as string;
  const ib = (await b.call("/api/trees", "POST", { family: B })).body.id as string;
  for (const [cl, id] of [[a, ia], [b, ib]] as const) assert.equal((await cl.call(`/api/trees/${id}/settings`, "POST", { discoverable: true })).status, 200);
  await a.call("/api/me/profile", "PUT", { name: "Rohan Jha", profile: {} });
  // connect the owners
  const sent = await a.call(`/api/trees/${ia}/requests`, "POST", { to: ib, share: true });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const rid = sent.body.id as string;
  const treeOf = async (cl: Client, id: string) => (await cl.call(`/api/trees/${id}`)).body;

  // not connected yet → nothing to combine
  assert.equal((await b.call(`/api/trees/${ib}/combine?req=${rid}`)).status, 404, "request not accepted yet");
  assert.equal((await b.call(`/api/trees/${ib}/requests`, "PATCH", { id: rid, action: "accept", share: true })).body.status, "accepted");

  let g = await b.call(`/api/trees/${ib}/combine?req=${rid}`);
  assert.equal(g.status, 200); assert.equal(g.body.combine, null); assert.equal(g.body.canUndo, false);
  assert.equal((await c.call(`/api/trees/${ib}/combine?req=${rid}`)).status, 404, "a stranger cannot even look");
  assert.equal((await new Client().call(`/api/trees/${ib}/combine?req=${rid}`)).status, 404);
  assert.equal((await b.call(`/api/trees/${ib}/combine?req=nope`)).status, 404);

  // offer needs the consent box
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "offer" })).status, 400);
  // nobody can apply an offer that does not exist
  assert.equal((await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "apply" })).status, 404);
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "offer", confirm: true })).status, 200);
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "offer", confirm: true })).status, 409, "one offer at a time");
  assert.equal((await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "offer", confirm: true })).status, 409);
  assert.ok((await a.call(`/api/trees/${ia}`)).body.activity.some((x: { text: string }) => /offered to combine/.test(x.text)), "receiver is told");

  // states and previews
  g = await b.call(`/api/trees/${ib}/combine?req=${rid}&preview=1`);
  assert.equal(g.body.role, "giver"); assert.equal(g.body.preview, undefined, "the giver gets no preview of their own gift");
  g = await a.call(`/api/trees/${ia}/combine?req=${rid}`);
  assert.equal(g.body.role, "receiver"); assert.equal(g.body.preview, undefined, "no preview unless asked");
  g = await a.call(`/api/trees/${ia}/combine?req=${rid}&preview=1`);
  const pv = g.body.preview;
  assert.equal(pv.ok, true, JSON.stringify(pv)); assert.ok(pv.pairs.length >= 4);
  assert.deepEqual(pv.added.map((x: { name: string }) => x.name).sort(), ["Gopal Jha", "Vikas Jha"]);
  assert.ok(pv.filledCount >= 1, "Rohan's village is filled in"); assert.equal(pv.leftOut, 0);

  // before: snapshots
  const A0 = await treeOf(a, ia), B0 = await treeOf(b, ib);
  // a pair can be unticked; too few ticked pairs are refused
  const all = pv.pairs.map((p: { id: string }) => p.id) as string[];
  const g2 = await a.call(`/api/trees/${ia}/combine?req=${rid}&preview=1&x=${all.slice(1).join(",")}`);
  assert.equal(g2.body.preview.ok, false); assert.match(g2.body.preview.reason, /At least 3/);
  assert.equal((await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "apply", exclude: all.slice(1) })).status, 400);
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "apply" })).status, 404, "the giver cannot apply");
  assert.equal(JSON.stringify((await treeOf(a, ia)).family), JSON.stringify(A0.family), "refused → nothing changed");

  // apply
  const ap = await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "apply", exclude: [] });
  assert.equal(ap.status, 200, JSON.stringify(ap.body)); assert.equal(ap.body.added, 2);
  const A1 = await treeOf(a, ia), B1 = await treeOf(b, ib);
  assert.equal(A1.family.persons.length, A0.family.persons.length + 2);
  assert.ok(A1.family.persons.some((p: { name_roman: string }) => p.name_roman === "Gopal Jha"));
  assert.equal(A1.family.persons.find((p: { name_roman: string }) => p.name_roman === "Rohan Jha").place, "Sarisab");
  assert.equal(JSON.stringify(B1.family), JSON.stringify(B0.family), "the giving tree is not changed");
  assert.ok(A1.rev > A0.rev);
  assert.ok(A1.activity.some((x: { text: string }) => /Combined “/.test(x.text)) && B1.activity.some((x: { text: string }) => /combined your tree/.test(x.text)), "both owners told");
  assert.ok(!JSON.stringify(A1.members ?? []).includes("delta") && !JSON.stringify(A1).includes("combine_undo"), "the undo record stays on the server");
  assert.equal((await a.call(`/api/trees/${ia}/requests`)).body.requests[0].combine.status, "applied");
  assert.equal((await b.call(`/api/trees/${ib}/requests`)).body.requests[0].combine.status, "applied");
  assert.equal((await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "apply" })).status, 404, "cannot apply twice");
  g = await a.call(`/api/trees/${ia}/combine?req=${rid}`); assert.equal(g.body.canUndo, true); assert.equal(g.body.role, "receiver");
  assert.equal((await b.call(`/api/trees/${ib}/combine?req=${rid}`)).body.canUndo, false);
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "undo" })).status, 404, "only the receiver can undo");

  // undo
  assert.equal((await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "undo" })).status, 200);
  const A2 = await treeOf(a, ia);
  assert.deepEqual(A2.family.persons.map((p: { id: string }) => p.id).sort(), A0.family.persons.map((p: { id: string }) => p.id).sort());
  assert.equal(A2.family.persons.find((p: { name_roman: string }) => p.name_roman === "Rohan Jha").place, undefined);
  assert.equal((await a.call(`/api/trees/${ia}/requests`)).body.requests[0].combine, undefined);
  assert.equal((await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "undo" })).status, 404, "nothing left to undo");

  // withdraw / decline
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "offer", confirm: true })).status, 200);
  assert.equal((await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "withdraw" })).status, 404, "only the giver can take the offer back");
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "withdraw" })).status, 200);
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "offer", confirm: true })).status, 200);
  assert.equal((await b.call(`/api/trees/${ib}/combine`, "POST", { req: rid, action: "decline" })).status, 404, "the giver cannot decline their own offer");
  assert.equal((await a.call(`/api/trees/${ia}/combine`, "POST", { req: rid, action: "decline" })).status, 200);
  assert.equal((await b.call(`/api/trees/${ib}/combine?req=${rid}`)).body.combine, null);
  assert.equal(JSON.stringify((await treeOf(a, ia)).family), JSON.stringify(A2.family));

  // a helper (editor) cannot combine
  const inv = await a.call(`/api/trees/${ia}/members`, "POST", { name: "Helper" });
  if (inv.status === 200 && inv.body.token) assert.equal((await new Client().call(`/api/trees/${ia}/combine?req=${rid}&k=${inv.body.token}`)).status, 403);
  console.log("combine API OK");
})().catch((e) => { console.error(e); process.exit(1); });
