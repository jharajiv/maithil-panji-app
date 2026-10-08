// A stand-in for Google's token endpoint (port 3998): the code "<email>|<name>" becomes an id_token. For local tests only.
import http from "node:http";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const p = new URLSearchParams(Buffer.concat(chunks).toString());
  if (req.url === "/token") {
    const [email, name] = decodeURIComponent(p.get("code") ?? "").split("|");
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id_token: `${b64({ alg: "RS256" })}.${b64({ iss: "https://accounts.google.com", aud: "test-client", exp: Math.floor(Date.now() / 1000) + 3600, email, email_verified: true, name })}.sig` }));
  }
  res.writeHead(404); res.end();
}).listen(3998, () => console.log("fake google on 3998"));
