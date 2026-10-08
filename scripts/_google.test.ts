/**
 * Google sign-in against a dev server started with a fake Google:
 *   GOOGLE_CLIENT_ID=test-client GOOGLE_CLIENT_SECRET=s GOOGLE_AUTH_URL=http://localhost:3998/auth GOOGLE_TOKEN_URL=http://localhost:3998/token npx next dev -p 3100
 *   BASE=http://localhost:3100 npx tsx scripts/_google.test.ts
 * The fake token endpoint turns the code "<email>|<name>|<flags>" into an id_token.
 */
import assert from "node:assert/strict";
import http from "node:http";

const BASE = process.env.BASE ?? "http://localhost:3100";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
let lastRedirect = "";

const fake = http.createServer(async (req, res) => {
  const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
  const p = new URLSearchParams(Buffer.concat(chunks).toString());
  if (req.url === "/token") {
    lastRedirect = p.get("redirect_uri") ?? "";
    if (p.get("client_secret") !== "s" || p.get("grant_type") !== "authorization_code") { res.writeHead(400); return res.end("{}"); }
    const [email, name, flag] = decodeURIComponent(p.get("code") ?? "").split("|");
    if (flag === "reject") { res.writeHead(400); return res.end("{}"); }
    const claims = { iss: "https://accounts.google.com", aud: flag === "badaud" ? "someone-else" : "test-client", exp: Math.floor(Date.now() / 1000) + 3600, email, email_verified: flag !== "unverified", name };
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id_token: `${b64({ alg: "RS256" })}.${b64(claims)}.sig`, access_token: "x" }));
  }
  res.writeHead(404); res.end();
}).listen(3998);

class Client {
  jar = new Map<string, string>();
  async raw(path: string, init: RequestInit = {}) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const r = await fetch(BASE + path, { redirect: "manual", ...init, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) } });
    for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv!.indexOf("="); const k = kv!.slice(0, i), v = kv!.slice(i + 1); if (!v) this.jar.delete(k); else this.jar.set(k, v); }
    return r;
  }
  async json(path: string, method = "GET", body?: unknown) { const r = await this.raw(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, any> }; } // eslint-disable-line @typescript-eslint/no-explicit-any
  /** start → "Google" → callback; returns the callback response */
  async viaGoogle(code: string, next = "/app", tamper?: (state: string) => string) {
    const s = await this.raw(`/api/auth/google/start?next=${encodeURIComponent(next)}`);
    assert.equal(s.status, 307, "start redirects to Google");
    const to = new URL(s.headers.get("location")!);
    assert.equal(to.origin + to.pathname, "http://localhost:3998/auth");
    assert.equal(to.searchParams.get("client_id"), "test-client"); assert.equal(to.searchParams.get("scope"), "openid email profile"); assert.equal(to.searchParams.get("response_type"), "code");
    assert.equal(to.searchParams.get("redirect_uri"), `${BASE}/api/auth/google/callback`);
    const state = tamper ? tamper(to.searchParams.get("state")!) : to.searchParams.get("state")!;
    return this.raw(`/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  }
}
const loc = (r: Response) => new URL(r.headers.get("location") ?? "http://x/").pathname + new URL(r.headers.get("location") ?? "http://x/").search;

(async () => {
  const t = String(Date.now()).slice(-8);
  const email = `gita.${t}@gmail.com`;
  const me0 = await new Client().json("/api/auth/me");
  assert.equal(me0.body.google, true); assert.equal(me0.body.enabled, true);

  // a new person: back from Google → one more step (nothing is created yet)
  const a = new Client();
  let r = await a.viaGoogle(`${email}|Gita Devi|`, "/app/profile");
  assert.equal(r.status, 307); assert.equal(loc(r), `/login?google=1&next=${encodeURIComponent("/app/profile")}`);
  assert.equal((await a.json("/api/auth/me")).body.account, null, "no account yet");
  assert.deepEqual((await a.json("/api/auth/me")).body.pending, { name: "Gita Devi", email });
  assert.equal((await a.json("/api/me/trees")).status, 401);
  assert.equal((await a.json("/api/auth/google/complete", "POST", { consent: false })).status, 400, "agreement is required");
  assert.equal((await a.json("/api/auth/google/complete", "POST", { consent: true, phone: "123" })).status, 400, "optional phone must still be valid");
  const done = await a.json("/api/auth/google/complete", "POST", { consent: true });
  assert.equal(done.status, 200, JSON.stringify(done.body)); assert.equal(done.body.account.email, email); assert.equal(done.body.account.name, "Gita Devi");
  assert.equal((await a.json("/api/auth/me")).body.account.email, email); assert.equal((await a.json("/api/auth/me")).body.pending, null);
  assert.equal((await a.json("/api/me/trees")).status, 200);
  assert.equal(lastRedirect, `${BASE}/api/auth/google/callback`);
  assert.equal((await a.json("/api/auth/google/complete", "POST", { consent: true })).status, 400, "the pending step is used up");

  // the same person again, on another device: straight in
  const b = new Client();
  r = await b.viaGoogle(`${email}|Gita Devi|`, "/app");
  assert.equal(loc(r), "/app"); assert.equal((await b.json("/api/auth/me")).body.account.email, email);
  // Google's capital letters do not create a second account
  const b2 = new Client();
  r = await b2.viaGoogle(`${email.toUpperCase()}|Gita|`); assert.equal(loc(r), "/app");

  // an account made with an emailed code is reached through Google too (same verified address)
  const em = `viv.${t}@example.com`, c = new Client();
  const st = await c.json("/api/auth/start", "POST", { email: em });
  assert.equal((await c.json("/api/auth/verify", "POST", { email: em, code: st.body.devCode, name: "Viv", phone: `+9198${t}`, consent: true })).status, 200);
  r = await new Client().viaGoogle(`${em}|Vivek|`); assert.equal(loc(r), "/app", "existing email account");

  // things that must fail
  for (const [code, why] of [[`x@y.com|X|badaud`, "google-failed"], [`x@y.com|X|unverified`, "google-failed"], [`x@y.com|X|reject`, "google-failed"]] as const) {
    const d = new Client(); r = await d.viaGoogle(code); assert.equal(loc(r), `/login?error=${why}`, code);
    assert.equal((await d.json("/api/auth/me")).body.account, null);
  }
  const e = new Client(); r = await e.viaGoogle(`x@y.com|X|`, "/app", (s) => s.slice(0, -2) + "xx"); assert.equal(loc(r), "/login?error=google-state", "tampered state");
  const f = new Client(); r = await f.raw("/api/auth/google/callback?code=abc&state=abc"); assert.equal(loc(r), "/login?error=google-state", "no state cookie");
  // a state from one browser cannot be replayed in another
  const g1 = new Client(), g2 = new Client();
  const s1 = await g1.raw("/api/auth/google/start"); await g2.raw("/api/auth/google/start");
  r = await g2.raw(`/api/auth/google/callback?code=${encodeURIComponent("x@y.com|X|")}&state=${encodeURIComponent(new URL(s1.headers.get("location")!).searchParams.get("state")!)}`);
  assert.equal(loc(r), "/login?error=google-state", "state belongs to the browser that started it");
  r = await new Client().raw("/api/auth/google/callback?error=access_denied"); assert.equal(loc(r), "/login?error=google-cancelled");
  // open redirects are not followed
  const h = new Client(); r = await h.viaGoogle(`${email}|Gita|`, "//evil.example.com"); assert.equal(loc(r), "/app");
  console.log("google sign-in OK");
  fake.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
