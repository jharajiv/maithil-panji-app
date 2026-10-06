import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Which country the reader is in (Vercel adds it to every request). Used only to suggest a sensible contribution amount. */
export async function GET(req: Request) {
  const c = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? "";
  return NextResponse.json({ country: /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : "" }, { headers: { "cache-control": "private, no-store" } });
}
