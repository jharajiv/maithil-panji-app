import { NextResponse } from "next/server";
import { logEvent } from "@/lib/events";
import { confirmSubscription, emailFromToken, originOf } from "@/lib/newsletter";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** the link in the confirmation email */
export async function GET(req: Request) {
  const to = (s: string) => NextResponse.redirect(new URL(`/newsletter?s=${s}`, originOf(req)));
  const store = getStore();
  const email = emailFromToken(new URL(req.url).searchParams.get("t"), "nl-confirm");
  if (!store || !email) return to("invalid");
  try {
    if (!(await confirmSubscription(store, email))) return to("invalid");
    logEvent("newsletter_confirmed");
    return to("confirmed");
  } catch { return to("invalid"); }
}
