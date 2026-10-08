/** Admin graph API (dev server started with ADMIN_EMAILS=admin.<anything>@example.com is NOT needed: set ADMIN_EMAILS=boss@example.com) */
import assert from "node:assert/strict";
import { applyOps, emptyFamily } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
const ADMIN = process.env.ADMIN_EMAIL ?? "boss@example.com";
class Client {
  cookie = "";
  async call(path: string, method = "GET", body?: unknown) {
    const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0]!;
    return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  async signIn(email: string, name: string, phone: string) {
    const s = await this.call("/api/auth/start", "POST", { email });
    const v = await this.call("/api/auth/verify", "POST", { email, code: s.body.devCode, name, phone, consent: true });
    assert.equal(v.status, 200, JSON.stringify(v.body));
  }
}
(async () => {
  const t = String(Date.now()).slice(-8);
  const admin = new Client(), user = new Client();
  const uniq = "Zq" + [...t].map((d) => "abcdefghij"[Number(d)]).join(""); // letters only: names are compared by sound, digits are ignored
  assert.equal((await new Client().call("/api/admin/graph")).status, 404, "anonymous");
  await user.signIn(`plain.${t}@example.com`, "Plain", `+9198${t}`);
  assert.equal((await user.call("/api/admin/graph?op=stats")).status, 404, "a normal account cannot even tell the page exists");
  await admin.signIn(ADMIN, "Boss", `+9197${t}`);

  const fam = applyOps(emptyFamily(), [
    { op: "add_person", ref: "f", name_roman: `${uniq} Jha`, gender: "male", birth: "1950", place: "Sarisab, Madhubani, Bihar", gotra: { roman: "Shandilya" }, mool: { roman: "Sarisab" } },
    { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", relation: { type: "child_of", to: "f" } },
  ]).family;
  assert.equal((await admin.call("/api/trees", "POST", { family: fam })).status, 200);
  const st = await admin.call("/api/admin/graph?op=stats&fresh=1"); assert.equal(st.status, 200); assert.ok(st.body.people >= 2 && st.body.trees >= 1);
  const s = await admin.call(`/api/admin/graph?op=search&q=${uniq}&fresh=1`); assert.equal(s.body.people.length, 1); assert.equal(s.body.people[0].gotra, "Shandilya", "inherits the root's gotra");
  const r = await admin.call(`/api/admin/graph?op=search&q=Rohan&gotra=shandilya&fresh=1`); const rohan = r.body.people.find((p: { tree: string }) => p.tree === s.body.people[0].tree);
  assert.ok(rohan);
  const pth = await admin.call(`/api/admin/graph?op=path&from=${encodeURIComponent(rohan.id)}&to=${encodeURIComponent(s.body.people[0].id)}`);
  assert.equal(pth.body.found, true); assert.equal(pth.body.steps, 1); assert.equal(pth.body.path[1].via, "father"); assert.equal(pth.body.degree, "1st connection");
  assert.ok(!JSON.stringify(pth.body).includes("whatsapp"), "no contact details");
  assert.equal((await admin.call(`/api/admin/graph?op=path&from=a:b&to=c:d`)).body.found, false);
  assert.equal((await admin.call(`/api/admin/graph?op=nope`)).status, 400);
  console.log("admin API OK");
})().catch((e) => { console.error(e); process.exit(1); });
