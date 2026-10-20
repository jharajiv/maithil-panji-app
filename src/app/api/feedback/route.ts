import { NextResponse } from "next/server";
import { logEvent } from "@/lib/events";
import { clientIp, limited } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * POST { helpful: boolean, share?: boolean, lang, goal, user_text, bot_text, note }
 * The thumbs under a chat answer. A thumb alone is only a count. The words are stored ONLY when the person pressed thumbs-down and then
 * chose to send that exchange to the team (share: true).
 */
export async function POST(req: Request) {
  if (limited("fb", clientIp(req), 30, 60 * 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (typeof b.helpful !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (!b.share) { logEvent(b.helpful ? "fb_up" : "fb_down"); return NextResponse.json({ ok: true }); }
  if (b.helpful) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const store = getStore();
  const user_text = clean(b.user_text, 600), bot_text = clean(b.bot_text, 900);
  if (!store || !user_text || !bot_text) return NextResponse.json({ error: "Could not send that." }, { status: 400 });
  const goal = /^[a-z_]{1,20}$/.test(String(b.goal ?? "")) ? String(b.goal) : undefined;
  try { await store.addFeedback({ lang: b.lang === "hi" ? "hi" : "en", goal, user_text, bot_text, note: clean(b.note, 400) || undefined }); }
  catch { return NextResponse.json({ error: "Could not send that." }, { status: 503 }); }
  logEvent("fb_shared");
  return NextResponse.json({ ok: true });
}
