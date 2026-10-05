import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** gotras / mools that users added and the Panji team has not reviewed yet — merged into search as "added by a user" */
export async function GET() {
  const store = getStore();
  if (!store) return NextResponse.json({ refs: [] });
  try {
    const refs = await store.listRefs();
    return NextResponse.json({ refs: refs.map((r) => ({ kind: r.kind, roman: r.roman, dev: r.dev })) }, { headers: { "cache-control": "public, max-age=60" } });
  } catch { return NextResponse.json({ refs: [] }); }
}
