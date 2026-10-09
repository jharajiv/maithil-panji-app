import assert from "node:assert/strict";
import { applyOps, emptyFamily, toFamilyData, type Op } from "../src/lib/family";
import { apexOf, outsideChart, scopeData } from "../src/lib/tree-filter";
import { familyCsv } from "../src/lib/csv-export";
import { paperFit } from "../src/lib/pdf";

const ops: Op[] = [
  { op: "add_person", ref: "me", name_roman: "Rohan Jha", gender: "male", birth: "1980", status: "living" },
  { op: "add_person", ref: "f", name_roman: "Shivnath Jha", gender: "male", relation: { type: "father_of", to: "me" } },
  { op: "add_person", ref: "m", name_roman: "Kamla Devi", gender: "female", relation: { type: "mother_of", to: "me" } },
  { op: "add_person", ref: "gf", name_roman: "Ramnath Jha", gender: "male", relation: { type: "father_of", to: "f" } },
  { op: "add_person", ref: "u", name_roman: "Harinath Jha", gender: "male", relation: { type: "sibling_of", to: "f" } },
  { op: "add_person", name_roman: "Sumit, \"Bunty\" Jha", gender: "male", relation: { type: "child_of", to: "u" } },
  { op: "add_person", ref: "mf", name_roman: "Bhola Mishra", gender: "male", relation: { type: "father_of", to: "m" } },
];
const data = toFamilyData(applyOps(emptyFamily(), ops).family)!;
const name = (id: string) => data.persons.find((p) => p.person_id === id)!.name_roman;

assert.equal(name(apexOf(data)), "Ramnath Jha", "the oldest ancestor on the father's side");
assert.equal(scopeData(data, "all").main_id, apexOf(data));
assert.equal(scopeData(data, "all").persons.length, data.persons.length, "everyone is passed on; the chart draws what hangs from the apex");
assert.equal(scopeData(data, "full").main_id, data.root_person_id);
// a person with no recorded father climbs through the mother
const only = toFamilyData(applyOps(emptyFamily(), [{ op: "add_person", ref: "a", name_roman: "A", gender: "male" }, { op: "add_person", name_roman: "Mum", gender: "female", relation: { type: "mother_of", to: "a" } }]).family)!;
assert.equal(name2(only, apexOf(only)), "Mum");
function name2(d: typeof data, id: string) { return d.persons.find((p) => p.person_id === id)!.name_roman; }

// people the chart does not draw are listed with their link to someone who is drawn
const shown = new Set(data.persons.filter((p) => p.name_roman !== "Bhola Mishra").map((p) => p.person_id));
const out = outsideChart(data, shown);
assert.deepEqual(out.map((o) => [o.name, o.note]), [["Bhola Mishra", "father of Kamla Devi"]]);
assert.deepEqual(outsideChart(data, new Set(data.persons.map((p) => p.person_id))), []);

// spreadsheet: everyone, UTF-8 marker for Excel, quotes escaped, father/mother by name
const csv = familyCsv(data);
assert.ok(csv.startsWith("﻿No.,Name"));
const lines = csv.split("\r\n"); assert.equal(lines.length, data.persons.length + 1);
assert.ok(csv.includes('"Sumit, ""Bunty"" Jha"'));
const rohan = lines.find((l) => l.includes("Rohan Jha,"))!; assert.ok(rohan.includes("Shivnath Jha,Kamla Devi"));

// paper: a wide tree goes on a landscape sheet; names get bigger on a bigger sheet; never beyond the sheet
const a2 = paperFit("a2", 6000, 3500, true), a0 = paperFit("a0", 6000, 3500, true);
assert.equal(a2.landscape, true); assert.equal(a2.pw, 594); assert.equal(a0.pw, 1189);
assert.ok(a0.cardMm > a2.cardMm * 1.8);
assert.ok(6000 * a2.mmPerPx <= a2.pw && 3500 * a2.mmPerPx <= a2.ph);
assert.equal(paperFit("a1", 800, 1600, false).landscape, false, "a tall tree goes on a portrait sheet");
assert.ok(paperFit("a0", 300, 300, false).mmPerPx <= 0.35, "a tiny tree is not blown up endlessly");
console.log("export OK");
