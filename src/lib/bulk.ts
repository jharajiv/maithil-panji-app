/**
 * Mass updates: fix one spelling everywhere (a gotra, a mool or a place typed wrongly in many people), or set the gotra / mool of the
 * whole family line in one go. Plain rules, no AI, so it works in every mode and costs nothing.
 */
import { stockLine, me, type DFamily, type DPerson, type PanjiRef } from "./family";
import { classify, fold, type Hit, plainRoman, searchGotras, searchMools } from "./lookup";

export type BulkField = "gotra" | "mool" | "place";
export interface BulkChange {
  field: BulkField;
  /** the spelling to replace; leave out (gotra / mool only) to set it for the whole father's line */
  from?: string;
  to: string;
}
export interface BulkResult { family: DFamily; count: number; /** what the new value was recorded as */ now: string; /** it was not found in the Panji list */ custom: boolean; message: string }

/** the values now in the tree for one field, with how many people have each (most used first) */
export function distinctValues(f: DFamily, field: BulkField): { value: string; count: number }[] {
  const m = new Map<string, { value: string; count: number }>();
  for (const p of f.persons) {
    const raw = field === "place" ? p.place : p[field]?.roman;
    const parts = field === "place" ? (raw ?? "").split(",").map((x) => x.trim()).filter(Boolean) : raw ? [plainRoman(raw)] : [];
    for (const v of new Set(parts)) { const k = fold(v); const cur = m.get(k); if (cur) cur.count++; else m.set(k, { value: v, count: 1 }); }
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** what the user typed → a gotra or mool as the Panji records it (from the list when it matches, otherwise as typed and marked custom) */
export function resolveRef(field: "gotra" | "mool", text: string, gotraId?: string): PanjiRef {
  const t = text.trim();
  const hits: Hit<{ id: string; roman: string; dev: string }>[] = field === "gotra" ? searchGotras(t) : searchMools(t, { gotraId });
  const c = classify(hits);
  const top = hits[0]?.item;
  if (top && (c.status === "exact" || c.status === "likely")) return { id: top.id, roman: plainRoman(top.roman), dev: top.dev };
  return { roman: t, custom: true };
}

const same = (a: string | undefined, b: string) => !!a && (fold(a) === fold(b) || fold(plainRoman(a)) === fold(b));

export function bulkRename(f: DFamily, ch: BulkChange): BulkResult {
  const to = ch.to.trim().slice(0, 80);
  const fail = (message: string): BulkResult => ({ family: f, count: 0, now: to, custom: false, message });
  if (!to) return fail("Please tell me what it should be changed to.");
  const next = structuredClone(f);
  let count = 0;

  if (ch.field === "place") {
    if (!ch.from?.trim()) return fail("Please tell me which place name to replace.");
    const from = ch.from.trim();
    for (const p of next.persons) {
      if (!p.place) continue;
      const parts = p.place.split(",").map((x) => x.trim());
      if (!parts.some((x) => fold(x) === fold(from))) continue;
      p.place = parts.map((x) => (fold(x) === fold(from) ? to : x)).join(", "); count++;
    }
    return count ? { family: next, count, now: to, custom: false, message: `Changed the place “${from}” to “${to}” for ${count} ${count === 1 ? "person" : "people"}.` } : fail(`No one has the place “${from}”.`);
  }

  const fld = ch.field;
  const root = me(f);
  const ref = resolveRef(fld, to, root?.gotra?.id);
  const set = (p: DPerson) => { p[fld] = { ...ref }; count++; };
  if (ch.from?.trim()) {
    const from = ch.from.trim();
    // the spelling may be the stored one, the Devanagari one, or the list entry it resolves to
    const listed = resolveRef(fld, from, root?.gotra?.id);
    for (const p of next.persons) { const cur = p[fld]; if (cur && (same(cur.roman, from) || same(cur.dev, from) || (listed.id && cur.id === listed.id))) set(p); }
    if (!count) return fail(`No one has the ${fld} “${from}”.`);
  } else {
    // the whole father's line, whatever it says now
    const line = stockLine(f);
    for (const p of next.persons) if (line.has(p.id)) set(p);
    if (!count) return fail("There is no one on the family line yet.");
  }
  const now = ref.dev ? `${ref.roman} (${ref.dev})` : ref.roman;
  const scope = ch.from ? `from “${ch.from.trim()}” ` : "for the whole family line ";
  return { family: next, count, now, custom: !!ref.custom, message: `Changed the ${fld} ${scope}to “${now}” for ${count} ${count === 1 ? "person" : "people"}.${ref.custom ? ` “${to}” is not in the Panji list, so it is noted as a new ${fld} for our team to review.` : ""}` };
}

/** "change gotra Shandliya to Shandilya", "replace mool from Sarisab with Sarisaba", "set gotra of everyone to Kashyap" → the change, or null when it is not one */
export function parseBulk(text: string): BulkChange | null {
  const t = text.trim().replace(/[“”"‘’]/g, "").replace(/\s+/g, " ");
  const field = (w: string): BulkField | null => (/^gotra|^gotr/i.test(w) ? "gotra" : /^mool|^moola/i.test(w) ? "mool" : /^(place|village|gaon|city|town|location)$/i.test(w) ? "place" : null);
  const verb = "(?:please\\s+)?(?:change|update|replace|rename|correct|fix|set|make)";
  const fld = "(gotra|gotras|mool|mools|moola|place|places|village|villages|city|town|location)";
  // "set gotra of everyone / all / the whole family to X"
  let m = new RegExp(`^${verb}\\s+(?:the\\s+)?${fld}\\s+(?:of|for)\\s+(?:everyone|everybody|all(?:\\s+(?:the\\s+)?(?:people|members|persons))?|the\\s+whole\\s+family|my\\s+whole\\s+family|entire\\s+family)\\s+(?:to|as|=)\\s+(.{2,60})$`, "i").exec(t);
  if (m) { const f = field(m[1]!); if (f === "gotra" || f === "mool") return { field: f, to: m[2]!.trim() }; }
  // "change gotra from X to Y" / "change gotra X to Y" / "rename mool X as Y"
  m = new RegExp(`^${verb}\\s+(?:the\\s+)?${fld}\\s+(?:from\\s+)?(.{2,60}?)\\s+(?:to|into|as|with|->|=>)\\s+(.{2,60})$`, "i").exec(t);
  if (m) { const f = field(m[1]!); if (f) return { field: f, from: m[2]!.trim(), to: m[3]!.trim() }; }
  // "replace X with Y in gotra" (the field at the end)
  m = new RegExp(`^${verb}\\s+(.{2,60}?)\\s+(?:with|to|into|by)\\s+(.{2,60}?)\\s+(?:in|for|under)\\s+(?:the\\s+)?(?:all\\s+)?${fld}$`, "i").exec(t);
  if (m) { const f = field(m[3]!); if (f) return { field: f, from: m[1]!.trim(), to: m[2]!.trim() }; }
  return null;
}

/**
 * Review of a spelling people typed that is not in the Panji list: every person who has it (kind = gotra or mool, matched by spelling) is
 * given the reviewed entry instead. `to` is a list entry (map) or the approved spelling (approve); it is no longer marked as "custom".
 */
export function remapRef(f: DFamily, kind: "gotra" | "mool", from: string, to: PanjiRef): { family: DFamily; count: number } {
  const next = structuredClone(f);
  let count = 0;
  for (const p of next.persons) {
    const cur = p[kind];
    if (cur?.custom && fold(cur.roman) === fold(from)) { p[kind] = { id: to.id, roman: to.roman, dev: to.dev }; count++; }
  }
  return { family: count ? next : f, count };
}
