/**
 * Corrections suggested by people viewing a tree. A suggestion is only a note to the family: nothing changes until the
 * owner or a helper applies it. Dates, names and villages can be applied with one tap; the rest are marked done by hand.
 */
import { parseDateText } from "./dates";
import type { DFamily, PersonFields } from "./family";
import type { Suggestion } from "./store";

export const SUGGEST_FIELDS = [
  { id: "name", label: "Name" },
  { id: "birth", label: "Birth date" },
  { id: "death", label: "Date of death" },
  { id: "place", label: "Village or place" },
  { id: "gotra", label: "Gotra" },
  { id: "mool", label: "Mool" },
  { id: "relation", label: "How they are related" },
  { id: "other", label: "Something else" },
] as const;
export type SuggestField = (typeof SUGGEST_FIELDS)[number]["id"];
export const fieldLabel = (id: string) => SUGGEST_FIELDS.find((f) => f.id === id)?.label ?? "Something else";

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** validate what a viewer sent; the caller adds id, tree and time */
export function cleanSuggestion(raw: Record<string, unknown>): { ok: true; person: string; field: SuggestField; value: string; note?: string; from_name?: string } | { ok: false; error: string } {
  const field = SUGGEST_FIELDS.find((f) => f.id === raw.field)?.id;
  const person = clip(raw.person, 20);
  const value = clip(raw.value, 200);
  if (!field || !/^[\w-]+$/.test(person)) return { ok: false, error: "Please choose what is wrong." };
  if (!value) return { ok: false, error: "Please write what it should be." };
  if (/https?:\/\/|www\./i.test(value) || /https?:\/\/|www\./i.test(clip(raw.note, 300))) return { ok: false, error: "Please do not add web links." };
  return { ok: true, person, field, value, note: clip(raw.note, 300) || undefined, from_name: clip(raw.from_name, 60) || undefined };
}

/** the change a suggestion would make, or null when it has to be done by hand */
export function changeFor(s: Pick<Suggestion, "field" | "value">): PersonFields | null {
  const v = s.value.trim();
  if (s.field === "birth" || s.field === "death") { const d = parseDateText(v); return d ? { [s.field]: d } : null; }
  if (s.field === "place") return v.length <= 120 ? { place: v } : null;
  if (s.field === "name") {
    if (/[ऀ-ॿ]/.test(v)) return v.length <= 80 ? { name_dev: v } : null;
    return /^[A-Za-z][A-Za-z .'’-]{0,78}$/.test(v) ? { name_roman: v } : null;
  }
  return null;
}

/** what the tree says now, for the inbox ("Born 1958 → 1960") */
export function currentValue(f: DFamily, personId: string, field: string): string {
  const p = f.persons.find((x) => x.id === personId);
  if (!p) return "";
  switch (field) {
    case "name": return p.name_roman;
    case "birth": return p.birth ?? "";
    case "death": return p.death ?? "";
    case "place": return p.place ?? "";
    case "gotra": return p.gotra?.roman ?? "";
    case "mool": return p.mool?.roman ?? "";
    default: return "";
  }
}
