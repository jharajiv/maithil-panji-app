import assert from "node:assert/strict";
import { analyticsAddress, BANNER_PATHS, gaId } from "../src/lib/consent";
import { withUtm } from "../src/lib/utm";
import { inviteUrl, captureRef } from "../src/lib/invite";

// private addresses never reach Google with their key or id
assert.deepEqual(analyticsAddress("/view/abc123", "?k=SECRETKEY&utm_source=whatsapp"), { path: "/view/[id]", query: "" });
assert.deepEqual(analyticsAddress("/join/abc123", "?key=SECRET"), { path: "/join/[id]", query: "" });
assert.deepEqual(analyticsAddress("/app/tree/t_9f3", ""), { path: "/app/tree/[id]", query: "" });
assert.deepEqual(analyticsAddress("/app/bridge/t_1/t_2", "?k=x"), { path: "/app/bridge/[id]/[id]", query: "" });
assert.deepEqual(analyticsAddress("/app", "?import=1"), { path: "/app", query: "" });
// public pages keep only the campaign labels, never the invitation code
assert.deepEqual(analyticsAddress("/", "?ref=abcdef0123&utm_source=invite&utm_medium=whatsapp&utm_campaign=invite&x=1"), { path: "/", query: "?utm_source=invite&utm_medium=whatsapp&utm_campaign=invite" });
assert.deepEqual(analyticsAddress("/faq", ""), { path: "/faq", query: "" });
// the banner is for public pages only, never the chat screen or private pages
for (const ok of ["/", "/about", "/faq", "/hi/faq", "/gotra", "/gotra/shandilya", "/mool/sarisab", "/sample", "/privacy", "/safety"]) assert.ok(BANNER_PATHS.test(ok), ok);
for (const no of ["/build", "/app", "/view/x", "/join/x", "/login", "/admin", "/newsletter"]) assert.ok(!BANNER_PATHS.test(no), no);
// analytics is off unless an id is set
delete process.env.NEXT_PUBLIC_GA_ID; assert.equal(gaId(), undefined);
process.env.NEXT_PUBLIC_GA_ID = "not-an-id"; assert.equal(gaId(), undefined);
process.env.NEXT_PUBLIC_GA_ID = "G-ABC123XYZ9"; assert.equal(gaId(), "G-ABC123XYZ9");
process.env.NEXT_PUBLIC_APP_ENV = "staging"; assert.equal(gaId(), undefined);
// share links
assert.equal(withUtm("https://paag.org.in/view/x?k=1", "whatsapp"), "https://paag.org.in/view/x?k=1&utm_source=whatsapp&utm_medium=share&utm_campaign=tree");
assert.equal(withUtm("https://paag.org.in/?utm_source=a", "b"), "https://paag.org.in/?utm_source=a");
assert.equal(withUtm("not a url", "x"), "not a url");
const inv = inviteUrl("https://paag.org.in", "abcdef0123", "whatsapp");
assert.match(inv, /\?ref=abcdef0123&utm_source=invite&utm_medium=whatsapp/);
// the invitation code is still found in the longer link (storage is not available here, so only check it does not throw)
captureRef(new URL(inv).search);
console.log("analytics OK");
