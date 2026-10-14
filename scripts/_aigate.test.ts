/**
 * The AI helper and unsaved trees. Dev server with a key that cannot work (so an AI attempt fails fast and says "unavailable"):
 *   ANTHROPIC_API_KEY=fake ANTHROPIC_BASE_URL=http://localhost:1 AUTH_SECRET=test-secret-long-enough-0123456789abcdef STORE=file npx next dev -p 3100
 *   BASE=http://localhost:3100 npx tsx scripts/_aigate.test.ts
 */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type DFamily } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
type Body = { reply?: string; notice?: string; mode?: string; gate?: string };
class Client {
  cookie = "";
  async call(path: string, method = "GET", body?: unknown) {
    const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.getSetCookie?.() ?? []; if (sc.length) this.cookie = sc.map((c) => c.split(";")[0]).join("; ");
    return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  chat(family: DFamily, text = "Vikram") { return this.call("/api/chat", "POST", { family, text, history: [] }).then((r) => ({ status: r.status, body: r.body as Body })); }
}
const tree = (n: number): DFamily => applyOps(emptyFamily(), Array.from({ length: n }, (_, i) => ({ op: "add_person" as const, name_roman: `Person${i} Jha`, gender: (i % 2 ? "female" : "male") as "male" | "female" }))).family;

(async () => {
  const guest = new Client();
  // a small unsaved tree: the AI is tried (the fake key fails, which proves it was tried)
  let r = await guest.chat(tree(3)); assert.match(r.body.notice ?? "", /unavailable/); assert.equal(r.body.gate, undefined);
  r = await guest.chat(tree(7)); assert.match(r.body.notice ?? "", /unavailable/, "7 people: still within the free part");
  // 8 named people, not saved: the AI helper steps aside and the client is told why
  r = await guest.chat(tree(8));
  assert.equal(r.status, 200); assert.equal(r.body.gate, "save"); assert.equal(r.body.mode, "basic"); assert.ok(r.body.reply, "the simple reader still asks the next question"); assert.equal(r.body.notice, undefined, "no AI attempt was made");
  // an empty placeholder does not count as a person
  const withPlaceholder = tree(7); withPlaceholder.persons.push({ id: "p99", name_roman: "Unknown", flags: {}, placeholder: true });
  r = await guest.chat(withPlaceholder); assert.equal(r.body.gate, undefined, "placeholders are not counted");

  // signing in lifts it
  const t = String(Date.now()).slice(-8), email = `gate.${t}@example.com`;
  const st = await guest.call("/api/auth/start", "POST", { email });
  assert.equal(st.status, 200);
  const v = await guest.call("/api/auth/verify", "POST", { email, code: st.body.devCode, name: "Rohan Jha", phone: `+9198${t}`, consent: true });
  assert.equal(v.status, 200);
  r = await guest.chat(tree(12)); assert.equal(r.body.gate, undefined); assert.match(r.body.notice ?? "", /unavailable/, "a signed-in person gets the AI helper at any size");

  // the counts reach the admin page's Usage table
  console.log("ai gate OK");
})().catch((e) => { console.error(e); process.exit(1); });
