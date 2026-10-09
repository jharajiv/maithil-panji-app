import assert from "node:assert/strict";
import http from "node:http";
import { hitFromPlace, hitsFrom, requestBody, searchBody, toHit } from "../src/lib/places";

const pred = (main: string, sec: string, types: string[] = ["locality", "political"]) => ({ suggestions: [{ placePrediction: { placeId: main, types, structuredFormat: { mainText: { text: main }, secondaryText: { text: sec } } } }] });

// Google writes the village and, after it, "District, State, India"
assert.deepEqual(toHit(pred("Kothiya", "Madhubani, Bihar, India").suggestions[0]!.placePrediction, true), { a: "Kothiya", b: "Madhubani", c: "Bihar", in: true });
assert.deepEqual(toHit(pred("Behta", "Madhubani District, Bihar, India").suggestions[0]!.placePrediction, true), { a: "Behta", b: "Madhubani", c: "Bihar", in: true }, "'District' is dropped");
assert.deepEqual(toHit(pred("Patna", "Bihar, India").suggestions[0]!.placePrediction, true), { a: "Patna", b: "", c: "Bihar", in: true }, "no district given");
assert.deepEqual(toHit(pred("Bihar", "India").suggestions[0]!.placePrediction, true), null, "the state itself is not a village");
assert.equal(toHit(pred("Zurich", "Switzerland").suggestions[0]!.placePrediction, true), null, "India mode keeps to India");
assert.deepEqual(toHit(pred("Opfikon", "Zurich, Switzerland").suggestions[0]!.placePrediction, false), { a: "Opfikon", b: "Zurich", c: "Switzerland", in: false });
assert.deepEqual(toHit(pred("Behta", "India").suggestions[0]!.placePrediction, false), { a: "Behta", b: "", c: "", in: true }, "an Indian village found in the abroad mode is still an Indian place");
assert.deepEqual(toHit(pred("Hyderabad", "Telangana, India").suggestions[0]!.placePrediction, true), { a: "Hyderabad", b: "", c: "Telangana", in: true });

// shops are dropped, duplicates collapse
const mixed = { suggestions: [...pred("Kothiya Sweets", "Madhubani, Bihar, India", ["establishment", "food"]).suggestions, ...pred("Kothiya", "Madhubani, Bihar, India").suggestions, ...pred("Kothiya", "Madhubani, Bihar, India").suggestions] };
assert.deepEqual(hitsFrom(mixed, true), [{ a: "Kothiya", b: "Madhubani", c: "Bihar", in: true }]);
assert.deepEqual(hitsFrom(null, true), []);

// a second village of the same name, in another district
const behta2 = { id: "p_behta2", displayName: { text: "Behta" }, types: ["locality", "political"], addressComponents: [
  { longText: "Behta", types: ["locality", "political"] }, { longText: "Biraul", types: ["administrative_area_level_3", "political"] },
  { longText: "Darbhanga", types: ["administrative_area_level_2", "political"] }, { longText: "Bihar", types: ["administrative_area_level_1", "political"] }, { longText: "India", types: ["country", "political"] }] };

// a full place (Place Details / Text Search) carries the district, state and block
const behta = { id: "p_behta", displayName: { text: "Behta" }, types: ["locality", "political"], addressComponents: [
  { longText: "Behta", types: ["locality", "political"] }, { longText: "Benipatti", types: ["administrative_area_level_3", "political"] },
  { longText: "Madhubani", types: ["administrative_area_level_2", "political"] }, { longText: "Bihar", types: ["administrative_area_level_1", "political"] }, { longText: "India", types: ["country", "political"] }] };
assert.deepEqual(hitFromPlace(behta, true), { a: "Behta", b: "Madhubani", c: "Bihar", n: "Benipatti", in: true });
assert.deepEqual(hitFromPlace(behta, false), { a: "Behta", b: "Madhubani", c: "Bihar", n: "Benipatti", in: true }, "found while the abroad mode is on: still Indian");
assert.equal(hitFromPlace({ ...behta, types: ["establishment", "store"] }, true), null, "a shop is not a place");
const zurich = { displayName: { text: "Opfikon" }, types: ["locality"], addressComponents: [{ longText: "Zurich", types: ["administrative_area_level_1"] }, { longText: "Switzerland", types: ["country"] }] };
assert.deepEqual(hitFromPlace(zurich, false), { a: "Opfikon", b: "Zurich", c: "Switzerland", in: false });
assert.equal(hitFromPlace(zurich, true), null, "India mode keeps to India");
assert.equal(searchBody("behta benipatti madhubani", true).regionCode, "IN");
assert.equal((searchBody("Zurich", false) as { regionCode?: string }).regionCode, undefined);

// the request: India is biased to Bihar, abroad is not restricted
assert.deepEqual(requestBody("Kothiya", true, false).includedRegionCodes, ["in"]);
assert.ok(requestBody("Kothiya", true, true).includedPrimaryTypes);
assert.equal(requestBody("Zurich", false, true).includedRegionCodes, undefined);

// the route, with a stand-in for Google
async function main() {
  const seen: { key?: string; url?: string; body?: Record<string, unknown>; types: boolean[] }[] = [];
  let rejectTypes = false, detailCalls = 0, searchCalls = 0;
  const srv = http.createServer((rq, rs) => {
    let raw = ""; rq.on("data", (d) => (raw += d)); rq.on("end", () => {
      const body = raw ? JSON.parse(raw) : {};
      rs.setHeader("content-type", "application/json");
      if (rq.method === "GET" && rq.url?.startsWith("/v1/places/")) {   // Place Details
        detailCalls++;
        const id = rq.url.slice("/v1/places/".length);
        if (id === "p_behta") { rs.end(JSON.stringify(behta)); return; }
        if (id === "p_behta2") { rs.end(JSON.stringify(behta2)); return; }
        rs.statusCode = 404; rs.end("{}"); return;
      }
      if (rq.url === "/v1/places:searchText") {                         // Text Search
        searchCalls++;
        const t = String(body.textQuery).toLowerCase();
        rs.end(JSON.stringify(t.includes("benipatti") ? { places: [behta, { id: "x", displayName: { text: "Behta Sweets" }, types: ["store"], addressComponents: [] }] } : {}));
        return;
      }
      seen.push({ key: String(rq.headers["x-goog-api-key"]), url: rq.url, body, types: [!!body.includedPrimaryTypes] });
      if (rejectTypes && body.includedPrimaryTypes) { rs.statusCode = 400; rs.end("{}"); return; }
      const q = String(body.input).toLowerCase();
      if (q.startsWith("behta")) { const ps = pred("Behta", "India"); ps.suggestions[0]!.placePrediction.placeId = "p_behta"; const p2 = pred("Behta", "India").suggestions[0]!; p2.placePrediction.placeId = "p_behta2"; rs.end(JSON.stringify({ suggestions: [...ps.suggestions, p2] })); return; }   // Google often lists a village with "India" only
      rs.end(JSON.stringify(pred("Kothiya", "Madhubani, Bihar, India")));
    });
  });
  await new Promise<void>((ok) => srv.listen(3997, ok));
  process.env.GOOGLE_PLACES_BASE = "http://localhost:3997/v1";
  delete process.env.GOOGLE_PLACES_URL;
  const { GET } = await import("../src/app/api/places/route");
  const call = (q: string, inn = "1") => GET(new Request(`http://x/api/places?q=${encodeURIComponent(q)}&in=${inn}`, { headers: { "x-forwarded-for": "9.9.9.9" } })).then((r) => r.json() as Promise<{ provider: string; hits?: unknown[] }>);

  delete process.env.GOOGLE_PLACES_API_KEY;
  assert.deepEqual(await call("Kothiya"), { provider: "off" }, "no key: the page falls back to OpenStreetMap");
  assert.equal(seen.length, 0);

  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  const r = await call("Kothiya");
  assert.equal(r.provider, "google");
  assert.deepEqual(r.hits, [{ a: "Kothiya", b: "Madhubani", c: "Bihar", in: true }]);
  assert.equal(seen[0]!.key, "test-key");
  assert.equal(detailCalls, 1, "each Indian place is looked up for its full address (the stand-in has none: the autocomplete line is kept)");
  assert.equal(searchCalls, 1, "a single word with few matches also gets a text search");
  detailCalls = 0; searchCalls = 0;
  assert.deepEqual((await call("Ko")).hits, [], "too short: no call to Google");
  assert.equal(seen.length, 2, "with and without the type filter");

  // "Behta" alone: Google lists two villages as "Behta, India"; both are kept and each gets its own district, state and block
  const b1 = await call("Behta");
  assert.deepEqual(b1.hits, [{ a: "Behta", b: "Madhubani", c: "Bihar", n: "Benipatti", in: true }, { a: "Behta", b: "Darbhanga", c: "Bihar", n: "Biraul", in: true }]);
  assert.equal(detailCalls, 2);
  await call("Behta");
  assert.equal(detailCalls, 2, "the same village is not looked up twice");

  // several words: text search finds the one that fits, and its answer comes first without repeats
  const b2 = await call("behta benipatti madhubani");
  assert.equal((b2.hits as { n?: string }[])[0]!.n, "Benipatti", "the text search answer comes first");
  assert.equal(b2.hits!.length, 2, "shop dropped, repeats collapsed");
  assert.ok(searchCalls >= 1);

  // the abroad mode still offers an Indian village, as an Indian place
  assert.equal(((await call("behta benipatti madhubani", "0")).hits as { in?: boolean }[])[0]!.in, true);

  rejectTypes = true; // Google refuses the type filter → asked again without it
  assert.deepEqual((await call("Kothiya")).hits, [{ a: "Kothiya", b: "Madhubani", c: "Bihar", in: true }]);

  process.env.GOOGLE_PLACES_BASE = "http://localhost:3997x/bad"; // unreachable → quiet error, page falls back
  assert.equal((await call("Kothiya")).provider, "error");
  srv.close();
  console.log("places OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
