import { createHmac } from "crypto";
import type { DFamily } from "./family";

/**
 * The read-only "view" link printed as a QR code on a downloaded tree.
 * The key is derived from the tree id and a server secret, so it needs no extra database column, is different for
 * every tree, and cannot be guessed. It opens a copy with phone numbers and private notes removed — nothing can be edited.
 */
const secret = () => process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "maithil-panji-dev-view-key";

export const viewKey = (treeId: string) => createHmac("sha256", secret()).update(`view|${treeId}`).digest("base64url").slice(0, 22);

export const viewKeyOk = (treeId: string, key: string | null | undefined) => !!key && key.length === 22 && key === viewKey(treeId);

/** what a visitor with the printout may see */
export function publicFamily(f: DFamily): DFamily {
  return { ...f, persons: f.persons.map(({ whatsapp: _w, notes: _n, ...p }) => { void _w; void _n; return p; }) };
}
