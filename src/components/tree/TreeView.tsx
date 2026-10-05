"use client";
import "family-chart/styles/family-chart.css";
import "./tree-templates.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Crosshair, Download, Maximize2, Share2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { sampleFamily } from "@/data/sample-persons";
import { mountTree, type MountedTree } from "@/lib/chart";
import { scopeData } from "@/lib/tree-filter";
import type { TemplateId } from "@/lib/types";
import { PersonSheet } from "./PersonSheet";
import { ExportSheet } from "./ExportSheet";

const TEMPLATES = [
  { value: "classic", label: "Classic" },
  { value: "madhubani", label: "Mithila Madhubani" },
  { value: "minimal", label: "Modern Minimal" },
] as const;

export function TreeView() {
  const data = sampleFamily;
  const [template, setTemplate] = useState<TemplateId>("classic");
  const [selected, setSelected] = useState<string | undefined>();
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedTree | null>(null);
  const scoped = useMemo(() => scopeData(data, "full"), [data]);
  const root = data.persons.find((p) => p.person_id === data.root_person_id)!;

  useEffect(() => {
    let cancelled = false;
    if (!host.current) return;
    mountTree(host.current, scoped, template, {
      rootId: data.root_person_id,
      onSelect: setSelected,
    }).then((m) => {
      if (cancelled) m.destroy();
      else mounted.current = m;
    });
    return () => {
      cancelled = true;
      mounted.current?.destroy();
      mounted.current = null;
    };
  }, [template, scoped, data.root_person_id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Our Maithil family tree", url });
      else {
        await navigator.clipboard.writeText(url);
        setToast("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="z-30 border-b bg-card/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur md:flex md:items-center md:gap-4 md:px-4 md:py-2">
        <div className="flex items-center gap-2 md:contents">
          <Link href="/" aria-label="Back to home" className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 md:flex-none">
            <h1 className="truncate font-display text-base font-semibold leading-tight">{root.name_roman.split(" ")[0]}’s family</h1>
            <p className="truncate text-xs text-muted-foreground">Sample family · {data.persons.length} people</p>
          </div>
          <div className="flex items-center gap-1 md:order-3 md:ml-auto">
            <Button size="sm" onClick={() => setExportOpen(true)}>
              <Download /> <span className="hidden min-[380px]:inline">Download PDF</span><span className="min-[380px]:hidden">PDF</span>
            </Button>
            <Button size="icon" variant="ghost" onClick={share} aria-label="Share"><Share2 /></Button>
            <Button size="icon" variant="ghost" disabled aria-label="Invite relatives (coming Day 3)" title="Invite relatives — coming Day 3"><UserPlus /></Button>
          </div>
        </div>
        <Segmented
          ariaLabel="Tree template"
          className="mt-2 md:order-2 md:mt-0 md:w-auto"
          options={TEMPLATES as unknown as { value: TemplateId; label: string }[]}
          value={template}
          onChange={setTemplate}
        />
      </header>

      <main className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" data-testid="tree-host" />
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-end justify-between px-3">
          <div className="pointer-events-auto flex gap-2">
            <Button size="sm" variant="outline" className="bg-card shadow" onClick={() => mounted.current?.fit()}><Maximize2 /> Fit</Button>
            <Button size="sm" variant="outline" className="bg-card shadow" onClick={() => mounted.current?.centreOn(data.root_person_id)}><Crosshair /> Me</Button>
          </div>
          <p className="rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow">Pinch to zoom · tap a person</p>
        </div>
        {toast && (
          <div role="status" className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">
            {toast}
          </div>
        )}
      </main>

      <PersonSheet
        data={data}
        person={data.persons.find((p) => p.person_id === selected)}
        onClose={() => setSelected(undefined)}
        onCentre={(id) => mounted.current?.centreOn(id)}
      />
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} data={data} template={template} />
    </div>
  );
}
