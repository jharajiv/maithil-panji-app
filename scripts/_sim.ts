import { applyOps, emptyFamily } from "../src/lib/family";
import { nextGoal, progress } from "../src/lib/interview";
import { basicParse } from "../src/lib/basic";
let f = emptyFamily();
const A: Record<string, string[]> = {
  self_name: ["Rohan Jha"], self_gender: ["male"], self_gotra: ["Shandilya"], self_mool: ["sarisab"], 
  self_birth: ["1985"], self_place: ["Zurich, Switzerland"], spouse: ["Anjali"], children: ["Aarav - son, Nisha - daughter"],
  spouses_of: ["none", "none", "Neha", "Sushil", "none", "none", "none"], children_of: ["none"], father: ["Mahesh Jha", "Harinath Jha", "I don't remember"],
  mother: ["Rekha", "Kamla"], details: ["living, born 1955, village Sarisab", "late, 1920"],
  siblings: ["Vikram - brother, Sunita - sister", "Ramakant - brother, Shyama - sister"],
};
const used: Record<string, number> = {};
for (let i = 0; i < 60; i++) {
  const g = nextGoal(f, { batch: false });
  if (!g) { console.log("COMPLETE"); break; }
  const arr = A[g.kind] ?? ["skip"]; const n = used[g.kind] ?? 0; used[g.kind] = n + 1;
  const line = arr[Math.min(n, arr.length - 1)]!;
  console.log(`Q[${g.kind}] ${g.question}\n   A: ${line}`);
  f = applyOps(f, basicParse(f, g, line).ops).family;
}
console.log(progress(f));
console.log(f.persons.map(p => `${p.id}:${p.name_roman}(${p.gender ?? "?"}${p.mool ? "," + p.mool.roman : ""})`).join(" | "));
