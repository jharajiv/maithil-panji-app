import { NextResponse } from "next/server";
import { isDiscoverable, load } from "@/lib/connect-server";
import { checkSimilar, findSimilar, glance } from "@/lib/similar-server";
import { stockOf } from "@/lib/similar";

export const dynamic = "force-dynamic";

/**
 * GET [?k=] → { on, hasStock, trees[] } — other opt-in trees with the same gotra and mool that look like the same family.
 * GET ?tree=<id>[&k=] → { glance } — a preview of one of them (only while it still looks similar).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const l = await load(req, id, url.searchParams.get("k"), "tree-similar", 120);
  if (l instanceof NextResponse) return l;
  const other = url.searchParams.get("tree");
  if (other) {
    const c = await checkSimilar(l.store, l.row, other);
    if (!c) return NextResponse.json({ error: "This tree is not available to look at." }, { status: 404 });
    return NextResponse.json({ glance: glance(c.other, c.match), percent: c.match.percent, strength: c.match.strength });
  }
  const on = isDiscoverable(l.row);
  const s = stockOf(l.row.family);
  const hasStock = !!(s.gotra?.roman && s.mool?.roman);
  return NextResponse.json({ on, hasStock, trees: on && hasStock ? await findSimilar(l.store, l.row) : [] });
}
