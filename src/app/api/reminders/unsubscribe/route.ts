import { NextResponse } from "next/server";
import { originOf } from "@/lib/google";
import { accountFromRemToken } from "@/lib/reminders";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST (the button on the stop page, and mail programs' one-click unsubscribe): ?t=<token> or { t } → birthday reminders off for that account */
export async function POST(req: Request) {
  const store = getStore();
  const url = new URL(req.url);
  const body = (await req.json().catch(() => null)) as { t?: string } | null;
  const id = accountFromRemToken(url.searchParams.get("t") ?? body?.t);
  if (!store || !id) return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
  const a = await store.getAccount(id);
  if (a?.profile?.reminders?.birthdays) await store.updateAccount(id, { profile: { ...a.profile, reminders: { birthdays: false, lead: a.profile.reminders.lead } } });
  return NextResponse.json({ ok: true });
}

/** opening the link in a browser shows the page with the button (a mail program that merely "visits" links must not switch anything off) */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/reminders/unsubscribe?t=${encodeURIComponent(t)}`, originOf(req)));
}
