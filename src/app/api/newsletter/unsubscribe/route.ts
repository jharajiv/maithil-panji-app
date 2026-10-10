import { NextResponse } from "next/server";
import { emailFromToken, originOf, unsubscribe } from "@/lib/newsletter";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST (the button on the unsubscribe page, and mail programs' one-click unsubscribe): ?t=<token> or { t } */
export async function POST(req: Request) {
  const store = getStore();
  const url = new URL(req.url);
  const body = (await req.json().catch(() => null)) as { t?: string } | null;
  const email = emailFromToken(url.searchParams.get("t") ?? body?.t, "nl-unsub");
  if (!store || !email) return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
  await unsubscribe(store, email);
  return NextResponse.json({ ok: true });
}

/** opening the link in a browser shows the page with the button (a mail program that merely "visits" links must not unsubscribe anyone) */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/newsletter/unsubscribe?t=${encodeURIComponent(t)}`, originOf(req)));
}
