/** Integration test against a running dev server: BASE=http://localhost:3100 npx tsx scripts/_api.test.ts */
import assert from "node:assert/strict";
import { applyOps, emptyFamily } from "../src/lib/family";
import { mergeFamilies } from "../src/lib/merge";

const BASE = process.env.BASE ?? "http://localhost:3100";
const j = async (path: string, init?: RequestInit) => { const r = await fetch(BASE + path, init); return { status: r.status, body: await r.json() as Record<string, any> }; }; // eslint-disable-line @typescript-eslint/no-explicit-any
const post = (path: string, body: unknown, method = "POST") => j(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

(async () => {
  let fam = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Rohan Jha", gender: "male" }]).family;
  fam.persons[0]!.is_me = true;
  fam = applyOps(fam, [{ op: "update_person", id: "p1", set: { mool: { roman: "Zzqxplo", custom: true }, photo: "data:image/jpeg;base64,/9j/AAAA" } }]).family;

  const c = await post("/api/trees", { family: fam, ownerName: "Rohan" });
  assert.equal(c.status, 200); const { id, token } = c.body as { id: string; token: string };

  // wrong token / unknown tree
  assert.equal((await j(`/api/trees/${id}?k=nope`)).status, 404);
  assert.equal((await j(`/api/trees/zzz?k=${token}`)).status, 404);

  const g = await j(`/api/trees/${id}?k=${token}`);
  assert.equal(g.body.role, "owner"); assert.equal(g.body.family.persons[0].photo?.startsWith("data:image/jpeg"), true);
  assert.equal((await j(`/api/trees/${id}?k=${token}&rev=1`)).body.unchanged, true);

  // invite a helper; helper sees tree but cannot invite
  const inv = await post(`/api/trees/${id}/members`, { k: token, name: "Vikram", personId: "p1" });
  assert.equal(inv.status, 200); const hk = inv.body.token as string;
  assert.ok(!JSON.stringify(inv.body).includes("token_hash"));
  const hg = await j(`/api/trees/${id}?k=${hk}`);
  assert.equal(hg.body.role, "editor"); assert.equal(hg.body.members, undefined);
  assert.equal((await post(`/api/trees/${id}/members`, { k: hk, name: "X" })).status, 403);

  // both edit from rev 1: owner adds a child, helper adds a sibling (clashing ids)
  const base = g.body.family;
  const mine = applyOps(structuredClone(base), [{ op: "add_person", name_roman: "Aarav", relation: { type: "child_of", to: "p1" } }]).family;
  const theirs = applyOps(structuredClone(base), [{ op: "add_person", name_roman: "Neha", relation: { type: "spouse_of", to: "p1" } }]).family;
  const s1 = await post(`/api/trees/${id}`, { k: hk, baseRev: 1, family: theirs }, "PUT");
  assert.equal(s1.status, 200); assert.equal(s1.body.rev, 2);
  const s2 = await post(`/api/trees/${id}`, { k: token, baseRev: 1, family: mine }, "PUT");
  assert.equal(s2.status, 409); assert.equal(s2.body.rev, 2);
  const merged = mergeFamilies(base, mine, s2.body.family);
  assert.deepEqual(merged.persons.map((p) => p.name_roman).sort(), ["Aarav", "Neha", "Rohan Jha"]);
  const s3 = await post(`/api/trees/${id}`, { k: token, baseRev: 2, family: merged }, "PUT");
  assert.equal(s3.status, 200); assert.equal(s3.body.rev, 3);
  const after = await j(`/api/trees/${id}?k=${hk}`);
  assert.equal(after.body.family.persons.length, 3);

  // refs table got the custom mool
  const refs = await j("/api/refs");
  assert.ok(refs.body.refs.some((r: { roman: string }) => r.roman === "Zzqxplo"));

  // revoke
  const members = (await j(`/api/trees/${id}?k=${token}`)).body.members as { id: string; role: string }[];
  const helper = members.find((m) => m.role === "editor")!;
  assert.equal((await post(`/api/trees/${id}/members`, { k: token, memberId: helper.id }, "DELETE")).status, 200);
  assert.equal((await j(`/api/trees/${id}?k=${hk}`)).status, 404);

  // flat tables (only checked when the mock PostgREST is the backend: DUMP=http://localhost:3999/__dump)
  if (process.env.DUMP) {
    const d = await (await fetch(process.env.DUMP)).json() as { persons: Record<string, any>[]; rels: Record<string, any>[]; consents: Record<string, any>[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const mine3 = d.persons.filter((x) => x.tree_id === id);
    assert.deepEqual(mine3.map((x) => x.name_roman).sort(), ["Aarav", "Neha", "Rohan Jha"]);
    assert.equal(mine3.find((x) => x.name_roman === "Rohan Jha")!.mool, "Zzqxplo");
    assert.equal(mine3.find((x) => x.name_roman === "Rohan Jha")!.mool_custom, true);
    assert.equal(mine3.find((x) => x.name_roman === "Rohan Jha")!.has_photo, true);
    assert.ok(!JSON.stringify(mine3).includes("data:image"));
    assert.ok(d.rels.filter((x) => x.tree_id === id).length >= 2);
    assert.equal(d.consents.filter((x) => x.tree_id === id).length, 1);
  }

  // bad payloads
  assert.equal((await post("/api/trees", { family: { persons: [], rels: [], next: 1 } })).status, 400);
  assert.equal((await post(`/api/trees/${id}`, { k: token, baseRev: 3, family: "nope" }, "PUT")).status, 400);
  // only the owner can delete; afterwards the link is dead
  const c2 = await post("/api/trees", { family: fam, ownerName: "Tmp" });
  const inv2 = await post(`/api/trees/${c2.body.id}/members`, { k: c2.body.token, name: "H" });
  assert.equal((await post(`/api/trees/${c2.body.id}`, { k: inv2.body.token }, "DELETE")).status, 403);
  assert.equal((await post(`/api/trees/${c2.body.id}`, { k: "bad" }, "DELETE")).status, 404);
  assert.equal((await post(`/api/trees/${c2.body.id}`, { k: c2.body.token }, "DELETE")).body.deleted, true);
  assert.equal((await j(`/api/trees/${c2.body.id}?k=${c2.body.token}`)).status, 404);
  if (process.env.DUMP) {
    const d = await (await fetch(process.env.DUMP)).json() as { persons: { tree_id: string }[] };
    assert.ok(!d.persons.some((x) => x.tree_id === c2.body.id));
    assert.ok(d.persons.some((x) => x.tree_id === id));
  }
  console.log("api tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
