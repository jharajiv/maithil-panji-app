/** The Supabase adapter's newest calls against the fake PostgREST: node scripts/_mockpg.mjs &  then  SUPABASE_URL=http://localhost:3999 SUPABASE_SERVICE_ROLE_KEY=test-key npx tsx scripts/_supabase_store.test.ts */
import assert from "node:assert/strict";
import { applyOps, emptyFamily } from "../src/lib/family";
import { getStore, newAccountId, newTreeId, treeMeta } from "../src/lib/store";

(async () => {
  const s = getStore()!; assert.equal(s.kind, "supabase");
  const acc = { id: newAccountId(), email: `x${Date.now()}@example.com`, name: "X", created_at: new Date().toISOString() };
  await s.createAccount(acc);
  const u = await s.updateAccount(acc.id, { name: "Y", profile: { pravar: "P", current_city: "Delhi" } });
  assert.equal(u?.name, "Y"); assert.equal((await s.getAccount(acc.id))?.profile?.pravar, "P");
  assert.equal(await s.updateAccount("missing", { name: "Z" }), null);
  // birthday reminders: only accounts that switched them on are listed
  assert.ok(!(await s.listReminderAccounts()).some((a) => a.id === acc.id));
  await s.updateAccount(acc.id, { profile: { pravar: "P", reminders: { birthdays: true, lead: "day" }, _sent: ["k"] } });
  const on = (await s.listReminderAccounts()).find((a) => a.id === acc.id);
  assert.equal(on?.profile?.reminders?.lead, "day"); assert.deepEqual(on?.profile?._sent, ["k"]);
  await s.updateAccount(acc.id, { profile: { pravar: "P", reminders: { birthdays: false, lead: "day" } } });
  assert.ok(!(await s.listReminderAccounts()).some((a) => a.id === acc.id));

  const fam = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Rohan Jha", gender: "male", gotra: { roman: "Shandilya" }, mool: { roman: "Sarisab" } }]).family;
  const id = newTreeId();
  await s.createTree({ id, family: fam, rev: 1, members: [], updated_at: new Date().toISOString(), ...treeMeta(fam) });
  await s.syncPeople(id, fam);
  assert.deepEqual(await s.findTreesBySameStock({ roman: "shandilya" }, { roman: "Sarisab" }), [id]);
  assert.deepEqual(await s.findTreesBySameStock({ roman: "Shandilya" }, { roman: "Pandaul" }), []);
  assert.ok((await s.listAllTrees()).some((t) => t.id === id));
  // usage counts: more than one page (the database hands out at most 1000 rows at a time)
  for (let i = 0; i < 1005; i++) await s.addEvent("tree_started");
  await s.addEvent("tree_saved");
  const counts = await s.countEvents(new Date(Date.now() - 86_400_000).toISOString());
  assert.equal(counts.tree_started, 1005); assert.equal(counts.tree_saved, 1);
  assert.deepEqual(await s.countEvents(new Date(Date.now() + 86_400_000).toISOString()), {});
  // the AI token log: written in one batch, read back by date, more than one page
  const row = { model: "claude-sonnet-4-5", kind: "interview", input: 100, cache_write: 0, cache_read: 900, output: 50 };
  await s.addAiCalls(Array.from({ length: 12 }, () => row));
  for (let i = 0; i < 99; i++) await s.addAiCalls(Array.from({ length: 12 }, () => ({ ...row, model: "claude-haiku-4-5" })));
  const calls = await s.listAiCalls(new Date(Date.now() - 86_400_000).toISOString());
  assert.equal(calls.length, 12 + 99 * 12); assert.equal(calls.filter((c) => c.model === "claude-sonnet-4-5").length, 12);
  assert.equal(calls[0]!.cache_read, 900); assert.ok(!Number.isNaN(Date.parse(calls[0]!.at)));
  assert.deepEqual(await s.listAiCalls(new Date(Date.now() + 86_400_000).toISOString()), []);
  console.log("supabase adapter OK");
})().catch((e) => { console.error(e); process.exit(1); });
