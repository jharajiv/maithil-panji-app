import assert from "node:assert/strict";
import { formatDate, parseDateText } from "../src/lib/dates";
const cases: [string, string | undefined][] = [
  ["1958", "1958"], ["born in 1958", "1958"], ["14 March 1958", "1958-03-14"], ["14th of march, 1958", "1958-03-14"], ["March 14, 1958", "1958-03-14"],
  ["14/03/1958", "1958-03-14"], ["14-3-1958", "1958-03-14"], ["1958-03-14", "1958-03-14"], ["March 1958", "1958-03"], ["31/02/1958", "1958"], ["I don't know", undefined], ["Skip", undefined], ["2050", undefined],
];
for (const [t, want] of cases) assert.equal(parseDateText(t), want, t);
assert.equal(formatDate("1958-03-14"), "14 March 1958"); assert.equal(formatDate("1958-03"), "March 1958"); assert.equal(formatDate("1958"), "1958");
console.log("date tests passed");
