import { NextResponse } from "next/server";
import { checkPair, load, previewFor } from "@/lib/connect-server";

export const dynamic = "force-dynamic";

/** GET ?person=<mine>&tree=<other>&p=<her in the other tree>[&k=] → what to show to judge the match (living people by first name only) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const l = await load(req, id, q.get("k"), "tree-preview", 120);
  if (l instanceof NextResponse) return l;
  const [person, tree, p] = [q.get("person"), q.get("tree"), q.get("p")];
  if (!person || !tree || !p) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const pair = await checkPair(l.store, l.row, person, tree, p);
  if (!pair) return NextResponse.json({ error: "That tree is not available to compare." }, { status: 404 });
  const preview = previewFor(pair.other, p);
  if (!preview) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ preview, strength: pair.strength });
}
