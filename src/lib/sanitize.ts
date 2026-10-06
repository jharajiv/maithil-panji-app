import type { DFamily, DPerson, DRel, PanjiRef } from "./family";

const s = (v: unknown, n = 120) => (typeof v === "string" ? v.slice(0, n) : undefined);
const photo = (v: unknown) => (typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 120_000 ? v : undefined);
const ref = (v: unknown): PanjiRef | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const roman = s(o.roman, 80);
  return roman ? { id: s(o.id, 60), roman, dev: s(o.dev, 80), custom: o.custom === true || undefined } : undefined;
};

/**
 * Defensive copy of a client-supplied family (size caps, unknown fields dropped).
 * Photos and WhatsApp numbers are kept only for the shared-tree store (`stored: true`); the chat never sees them.
 */
export function sanitizeFamily(raw: unknown, opts: { stored?: boolean } = {}): DFamily | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.persons) || !Array.isArray(r.rels)) return null;
  const persons: DPerson[] = [];
  for (const x of r.persons.slice(0, opts.stored ? 500 : 300)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = s(o.id, 20);
    if (!id) continue;
    const flags: DPerson["flags"] = {};
    if (o.flags && typeof o.flags === "object") {
      for (const [k, v] of Object.entries(o.flags as Record<string, unknown>)) if (v === "done" || v === "unknown" || v === "skipped") (flags as Record<string, string>)[k] = v;
    }
    persons.push({
      id, name_roman: s(o.name_roman, 80) ?? "", name_dev: s(o.name_dev, 80),
      gender: o.gender === "male" || o.gender === "female" || o.gender === "other" ? o.gender : undefined,
      birth: s(o.birth, 10), death: s(o.death, 10), status: o.status === "living" || o.status === "deceased" ? o.status : undefined,
      place: s(o.place, 120), notes: s(o.notes, 200),
      gotra: ref(o.gotra), mool: ref(o.mool),
      photo: opts.stored ? photo(o.photo) : undefined,
      whatsapp: opts.stored && typeof o.whatsapp === "string" && /^\+\d{6,15}$/.test(o.whatsapp) ? o.whatsapp : undefined,
      is_me: o.is_me === true || undefined, placeholder: o.placeholder === true || undefined, flags,
    });
  }
  const ids = new Set(persons.map((p) => p.id));
  const rels: DRel[] = [];
  for (const x of r.rels.slice(0, 900)) {
    const o = x as Record<string, unknown>;
    if ((o?.type === "parent_of" || o?.type === "spouse_of") && typeof o.a === "string" && typeof o.b === "string" && ids.has(o.a) && ids.has(o.b)) rels.push({ type: o.type, a: o.a, b: o.b });
  }
  const next = typeof r.next === "number" && Number.isFinite(r.next) ? Math.min(Math.max(1, Math.floor(r.next)), 100000) : persons.length + 1;
  return { persons, rels, next };
}
