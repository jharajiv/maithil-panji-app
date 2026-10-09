import assert from "node:assert/strict";
import { parsePlace } from "../src/components/build/widgets";

assert.deepEqual(parsePlace("Behta, Madhubani, Bihar"), { india: true, a: "Behta", b: "Madhubani", c: "Bihar" });
assert.deepEqual(parsePlace("Behta, India"), { india: true, a: "Behta", b: "", c: "" }, "'India' is not a district");
assert.deepEqual(parsePlace("Behta, Madhubani, Bihar, India"), { india: true, a: "Behta", b: "Madhubani", c: "Bihar" });
assert.deepEqual(parsePlace("Patna, Bihar"), { india: true, a: "Patna", b: "", c: "Bihar" });
assert.deepEqual(parsePlace("Zurich, Switzerland"), { india: false, a: "Zurich", b: "", c: "Switzerland" });
assert.deepEqual(parsePlace("Opfikon, Zurich, Switzerland"), { india: false, a: "Opfikon", b: "Zurich", c: "Switzerland" });
assert.deepEqual(parsePlace("Behta"), { india: true, a: "Behta", b: "", c: "" });
assert.deepEqual(parsePlace(""), { india: true, a: "", b: "", c: "" });
console.log("parsePlace OK");
