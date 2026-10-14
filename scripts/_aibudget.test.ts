/** The AI-use alert: needs the fake Resend (node scripts/_fake_resend.mjs). RESEND_API_URL=http://localhost:3998 npx tsx scripts/_aibudget.test.ts */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.STORE = "file"; process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "aib-"));
process.env.RESEND_API_KEY = "k"; process.env.RESEND_API_URL = process.env.RESEND_API_URL ?? "http://localhost:3998"; process.env.EMAIL_FROM = "PAAG <hello@paag.org.in>";
process.env.ADMIN_EMAILS = "boss@example.com, second@example.com"; process.env.AI_DAILY_ALERT = "10";
delete process.env.NEXT_PUBLIC_APP_ENV; delete process.env.VERCEL_ENV;
const FAKE = process.env.RESEND_API_URL;

(async () => {
  const { dueLevel, istDayStart, watchBudget, alertLevel } = await import("../src/lib/ai-budget");
  const { getStore } = await import("../src/lib/store");
  const store = getStore()!;

  // the day starts at midnight in India
  assert.equal(istDayStart(Date.parse("2026-10-14T20:00:00Z")), "2026-10-14T18:30:00.000Z"); // 1:30 am on the 15th in India
  assert.equal(istDayStart(Date.parse("2026-10-14T05:00:00Z")), "2026-10-13T18:30:00.000Z"); // 10:30 am on the 14th
  assert.equal(alertLevel(), 10);

  // which warning is due
  assert.equal(dueLevel(6, 10, { a70: 0, a100: 0 }), null);
  assert.equal(dueLevel(7, 10, { a70: 0, a100: 0 }), 70);
  assert.equal(dueLevel(8, 10, { a70: 1, a100: 0 }), null, "70% is sent once a day");
  assert.equal(dueLevel(10, 10, { a70: 1, a100: 0 }), 100);
  assert.equal(dueLevel(12, 10, { a70: 1, a100: 1 }), null);
  assert.equal(dueLevel(15, 10, { a70: 0, a100: 0 }), 100, "a jump straight past 100% sends only the 100% email");

  const sent = async () => (await (await fetch(`${FAKE}/__sent`)).json()) as { to: string[]; subject: string; text: string }[];
  await fetch(`${FAKE}/__sent`, { method: "DELETE" });
  let t = Date.now();
  for (let i = 0; i < 6; i++) await store.addEvent("ai_turn");
  await watchBudget(t); assert.equal((await sent()).length, 0, "6 of 10: nothing yet");
  await store.addEvent("ai_turn");
  await watchBudget(t + 10_000); assert.equal((await sent()).length, 0, "checked again within 2 minutes: skipped");
  t += 200_000; await watchBudget(t);
  let m = await sent();
  assert.equal(m.length, 2, "7 of 10: one email to each admin"); assert.deepEqual(m.map((x) => x.to[0]).sort(), ["boss@example.com", "second@example.com"]);
  assert.match(m[0]!.subject, /7 answers today — 70%/); assert.match(m[0]!.text, /Nothing has been switched off/);
  t += 200_000; await watchBudget(t); assert.equal((await sent()).length, 2, "not sent twice");
  for (let i = 0; i < 3; i++) await store.addEvent("ai_turn");
  await store.addEvent("ai_save_gate");
  t += 200_000; await watchBudget(t);
  m = await sent(); assert.equal(m.length, 4, "10 of 10: the 100% email follows");
  assert.match(m[2]!.subject, /over your alert level of 10/); assert.match(m[2]!.text, /stepped aside once because a tree was not saved/);
  t += 200_000; await watchBudget(t); assert.equal((await sent()).length, 4);
  console.log("ai budget OK");
})().catch((e) => { console.error(e); process.exit(1); });
