import { NextResponse } from "next/server";
import { isDiscoverable, load } from "@/lib/connect-server";
import { publicFamily } from "@/lib/view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cross the bridge: a read-only look at the tree of the family a woman of this tree is linked to ("jump to her family's tree").
 * Allowed only when (1) the caller belongs to this tree, (2) a woman here is linked to that tree AND she points back (links are written on both sides
 * by the server), and (3) the other family still lets itself be found. Living relatives show by first name only, as on any private view link.
 * Who may cross, and how much they may see, is meant to become a setting of the owner (family-wide, or only mother / sisters / daughters) — see the backlog.
 * GET ?to=<other tree id>[&k=<helper key>]
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = new URL(req.url);
  const l = await load(req, id, u.searchParams.get("k"), "tree-bridge", 200);
  if (l instanceof NextResponse) return l;
  const to = u.searchParams.get("to") ?? "";
  const mine = l.row.family.persons.filter((p) => p.links?.some((x) => x.tree === to));
  const other = mine.length ? await l.store.getTree(to) : null;
  const bridge = other && mine.find((p) => p.links?.some((x) => x.tree === to && other.family.persons.find((q) => q.id === x.person)?.links?.some((y) => y.tree === id && y.person === p.id)));
  const link = bridge?.links?.find((x) => x.tree === to);
  if (!other || !bridge || !link || !isDiscoverable(other)) return NextResponse.json({ error: "This family’s tree is not available through the link any more." }, { status: 404 });
  return NextResponse.json({
    title: other.title ?? "Family tree", mode: "private" as const, family: publicFamily(other.family, "private"),
    focus: link.person, bridge: { by: bridge.name_roman, fromTitle: l.row.title ?? "your tree" },
  }, { headers: { "cache-control": "private, no-store" } });
}
