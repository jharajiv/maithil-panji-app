import assert from "node:assert/strict";
import http from "node:http";
import { hitsFrom, requestBody, toHit } from "../src/lib/places";

const pred = (main: string, sec: string, types: string[] = ["locality", "political"]) => ({ suggestions: [{ placePrediction: { placeId: main, types, structuredFormat: { mainText: { text: main }, secondaryText: { text: sec } } } }] });

// Google writes the village and, after it, "District, State, India"
assert.deepEqual(toHit(pred("Kothiya", "Madhubani, Bihar, India").suggestions[0]!.placePrediction, true), { a: "Kothiya", b: "Madhubani", c: "Bihar" });
assert.deepEqual(toHit(pred("Behta", "Madhubani District, Bihar, India").suggestions[0]!.placePrediction, true), { a: "Behta", b: "Madhubani", c: "Bihar" }, "'District' is dropped");
assert.deepEqual(toHit(pred("Patna", "Bihar, India").suggestions[0]!.placePrediction, true), { a: "Patna", b: "", c: "Bihar" }, "no district given");
assert.deepEqual(toHit(pred("Bihar", "India").suggestions[0]!.placePrediction, true), null, "the state itself is not a village");
assert.equal(toHit(pred("Zurich", "Switzerland").suggestions[0]!.placePrediction, true), null, "India mode keeps to India");
assert.deepEqual(toHit(pred("Opfikon", "Zurich, Switzerland").suggestions[0]!.placePrediction, false), { a: "Opfikon", b: "", c: "Switzerland" });
assert.deepEqual(toHit(pred("Hyderabad", "Telangana, India").suggestions[0]!.placePrediction, true), { a: "Hyderabad", b: "", c: "Telangana" });

// shops are dropped, duplicates collapse
const mixed = { suggestions: [...pred("Kothiya Sweets", "Madhubani, Bihar, India", ["establishment", "food"]).suggestions, ...pred("Kothiya", "Madhubani, Bihar, India").suggestions, ...pred("Kothiya", "Madhubani, Bihar, India").suggestions] };
assert.deepEqual(hitsFrom(mixed, true), [{ a: "Kothiya", b: "Madhubani", c: "Bihar" }]);
assert.deepEqual(hitsFrom(null, true), []);

// the request: India is biased to Bihar, abroad is not restricted
assert.deepEqual(requestBody("Kothiya", true, false).includedRegionCodes, ["in"]);
assert.ok(requestBody("Kothiya", true, true).includedPrimaryTypes);
assert.equal(requestBody("Zurich", false, true).includedRegionCodes, undefined);

// the route, with a stand-in for Google
async function main() {
  const seen: { key?: string; body?: Record<string, unknown>; types: boolean[] }[] = [];
  let rejectTypes = false;
  const srv = http.createServer((rq, rs) => {
    let raw = ""; rq.on("data", (d) => (raw += d)); rq.on("end", () => {
      const body = JSON.parse(raw);
      seen.push({ key: String(rq.headers["x-goog-api-key"]), body, types: [!!body.includedPrimaryTypes] });
      if (rejectTypes && body.includedPrimaryTypes) { rs.statusCode = 400; rs.end("{}"); return; }
      rs.setHeader("content-type", "application/json");
      rs.end(JSON.stringify(pred("Kothiya", "Madhubani, Bihar, India")));
    });
  });
  await new Promise<void>((ok) => srv.listen(3997, ok));
  process.env.GOOGLE_PLACES_URL = "http://localhost:3997/v1/places:autocomplete";
  const { GET } = await import("../src/app/api/places/route");
  const call = (q: string, inn = "1") => GET(new Request(`http://x/api/places?q=${encodeURIComponent(q)}&in=${inn}`, { headers: { "x-forwarded-for": "9.9.9.9" } })).then((r) => r.json() as Promise<{ provider: string; hits?: unknown[] }>);

  delete process.env.GOOGLE_PLACES_API_KEY;
  assert.deepEqual(await call("Kothiya"), { provider: "off" }, "no key: the page falls back to OpenStreetMap");
  assert.equal(seen.length, 0);

  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  const r = await call("Kothiya");
  assert.equal(r.provider, "google");
  assert.deepEqual(r.hits, [{ a: "Kothiya", b: "Madhubani", c: "Bihar" }]);
  assert.equal(seen[0]!.key, "test-key");
  assert.deepEqual((await call("Ko")).hits, [], "too short: no call to Google");
  assert.equal(seen.length, 1);

  rejectTypes = true; // Google refuses the type filter → asked again without it
  assert.deepEqual((await call("Kothiya")).hits, [{ a: "Kothiya", b: "Madhubani", c: "Bihar" }]);

  process.env.GOOGLE_PLACES_URL = "http://localhost:3997x/bad"; // unreachable → quiet error, page falls back
  assert.equal((await call("Kothiya")).provider, "error");
  srv.close();
  console.log("places OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
