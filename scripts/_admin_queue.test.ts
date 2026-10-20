/** Admin to-do list: possible duplicate trees (only trees that agreed to be found) and new gotra / mool spellings. */
import assert from "node:assert/strict";
import { applyOps, emptyFamily, type DFamily, type Op } from "../src/lib/family";
import { buildQueue, costOf, sumTokens } from "../src/lib/admin-queue";
import { refCodeOf, REF_RX, captureRef } from "../src/lib/invite";
import type { AccountRow, Member, Store, TreeRow } from "../src/lib/store";

const build = (ops: Op[]): DFamily => applyOps(emptyFamily(), ops).family;
const G = { roman: "Shandilya" }, M = { roman: "Sarisab" };
const A = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1920", status: "deceased", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1952", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", relation: { type: "child_of", to: "f" }, is_me: true, gotra: G, mool: M },
  { op: "add_person", name_roman: "Mohan Jha", gender: "male", birth: "1983", status: "living", relation: { type: "child_of", to: "f" } },
]);
const B = build([
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", birth: "1921", status: "deceased", gotra: G, mool: M },
  { op: "add_person", ref: "f", name_roman: "Shivanath Jha", gender: "male", birth: "1948", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", birth: "1951", status: "living", relation: { type: "child_of", to: "gf" } },
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living", relation: { type: "child_of", to: "f" }, is_me: true, gotra: G, mool: M },
  { op: "add_person", name_roman: "Mohan Jha", gender: "male", birth: "1983", status: "living", relation: { type: "child_of", to: "f" } },
]);
const C = build([ // a family with a typed (custom) mool, in no one's opted-in list
  { op: "add_person", ref: "me", name_roman: "Amit Jha", gender: "male", birth: "1982", is_me: true, gotra: G, mool: { roman: "Zarwapur", dev: "ज़रवापुर", custom: true } },
]);

const owner = (name: string, account: string | undefined, discoverable: boolean): Member => ({ id: name, name, role: "owner", created_at: "2026-01-01", account_id: account, status: "joined", discoverable });
const row = (id: string, family: DFamily, m: Member): TreeRow => ({ id, family, rev: 1, members: [m], updated_at: new Date().toISOString(), title: `${id} family` });
const accounts: Record<string, AccountRow> = { a1: { id: "a1", email: "rohan@example.com", phone: "+919800000001", name: "Rohan Jha", created_at: "2026-01-01" }, a2: { id: "a2", email: "other@example.com", name: "Cousin Jha", created_at: "2026-01-01" } };
const store = { getAccount: async (id: string) => accounts[id] ?? null, listAllTrees: async () => [] } as unknown as Store;

(async () => {
  // both opted in → listed with contact details
  let q = await buildQueue(store, [row("t1", A, owner("Rohan", "a1", true)), row("t2", B, owner("Cousin", "a2", true)), row("t3", C, owner("Amit", "a2", false))]);
  assert.equal(q.duplicates.length, 1, "one pair");
  const d = q.duplicates[0]!;
  assert.ok(d.percent >= 50 && d.matched >= 3);
  assert.equal(d.gotra, "Shandilya"); assert.equal(d.mool, "Sarisab");
  assert.deepEqual([d.a.owner?.email, d.b.owner?.email].sort(), ["other@example.com", "rohan@example.com"]);
  assert.equal(d.sameOwner, false);
  assert.equal(q.optedIn, 2); assert.equal(q.scanned, 3);

  // the same person started twice → flagged
  q = await buildQueue(store, [row("t1", A, owner("Rohan", "a1", true)), row("t2", B, owner("Rohan", "a1", true))]);
  assert.equal(q.duplicates[0]!.sameOwner, true);

  // one tree has not agreed to be found → nothing is compared, no contact is shown
  q = await buildQueue(store, [row("t1", A, owner("Rohan", "a1", true)), row("t2", B, owner("Cousin", "a2", false))]);
  assert.equal(q.duplicates.length, 0, "only opted-in trees are compared");

  // a private-link owner has no account: name only, nothing else
  q = await buildQueue(store, [row("t1", A, owner("Rohan", undefined, true)), row("t2", B, owner("Cousin", "a2", true))]);
  const noAcct = [q.duplicates[0]!.a, q.duplicates[0]!.b].find((s) => s.owner?.name === "Rohan")!;
  assert.deepEqual(noAcct.owner, { name: "Rohan" });

  // typed spellings are counted per tree, whether or not the owner opted in
  q = await buildQueue(store, [row("t3", C, owner("Amit", "a2", false)), row("t4", C, owner("Amit", "a2", false)), row("t1", A, owner("Rohan", "a1", true))]);
  assert.equal(q.newRefs.length, 1); assert.deepEqual(q.newRefs[0], { kind: "mool", roman: "Zarwapur", dev: "ज़रवापुर", trees: 2 });
  assert.ok(!JSON.stringify(q.newRefs).includes("Amit"), "no names of people");

  q = await buildQueue(store, []);
  assert.deepEqual([q.duplicates.length, q.newRefs.length, q.scanned], [0, 0, 0]);
  assert.deepEqual(q.invites, { total: 0, byInvite: 0, inviters: 0, top: [] });

  // invitations: the code is a short hash of the inviter's tree id; trees that carry it are counted under that inviter
  const code = await refCodeOf("t1");
  assert.ok(REF_RX.test(code)); assert.equal(code, await refCodeOf("t1")); assert.notEqual(code, await refCodeOf("t2"));
  const invited = (id: string, by: string) => row(id, A, { ...owner(`Guest ${id}`, undefined, false), invited_by: by });
  q = await buildQueue(store, [row("t1", A, owner("Rohan", "a1", false)), invited("t2", code), invited("t3", code), row("t4", B, owner("Cousin", "a2", false))]);
  assert.deepEqual(q.invites, { total: 4, byInvite: 2, inviters: 1, top: [{ name: "Rohan", count: 2 }] });
  // the code never contains the tree id itself
  assert.ok(!code.includes("t1"));
  // a code whose inviter has deleted their tree is still counted, without a name
  q = await buildQueue(store, [invited("t2", "0123456789")]);
  assert.equal(q.invites.top[0]!.count, 1);
  // only well-formed codes are remembered from a link
  const mem: Record<string, string> = {};
  (globalThis as unknown as { localStorage: unknown }).localStorage = { setItem: (k: string, v: string) => { mem[k] = v; }, getItem: (k: string) => mem[k] ?? null };
  captureRef("?ref=<script>"); assert.deepEqual(mem, {});
  captureRef(`?utm=1&ref=${code.toUpperCase()}`); assert.equal(Object.values(mem)[0], code);
  /* AI token sums */
  {
    assert.equal(sumTokens([], 0), undefined);
    const calls = [
      { at: "2026-10-18T10:00:00Z", model: "claude-sonnet-4-5", kind: "interview", input: 1000, cache_write: 0, cache_read: 4000, output: 100 },
      { at: "2026-10-18T11:00:00Z", model: "claude-haiku-4-5", kind: "names", input: 500, cache_write: 0, cache_read: 0, output: 50 },
      { at: "2026-10-19T09:00:00Z", model: "claude-sonnet-4-5", kind: "interview", input: 1000, cache_write: 4000, cache_read: 0, output: 100 },
    ];
    const t = sumTokens(calls, 2)!;
    assert.deepEqual(t.days.map((d) => [d.key, d.calls]), [["2026-10-19", 1], ["2026-10-18", 2]], "newest day first");
    assert.deepEqual(t.models.map((m) => m.key).sort(), ["claude-haiku-4-5", "claude-sonnet-4-5"]);
    assert.equal(t.total.input, 2500); assert.equal(t.total.cache_read, 4000); assert.equal(t.total.output, 250);
    assert.ok(Math.abs(costOf("claude-sonnet-4-5", calls[0]!) - (1000 * 3 + 4000 * 0.3 + 100 * 15) / 1e6) < 1e-9, "cache reads cost a tenth");
    assert.ok(Math.abs(costOf("claude-haiku-4-5", calls[1]!) - (500 + 250) / 1e6) < 1e-9);
    assert.equal(t.cachePercent, Math.round((100 * 4000) / (2500 + 4000 + 4000)));
    assert.ok(Math.abs(t.usdPerAnswer - t.total.usd / 2) < 1e-12);
  }
  console.log("admin queue OK");
})().catch((e) => { console.error(e); process.exit(1); });
