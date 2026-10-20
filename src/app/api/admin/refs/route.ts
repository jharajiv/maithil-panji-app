import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { refKey, getStore } from "@/lib/store";
import { allGotras, allMools, registerExtras } from "@/lib/lookup";
import { remapRef } from "@/lib/bulk";
import { mutateTree } from "@/lib/connect-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const clean = (v: unknown, max = 60) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Admin only. The decision on a gotra or mool spelling that people typed because it was not in the Panji list:
 *  - action "map": it is the same as an entry that is already in the list (`id`); every saved tree that has it is changed to that entry;
 *  - action "approve": it is a real new entry, perhaps with a corrected spelling and a Devanagari spelling; it joins the list that
 *    people are offered, and every saved tree that has it is changed to the approved spelling.
 * In both cases the old spelling is marked as rejected, so it is no longer offered to anybody.
 */
export async function POST(req: Request) {
  const a = await currentAccount(req);
  if (!isAdmin(a)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "No store is configured." }, { status: 503 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const kind = b.kind === "gotra" || b.kind === "mool" ? b.kind : null;
  const from = clean(b.from);
  const action = b.action === "map" || b.action === "approve" ? b.action : null;
  if (!kind || !from || !action) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  try { registerExtras(await store.listRefs()); } catch { /* optional */ }
  let to: { id?: string; roman: string; dev?: string };
  if (action === "map") {
    const id = clean(b.id, 40);
    const hit = (kind === "gotra" ? allGotras() : allMools()).find((x) => x.id === id);
    if (!hit) return NextResponse.json({ error: "That entry is not in the list." }, { status: 400 });
    to = { id: hit.id, roman: hit.roman, dev: hit.dev || undefined };
  } else {
    const roman = clean(b.roman) || from, dev = clean(b.dev) || undefined;
    if (!roman) return NextResponse.json({ error: "Please write the spelling." }, { status: 400 });
    to = { id: `x-${kind}-${refKey(roman)}`, roman, dev };
    await store.reviewRef({ kind, key: refKey(roman), roman, dev, status: "approved" });
  }
  // the spelling that was typed is not offered to anyone any more (unless it is the approved one)
  if (refKey(from) !== refKey(to.roman)) await store.reviewRef({ kind, key: refKey(from), roman: from, status: "rejected" });

  const trees = await store.listAllTrees();
  let changedTrees = 0, people = 0, failed = 0;
  for (const t of trees) {
    if (!remapRef(t.family, kind, from, to).count) continue;
    let n = 0;
    const saved = await mutateTree(store, t.id, (r) => { const x = remapRef(r.family, kind, from, to); n = x.count; return x.count ? { family: x.family } : null; });
    if (saved) { changedTrees++; people += n; } else failed++;
  }
  return NextResponse.json({ ok: true, trees: changedTrees, people, failed, now: to });
}
