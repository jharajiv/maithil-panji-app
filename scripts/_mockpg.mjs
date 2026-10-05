// Minimal PostgREST look-alike (tables: trees, custom_refs) to exercise the Supabase adapter without a real project.
import http from "node:http";
const trees = new Map(); const refs = new Map();
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
  const send = (code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(data === undefined ? "" : JSON.stringify(data)); };
  if (req.headers.apikey !== "test-key" || req.headers.authorization !== "Bearer test-key") return send(401, { message: "bad key" });
  const eq = (k) => u.searchParams.get(k)?.replace(/^eq\./, "");
  if (u.pathname === "/rest/v1/trees") {
    if (req.method === "POST") { if (trees.has(body.id)) return send(409, {}); trees.set(body.id, body); return send(201); }
    if (req.method === "GET") { const r = trees.get(eq("id")); return send(200, r ? [r] : []); }
    if (req.method === "PATCH") { const r = trees.get(eq("id")); if (!r || (eq("rev") !== undefined && String(r.rev) !== eq("rev"))) return send(200, []); const n = { ...r, ...body }; trees.set(r.id, n); return send(200, [n]); }
  }
  if (u.pathname === "/rest/v1/custom_refs") {
    if (req.method === "POST") { for (const r of body) { const k = r.kind + ":" + r.key; if (!refs.has(k)) refs.set(k, r); } return send(201); }
    if (req.method === "GET") return send(200, [...refs.values()]);
  }
  send(404, { message: "nope" });
});
srv.listen(3999, () => console.log("mock postgrest on 3999"));
