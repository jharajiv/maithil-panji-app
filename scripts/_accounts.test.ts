/** Accounts + invitation flow against a running dev server (dev code provider): BASE=http://localhost:3100 npx tsx scripts/_accounts.test.ts */
import assert from "node:assert/strict";
import { applyOps, emptyFamily } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
type Res = { status: number; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
class Client {
  cookie = "";
  async call(path: string, method = "GET", body?: unknown): Promise<Res> {
    const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get("set-cookie");
    if (sc) { const v = sc.split(";")[0]!; this.cookie = v.endsWith("=") ? "" : v; }
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  async signIn(email: string, name: string, phone: string) {
    const s = await this.call("/api/auth/start", "POST", { email });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    const v = await this.call("/api/auth/verify", "POST", { email, code: s.body.devCode, name, phone, consent: true });
    assert.equal(v.status, 200, JSON.stringify(v.body));
    return { isNew: s.body.isNew as boolean, account: v.body.account };
  }
}

(async () => {
  const owner = new Client(), vik = new Client(), eve = new Client();
  const t = String(Date.now()).slice(-8);
  const E_OWNER = `Rohan.${t}@Example.com`, E_VIK = `vikram.${t}@example.com`, E_EVE = `eve.${t}@example.com`;
  const P_OWNER = `+9198${t}`, P_VIK = `+9197${t}`;

  assert.deepEqual((await owner.call("/api/auth/me")).body.account, null);
  let fam = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Rohan Jha", gender: "male" }]).family;
  assert.equal((await owner.call("/api/trees", "POST", { family: fam })).status, 401, "anonymous create is refused while accounts are on");

  // sign-up rules
  assert.equal((await owner.call("/api/auth/start", "POST", { email: "not-an-email" })).status, 400);
  const st = await owner.call("/api/auth/start", "POST", { email: E_OWNER });
  assert.equal(st.status, 200); assert.equal(st.body.isNew, true); assert.equal(st.body.email, E_OWNER.toLowerCase());
  assert.equal((await owner.call("/api/auth/verify", "POST", { email: E_OWNER, code: st.body.devCode })).body.needsProfile, true);
  assert.equal((await owner.call("/api/auth/verify", "POST", { email: E_OWNER, code: st.body.devCode, name: "Rohan Jha", consent: true })).body.needsProfile, true, "mobile number is required");
  assert.equal((await owner.call("/api/auth/verify", "POST", { email: E_OWNER, code: "000000", name: "Rohan", phone: P_OWNER, consent: true })).status, 401);
  assert.equal((await owner.call("/api/auth/verify", "POST", { email: E_OWNER, code: st.body.devCode, name: "Rohan Jha", phone: P_OWNER, consent: true })).status, 200);
  const me = (await owner.call("/api/auth/me")).body.account; assert.equal(me.name, "Rohan Jha"); assert.equal(me.email, E_OWNER.toLowerCase());
  assert.equal((await new Client().call("/api/me/trees")).status, 401);

  // create + access
  const c = await owner.call("/api/trees", "POST", { family: fam }); assert.equal(c.status, 200); assert.equal(c.body.token, undefined);
  const id = c.body.id as string;
  const g = await owner.call(`/api/trees/${id}`); assert.equal(g.body.role, "owner"); assert.equal(g.body.family.persons.length, 1);
  assert.equal((await new Client().call(`/api/trees/${id}`)).status, 404);
  const mine = await owner.call("/api/me/trees"); assert.equal(mine.body.mine.length, 1); assert.equal(mine.body.mine[0].title, "Rohan’s family"); assert.equal(mine.body.mine[0].people, 1);

  // invite: name + mobile number required; the link carries a single-use secret
  assert.equal((await owner.call(`/api/trees/${id}/members`, "POST", { name: "Vikram" })).status, 400, "phone is required");
  assert.equal((await owner.call(`/api/trees/${id}/members`, "POST", { name: "Vikram", phone: "123" })).status, 400);
  const inv = await owner.call(`/api/trees/${id}/members`, "POST", { name: "Vikram", phone: P_VIK, personId: "p1" });
  assert.equal(inv.status, 200); assert.match(inv.body.path, new RegExp(`^/join/${id}\\?i=[\\w-]{20,}$`));
  const link1 = inv.body.path as string; const secret1 = link1.split("i=")[1]!;
  const vm = inv.body.members.find((m: any) => m.name === "Vikram"); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal(vm.status, "invited"); assert.ok(vm.phone_hint.endsWith(P_VIK.slice(-3))); assert.ok(!JSON.stringify(inv.body.members).includes(P_VIK)); assert.ok(!JSON.stringify(inv.body.members).includes("invite_hash"));
  assert.equal((await owner.call(`/api/trees/${id}/members`, "POST", { name: "Me again", phone: P_OWNER })).status, 400, "a number that already has access cannot be invited again");

  // preview needs the secret
  assert.equal((await new Client().call(`/api/trees/${id}/join`)).status, 404);
  assert.equal((await new Client().call(`/api/trees/${id}/join?i=wrong`)).status, 404);
  const pv = await new Client().call(`/api/trees/${id}/join?i=${secret1}`); assert.equal(pv.status, 200); assert.equal(pv.body.owner, "Rohan Jha"); assert.equal(pv.body.inviteName, "Vikram"); assert.equal(pv.body.invitePhone, P_VIK);

  // re-inviting the same number replaces the link: the old one stops working
  const again = await owner.call(`/api/trees/${id}/members`, "POST", { name: "Vikram", phone: P_VIK });
  assert.equal(again.body.existing, true); const secret2 = (again.body.path as string).split("i=")[1]!; assert.notEqual(secret1, secret2);
  assert.equal((await new Client().call(`/api/trees/${id}/join?i=${secret1}`)).status, 404);

  // the invitee signs up (any email), the link joins them; the link works once
  assert.equal((await vik.signIn(E_VIK, "Vikram Jha", P_VIK)).isNew, true);
  assert.equal((await vik.call(`/api/trees/${id}`)).status, 404, "not a member until the invitation is used");
  assert.equal((await vik.call(`/api/trees/${id}/join`, "POST", { i: secret1 })).status, 403, "replaced link is dead");
  assert.equal((await vik.call(`/api/trees/${id}/join`, "POST", {})).status, 403, "no secret, no entry");
  assert.equal((await vik.call(`/api/trees/${id}/join`, "POST", { i: secret2 })).status, 200);
  assert.equal((await vik.call(`/api/trees/${id}/join`, "POST", { i: secret2 })).body.already, true);
  assert.equal((await new Client().call(`/api/trees/${id}/join?i=${secret2}`)).status, 404, "used link no longer opens");
  const vg = await vik.call(`/api/trees/${id}`); assert.equal(vg.body.role, "editor"); assert.equal(vg.body.members, undefined);
  assert.equal((await vik.call("/api/me/trees")).body.shared.length, 1);

  // a forwarded, already-used link is useless to anyone else
  await eve.signIn(E_EVE, "Eve", `+9196${t}`);
  assert.equal((await eve.call(`/api/trees/${id}/join`, "POST", { i: secret2 })).status, 403);
  assert.equal((await eve.call(`/api/trees/${id}`)).status, 404);

  // collaborator edits; owner sees it; collaborator cannot invite/delete
  const edited = applyOps(structuredClone(vg.body.family), [{ op: "add_person", name_roman: "Meera", relation: { type: "spouse_of", to: "p1" } }, { op: "update_person", id: "p1", set: { birth: "1985-03-14", photo: "data:image/jpeg;base64,/9j/AAAA" } }]).family;
  assert.equal((await vik.call(`/api/trees/${id}`, "PUT", { baseRev: vg.body.rev, family: edited })).status, 200);
  const og = await owner.call(`/api/trees/${id}`); assert.equal(og.body.family.persons.length, 2); assert.equal(og.body.family.persons[0].birth, "1985-03-14"); assert.ok(og.body.family.persons[0].photo.startsWith("data:image/jpeg"));
  const joined = og.body.members.find((m: any) => m.name === "Vikram"); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal(joined.status, "joined"); assert.match(joined.email_hint, /^v•+@example\.com$/); assert.ok(!JSON.stringify(og.body.members).includes(E_VIK));
  assert.equal((await owner.call("/api/me/trees")).body.mine[0].people, 2);
  assert.equal((await vik.call(`/api/trees/${id}/members`, "POST", { name: "X", phone: P_OWNER })).status, 403);
  assert.equal((await vik.call(`/api/trees/${id}`, "DELETE", {})).status, 403);

  // leaving, and being removed
  assert.equal((await vik.call(`/api/trees/${id}/members`, "DELETE", { memberId: vg.body.member.id })).status, 200);
  assert.equal((await vik.call(`/api/trees/${id}`)).status, 404);
  const re = await owner.call(`/api/trees/${id}/members`, "POST", { name: "Vikram", phone: P_VIK });
  assert.equal(re.status, 200);
  assert.equal((await vik.call(`/api/trees/${id}/join`, "POST", { i: (re.body.path as string).split("i=")[1] })).status, 200);
  assert.equal((await owner.call(`/api/trees/${id}/members`, "DELETE", { memberId: (await owner.call(`/api/trees/${id}`)).body.members.find((m: any) => m.name === "Vikram").id })).status, 200); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal((await vik.call(`/api/trees/${id}`)).status, 404);

  // sign-in on a second device: same account, same trees
  const phone2 = new Client(); const s2 = await phone2.call("/api/auth/start", "POST", { email: E_OWNER.toUpperCase() }); assert.equal(s2.body.isNew, false);
  assert.equal((await phone2.call("/api/auth/verify", "POST", { email: E_OWNER, code: s2.body.devCode })).status, 200);
  assert.equal((await phone2.call("/api/me/trees")).body.mine.length, 1);

  // sign out kills the session
  const old = owner.cookie; await owner.call("/api/auth/logout", "POST");
  assert.equal((await owner.call("/api/auth/me")).body.account, null);
  const ghost = new Client(); ghost.cookie = old; assert.equal((await ghost.call(`/api/trees/${id}`)).status, 404);

  // codes are single-use and rate-limited by attempts
  const cc = new Client(); const s3 = await cc.call("/api/auth/start", "POST", { email: E_OWNER });
  assert.equal((await cc.call("/api/auth/verify", "POST", { email: E_OWNER, code: s3.body.devCode })).status, 200);
  assert.equal((await cc.call("/api/auth/verify", "POST", { email: E_OWNER, code: s3.body.devCode })).status, 401, "a code works once");

  // delete tree
  assert.equal((await phone2.call(`/api/trees/${id}`, "DELETE", {})).body.deleted, true);
  assert.equal((await phone2.call("/api/me/trees")).body.mine.length, 0);

  if (process.env.DUMP) {
    const d = await (await fetch(process.env.DUMP)).json() as { accounts: { email: string }[]; consents: { kind: string }[] };
    assert.equal(d.accounts.filter((a) => a.email === E_OWNER.toLowerCase()).length, 1);
    assert.ok(d.consents.some((x) => x.kind === "account-terms"));
  }
  console.log("account tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
