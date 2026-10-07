import { NextResponse } from "next/server";
import { findMatches, isDiscoverable, load } from "@/lib/connect-server";
import { womenToMatch } from "@/lib/connect";

export const dynamic = "force-dynamic";

/** GET [?k=] → { on, women, matches[] } — possible counterparts of this tree's married women in other (opt-in) trees */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await load(req, id, new URL(req.url).searchParams.get("k"), "tree-matches", 120);
  if (l instanceof NextResponse) return l;
  const on = isDiscoverable(l.row);
  const women = womenToMatch(l.row.family).length;
  if (!on) return NextResponse.json({ on, women, matches: [] });
  const matches = await findMatches(l.store, l.row);
  return NextResponse.json({ on, women, matches });
}
