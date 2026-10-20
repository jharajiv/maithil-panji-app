/** Thumbs under chat answers, the admin feedback list, the backup downloads and the database check (run with ADMIN_EMAILS=boss@example.com and AUTH_SECRET) */
import assert from "node:assert/strict";
import { applyOps, emptyFamily } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
const ADMIN = process.env.ADMIN_EMAIL ?? "boss@example.com";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
class Client {
  cookie = "";
  async raw(path: string, method = "GET", body?: unknown) {
    const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", "user-agent": UA, ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0]!;
    return r;
  }
  async call(path: string, method = "GET", body?: unknown) {
    const r = await this.raw(path, method, body);
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
  const admin = new Client(), user = new Client(), anon = new Client();
  await admin.signIn(ADMIN, "Boss", `+9197${t}`);
  await user.signIn(`plain.${t}@example.com`, "Plain", `+9198${t}`);
  const mark = `fbtest${t}`;

  // a thumb alone is a count and stores no words
  assert.equal((await anon.call("/api/feedback", "POST", { helpful: true })).status, 200);
  assert.equal((await anon.call("/api/feedback", "POST", { helpful: false, user_text: mark, bot_text: "x" })).status, 200);
  assert.equal((await admin.call("/api/admin/feedback")).body.items.some((f: { user_text: string }) => f.user_text.includes(mark)), false, "words are not kept without consent");
  assert.equal((await anon.call("/api/feedback", "POST", { helpful: "yes" })).status, 400, "bad body");
  assert.equal((await anon.call("/api/feedback", "POST", { helpful: true, share: true, user_text: mark, bot_text: "x" })).status, 400, "only a thumbs-down can be shared");
  assert.equal((await anon.call("/api/feedback", "POST", { helpful: false, share: true, user_text: "", bot_text: "x" })).status, 400, "nothing to send");

  // thumbs-down + the person agreed: the one exchange is stored (cleaned and trimmed)
  const sent = await anon.call("/api/feedback", "POST", { helpful: false, share: true, lang: "hi", goal: "father", user_text: `${mark} <b>hi</b>`, bot_text: "Who is his father? ".repeat(100), note: "wrong\u0000 question" });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const bad = await anon.call("/api/feedback", "POST", { helpful: false, share: true, goal: "x; drop table", user_text: `${mark}b`, bot_text: "ok" });
  assert.equal(bad.status, 200);
  assert.equal((await user.call("/api/admin/feedback")).status, 404, "a normal account cannot see the list");
  assert.equal((await anon.call("/api/admin/feedback")).status, 404);
  const list = (await admin.call("/api/admin/feedback")).body.items as { id: number; user_text: string; bot_text: string; lang: string; goal?: string | null; note?: string | null }[];
  const mine = list.find((f) => f.user_text.startsWith(mark + " "))!;
  assert.ok(mine, "shared exchange is listed");
  assert.ok(!mine.user_text.includes("<"), "markup removed"); assert.ok(mine.bot_text.length <= 900); assert.equal(mine.lang, "hi"); assert.equal(mine.goal, "father"); assert.equal(mine.note, "wrong question");
  const other = list.find((f) => f.user_text === `${mark}b`)!; assert.ok(!other.goal, "a goal that is not a plain word is dropped");
  // the admin can delete it
  assert.equal((await admin.call(`/api/admin/feedback?id=${mine.id}`, "DELETE")).status, 200);
  assert.equal((await user.call(`/api/admin/feedback?id=${other.id}`, "DELETE")).status, 404);
  assert.equal((await admin.call("/api/admin/feedback?id=abc", "DELETE")).status, 400);
  assert.equal((await admin.call("/api/admin/feedback")).body.items.some((f: { id: number }) => f.id === mine.id), false);
  await admin.call(`/api/admin/feedback?id=${other.id}`, "DELETE");

  // the counts reach the admin numbers
  const q = (await admin.call("/api/admin/queue")).body.usage;
  assert.ok(q.quality?.up >= 1 && q.quality?.down >= 1 && q.quality?.shared >= 2, JSON.stringify(q.quality));

  // the app can post pace counts; a browser can never post server-only counts (thumbs, goals…)
  const snap = async () => { await new Promise((r) => setTimeout(r, 400)); return (await admin.call("/api/admin/queue")).body.usage.quality; };
  const was = await snap(); const hour = (x: typeof was) => x.pace.three.find((p: { label: string }) => p.label === "within an hour").count as number;
  assert.equal((await anon.call("/api/ev", "POST", { name: "pace3_1h" })).status, 204);
  for (const name of ["fb_up", "goal:father", "chat_fallback", "skip:mother"]) assert.equal((await anon.call("/api/ev", "POST", { name })).status, 204);
  const now = await snap();
  assert.equal(hour(now), hour(was) + 1, "pace count added");
  assert.equal(now.up, was.up, "forged thumbs are ignored"); assert.equal(now.fallback, was.fallback); assert.equal(now.turns, was.turns);

  // real chat turns (simple mode: no AI key here) are counted by question kind, never by words
  const base = await snap();
  const c1 = await anon.call("/api/chat", "POST", { family: emptyFamily(), text: "Rohan Jha", history: [] });
  assert.equal(c1.status, 200, JSON.stringify(c1.body));
  const c2 = await anon.call("/api/chat", "POST", { family: c1.body.family, text: "skip", history: [], prevGoalId: c1.body.goal?.id });
  assert.equal(c2.status, 200);
  const after = await snap();
  assert.ok(after.turns >= base.turns + 2, `turns ${base.turns} → ${after.turns}`);
  assert.ok(after.questions.some((x: { reached: number }) => x.reached > 0));
  assert.ok(JSON.stringify(after).indexOf("Rohan") < 0, "no words in the counts");

  // backups: admin only
  const fam = applyOps(emptyFamily(), [
    { op: "add_person", ref: "f", name_roman: `Export${t} Jha`, nickname: "Munna", gender: "male", birth: "1950", place: "Sarisab", gotra: { roman: "Shandilya" }, mool: { roman: "Sarisab" } },
    { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", relation: { type: "child_of", to: "f" } },
  ]).family;
  assert.equal((await admin.call("/api/trees", "POST", { family: fam })).status, 200);
  assert.equal((await user.raw("/api/admin/export?kind=trees")).status, 404);
  assert.equal((await anon.raw("/api/admin/export?kind=people")).status, 404);
  assert.equal((await admin.raw("/api/admin/export?kind=nothing")).status, 400);
  const tr = await admin.raw("/api/admin/export?kind=trees");
  assert.equal(tr.status, 200); assert.match(tr.headers.get("content-disposition") ?? "", /attachment; filename="paag-trees-\d{4}-\d{2}-\d{2}\.json"/);
  const dump = JSON.parse(await tr.text()) as { trees: { id: string; family: { persons: unknown[] }; members?: Record<string, unknown>[] }[]; count: number };
  assert.ok(dump.count >= 1 && dump.trees.length === dump.count);
  assert.ok(dump.trees.some((x) => JSON.stringify(x.family).includes(`Export${t}`)), "the new tree is in the backup");
  for (const tree of dump.trees) for (const m of tree.members ?? []) for (const k of Object.keys(m)) assert.ok(["id", "name", "role", "status", "person_id", "email", "phone", "created_at"].includes(k), `member field ${k} is not in the backup`);
  const bytes = new Uint8Array(await (await admin.raw("/api/admin/export?kind=people")).arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "BOM so Excel reads Devanagari");
  const csv = new TextDecoder().decode(bytes); assert.match(csv, /Tree,Person,Name,Nickname/);
  assert.ok(csv.includes(`Export${t} Jha`) && csv.includes("Munna") && csv.includes("Shandilya"));

  // the database check exists in the status list (the file store has every table, so it is OK)
  const st = (await admin.call("/api/admin/status")).body;
  assert.ok(Array.isArray(st.checks)); const schema = st.checks.find((c: { id: string }) => c.id === "schema");
  if (schema) assert.equal(schema.ok, true, JSON.stringify(schema));
  console.log("feedback api ok");
})().catch((e) => { console.error(e); process.exit(1); });
