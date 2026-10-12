/**
 * Birthday reminders through the real routes. Needs: node scripts/_fake_resend.mjs &  and a dev server started with
 *   RESEND_API_KEY=k RESEND_API_URL=http://localhost:3998 EMAIL_FROM="PAAG <hello@paag.org.in>" CRON_SECRET=cron-secret-0123456789 AUTH_SECRET=... STORE=file
 * then: BASE=http://localhost:3100 npx tsx scripts/_reminders_api.test.ts
 */
import assert from "node:assert/strict";
import { applyOps, emptyFamily } from "../src/lib/family";

const BASE = process.env.BASE ?? "http://localhost:3100";
const MAIL = "http://localhost:3998";
type Res = { status: number; body: Record<string, any>; headers: Headers }; // eslint-disable-line @typescript-eslint/no-explicit-any
class Client {
  cookie = "";
  async call(path: string, method = "GET", body?: unknown, extra: Record<string, string> = {}): Promise<Res> {
    const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "content-type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get("set-cookie");
    if (sc) { const v = sc.split(";")[0]!; this.cookie = v.endsWith("=") ? "" : v; }
    return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
  }
}
const sentMail = async () => (await (await fetch(`${MAIL}/__sent`)).json()) as { to: string[]; subject: string; html: string; text: string; headers?: Record<string, string> }[];

(async () => {
  await fetch(`${MAIL}/__sent`, { method: "DELETE" });
  const c = new Client(), anon = new Client();
  const t = String(Date.now()).slice(-8), email = `rem.${t}@example.com`;
  assert.equal((await anon.call("/api/me/reminders")).status, 401);
  assert.equal((await anon.call("/api/me/reminders", "PUT", { on: true })).status, 401);

  const s = await c.call("/api/auth/start", "POST", { email });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const code = s.body.devCode ?? /\b(\d{6})\b/.exec((await sentMail()).filter((m) => m.to.includes(email)).at(-1)?.text ?? "")?.[1];
  assert.ok(code, "sign-in code");
  const v = await c.call("/api/auth/verify", "POST", { email, code, name: "Rohan Jha", phone: `+9198${t}`, consent: true });
  assert.equal(v.status, 200, JSON.stringify(v.body));

  // a tree with two birthdays: one in 7 days (India's date), one today
  const ist = new Date(Date.now() + 5.5 * 3600_000), iso = (d: Date, y: number) => `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const in7 = new Date(ist.getTime() + 7 * 86_400_000);
  const fam = applyOps(emptyFamily(), [{ op: "add_person", name_roman: "Rohan Jha", gender: "male" }, { op: "add_person", name_roman: "Meera Jha", gender: "female" }, { op: "add_person", name_roman: "Kabir Jha", gender: "male" }]).family;
  fam.persons[0]!.is_me = true;
  fam.persons[1]!.birth = iso(in7, 1990); fam.persons[2]!.birth = iso(ist, 2015);
  const made = await c.call("/api/trees", "POST", { family: fam, ownerName: "Rohan" });
  assert.equal(made.status, 200, JSON.stringify(made.body));

  // off by default; the person sees what would be reminded before switching on
  const g0 = await c.call("/api/me/reminders");
  assert.equal(g0.status, 200); assert.equal(g0.body.on, false); assert.equal(g0.body.mailReady, true);
  assert.equal(g0.body.living, 3); assert.equal(g0.body.withDate, 2);
  assert.deepEqual(g0.body.next.map((n: { name: string }) => n.name), ["Kabir Jha", "Meera Jha"]);
  const dash = await c.call("/api/me/profile"); assert.equal(dash.body.profile.reminders, undefined);

  // the cron endpoint is closed without the secret; nothing is sent while nobody switched reminders on
  assert.equal((await anon.call("/api/cron/birthdays")).status, 404);
  assert.equal((await anon.call("/api/cron/birthdays", "GET", undefined, { authorization: "Bearer wrong" })).status, 404);
  const cron = { authorization: `Bearer ${process.env.CRON_SECRET ?? "cron-secret-0123456789"}` };
  const r0 = await anon.call("/api/cron/birthdays", "GET", undefined, cron);
  assert.equal(r0.status, 200); assert.equal(r0.body.emails === 0 || r0.body.emails === undefined, true);
  await fetch(`${MAIL}/__sent`, { method: "DELETE" }); // forget the sign-in code email

  // switch on (week ahead), saving the profile does not undo it, and it cannot be forged through the profile
  const on = await c.call("/api/me/reminders", "PUT", { on: true, lead: "week" });
  assert.equal(on.status, 200); assert.equal(on.body.on, true); assert.equal(on.body.lead, "week");
  await c.call("/api/me/profile", "PUT", { name: "Rohan Jha", profile: { occupation: "teacher", reminders: { birthdays: false, lead: "day" }, _sent: ["x"] } });
  const g1 = await c.call("/api/me/reminders"); assert.equal(g1.body.on, true); assert.equal(g1.body.lead, "week");
  assert.equal((await c.call("/api/me/profile")).body.profile.occupation, "teacher");

  // test email goes to the person only, and says it is a test
  const te = await c.call("/api/me/reminders", "POST");
  assert.equal(te.status, 200, JSON.stringify(te.body));
  let mails = (await sentMail()).filter((m) => m.to.includes(email));
  assert.equal(mails.length, 1); assert.match(mails[0]!.subject, /^\[Test\]/);

  // the daily job: Kabir today + Meera in 7 days → two emails to the owner only (one for each kind), then nothing more
  const r1 = await anon.call("/api/cron/birthdays", "GET", undefined, cron);
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  mails = (await sentMail()).filter((m) => m.to.includes(email) && !m.subject.startsWith("[Test]"));
  assert.equal(mails.length, 1, "one email lists both"); assert.match(mails[0]!.subject, /^2 family birthdays/);
  assert.match(mails[0]!.html, /Kabir Jha/); assert.match(mails[0]!.html, /Meera Jha/);
  assert.ok((await sentMail()).every((m) => m.to.length === 1), "each email goes to one person");
  const r2 = await anon.call("/api/cron/birthdays", "GET", undefined, cron);
  assert.equal((await sentMail()).filter((m) => m.to.includes(email) && !m.subject.startsWith("[Test]")).length, 1, "not sent twice");
  void r2;

  // the stop link: opening it only shows a page; the button (POST) switches reminders off
  const stop = new URL(/<(https?:\/\/[^>]+)>/.exec(mails[0]!.headers!["List-Unsubscribe"]!)![1]!);
  const link = stop.pathname + stop.search;
  const peek = await anon.call(link); assert.equal(peek.status, 307); assert.match(peek.headers.get("location") ?? "", /\/reminders\/unsubscribe\?t=/);
  assert.equal((await c.call("/api/me/reminders")).body.on, true, "merely opening the link changes nothing");
  assert.equal((await anon.call("/api/reminders/unsubscribe?t=garbage", "POST")).status, 400);
  assert.equal((await anon.call(link, "POST")).status, 200);
  assert.equal((await c.call("/api/me/reminders")).body.on, false);
  console.log("reminders api OK");
})();
