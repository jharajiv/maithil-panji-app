/** Staging copy: banner flag, robots/sitemap closed, and email only to the allow-list. Run: npx tsx scripts/_staging.test.ts */
import assert from "node:assert/strict";
import http from "node:http";

const hits: string[] = [];
const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { hits.push(`${req.url} ${b.length ? (JSON.parse(b) as unknown[] | { to?: string[] }) && b : ""}`); res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); });
}).listen(3995, async () => {
  process.env.RESEND_API_KEY = "k"; process.env.EMAIL_FROM = "PAAG <hello@paag.org.in>"; process.env.RESEND_API_URL = "http://localhost:3995/emails";
  const mk = (to: string) => ({ to, subject: "s", html: "h", text: "t" });
  try {
    // ── production (default): everything is sent, search engines welcome
    const { isStaging, envName, stagingMailAllowed } = await import("../src/lib/env");
    const { sendMail, sendBatch } = await import("../src/lib/mail");
    assert.equal(isStaging(), false); assert.ok(envName() !== "staging");
    assert.equal(await sendMail(mk("anyone@example.com")), true); assert.equal(hits.length, 1);
    const robotsMod = await import("../src/app/robots"); const siteMod = await import("../src/app/sitemap");
    assert.ok(JSON.stringify(robotsMod.default()).includes("/faq")); assert.ok(siteMod.default().length >= 5);

    // ── staging with an allow-list
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    process.env.STAGING_MAIL_ALLOW = "me@myvyoma.io, @paag.org.in";
    assert.ok(isStaging() && envName() === "staging");
    assert.equal(stagingMailAllowed("ME@myvyoma.io"), true); assert.equal(stagingMailAllowed("x@paag.org.in"), true);
    assert.equal(stagingMailAllowed("x@evilpaag.org.in"), false); assert.equal(stagingMailAllowed("other@example.com"), false);
    hits.length = 0;
    assert.equal(await sendMail(mk("stranger@example.com")), true); assert.equal(hits.length, 0, "no email to a stranger from staging");
    assert.equal(await sendMail(mk("me@myvyoma.io")), true); assert.equal(hits.length, 1);
    hits.length = 0;
    const r = await sendBatch([mk("a@example.com"), mk("me@myvyoma.io"), mk("b@example.com"), mk("test@paag.org.in")]);
    assert.deepEqual(r, { sent: 2, failed: 0 }); assert.equal(hits.length, 1);
    assert.ok(hits[0]!.includes("me@myvyoma.io") && hits[0]!.includes("test@paag.org.in") && !hits[0]!.includes("example.com"));
    // staging with an empty list: nothing leaves
    process.env.STAGING_MAIL_ALLOW = ""; hits.length = 0;
    await sendMail(mk("me@myvyoma.io")); assert.equal((await sendBatch([mk("me@myvyoma.io")])).sent, 0); assert.equal(hits.length, 0);
    // robots and sitemap are closed
    assert.deepEqual(robotsMod.default().rules, [{ userAgent: "*", disallow: "/" }]); assert.deepEqual(siteMod.default(), []);
    // Vercel preview deployments count as staging too
    delete process.env.NEXT_PUBLIC_APP_ENV; assert.equal(isStaging(), false); process.env.VERCEL_ENV = "preview"; assert.equal(isStaging(), true);
    console.log("staging OK");
  } catch (e) { console.error(e); process.exitCode = 1; } finally { srv.close(); }
});
