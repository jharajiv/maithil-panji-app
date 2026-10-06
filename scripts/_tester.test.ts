import assert from "node:assert/strict";
process.env.TEST_LOGIN_EMAILS = "Nidi.Friend@Gmail.com, other@example.com";
process.env.TEST_LOGIN_CODE = "48291735";
import { checkLoginCode, isTester, sendLoginCode } from "../src/lib/auth";
(async () => {
  const store = {} as never; // testers never touch the store
  assert.ok(isTester("nidi.friend@gmail.com") && isTester("other@example.com"));
  assert.ok(!isTester("stranger@gmail.com"));
  assert.deepEqual(await sendLoginCode(store, "nidi.friend@gmail.com"), { ok: true, tester: true });
  assert.equal(await checkLoginCode(store, "nidi.friend@gmail.com", "48291735"), true);
  assert.equal(await checkLoginCode(store, "nidi.friend@gmail.com", "48291736"), false);
  assert.equal(await checkLoginCode(store, "nidi.friend@gmail.com", "4829173"), false);
  // a code that is not on the list never works for anyone else (falls through to the normal store lookup, which fails here)
  await assert.rejects(() => checkLoginCode(store, "stranger@gmail.com", "48291735"));
  process.env.TEST_LOGIN_CODE = "12ab";
  assert.ok(!isTester("nidi.friend@gmail.com"), "an invalid code switches the tester list off");
  console.log("tester tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
