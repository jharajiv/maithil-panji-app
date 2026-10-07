"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/track";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveTree } from "@/components/build/LiveTree";
import { darbhangaSample, portraitFor, SAMPLE_CREDIT, SAMPLE_NOTICE } from "@/data/darbhanga-sample";
import type { DFamily } from "@/lib/family";
import type { TemplateId } from "@/lib/types";

/** A real public lineage to explore — so a visitor can feel what their own tree will look like. Read-only, no sign-in. */
export function SampleClient() {
  const base = useMemo(() => darbhangaSample(), []);
  const portraits = useMemo(() => portraitFor(base), [base]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  // portraits are small files in /public/sample/portraits; the chart wants them as data addresses
  useEffect(() => {
    let live = true;
    portraits.forEach(async (p) => {
      try {
        const blob = await (await fetch(`/sample/portraits/${p.file}`)).blob();
        const url = await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(blob); });
        if (live && url.startsWith("data:image/")) setPhotos((x) => ({ ...x, [p.id]: url }));
      } catch { /* no portrait: the card keeps its motif */ }
    });
    return () => { live = false; };
  }, [portraits]);
  const family = useMemo<DFamily>(() => (Object.keys(photos).length ? { ...base, persons: base.persons.map((p) => (photos[p.id] ? { ...p, photo: photos[p.id] } : p)) } : base), [base, photos]);
  const [template, setTemplate] = useState<TemplateId>("madhubani");
  const [sel, setSel] = useState<string | undefined>();
  useEffect(() => { track("sample_opened", "session"); }, []);
  const person = family.persons.find((p) => p.id === sel);
  const credit = portraits.find((p) => p.id === sel && photos[p.id])?.credit;
  const years = person ? [person.birth, person.death].filter(Boolean).join(" – ") : "";
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">Sample family tree</div>
          <h1 className="truncate font-display text-lg font-semibold leading-tight text-indigo">Sample: the Darbhanga Raj line</h1>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">{family.persons.length} people</span>
        <Button asChild size="sm" className="bg-terracotta text-white hover:bg-terracotta/90"><Link href="/build">Build your own <ArrowRight /></Link></Button>
      </header>
      <p role="note" className="border-b bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">{SAMPLE_NOTICE}</p>
      <div className="relative min-h-0 flex-1">
        <LiveTree family={family} template={template} onTemplate={setTemplate} onSelect={setSel} readOnly plain className="flex h-full min-h-0 flex-col" />
        {person && (
          <div className="absolute inset-x-3 bottom-3 z-20 mx-auto max-h-[60%] max-w-md overflow-y-auto rounded-2xl border bg-card p-4 shadow-lg">
            <button type="button" aria-label="Close" onClick={() => setSel(undefined)} className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
            <div className="font-display text-xl font-semibold">{person.name_roman}</div>
            {person.name_dev && <div lang="hi" className="text-muted-foreground">{person.name_dev}</div>}
            <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
              {years && <div>{years}</div>}
              {person.gotra && <div>Gotra {person.gotra.roman}</div>}
              {person.notes && <div className="text-foreground/80">{person.notes}</div>}
              {credit && <div className="text-xs">Photo: {credit}</div>}
            </dl>
          </div>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t bg-card px-4 py-1.5 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1">{SAMPLE_CREDIT}{portraits.length > 0 && " Photo credits are on each person’s card."}</span>
        <span className="flex items-center gap-3">
          <a className="underline-offset-2 hover:underline" href="https://rajputs.net/view/darbhanga" target="_blank" rel="noopener noreferrer">rajputs.net</a>
          <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        </span>
      </footer>
    </div>
  );
}
