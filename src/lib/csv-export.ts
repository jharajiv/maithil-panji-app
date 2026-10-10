import type { FamilyData } from "./types";

const q = (v: unknown) => { const s = String(v ?? ""); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Everyone in the tree as one table (opens in Excel / Google Sheets), with father, mother and spouse by name. For keeping a complete copy offline. */
export function familyCsv(data: FamilyData): string {
  const by = new Map(data.persons.map((p) => [p.person_id, p]));
  const parents = new Map<string, string[]>(), spouses = new Map<string, string[]>();
  for (const r of data.relationships) {
    const [a, b] = [r.person_a_id, r.person_b_id];
    if (r.type === "parent_of") (parents.get(b) ?? parents.set(b, []).get(b)!).push(a);
    else if (r.type === "spouse_of") { (spouses.get(a) ?? spouses.set(a, []).get(a)!).push(b); (spouses.get(b) ?? spouses.set(b, []).get(b)!).push(a); }
  }
  const names = (ids: string[] | undefined, g?: "male" | "female") => (ids ?? []).map((i) => by.get(i)).filter((p) => p && (!g || (g === "male" ? p.gender === "male" : p.gender !== "male"))).map((p) => p!.name_roman).join(" / ");
  const head = ["No.", "Name", "Name (Devanagari)", "Gender", "Born", "Died", "Living", "Village / place", "Gotra", "Mool", "Father", "Mother", "Spouse", "Husband (if a daughter)", "Notes"];
  const rows = data.persons.map((p, i) => [i + 1, p.name_roman, p.name_devanagari ?? "", p.gender, p.dob ?? "", p.dod ?? "", p.is_living ? "yes" : "no", p.current_village ?? "", p.gotra ?? "", p.mool ?? "", names(parents.get(p.person_id), "male"), names(parents.get(p.person_id), "female"), names(spouses.get(p.person_id)), p.married_to ?? "", p.notes ?? ""]);
  return "﻿" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
}

export function downloadCsv(data: FamilyData, name = "family-tree-people.csv") {
  const url = URL.createObjectURL(new Blob([familyCsv(data)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
