"use client";
import "family-chart/styles/family-chart.css";
import "@/components/tree/tree-templates.css";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Crosshair, Maximize2, Minimize2, Minus, Plus, Scan, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Motif } from "@/components/landing/Motif";
import { cn } from "@/lib/utils";
import { mountTree, type MountedTree } from "@/lib/chart";
import { fatherOf, toFamilyData, type DFamily } from "@/lib/family";
import { paternalLineage } from "@/lib/tree-filter";
import type { TemplateId } from "@/lib/types";

const TEMPLATES = [
  { value: "madhubani", label: "Mithila Madhubani" },
  { value: "classic", label: "Classic" },
  { value: "minimal", label: "Modern" },
] as const;

/** from this size on, a redraw keeps the reader's place instead of zooming back out to fit everything */
const BIG = 25;

export interface LiveTreeHandle { fit: () => void; centreOn: (id: string) => void }

export const LiveTree = forwardRef<LiveTreeHandle, {
  family: DFamily; template: TemplateId; onTemplate: (t: TemplateId) => void; onSelect: (id: string) => void; className?: string;
  /** right-click / long-press on a person's box */
  onContext?: (id: string, x: number, y: number, touch: boolean) => void;
  /** the free-form editor button, shown next to the zoom controls */
  extra?: React.ReactNode;
  /** the read-only page opened from a printed QR code */
  readOnly?: boolean;
}>(function LiveTree({ family, template, onTemplate, onSelect, onContext, className, extra, readOnly }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedTree | null>(null);
  const view = useRef<{ k: number; x: number; y: number } | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const ctx = useRef(onContext);
  ctx.current = onContext;
  const data = useMemo(() => toFamilyData(family), [family]);
  const scoped = useMemo(() => (data ? paternalLineage(data) : null), [data]);
  const count = family.persons.length;
  const [full, setFull] = useState(false);
  const [finding, setFinding] = useState(false);
  const [q, setQ] = useState("");

  useImperativeHandle(ref, () => ({
    fit: () => mounted.current?.fit(),
    centreOn: (id) => mounted.current?.panTo(id, 1),
  }));

  useEffect(() => {
    if (!scoped || !host.current || !data) return;
    let cancelled = false;
    const el = host.current;
    // small debounce: the chat can change the family several times in a second
    const t = setTimeout(() => {
      mountTree(el, scoped, template, { rootId: data.root_person_id, onSelect: (id) => select.current(id), onContext: ctx.current ? (id, x, y, touch) => ctx.current?.(id, x, y, touch) : undefined, transition: 0 }).then((m) => {
        if (cancelled) { m.destroy(); return; }
        mounted.current = m;
        if (scoped.persons.length > BIG) {
          // a big family cannot be read when squeezed onto the screen: keep the reader's place, or start at "me" at a readable size
          if (view.current) m.setView(view.current); else m.panTo(data.root_person_id, 0.7);
        }
      });
    }, 250);
    return () => {
      cancelled = true; clearTimeout(t);
      if (mounted.current) view.current = mounted.current.getView() ?? view.current;
      mounted.current?.destroy(); mounted.current = null;
    };
  }, [scoped, template, data]);

  // after entering/leaving full screen the pane changes size: fit again
  useEffect(() => { const t = setTimeout(() => mounted.current?.fit(), 120); return () => clearTimeout(t); }, [full]);
  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [full]);

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return family.persons.filter((p) => !p.placeholder && (p.name_roman.toLowerCase().includes(s) || (p.name_dev ?? "").includes(s))).slice(0, 8);
  }, [q, family.persons]);

  return (
    <section className={cn(className, full && "fixed inset-0 z-40 flex flex-col bg-background")} aria-label="Your family tree">
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Segmented ariaLabel="Tree style" className="min-w-0 flex-1 sm:max-w-md" options={TEMPLATES as unknown as { value: TemplateId; label: string }[]} value={template} onChange={onTemplate} />
        <div className="flex flex-wrap gap-1.5">
          <Button size="icon" variant="outline" onClick={() => mounted.current?.zoomBy(1 / 1.35)} disabled={!scoped} aria-label="Zoom out"><Minus /></Button>
          <Button size="icon" variant="outline" onClick={() => mounted.current?.zoomBy(1.35)} disabled={!scoped} aria-label="Zoom in"><Plus /></Button>
          <Button size="sm" variant="outline" onClick={() => mounted.current?.fit()} disabled={!scoped}><Scan /> Fit</Button>
          {data && <Button size="sm" variant="outline" onClick={() => mounted.current?.panTo(data.root_person_id, 1)}><Crosshair /> Me</Button>}
          {count > 8 && <Button size="icon" variant={finding ? "default" : "outline"} onClick={() => { setFinding((v) => !v); setQ(""); }} aria-label="Find a person" aria-pressed={finding}><Search /></Button>}
          {extra}
          <Button size="icon" variant="outline" onClick={() => setFull((v) => !v)} aria-label={full ? "Leave full screen" : "Full screen"} disabled={!scoped}>{full ? <Minimize2 /> : <Maximize2 />}</Button>
        </div>
      </div>
      {finding && (
        <div className="relative border-b bg-card px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name to find…" className="h-10 w-full rounded-lg border bg-background pl-9 pr-9 text-base outline-none focus:border-primary" />
            {q && <button type="button" aria-label="Clear" onClick={() => setQ("")} className="absolute right-2 top-2 rounded p-1 text-muted-foreground"><X className="size-4" /></button>}
          </div>
          {hits.length > 0 && (
            <ul className="absolute inset-x-3 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-card shadow-lg">
              {hits.map((p) => (
                <li key={p.id}><button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary"
                  onClick={() => { mounted.current?.panTo(p.id, 1); setFinding(false); setQ(""); }}>
                  <span className="min-w-0"><span className="block truncate font-medium">{p.name_roman}</span>{fatherOf(family, p.id) && <span className="block truncate text-xs text-muted-foreground">{p.gender === "female" ? "daughter" : "son"} of {fatherOf(family, p.id)!.name_roman}</span>}</span><span className="shrink-0 text-xs text-muted-foreground">{p.birth ? p.birth.slice(0, 4) : ""}</span>
                </button></li>
              ))}
            </ul>
          )}
          {q.trim() && !hits.length && <p className="px-1 pt-1 text-xs text-muted-foreground">No one with that name yet.</p>}
        </div>
      )}
      <div className="relative min-h-0 flex-1 bg-background">
        <div ref={host} className="absolute inset-0" data-testid="live-tree" />
        {!scoped && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div className="max-w-xs">
              <div className="mx-auto mb-4 flex justify-center gap-3 text-primary opacity-80"><Motif name="lotus" className="size-14" /><Motif name="sun" className="size-14" /><Motif name="fish" className="size-14" /></div>
              <h3 className="font-display text-xl font-semibold">Your tree will grow here</h3>
              <p className="mt-1 text-muted-foreground">Answer the questions in the chat, and watch your family appear — in the Mithila Madhubani style.</p>
            </div>
          </div>
        )}
        {scoped && <p className="pointer-events-none absolute bottom-2 left-1/2 w-max max-w-[92%] -translate-x-1/2 rounded-full bg-card/90 px-3 py-1 text-center text-xs text-muted-foreground shadow">{count} {count === 1 ? "person" : "people"} · {readOnly ? "tap anyone for details" : "tap anyone to edit · press and hold (or right-click) for more"} · drag to move · pinch or scroll to zoom</p>}
      </div>
    </section>
  );
});
