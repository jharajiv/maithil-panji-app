"use client";
import "family-chart/styles/family-chart.css";
import "@/components/tree/tree-templates.css";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Crosshair, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Motif } from "@/components/landing/Motif";
import { mountTree, type MountedTree } from "@/lib/chart";
import { toFamilyData, type DFamily } from "@/lib/family";
import { paternalLineage } from "@/lib/tree-filter";
import type { TemplateId } from "@/lib/types";

const TEMPLATES = [
  { value: "madhubani", label: "Mithila Madhubani" },
  { value: "classic", label: "Classic" },
  { value: "minimal", label: "Modern" },
] as const;

export interface LiveTreeHandle { fit: () => void; centreOn: (id: string) => void }

export const LiveTree = forwardRef<LiveTreeHandle, {
  family: DFamily; template: TemplateId; onTemplate: (t: TemplateId) => void; onSelect: (id: string) => void; className?: string;
}>(function LiveTree({ family, template, onTemplate, onSelect, className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedTree | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const data = useMemo(() => toFamilyData(family), [family]);
  const scoped = useMemo(() => (data ? paternalLineage(data) : null), [data]);
  const count = family.persons.length;

  useImperativeHandle(ref, () => ({
    fit: () => mounted.current?.fit(),
    centreOn: (id) => mounted.current?.centreOn(id),
  }));

  useEffect(() => {
    if (!scoped || !host.current || !data) return;
    let cancelled = false;
    const el = host.current;
    // small debounce: the chat can change the family several times in a second
    const t = setTimeout(() => {
      mountTree(el, scoped, template, { rootId: data.root_person_id, onSelect: (id) => select.current(id), transition: 0 }).then((m) => {
        if (cancelled) m.destroy(); else mounted.current = m;
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); mounted.current?.destroy(); mounted.current = null; };
  }, [scoped, template, data]);

  return (
    <section className={className} aria-label="Your family tree">
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Segmented ariaLabel="Tree style" className="min-w-0 flex-1 sm:max-w-md" options={TEMPLATES as unknown as { value: TemplateId; label: string }[]} value={template} onChange={onTemplate} />
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => mounted.current?.fit()} disabled={!scoped}><Maximize2 /> Fit</Button>
          {data && <Button size="sm" variant="outline" onClick={() => mounted.current?.centreOn(data.root_person_id)}><Crosshair /> Me</Button>}
        </div>
      </div>
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
        {scoped && <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow">{count} {count === 1 ? "person" : "people"} · tap anyone to edit · pinch to zoom</p>}
      </div>
    </section>
  );
});
