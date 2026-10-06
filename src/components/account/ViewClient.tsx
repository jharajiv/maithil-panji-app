"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveTree } from "@/components/build/LiveTree";
import type { DFamily } from "@/lib/family";
import type { TemplateId } from "@/lib/types";

/** What someone sees after scanning the QR code on a printed tree: the family, read-only. */
export function ViewClient({ id, v }: { id: string; v: string }) {
  const [state, setState] = useState<{ title: string; family: DFamily } | "loading" | "invalid">("loading");
  const [template, setTemplate] = useState<TemplateId>("madhubani");
  const [sel, setSel] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    fetch(`/api/trees/${encodeURIComponent(id)}/view?v=${encodeURIComponent(v)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? await r.json() : null))
      .then((j) => { if (live) setState(j?.family ? { title: j.title, family: j.family } : "invalid"); })
      .catch(() => { if (live) setState("invalid"); });
    return () => { live = false; };
  }, [id, v]);

  const person = useMemo(() => (state !== "loading" && state !== "invalid" ? state.family.persons.find((p) => p.id === sel) : undefined), [state, sel]);

  if (state === "loading") return <div className="grid h-dvh place-items-center text-muted-foreground">Loading the family tree…</div>;
  if (state === "invalid") {
    return (
      <div className="grid h-dvh place-items-center bg-background px-6 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="font-display text-2xl font-semibold text-indigo">This link is not valid</h1>
          <p className="text-muted-foreground">The family may have taken the tree offline, or the QR code was not copied completely. Please ask the person who shared it.</p>
          <Button asChild size="lg"><Link href="/">Maithil Panji home</Link></Button>
        </div>
      </div>
    );
  }
  const count = state.family.persons.length;
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">Maithil Panji · view only</div>
          <h1 className="truncate font-display text-lg font-semibold leading-tight text-indigo">{state.title}</h1>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">{count} people</span>
        <Button asChild size="sm"><Link href="/build">Build your own <ArrowRight /></Link></Button>
      </header>
      <div className="relative min-h-0 flex-1">
        <LiveTree family={state.family} template={template} onTemplate={setTemplate} onSelect={setSel} readOnly className="flex h-full min-h-0 flex-col" />
        {person && (
          <div className="absolute inset-x-3 bottom-3 z-20 mx-auto max-w-md rounded-2xl border bg-card p-4 shadow-lg">
            <button type="button" aria-label="Close" onClick={() => setSel(undefined)} className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
            <div className="font-display text-xl font-semibold">{person.name_roman}</div>
            {person.name_dev && <div lang="hi" className="text-muted-foreground">{person.name_dev}</div>}
            <dl className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              {person.birth && <div>Born {person.birth}{person.status === "deceased" && person.death ? ` · died ${person.death}` : ""}</div>}
              {person.place && <div>{person.place}</div>}
              {(person.gotra || person.mool) && <div>{[person.gotra?.roman && `Gotra ${person.gotra.roman}`, person.mool?.roman && `Mool ${person.mool.roman}`].filter(Boolean).join(" · ")}</div>}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
