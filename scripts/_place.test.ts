import assert from "node:assert/strict";
import { resembles } from "../src/components/build/widgets";
// the map service returns better-known places for a small village: those must not replace what was typed
assert.equal(resembles("Madhubani", "Kothiya"), false);
assert.equal(resembles("Darbhanga", "Kothiya"), false);
assert.equal(resembles("Kothiya", "Kothiya"), true);
assert.equal(resembles("Kothia", "Kothiya"), true, "spelling variant");
assert.equal(resembles("Madhubani", "Madhuban"), true, "still typing");
assert.equal(resembles("Syampur", "Shyampur"), true, "sound-alike");
assert.equal(resembles("Rajnagar", "Raj"), true);
assert.equal(resembles("", "Raj"), false);
console.log("place OK");
