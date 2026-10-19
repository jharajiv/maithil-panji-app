import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { checkPass, publicFamily, viewMode, viewPassOf, viewState } from "@/lib/view";
import { clientIp, distinctLimited, limited } from "@/lib/ratelimit";
import { automated } from "@/lib/guard";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** GET ?v=key → a read-only copy of the tree for someone who scanned its printed QR code */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Not available." }, { status: 503 });
  if (limited("tree-view", clientIp(req), 120)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  // shared trees are for people: programs that copy pages one after another get nothing
  if (automated(req)) return NextResponse.json({ error: "This page is for people to read in a browser." }, { status: 403 });
  const { id } = await params;
  if (distinctLimited("tree-view-many", clientIp(req), id, Number(process.env.VIEW_TREES_PER_HOUR) || 15)) return NextResponse.json({ error: "Too many different trees were opened from here. Please try again later." }, { status: 429 });
  const v = new URL(req.url).searchParams.get("v");
  const row = await store.getTree(id);
  const mode = row ? viewMode(id, v, viewState(row)) : null;
  if (!row || !mode) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  // an owner-set password: asked for before anything is shown, and wrong guesses are slowed down
  const pass = viewPassOf(row);
  if (pass) {
    const given = req.headers.get("x-view-pass");
    if (!given) return NextResponse.json({ needsPassword: true }, { status: 401 });
    if (limited(`tree-pass:${id}`, clientIp(req), 8, 15 * 60_000)) return NextResponse.json({ error: "Too many wrong tries. Please wait a few minutes." }, { status: 429 });
    if (!checkPass(pass, given)) return NextResponse.json({ needsPassword: true, wrong: true }, { status: 401 });
  }
  logEvent("view_opened");
  return NextResponse.json({ title: row.title ?? "Family tree", mode, family: publicFamily(row.family, mode) }, { headers: { "cache-control": "private, max-age=30" } });
}
