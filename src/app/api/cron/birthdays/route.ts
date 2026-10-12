import { NextResponse } from "next/server";
import { isStaging } from "@/lib/env";
import { mailConfigured } from "@/lib/mail";
import { runBirthdayReminders } from "@/lib/reminders-run";
import { getStore } from "@/lib/store";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel Cron calls this once a day (vercel.json) with "Authorization: Bearer <CRON_SECRET>". Without CRON_SECRET set, nothing runs. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = getStore();
  if (!store || !mailConfigured()) return NextResponse.json({ error: "Database or email is not set up" }, { status: 503 });
  const r = await runBirthdayReminders(store);
  console.log("birthday reminders:", JSON.stringify(r), isStaging() ? "(staging: mail only to the allowed list)" : "");
  return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
}
