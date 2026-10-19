"use client";
import { useMemo, useState } from "react";
import { Download, Loader2, MapPin, MessageCircle, Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { DFamily } from "@/lib/family";
import { diasporaOf, fitView, INDIA_VIEW, MAP_H, MAP_W, markerSize, project, WORLD_VIEW, zoomView, type Diaspora, type Spot, type View } from "@/lib/diaspora";
import { WORLD_BORDERS, WORLD_LAND } from "@/lib/world-path";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

const INDIGO = "#1f2a5c", TERRA = "#a63a1d", CREAM = "#fbf7ef", SEA = "#e6edf5", LAND = "#f4ead2", LINE = "#cdbf9d";
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** the shareable picture: the map and the numbers, never a name */
function pictureSvg(d: Diaspora, v: View, who: string): string {
  const W = 1200, MH = 600, TOP = 110, H = TOP + MH + 70;
  const x = (lon: number, lat: number) => { const p = project(lat, lon); return { cx: ((p.x - v.x) / v.w) * W, cy: TOP + ((p.y - v.y) / v.h) * MH }; };
  const dots = d.spots.map((s) => {
    const { cx, cy } = x(s.lon, s.lat); const r = markerSize(s.count) * 0.75;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${TERRA}" stroke="#fff" stroke-width="3" opacity="0.92"/>` +
      `<text x="${cx.toFixed(1)}" y="${(cy + 7).toFixed(1)}" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">${s.count}</text>`;
  }).join("");
  const labels = d.spots.slice(0, 12).map((s) => {
    const { cx, cy } = x(s.lon, s.lat); const r = markerSize(s.count) * 0.75;
    return `<text x="${cx.toFixed(1)}" y="${(cy + r + 20).toFixed(1)}" text-anchor="middle" font-size="19" fill="${INDIGO}" stroke="${CREAM}" stroke-width="4" paint-order="stroke">${esc(s.label)}</text>`;
  }).join("");
  const places = d.spots.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Georgia, 'Noto Serif', serif">
<rect width="${W}" height="${H}" fill="${CREAM}"/>
<text x="40" y="58" font-size="38" font-weight="700" fill="${INDIGO}">${esc(who)} — where we are today</text>
<text x="40" y="92" font-size="22" fill="#6b6b6b">${d.placed} family member${d.placed === 1 ? "" : "s"} in ${places} place${places === 1 ? "" : "s"}  ·  हम आज कहाँ हैं</text>
<svg x="0" y="${TOP}" width="${W}" height="${MH}" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" preserveAspectRatio="none"><rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" fill="${SEA}"/><path d="${WORLD_LAND}" fill="${LAND}"/><path d="${WORLD_BORDERS}" fill="none" stroke="${LINE}" stroke-width="${(v.w / W).toFixed(3)}"/></svg>
${dots}${labels}
<text x="40" y="${H - 24}" font-size="22" fill="${INDIGO}" font-weight="700">PAAG Foundation</text>
<text x="${W - 40}" y="${H - 24}" font-size="20" fill="#6b6b6b" text-anchor="end">paag.org.in · numbers only, no names</text>
</svg>`;
}

async function pictureBlob(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("draw")); i.src = url; });
    const c = document.createElement("canvas"); c.width = img.naturalWidth || 1200; c.height = img.naturalHeight || 780;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("png"))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

/** My tree → "Where we are today": the living family members on a world map, in their city or district (never an address). */
export function DiasporaMap({ family, onClose, hindi }: { family: DFamily; onClose: () => void; hindi?: boolean }) {
  const d = useMemo(() => diasporaOf(family), [family]);
  const [view, setView] = useState<View>(() => fitView(diasporaOf(family).spots));
  const [sel, setSel] = useState<Spot | undefined>();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const me = family.persons.find((p) => p.is_me);
  const who = `${me?.name_roman.split(" ")[0] ?? "Our"}${me ? "’s family" : " family"}`;

  const save = async (share: boolean) => {
    setBusy(true); setNote("");
    try {
      const blob = await pictureBlob(pictureSvg(d, view, who));
      const file = new File([blob], "where-our-family-lives.png", { type: "image/png" });
      track("share_clicked");
      const text = `Where ${who} members live today — made on PAAG Foundation (paag.org.in)`;
      const nav = navigator as Navigator & { canShare?: (x: unknown) => boolean };
      if (share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text }); }
      else {
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        if (share) window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n(The picture was saved to your phone — attach it to this message.)`)}`, "_blank", "noopener");
        setNote("The picture was saved on your phone.");
      }
    } catch (e) { if ((e as Error).name !== "AbortError") setNote("The picture could not be made. Please try again."); } finally { setBusy(false); }
  };

  const pct = (s: Spot) => { const p = project(s.lat, s.lon); return { left: `${((p.x - view.x) / view.w) * 100}%`, top: `${((p.y - view.y) / view.h) * 100}%` }; };
  const inView = (s: Spot) => { const p = project(s.lat, s.lon); return p.x >= view.x - 5 && p.x <= view.x + view.w + 5 && p.y >= view.y - 5 && p.y <= view.y + view.h + 5; };
  const pill = "h-9 rounded-full border bg-card px-3 text-sm font-medium hover:bg-secondary";

  return (
    <Sheet open onClose={onClose} title="Where we are today" className="md:w-[34rem]">
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold leading-tight">Where we are today <span lang="hi" className="text-base font-medium text-muted-foreground">· हम आज कहाँ हैं</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">{d.living === 0 ? "Add living family members and where they live, and they will appear here." : `${d.placed} of ${d.living} living family members are on the map.`} {hindi && <span lang="hi">हर व्यक्ति अपने शहर या ज़िले में दिखता है, पते पर नहीं।</span>}</p>
        </div>

        <div className="relative w-full overflow-hidden rounded-xl border bg-[#e6edf5]" style={{ aspectRatio: "2 / 1" }} role="img" aria-label={`Map of where ${d.placed} family members live`}>
          <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            <rect x="0" y="0" width={MAP_W} height={MAP_H} fill={SEA} />
            <path d={WORLD_LAND} fill={LAND} />
            <path d={WORLD_BORDERS} fill="none" stroke={LINE} strokeWidth={view.w / 1200} />
          </svg>
          {d.spots.filter(inView).map((s) => {
            const size = markerSize(s.count);
            return (
              <button key={s.key} type="button" onClick={() => setSel(s)} aria-label={`${s.label}: ${s.count} ${s.count === 1 ? "person" : "people"}`} aria-pressed={sel?.key === s.key}
                style={{ ...pct(s), width: size, height: size }}
                className={cn("absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md before:absolute before:-inset-2 before:content-['']", sel?.key === s.key ? "bg-indigo ring-2 ring-indigo/40" : "bg-terracotta/90 hover:bg-terracotta")}>{s.count}</button>
            );
          })}
          <div className="absolute right-2 top-2 flex flex-col gap-1.5">
            <button type="button" aria-label="Zoom in" onClick={() => setView((v) => zoomView(v, 0.6))} className="grid size-9 place-items-center rounded-full border bg-card shadow"><Plus className="size-4" /></button>
            <button type="button" aria-label="Zoom out" onClick={() => setView((v) => zoomView(v, 1.6))} className="grid size-9 place-items-center rounded-full border bg-card shadow"><Minus className="size-4" /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Part of the map">
          <button type="button" className={pill} onClick={() => setView(fitView(d.spots))}>Everyone</button>
          <button type="button" className={pill} onClick={() => setView(INDIA_VIEW)}>India</button>
          <button type="button" className={pill} onClick={() => setView(WORLD_VIEW)}>World</button>
        </div>

        {sel && (
          <div className="rounded-xl border bg-secondary/50 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-semibold"><MapPin className="size-4 text-terracotta" /> {sel.label} <span className="font-normal text-muted-foreground">· {sel.count} {sel.count === 1 ? "person" : "people"}</span></p>
            <p className="mt-1">{sel.people.map((p) => p.name).join(", ")}</p>
          </div>
        )}

        {d.spots.length > 0 && (
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {d.spots.map((s) => (
              <li key={s.key}><button type="button" onClick={() => { setSel(s); setView(zoomView(fitView([s]), 1)); }} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 text-left hover:bg-secondary">
                <span className="truncate">{s.label}</span><span className="font-semibold tabular-nums text-terracotta">{s.count}</span></button></li>
            ))}
          </ul>
        )}

        {(d.noPlace.length > 0 || d.unknown.length > 0) && (
          <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            {d.noPlace.length > 0 && <p><strong className="text-foreground">{d.noPlace.length} living {d.noPlace.length === 1 ? "person has" : "people have"} no place yet:</strong> {d.noPlace.slice(0, 8).map((p) => p.first).join(", ")}{d.noPlace.length > 8 ? "…" : ""}. Tap them in the tree and add where they live.</p>}
            {d.unknown.length > 0 && <p className={d.noPlace.length ? "mt-2" : ""}><strong className="text-foreground">Not found on the map:</strong> {d.unknown.slice(0, 6).map((p) => `${p.first} (${p.place})`).join("; ")}. Try the nearest city or district.</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" disabled={busy || d.spots.length === 0} onClick={() => save(false)}>{busy ? <Loader2 className="animate-spin" /> : <Download />} Save picture</Button>
          <Button className="h-12 bg-[#128C4A] text-white hover:bg-[#0f7a40]" disabled={busy || d.spots.length === 0} onClick={() => save(true)}><MessageCircle /> Share picture</Button>
        </div>
        <p role="status" className="min-h-4 text-xs text-muted-foreground">{note}</p>
        <p className="text-xs text-muted-foreground">Each person is placed in their city or district, never at an address. The picture shows numbers only — no names — so it is safe to share.</p>
      </div>
    </Sheet>
  );
}
