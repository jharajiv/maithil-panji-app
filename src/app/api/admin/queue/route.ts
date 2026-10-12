import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { buildQueue } from "@/lib/admin-queue";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin only (ADMIN_EMAILS). The things an admin can act on: possible duplicate trees and new gotra / mool spellings. */
export async function GET(req: Request) {
  const a = await currentAccount(req);
  if (!isAdmin(a)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "No store is configured." }, { status: 503 });
  return NextResponse.json(await buildQueue(store), { headers: { "cache-control": "no-store" } });
}
