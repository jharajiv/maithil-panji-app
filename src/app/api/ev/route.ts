import { NextResponse } from "next/server";
import { isEvent, logEvent } from "@/lib/events";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** POST { name } → one anonymous usage count. Always answers 204: the page never waits for, or depends on, this. */
export async function POST(req: Request) {
  if (limited("ev", clientIp(req), 60, 60_000)) return new NextResponse(null, { status: 204 });
  let name: unknown;
  try { name = (await req.json())?.name; } catch { /* no body */ }
  if (isEvent(name)) logEvent(name);
  return new NextResponse(null, { status: 204 });
}
