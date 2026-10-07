"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageCircle, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveTree } from "@/components/build/LiveTree";
import type { DFamily } from "@/lib/family";
import type { TemplateId } from "@/lib/types";

/** What someone sees after scanning the QR code on a printed tree: the family, read-only. */
export function ViewClient({ id, v }: { id: string; v: string }) {
  const [state, setState] = useState<{ title: string; mode?: "private" | "full"; family: DFamily } | "loading" | "invalid">("loading");
  const [template, setTemplate] = useState<TemplateId>("madhubani");
  const [sel, setSel] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    fetch(`/api/trees/${encodeURIComponent(id)}/view?v=${encodeURIComponent(v)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? await r.json() : null))
      .then((j) => { if (live) setState(j?.family ? { title: j.title, mode: j.mode, family: j.family } : "invalid"); })
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
  const here = typeof location !== "undefined" ? location.href : "";
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">Maithil Panji · view only</div>
          <h1 className="truncate font-display text-lg font-semibold leading-tight text-indigo">{state.title}</h1>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">{count} people</span>
        <Button asChild size="sm" className="bg-terracotta text-white hover:bg-terracotta/90"><Link href="/build">Build your own <ArrowRight /></Link></Button>
      </header>
      {state.mode === "private" && (
        <p className="flex items-center justify-center gap-2 border-b bg-green-50 px-4 py-1.5 text-center text-xs text-green-900"><ShieldCheck className="size-3.5 shrink-0" /> The family chose to protect living relatives: they show by first name only.</p>
      )}
      <div className="relative min-h-0 flex-1">
        <LiveTree family={state.family} template={template} onTemplate={setTemplate} onSelect={setSel} readOnly className="flex h-full min-h-0 flex-col" />
        {!person && (
          <div className="pointer-events-none absolute inset-x-3 bottom-12 z-10 mx-auto flex max-w-md justify-center">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-card/95 py-1.5 pl-4 pr-1.5 text-sm shadow-lg backdrop-blur">
              <span className="text-muted-foreground">Every Maithil family has a story.</span>
              <Button asChild size="sm" className="rounded-full bg-terracotta text-white hover:bg-terracotta/90"><Link href="/build">Build yours — free</Link></Button>
            </div>
          </div>
        )}
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
      <footer className="flex items-center justify-between gap-3 border-t bg-card px-4 py-1.5 text-xs text-muted-foreground">
        <span>View only · cannot be edited or downloaded</span>
        <span className="flex items-center gap-3">
          <a className="inline-flex items-center gap-1 underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Have a look at this Maithil family tree: ${here}`)}`}><MessageCircle className="size-3.5" /> Send on WhatsApp</a>
          <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        </span>
      </footer>
    </div>
  );
}
