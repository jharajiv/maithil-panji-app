/**
 * Invite groundwork. Nobody is blocked today — the site is open — but we record who brought whom, so that invite codes can be switched on later
 * if people use the site a lot. A person's invite code is the first 10 characters of the SHA-256 of their tree id: it is public in the
 * link they share, and it cannot be turned back into the tree id.
 */
export const REF_RX = /^[a-f0-9]{10}$/;
const KEY = "maithil-panji.ref.v1";

/** the same value on the browser and on the server (Web Crypto exists in both) */
export async function refCodeOf(treeId: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(treeId));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

/** medium: which button the link came from (whatsapp, copy), so Analytics can tell invitations apart */
export const inviteUrl = (origin: string, code: string, medium = "share") => `${origin}/?ref=${code}&utm_source=invite&utm_medium=${medium}&utm_campaign=invite`;

/** remember the code in the link that brought this visitor (the newest link wins) */
export function captureRef(search: string): void {
  const v = new URLSearchParams(search).get("ref")?.trim().toLowerCase() ?? "";
  if (!REF_RX.test(v)) return;
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
}
export function storedRef(): string | undefined {
  try { const v = localStorage.getItem(KEY) ?? ""; return REF_RX.test(v) ? v : undefined; } catch { return undefined; }
}
export function clearRef(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
