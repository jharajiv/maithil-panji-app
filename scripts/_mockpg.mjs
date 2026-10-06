// Minimal PostgREST look-alike (tables: trees, custom_refs) to exercise the Supabase adapter without a real project.
import http from "node:http";
const trees = new Map(); const refs = new Map(); const persons = new Map(); let rels = []; const consents = []; const accounts = new Map(); const sessions = new Map(); const codes = new Map();
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
  const send = (code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(data === undefined ? "" : JSON.stringify(data)); };
  if (u.pathname === "/__dump") return send(200, { persons: [...persons.values()], rels, consents, trees: trees.size, accounts: [...accounts.values()], sessions: sessions.size });
  if (req.headers.apikey !== "test-key" || req.headers.authorization !== "Bearer test-key") return send(401, { message: "bad key" });
  const eq = (k) => u.searchParams.get(k)?.replace(/^eq\./, "");
  if (u.pathname === "/rest/v1/trees") {
    if (req.method === "POST") { if (trees.has(body.id)) return send(409, {}); trees.set(body.id, body); return send(201); }
    if (req.method === "GET" && u.searchParams.get("members")?.startsWith("cs.")) {
      const want = JSON.parse(u.searchParams.get("members").slice(3))[0];
      return send(200, [...trees.values()].filter((t) => t.members.some((m) => Object.entries(want).every(([k, v]) => m[k] === v))));
    }
    if (req.method === "GET") { const r = trees.get(eq("id")); return send(200, r ? [r] : []); }
    if (req.method === "PATCH") { const r = trees.get(eq("id")); if (!r || (eq("rev") !== undefined && String(r.rev) !== eq("rev"))) return send(200, []); const n = { ...r, ...body }; trees.set(r.id, n); return send(200, [n]); }
  }
  if (u.pathname === "/rest/v1/trees" && req.method === "DELETE") { const r = trees.get(eq("id")); if (!r) return send(200, []); trees.delete(r.id); for (const [k, v] of persons) if (v.tree_id === r.id) persons.delete(k); rels = rels.filter((x) => x.tree_id !== r.id); return send(200, [r]); }
  if (u.pathname === "/rest/v1/persons") {
    if (!trees.has(body?.[0]?.tree_id ?? eq("tree_id"))) return send(409, { message: "fk" });
    if (req.method === "POST") { for (const r of body) persons.set(r.tree_id + "/" + r.person_id, r); return send(201); }
    if (req.method === "DELETE") { const keep = (u.searchParams.get("person_id") ?? "").replace(/^not\.in\.\(|\)$/g, "").split(",").filter(Boolean).map((x) => x.replace(/"/g, "")); for (const [k, v] of persons) if (v.tree_id === eq("tree_id") && !keep.includes(v.person_id)) persons.delete(k); return send(204); }
  }
  if (u.pathname === "/rest/v1/relations") {
    if (req.method === "POST") { rels.push(...body); return send(201); }
    if (req.method === "DELETE") { rels = rels.filter((x) => x.tree_id !== eq("tree_id")); return send(204); }
  }
  if (u.pathname === "/rest/v1/accounts") {
    if (req.method === "POST") { if (accounts.has(body.id) || [...accounts.values()].some((a) => a.email === body.email)) return send(409, {}); accounts.set(body.id, body); return send(201); }
    if (req.method === "GET") return send(200, [...accounts.values()].filter((a) => (eq("id") ? a.id === eq("id") : a.email === eq("email"))));
    if (req.method === "DELETE") { accounts.delete(eq("id")); return send(204); }
  }
  if (u.pathname === "/rest/v1/login_codes") {
    if (req.method === "POST") { codes.set(body.email, body); return send(201); }
    if (req.method === "GET") { const r = codes.get(eq("email")); return send(200, r ? [r] : []); }
    if (req.method === "PATCH") { const r = codes.get(eq("email")); if (r) codes.set(r.email, { ...r, ...body }); return send(204); }
    if (req.method === "DELETE") { codes.delete(eq("email")); return send(204); }
  }
  if (u.pathname === "/rest/v1/sessions") {
    if (req.method === "POST") { sessions.set(body.token_hash, body); return send(201); }
    if (req.method === "GET") { const r = sessions.get(eq("token_hash")); return send(200, r ? [r] : []); }
    if (req.method === "DELETE") { if (eq("token_hash")) sessions.delete(eq("token_hash")); else for (const [k, v] of sessions) if (v.account_id === eq("account_id")) sessions.delete(k); return send(204); }
  }
  if (u.pathname === "/rest/v1/consents" && req.method === "POST") { consents.push(body); return send(201); }
  if (u.pathname === "/rest/v1/custom_refs") {
    if (req.method === "POST") { for (const r of body) { const k = r.kind + ":" + r.key; if (!refs.has(k)) refs.set(k, r); } return send(201); }
    if (req.method === "GET") return send(200, [...refs.values()]);
  }
  send(404, { message: "nope" });
});
srv.listen(3999, () => console.log("mock postgrest on 3999"));
