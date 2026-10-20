import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const csv = (rows: (string | number | undefined)[][]) => "﻿" + rows.map((r) => r.map((v) => { const t = String(v ?? ""); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(",")).join("\r\n");

/**
 * Admin only: a copy of everything, for backup. ?kind=trees → one JSON file with every saved tree (people, relations, photos included);
 * ?kind=people → one spreadsheet with a row per person. Secrets (sign-in hashes, share keys, passwords on links) are never included.
 */
export async function GET(req: Request) {
  if (!isAdmin(await currentAccount(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "No store is configured." }, { status: 503 });
  const kind = new URL(req.url).searchParams.get("kind");
  const trees = await store.listAllTrees(20000);
  const day = new Date().toISOString().slice(0, 10);
  if (kind === "trees") {
    const out = trees.map((t) => ({
      id: t.id, title: t.title, updated_at: t.updated_at, family: t.family,
      members: t.members.map((m) => ({ id: m.id, name: m.name, role: m.role, status: m.status, person_id: m.person_id, email: m.email, phone: m.phone, created_at: m.created_at })),
    }));
    return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), count: out.length, trees: out }), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="paag-trees-${day}.json"`, "cache-control": "no-store" } });
  }
  if (kind === "people") {
    const rows: (string | number | undefined)[][] = [["Tree", "Person", "Name", "Nickname", "Name (Devanagari)", "Gender", "Born", "Died", "Living", "Place", "Gotra", "Mool", "Father", "Notes"]];
    for (const t of trees) {
      const by = new Map(t.family.persons.map((p) => [p.id, p]));
      const father = (id: string) => { const r = t.family.rels.find((x) => x.type === "parent_of" && x.b === id && by.get(x.a)?.gender !== "female"); return r ? by.get(r.a)?.name_roman : undefined; };
      for (const p of t.family.persons) {
        if (p.placeholder) continue;
        rows.push([t.id, p.id, p.name_roman, p.nickname, p.name_dev, p.gender, p.birth, p.death, p.status === "deceased" ? "no" : "yes", p.place, p.gotra?.roman, p.mool?.roman, father(p.id), p.notes]);
      }
    }
    return new NextResponse(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="paag-people-${day}.csv"`, "cache-control": "no-store" } });
  }
  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
