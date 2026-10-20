/** Admin graph API (dev server started with ADMIN_EMAILS=admin.<anything>@example.com is NOT needed: set ADMIN_EMAILS=boss@example.com) */
import assert from "node:assert/strict";
import { applyOps, emptyFamily } from "../src/lib/family";
import { refCodeOf } from "../src/lib/invite";

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
  const mine = await admin.call("/api/trees", "POST", { family: fam }); assert.equal(mine.status, 200);
  // invitations: a tree saved by someone who came through the admin's invite code is counted under the admin
  const code = await refCodeOf(mine.body.id);
  const before = (await admin.call("/api/admin/queue")).body.invites.byInvite as number;
  const guest = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Guest Visitor", gender: "male", is_me: true }]).family;
  assert.equal((await user.call("/api/trees", "POST", { family: guest, ref: code })).status, 200);
  assert.equal((await user.call("/api/trees", "POST", { family: guest, ref: "<script>alert(1)</script>" })).status, 200, "a malformed code is simply ignored");
  const q = (await admin.call("/api/admin/queue")).body.invites;
  assert.equal(q.byInvite, before + 1, "only the well-formed code counted");
  assert.ok(q.top.some((x: { name: string; count: number }) => x.name === "Boss" && x.count >= 1), "counted under the inviter");
  assert.equal((await user.call("/api/admin/queue")).status, 404);
  const st = await admin.call("/api/admin/graph?op=stats&fresh=1"); assert.equal(st.status, 200); assert.ok(st.body.people >= 2 && st.body.trees >= 1);
  const s = await admin.call(`/api/admin/graph?op=search&q=${uniq}&fresh=1`); assert.equal(s.body.people.length, 1); assert.equal(s.body.people[0].gotra, "Shandilya", "inherits the root's gotra");
  const r = await admin.call(`/api/admin/graph?op=search&q=Rohan&gotra=shandilya&fresh=1`); const rohan = r.body.people.find((p: { tree: string }) => p.tree === s.body.people[0].tree);
  assert.ok(rohan);
  const pth = await admin.call(`/api/admin/graph?op=path&from=${encodeURIComponent(rohan.id)}&to=${encodeURIComponent(s.body.people[0].id)}`);
  assert.equal(pth.body.found, true); assert.equal(pth.body.steps, 1); assert.equal(pth.body.path[1].via, "father"); assert.equal(pth.body.degree, "1st connection");
  assert.ok(!JSON.stringify(pth.body).includes("whatsapp"), "no contact details");
  assert.equal((await admin.call(`/api/admin/graph?op=path&from=a:b&to=c:d`)).body.found, false);
  assert.equal((await admin.call(`/api/admin/graph?op=nope`)).status, 400);
  // review of typed gotra / mool spellings: map to a list entry, approve with a corrected spelling
  const typed = applyOps(emptyFamily(), [
    { op: "add_person", ref: "a", name_roman: "Typed Jha", gender: "male", is_me: true, gotra: { roman: "Kashayp", custom: true }, mool: { roman: "Zzmoolpur", dev: "ज़ज़मूलपुर", custom: true } },
    { op: "add_person", ref: "b", name_roman: "Typed Son", gender: "male", relation: { type: "child_of", to: "a" } },
  ]).family;
  const tt = await admin.call("/api/trees", "POST", { family: typed }); assert.equal(tt.status, 200);
  let qq = (await admin.call("/api/admin/queue")).body.newRefs as { kind: string; roman: string }[];
  assert.ok(qq.some((x) => x.kind === "gotra" && x.roman === "Kashayp") && qq.some((x) => x.kind === "mool" && x.roman === "Zzmoolpur"));
  assert.equal((await user.call("/api/admin/refs", "POST", { action: "approve", kind: "gotra", from: "Kashayp" })).status, 404, "admin only");
  assert.equal((await admin.call("/api/admin/refs", "POST", { action: "map", kind: "gotra", from: "Kashayp", id: "no-such" })).status, 400);
  const g = (await admin.call("/api/admin/refs", "POST", { action: "map", kind: "gotra", from: "Kashayp", id: "g03" })).body;
  assert.equal(g.ok, true); assert.equal(g.people, 2); assert.ok(g.now.roman);
  const m = (await admin.call("/api/admin/refs", "POST", { action: "approve", kind: "mool", from: "Zzmoolpur", roman: "Zzmoolpura", dev: "ज़ज़मूलपुरा" })).body;
  assert.equal(m.ok, true); assert.equal(m.people, 2);
  const after = (await admin.call(`/api/trees/${tt.body.id}`)).body.family.persons as { gotra?: { id?: string; custom?: boolean }; mool?: { roman: string; custom?: boolean; id?: string } }[];
  assert.ok(after.every((p) => p.gotra?.id === "g03" && !p.gotra.custom), "mapped to the list entry");
  assert.ok(after.every((p) => p.mool?.roman === "Zzmoolpura" && !p.mool.custom && p.mool.id === "x-mool-zzmoolpura"), "approved with the corrected spelling");
  qq = (await admin.call("/api/admin/queue")).body.newRefs;
  assert.ok(!qq.some((x) => x.roman === "Kashayp" || x.roman === "Zzmoolpur" || x.roman === "Zzmoolpura"), "no longer in the review list");
  const offered = ((await (await fetch(BASE + "/api/refs")).json()) as { refs: { roman: string }[] }).refs.map((x) => x.roman);
  assert.ok(offered.includes("Zzmoolpura") && !offered.includes("Zzmoolpur"), "approved spelling is offered, the typo is not");
  console.log("admin API OK");
})().catch((e) => { console.error(e); process.exit(1); });
