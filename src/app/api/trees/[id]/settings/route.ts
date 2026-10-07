import { NextResponse } from "next/server";
import { load } from "@/lib/connect-server";

export const dynamic = "force-dynamic";

/** POST { k?, discoverable: boolean } — owner only: let other families' trees find this one when matching married women */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const l = await load(req, id, typeof body.k === "string" ? body.k : null, "tree-settings", 60);
  if (l instanceof NextResponse) return l;
  if (l.me.role !== "owner") return NextResponse.json({ error: "Only the owner can change this." }, { status: 403 });
  if (typeof body.discoverable !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const members = l.row.members.map((m) => (m.role === "owner" ? { ...m, discoverable: body.discoverable as boolean } : m));
  const saved = await l.store.updateTree(id, l.row.rev, { members }, false);
  if (!saved) return NextResponse.json({ error: "The tree changed at the same moment. Please try again." }, { status: 409 });
  return NextResponse.json({ ok: true, discoverable: body.discoverable });
}
