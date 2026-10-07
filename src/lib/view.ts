import { createHmac, timingSafeEqual } from "crypto";
import type { DFamily, DPerson } from "./family";

/**
 * The read-only "view" link — printed as a QR code on a downloaded tree, or shared on WhatsApp / social media.
 *
 * There are two kinds of link, and the kind is part of the key itself, so a visitor can never "upgrade" a link by editing it:
 *   • "private" (the default): living relatives appear by first name only — no birth date, village, photo or notes.
 *   • "full": everything the owner entered except phone numbers and private notes. The owner has to choose this on purpose.
 * Keys are derived from the tree id and a server secret, so they need no database column, differ for every tree, and cannot be guessed.
 * Nothing can be edited through either link.
 */
const secret = () => process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "maithil-panji-dev-view-key";

export type ViewMode = "private" | "full";

/** "full" keeps the original derivation, so QR codes printed before the privacy option existed keep working */
export const viewKey = (treeId: string, mode: ViewMode = "private", epoch = 0) =>
  createHmac("sha256", secret()).update(`${mode === "full" ? `view|${treeId}` : `view|${treeId}|private`}${epoch > 0 ? `|e${epoch}` : ""}`).digest("base64url").slice(0, 22);

/** The owner can switch view links off, or replace them (older links stop working). Both live on the owner's member record, so no database change is needed. */
export interface ViewState { epoch: number; off: boolean }
export const viewState = (row: { members: { role: string; view_epoch?: number; view_off?: boolean }[] }): ViewState => {
  const o = row.members.find((m) => m.role === "owner");
  return { epoch: o?.view_epoch ?? 0, off: !!o?.view_off };
};

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** which kind of link this key is — or null when it is not valid for this tree */
export function viewMode(treeId: string, key: string | null | undefined, st: ViewState = { epoch: 0, off: false }): ViewMode | null {
  if (st.off || !key || key.length !== 22) return null;
  if (same(key, viewKey(treeId, "private", st.epoch))) return "private";
  if (same(key, viewKey(treeId, "full", st.epoch))) return "full";
  return null;
}

export const viewKeyOk = (treeId: string, key: string | null | undefined, st?: ViewState) => viewMode(treeId, key, st) !== null;

const first = (s: string) => s.trim().split(/\s+/)[0] ?? s;

/** someone who has not been recorded as passed away is treated as living — when in doubt, protect.
 *  The one exception: no status recorded and born 100+ years ago, so certainly not living. */
const isLiving = (p: DPerson) => {
  if (p.status === "deceased") return false;
  if (p.status === "living") return true;
  const year = Number(/^\d{4}/.exec(p.birth ?? "")?.[0]);
  return !(year && year <= new Date().getFullYear() - 100);
};

/** what a visitor with the link may see */
export function publicFamily(f: DFamily, mode: ViewMode = "private"): DFamily {
  return {
    ...f,
    persons: f.persons.map((person) => {
      const { whatsapp: _w, notes: _n, links: _l, ...p } = person;
      void _w; void _n; void _l;
      if (mode === "full" || !isLiving(p as DPerson)) return p as DPerson;
      // living relatives: first name only; nothing that could locate or identify them further
      const { birth: _b, place: _pl, photo: _ph, married_to: _m, death: _d, ...rest } = p as DPerson;
      void _b; void _pl; void _ph; void _m; void _d;
      return { ...rest, name_roman: first(rest.name_roman), name_dev: rest.name_dev ? first(rest.name_dev) : rest.name_dev } as DPerson;
    }),
  };
}

/** the longest line of descent in the tree (for the preview image and the page summary) */
export function generations(f: DFamily): number {
  const kids = new Map<string, string[]>();
  for (const r of f.rels) if (r.type === "parent_of") (kids.get(r.a) ?? kids.set(r.a, []).get(r.a)!).push(r.b);
  const memo = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 1;
    seen.add(id);
    const d = 1 + Math.max(0, ...(kids.get(id) ?? []).map((k) => depth(k, seen)));
    seen.delete(id);
    memo.set(id, d);
    return d;
  };
  return Math.max(1, ...f.persons.map((p) => depth(p.id, new Set())));
}
