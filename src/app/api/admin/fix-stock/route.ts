import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { fillStock } from "@/lib/family";
import { mutateTree } from "@/lib/connect-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Admin only. The family's gotra and mool belong to the whole father's line (see fillStock in family.ts). Trees saved by older
 * versions can have blanks. GET counts what would be filled; POST fills the blanks (never changes an existing value).
 */
async function guard(req: Request) {
  const a = await currentAccount(req);
  if (!isAdmin(a)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "No store is configured." }, { status: 503 });
  return store;
}

export async function GET(req: Request) {
  const store = await guard(req);
  if (store instanceof NextResponse) return store;
  const trees = await store.listAllTrees();
  let affected = 0, entries = 0;
  for (const t of trees) { const r = fillStock(t.family); if (r.filled) { affected++; entries += r.filled; } }
  return NextResponse.json({ trees: trees.length, affected, entries });
}

export async function POST(req: Request) {
  const store = await guard(req);
  if (store instanceof NextResponse) return store;
  const trees = await store.listAllTrees();
  let fixed = 0, entries = 0, failed = 0;
  for (const t of trees) {
    if (!fillStock(t.family).filled) continue;
    let filled = 0;
    const saved = await mutateTree(store, t.id, (r) => { const x = fillStock(r.family); filled = x.filled; return x.filled ? { family: x.family } : null; });
    if (saved) { fixed++; entries += filled; } else failed++;
  }
  return NextResponse.json({ fixed, entries, failed });
}
