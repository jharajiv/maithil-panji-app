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

  const fam = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Rohan Jha", gender: "male", gotra: { roman: "Shandilya" }, mool: { roman: "Sarisab" } }]).family;
  const id = newTreeId();
  await s.createTree({ id, family: fam, rev: 1, members: [], updated_at: new Date().toISOString(), ...treeMeta(fam) });
  await s.syncPeople(id, fam);
  assert.deepEqual(await s.findTreesBySameStock({ roman: "shandilya" }, { roman: "Sarisab" }), [id]);
  assert.deepEqual(await s.findTreesBySameStock({ roman: "Shandilya" }, { roman: "Pandaul" }), []);
  assert.ok((await s.listAllTrees()).some((t) => t.id === id));
  console.log("supabase adapter OK");
})().catch((e) => { console.error(e); process.exit(1); });
