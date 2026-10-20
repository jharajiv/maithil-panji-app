import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin only: the exchanges people chose to send after a thumbs-down (newest first), and deleting one */
async function guard(req: Request) {
  if (!isAdmin(await currentAccount(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = getStore();
  return store ?? NextResponse.json({ error: "No store is configured." }, { status: 503 });
}
export async function GET(req: Request) {
  const store = await guard(req);
  if (store instanceof NextResponse) return store;
  try { return NextResponse.json({ items: await store.listFeedback(40) }); } catch { return NextResponse.json({ items: [], missing: true }); }
}
export async function DELETE(req: Request) {
  const store = await guard(req);
  if (store instanceof NextResponse) return store;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await store.deleteFeedback(id);
  return NextResponse.json({ ok: true });
}
