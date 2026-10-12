import assert from "node:assert/strict";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { gotraPages, moolPages, slugOf } from "../src/lib/refpages";
import { llmsTxt, llmsFullTxt } from "../src/lib/llms";

delete process.env.NEXT_PUBLIC_APP_ENV; delete process.env.VERCEL_ENV; delete process.env.NEXT_PUBLIC_VERCEL_ENV;
process.env.NEXT_PUBLIC_SITE_URL = "https://paag.org.in";

// reference pages: every page has its own address, made only of a-z 0-9 and "-"
const gs = gotraPages(), ms = moolPages();
assert.equal(new Set(gs.map((g) => g.slug)).size, gs.length, "gotra slugs unique");
assert.equal(new Set(ms.map((m) => m.slug)).size, ms.length, "mool slugs unique");
for (const x of [...gs, ...ms]) assert.match(x.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, x.slug);
assert.ok(gs.length >= 15 && ms.length >= 100, `${gs.length} gotras, ${ms.length} mools`);
assert.equal(slugOf("Shāṇḍilya"), "shandilya");
// every mool names a gotra that has a page
const gid = new Set(gs.map((g) => g.id));
const orphan = ms.filter((m) => m.gotraIds.some((id) => !gid.has(id)));
assert.equal(orphan.length, 0, `mools naming a gotra with no page: ${orphan.map((m) => m.name).join(", ")}`);

// sitemap: public pages only, each once, and both FAQ languages point at each other
const sm = sitemap(); const urls = sm.map((s) => s.url);
assert.equal(new Set(urls).size, urls.length, "no duplicate addresses");
assert.equal(urls.length, 9 + gs.length + ms.length);
for (const u of urls) assert.ok(!/\/(app|admin|build|view|join|login|api|tree|intake)(\/|$)/.test(u), u);
assert.ok(urls.includes("https://paag.org.in/hi/faq"));
assert.ok(urls.includes(`https://paag.org.in/gotra/${gs.find((g) => g.name.startsWith("Shand"))!.slug}`));
const faq = sm.find((s) => s.url.endsWith("/hi/faq"))!;
assert.equal(faq.alternates?.languages?.hi, "https://paag.org.in/hi/faq");

// robots: private places closed to everybody, AI assistants allowed, and the switch for training crawlers works
const rules = (robots().rules as { userAgent: string | string[]; allow?: string | string[]; disallow?: string | string[] }[]);
const all = (r: typeof rules[number]) => ([] as string[]).concat(r.disallow ?? []);
for (const r of rules) { for (const p of ["/api/", "/app", "/admin", "/build", "/view/", "/join/"]) assert.ok(all(r).includes(p) || all(r).includes("/"), `${p} closed for ${r.userAgent}`); }
const ua = rules.flatMap((r) => ([] as string[]).concat(r.userAgent));
for (const b of ["*", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "GPTBot", "ClaudeBot", "Google-Extended"]) assert.ok(ua.includes(b), b);
assert.equal(robots().sitemap, "https://paag.org.in/sitemap.xml");
process.env.AI_TRAINING_CRAWLERS = "block";
const blocked = (robots().rules as typeof rules).find((r) => ([] as string[]).concat(r.userAgent).includes("GPTBot"))!;
assert.deepEqual(blocked.disallow, "/");
assert.ok((robots().rules as typeof rules).some((r) => ([] as string[]).concat(r.userAgent).includes("OAI-SearchBot") && !all(r).includes("/")), "search assistants stay allowed");
delete process.env.AI_TRAINING_CRAWLERS;
// the test copy stays hidden
process.env.NEXT_PUBLIC_APP_ENV = "staging";
assert.deepEqual(robots().rules, [{ userAgent: "*", disallow: "/" }]);
assert.equal(sitemap().length, 0);
delete process.env.NEXT_PUBLIC_APP_ENV;

// llms files: links point at the real site, nothing private
const l = llmsTxt(), lf = llmsFullTxt();
assert.match(l, /^# PAAG Foundation/);
assert.match(l, /https:\/\/paag\.org\.in\/hi\/faq/);
assert.match(lf, /Questions and answers/);
for (const t of [l, lf]) assert.ok(!/\/view\/|\/join\/|localhost/.test(t));
console.log(`seo OK (${gs.length} gotras, ${ms.length} mools, ${urls.length} sitemap urls, llms-full ${(lf.length / 1024).toFixed(0)} KB)`);
