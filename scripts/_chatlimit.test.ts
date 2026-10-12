/**
 * The daily chat limit per device. Start a dev server with a key that cannot work, so the AI always fails fast:
 *   ANTHROPIC_API_KEY=fake ANTHROPIC_BASE_URL=http://localhost:1 CHAT_DAILY_LIMIT=3 AUTH_OFF=1 STORE=file npx next dev -p 3100
 *   BASE=http://localhost:3100 npx tsx scripts/_chatlimit.test.ts
 */
import assert from "node:assert/strict";
import { emptyFamily } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
const say = async (dev: string, text: string) => {
  const r = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "content-type": "application/json", "x-device-id": dev }, body: JSON.stringify({ family: emptyFamily(), text, history: [] }) });
  return { status: r.status, body: (await r.json()) as { reply?: string; notice?: string; mode?: string } };
};
(async () => {
  const a = "devicea0000000000001", b = "deviceb0000000000002";
  for (let i = 1; i <= 3; i++) {
    const r = await say(a, "Rohan Jha");
    assert.equal(r.status, 200); assert.match(r.body.notice ?? "", /unavailable/, `turn ${i} tried the AI first`);
  }
  const over = await say(a, "Rohan Jha");
  assert.equal(over.status, 200);
  assert.match(over.body.notice ?? "", /today’s AI answers/, "the 4th answer is past the limit");
  assert.equal(over.body.mode, "basic");
  assert.ok(over.body.reply, "the simple reader still answers");
  const other = await say(b, "Rohan Jha");
  assert.match(other.body.notice ?? "", /unavailable/, "another device is not affected");
  console.log("chat limit OK");
})().catch((e) => { console.error(e); process.exit(1); });
