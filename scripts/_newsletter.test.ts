/** Newsletter: sign-up with email confirmation, unsubscribe, admin numbers / CSV / sending, setup status. A stand-in for Resend records the emails. */
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nl-"));
Object.assign(process.env, { STORE: "file", DATA_DIR: dir, AUTH_SECRET: "test-secret-long-enough", RESEND_API_KEY: "rk", EMAIL_FROM: "PAAG Foundation <hello@paag.org.in>", RESEND_API_URL: "http://localhost:3996/emails", NEXT_PUBLIC_SITE_URL: "https://paag.org.in", NEXT_PUBLIC_CONTACT_EMAIL: "hello@paag.org.in", ADMIN_EMAILS: "boss@example.com" });
delete process.env.GOOGLE_CLIENT_ID;

type Sent = { to: string[]; subject: string; html: string; text: string; headers?: Record<string, string>; reply_to?: string };
const sent: Sent[] = [];
let failNext = false;

async function main() {
  const srv = http.createServer((rq, rs) => {
    let raw = ""; rq.on("data", (d) => (raw += d)); rq.on("end", () => {
      if (failNext) { failNext = false; rs.statusCode = 500; rs.end("{}"); return; }
      const j = JSON.parse(raw);
      if (rq.url === "/emails/batch") sent.push(...(j as Sent[])); else if (rq.url === "/emails") sent.push(j as Sent);
      rs.setHeader("content-type", "application/json"); rs.end("{}");
    });
  });
  await new Promise<void>((ok) => srv.listen(3996, ok));

  const { getStore, hashToken, newAccountId } = await import("../src/lib/store");
  const sub = await import("../src/app/api/newsletter/route");
  const conf = await import("../src/app/api/newsletter/confirm/route");
  const unsub = await import("../src/app/api/newsletter/unsubscribe/route");
  const adm = await import("../src/app/api/admin/newsletter/route");
  const stat = await import("../src/app/api/admin/status/route");
  const { textToHtml, emailFromToken, confirmToken, unsubToken } = await import("../src/lib/newsletter");
  const store = getStore()!;
  let ip = 0;
  const post = (body: unknown) => sub.POST(new Request("http://x/api/newsletter", { method: "POST", headers: { "x-forwarded-for": `10.0.0.${++ip}` }, body: JSON.stringify(body) }));
  const tokenOf = (text: string) => decodeURIComponent(/[?&]t=([^\s&"<]+)/.exec(text)![1]!);

  assert.deepEqual(await (await sub.GET()).json(), { enabled: true });

  // validation
  assert.equal((await post({ email: "nope", consent: true })).status, 400);
  assert.equal((await post({ email: "a@example.com" })).status, 400, "the box must be ticked");
  assert.equal(sent.length, 0);
  assert.equal((await (await post({ email: "robot@example.com", consent: true, website: "http://spam" })).json()).ok, true);
  assert.equal(sent.length, 0, "a robot filling the hidden field gets no email and no record");
  assert.equal(await store.getSubscriber("robot@example.com"), null);

  // sign-up → pending + a confirmation mail in the chosen language
  assert.equal((await post({ email: "Asha@Example.com", lang: "hi", source: "footer", consent: true })).status, 200);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]!.to, ["asha@example.com"]);
  assert.match(sent[0]!.subject, /पक्का/);
  assert.equal(sent[0]!.reply_to, "hello@paag.org.in");
  assert.equal((await store.getSubscriber("asha@example.com"))!.status, "pending");
  // asking again at once: the same answer, no second email
  assert.equal((await post({ email: "asha@example.com", lang: "hi", consent: true })).status, 200);
  assert.equal(sent.length, 1, "no repeat within ten minutes");

  // the link in the email confirms
  const link = tokenOf(sent[0]!.text);
  const go = (t: string) => conf.GET(new Request(`https://paag.org.in/api/newsletter/confirm?t=${encodeURIComponent(t)}`));
  const bad = await go("garbage"); assert.match(bad.headers.get("location")!, /\/newsletter\?s=invalid/);
  assert.match((await go(unsubToken("asha@example.com"))).headers.get("location")!, /s=invalid/, "an unsubscribe link is not a confirm link");
  assert.match((await go(confirmToken("never@example.com"))).headers.get("location")!, /s=invalid/, "nobody asked for this address");
  const ok = await go(link); assert.equal(ok.headers.get("location"), "https://paag.org.in/newsletter?s=confirmed");
  assert.equal((await store.getSubscriber("asha@example.com"))!.status, "confirmed");
  assert.equal(emailFromToken(link, "nl-confirm"), "asha@example.com");
  // already confirmed: quiet (no email)
  await post({ email: "asha@example.com", consent: true }); assert.equal(sent.length, 1);

  // a failing mail provider is reported
  failNext = true;
  assert.equal((await post({ email: "ravi@example.com", consent: true })).status, 502);

  // second and third subscribers
  await post({ email: "meena@example.com", lang: "en", consent: true });
  await go(tokenOf(sent.at(-1)!.text));
  await post({ email: "pending@example.com", lang: "en", consent: true });

  // admin: numbers, csv, test send, real send
  const token = "admin-session-token";
  await store.createAccount({ id: newAccountId(), email: "boss@example.com", name: "Boss", created_at: new Date().toISOString() });
  const acc = (await store.getAccountByEmail("boss@example.com"))!;
  await store.createSession({ token_hash: hashToken(token), account_id: acc.id, expires_at: new Date(Date.now() + 3600_000).toISOString(), created_at: new Date().toISOString() });
  const asAdmin = (url: string, init: RequestInit = {}) => new Request(url, { ...init, headers: { ...(init.headers ?? {}), cookie: `pj_session=${token}`, "x-forwarded-for": "7.7.7.7" } });
  assert.equal((await adm.GET(new Request("http://x/api/admin/newsletter"))).status, 404, "anonymous");
  const nums = await (await adm.GET(asAdmin("http://x/api/admin/newsletter"))).json();
  assert.equal(nums.confirmed, 2); assert.equal(nums.pending, 2); assert.equal(nums.confirmedHi, 1); assert.equal(nums.confirmedEn, 1);
  const csvRes = await adm.GET(asAdmin("http://x/api/admin/newsletter?format=csv"));
  const bytes = new Uint8Array(await csvRes.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "BOM so Excel reads it as UTF-8");
  const csv = new TextDecoder().decode(bytes);
  assert.match(csv, /asha@example.com,confirmed,hi,footer/); assert.match(csv, /email,status,language/);
  assert.match(csvRes.headers.get("content-disposition")!, /PAAG-newsletter-subscribers\.csv/);

  const before = sent.length;
  const t = await (await adm.POST(asAdmin("http://x/api/admin/newsletter", { method: "POST", body: JSON.stringify({ subject: "Hello", body: "Namaste\n\nSee https://paag.org.in/sample.", test: true }) }))).json();
  assert.equal(t.sent, 1); assert.deepEqual(sent.at(-1)!.to, ["boss@example.com"]); assert.match(sent.at(-1)!.subject, /^\[Test\]/);
  assert.equal(sent.length, before + 1);

  const r = await (await adm.POST(asAdmin("http://x/api/admin/newsletter", { method: "POST", body: JSON.stringify({ subject: "Diwali greetings", body: "## Namaste\n\nHello <b>friends</b>\n\nVisit https://paag.org.in/sample.", audience: "all" }) }))).json();
  assert.equal(r.total, 2); assert.equal(r.sent, 2);
  const mails = sent.slice(-2);
  assert.deepEqual(mails.map((m) => m.to[0]).sort(), ["asha@example.com", "meena@example.com"], "only confirmed people");
  for (const m of mails) {
    assert.match(m.headers!["List-Unsubscribe"]!, /^<https:\/\/paag\.org\.in\/api\/newsletter\/unsubscribe\?t=/);
    assert.equal(m.headers!["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.match(m.html, /&lt;b&gt;friends&lt;\/b&gt;/, "typed HTML is shown as text, not run");
    assert.match(m.html, /<a href="https:\/\/paag\.org\.in\/sample" /, "web address becomes a link without the full stop");
    assert.match(m.html, /<h2/);
  }
  assert.equal((await (await adm.POST(asAdmin("http://x/api/admin/newsletter", { method: "POST", body: JSON.stringify({ subject: "", body: "x" }) }))).status), 400);
  assert.equal((await adm.POST(new Request("http://x/api/admin/newsletter", { method: "POST", body: "{}" }))).status, 404, "anonymous cannot send");

  // unsubscribe: from the email link (the page's button posts), one-click from the mail program
  const un = tokenOf(mails.find((m) => m.to[0] === "asha@example.com")!.text);
  const g = await unsub.GET(new Request(`https://paag.org.in/api/newsletter/unsubscribe?t=${encodeURIComponent(un)}`));
  assert.match(g.headers.get("location")!, /\/newsletter\/unsubscribe\?t=/);
  assert.equal((await store.getSubscriber("asha@example.com"))!.status, "confirmed", "just visiting the link does not unsubscribe");
  assert.equal((await unsub.POST(new Request(`https://paag.org.in/api/newsletter/unsubscribe?t=${encodeURIComponent(un)}`, { method: "POST", body: "List-Unsubscribe=One-Click" }))).status, 200);
  assert.equal((await store.getSubscriber("asha@example.com"))!.status, "unsubscribed");
  assert.equal((await unsub.POST(new Request("https://paag.org.in/api/newsletter/unsubscribe?t=bad", { method: "POST" }))).status, 400);
  assert.equal((await unsub.POST(new Request(`https://paag.org.in/api/newsletter/unsubscribe?t=${encodeURIComponent(confirmToken("meena@example.com"))}`, { method: "POST" }))).status, 400, "a confirm link cannot unsubscribe");
  const after = await (await adm.GET(asAdmin("http://x/api/admin/newsletter"))).json(); assert.equal(after.confirmed, 1); assert.equal(after.unsubscribed, 1);
  // someone who left can come back (and must confirm again)
  await post({ email: "asha@example.com", consent: true });
  assert.equal((await store.getSubscriber("asha@example.com"))!.status, "pending");

  // text → html
  assert.equal(textToHtml("a\n\nb"), `<p style="font-size:16px;line-height:1.6;margin:0 0 16px">a</p>\n<p style="font-size:16px;line-height:1.6;margin:0 0 16px">b</p>`);
  assert.ok(!textToHtml("<script>alert(1)</script>").includes("<script>"));
  assert.ok(!textToHtml("javascript:alert(1) http://evil.example").includes("<a "), "only https addresses become links");

  // setup status: admin only, no secret values
  assert.equal((await stat.GET(new Request("http://x/api/admin/status"))).status, 404);
  const st = await (await stat.GET(asAdmin("https://paag.org.in/api/admin/status"))).json();
  const text = JSON.stringify(st);
  assert.ok(!text.includes("test-secret-long-enough") && !text.includes('"rk"'), "no secret values");
  const by = Object.fromEntries(st.checks.map((c: { id: string }) => [c.id, c]));
  assert.equal(by.site.ok, true); assert.equal(by.mail.ok, true); assert.equal(by.google.ok, false); assert.equal(by.newsletter.ok, true);
  assert.match(by.google.extra, /^Authorised redirect URI to register with Google: https:\/\/paag\.org\.in\/api\/auth\/google\/callback$/);

  // off without email sending
  delete process.env.RESEND_API_KEY;
  assert.deepEqual(await (await sub.GET()).json(), { enabled: false });
  assert.equal((await post({ email: "late@example.com", consent: true })).status, 503);

  srv.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log("newsletter OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
