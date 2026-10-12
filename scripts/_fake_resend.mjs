// A tiny stand-in for Resend: remembers every email it is asked to send. node scripts/_fake_resend.mjs   (GET /__sent → the list, DELETE /__sent → clear)
import http from "node:http";
const sent = [];
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = chunks.length ? Buffer.concat(chunks).toString() : "";
  if (req.url === "/__sent") { if (req.method === "DELETE") sent.length = 0; res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(sent)); }
  const b = raw ? JSON.parse(raw) : {};
  (Array.isArray(b) ? b : [b]).forEach((m) => sent.push(m));
  res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id: "x" }));
}).listen(3998, () => console.log("fake resend on 3998"));
