import { NextResponse } from "next/server";
import { authEnabled, currentAccount } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET → the signed-in person's trees: ones they own and ones shared with them */
export async function GET(req: Request) {
  const store = getStore();
  if (!store || !authEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const account = await currentAccount(req);
  if (!account) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const rows = await store.listTreesFor(account.id);
  const out = { mine: [] as unknown[], shared: [] as unknown[] };
  for (const t of rows) {
    const me = t.members.find((m) => m.account_id === account.id && m.status !== "invited");
    if (!me) continue;
    const owner = t.members.find((m) => m.role === "owner")?.name ?? "";
    (me.role === "owner" ? out.mine : out.shared).push({ id: t.id, title: t.title ?? "Family tree", people: t.people_count ?? 0, updated_at: t.updated_at, owner, members: t.members.length });
  }
  return NextResponse.json(out);
}
