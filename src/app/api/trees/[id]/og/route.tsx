import { PaagLogo } from "@/components/brand/Logo";
import { ImageResponse } from "next/og";
import { getStore } from "@/lib/store";
import { generations, viewMode, viewState } from "@/lib/view";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INDIGO = "#1f2a5c", CREAM = "#fbf7ef", TERRA = "#a63a1d";

/**
 * GET ?v=key → the 1200×630 picture WhatsApp / Facebook / X show when the view link is pasted.
 * It carries only what is safe to show to anyone: the tree's title, how many people and generations, and the family's gotra and mool.
 * No living relative's name, date or place is ever drawn here.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = new URL(req.url).searchParams.get("v");
  const store = getStore();
  const fallback = (title: string, line: string) => card(title, line, "");
  if (!store || limited("tree-og", clientIp(req), 120)) return fallback("Maithil Panji", "Build your family tree");
  const row = await store.getTree(id);
  if (!row || !viewMode(id, v, viewState(row))) return fallback("Maithil Panji", "Build your family tree");
  const f = row.family;
  const me = f.persons.find((p) => p.is_me);
  const gotra = me?.gotra?.roman ?? f.persons.find((p) => p.gotra?.roman)?.gotra?.roman;
  const mool = me?.mool?.roman ?? f.persons.find((p) => p.mool?.roman)?.mool?.roman;
  const title = (row.title ?? "Family tree").replace(/ family$/, " family tree");
  const facts = [`${f.persons.length} people`, `${generations(f)} generations`].join("  ·  ");
  const tradition = [gotra && `Gotra ${gotra}`, mool && `Mool ${mool}`].filter(Boolean).join("  ·  ");
  return card(title, facts, tradition);
}

const box = (w: number, accent = false) => (
  <div style={{ display: "flex", width: w, height: 44, borderRadius: 10, background: accent ? TERRA : CREAM, opacity: accent ? 1 : 0.92 }} />
);
const line = (h: number) => <div style={{ display: "flex", width: 3, height: h, background: "#c9b9a0" }} />;

function card(title: string, facts: string, tradition: string) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: INDIGO, color: CREAM, padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingRight: 24 }}>
          <div style={{ display: "flex", alignItems: "center" }}><PaagLogo height={84} onDark foundation={false} /><div style={{ display: "flex", marginLeft: 26, fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#f0c9a8" }}>Maithil Panji</div></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: title.length > 22 ? 64 : 82, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 36, color: "#e8dcc8" }}>{facts}</div>
            {tradition ? <div style={{ display: "flex", marginTop: 10, fontSize: 32, color: "#f0c9a8" }}>{tradition}</div> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 30 }}>
            <div style={{ display: "flex", background: TERRA, color: "#fff", padding: "14px 26px", borderRadius: 14, fontWeight: 700 }}>Build your own family tree — free</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 380 }}>
          {box(150, true)}{line(30)}
          <div style={{ display: "flex", alignItems: "center" }}>{box(150)}<div style={{ display: "flex", width: 14 }} />{box(150)}</div>
          {line(30)}
          <div style={{ display: "flex" }}>{box(100)}<div style={{ display: "flex", width: 10 }} />{box(100)}<div style={{ display: "flex", width: 10 }} />{box(100)}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=300, s-maxage=300" } },
  );
}
