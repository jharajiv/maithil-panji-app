import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { publicFamily, viewKeyOk } from "@/lib/view";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** GET ?v=key → a read-only copy of the tree for someone who scanned its printed QR code */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Not available." }, { status: 503 });
  if (limited("tree-view", clientIp(req), 120)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id } = await params;
  const v = new URL(req.url).searchParams.get("v");
  if (!viewKeyOk(id, v)) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  const row = await store.getTree(id);
  if (!row) return NextResponse.json({ error: "This tree is not online any more." }, { status: 404 });
  return NextResponse.json({ title: row.title ?? "Family tree", family: publicFamily(row.family) }, { headers: { "cache-control": "private, max-age=30" } });
}
