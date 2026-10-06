"use client";
import { useEffect, useMemo, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportTreePdf, FIT_MAX_PEOPLE, type ExportMode } from "@/lib/pdf";
import { scopeData } from "@/lib/tree-filter";
import { recentlyDonated } from "@/lib/donate";
import { DonateStep, donationConfigured } from "./DonateStep";
import type { ExportScope, FamilyData, PageFormat, TemplateId } from "@/lib/types";

function Choice<T extends string>({
  value, current, onSelect, title, hint,
}: { value: T; current: T; onSelect: (v: T) => void; title: string; hint: string }) {
  const on = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onSelect(value)}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors",
        on ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary",
      )}
    >
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{hint}</div>
    </button>
  );
}

export function ExportSheet({
  open, onClose, data, template, defaultScope = "full", sample = false, viewUrl, saveHref,
}: { open: boolean; onClose: () => void; data: FamilyData; template: TemplateId; defaultScope?: ExportScope; sample?: boolean; viewUrl?: string; saveHref?: string }) {
  const [scope, setScope] = useState<ExportScope>(defaultScope);
  const [format, setFormat] = useState<PageFormat>("a3-landscape");
  const people = useMemo(() => scopeData(data, scope).persons.length, [data, scope]);
  const big = people > FIT_MAX_PEOPLE;
  const [mode, setMode] = useState<ExportMode>(big ? "poster" : "fit");
  const [touched, setTouched] = useState(false);
  // until the reader chooses, follow the size of the tree
  useEffect(() => { if (!touched) setMode(big ? "poster" : "fit"); }, [big, touched]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"options" | "donate">("options");
  useEffect(() => { if (!open) setStep("options"); }, [open]);

  /** the download button: a small, skippable contribution first (never for the sample tree, and not again soon after contributing) */
  function start() {
    if (sample || !donationConfigured() || recentlyDonated()) { void run(); return; }
    setStep("donate");
  }

  async function run() {
    setStep("options");
    setError(null);
    setBusy("Preparing…");
    try {
      await exportTreePdf({ data, scope, template, format, mode, sample, onProgress: setBusy, viewUrl });
      onClose();
    } catch (e) {
      console.error(e);
      setError("Could not build the PDF. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title="Download PDF">
      {step === "donate" ? <DonateStep onBack={() => setStep("options")} onContinue={() => void run()} /> : <>
      <h2 className="font-display text-xl font-semibold">Download PDF</h2>
      <p className="mb-4 text-sm text-muted-foreground">Print-ready, in your current template.</p>

      <div role="radiogroup" aria-label="What to include" className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to include</div>
        <Choice value="full" current={scope} onSelect={setScope} title="Full family tree" hint="Centred on you: your parents and grandparents, and your children." />
        <Choice value="paternal" current={scope} onSelect={setScope} title="Paternal lineage (Panji-style)" hint="The traditional chart: father’s line, brothers’ lines, spouses attached, daughters as leaves." />
      </div>

      <div role="radiogroup" aria-label="Size" className="mt-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Size · {people} {people === 1 ? "person" : "people"}</div>
        <Choice value="fit" current={mode} onSelect={(v) => { setTouched(true); setMode(v); }} title="One page" hint={big ? "Everything on a single sheet — names will be very small for a family this size." : "Everything on a single sheet. Best for up to about 40 people."} />
        <Choice value="pages" current={mode} onSelect={(v) => { setTouched(true); setMode(v); }} title="Several A3 / A4 sheets" hint="Readable size: printed in parts that you join, with an overview sheet first." />
        <Choice value="poster" current={mode} onSelect={(v) => { setTouched(true); setMode(v); }} title="Large poster (one big page)" hint="One very large page — zoom in on a screen, or take it to a print shop. Best for big families." />
      </div>

      {mode !== "poster" && (
        <div role="radiogroup" aria-label="Page" className="mt-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sheet size</div>
          <div className="grid grid-cols-2 gap-2">
            <Choice value="a3-landscape" current={format} onSelect={setFormat} title="A3 landscape" hint="Default, for framing" />
            <Choice value="a4-portrait" current={format} onSelect={setFormat} title="A4 portrait" hint="Home printing" />
          </div>
        </div>
      )}

      {!sample && (viewUrl ? (
        <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">The QR code at the bottom of the page is unique to your tree. Anyone who scans it sees a read-only copy online — they cannot change anything.</p>
      ) : saveHref ? (
        <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">Want a personal QR code on the printout, so relatives can scan it and see this tree online? <a className="font-medium text-primary underline underline-offset-2" href={saveHref}>Save your tree to an account first.</a></p>
      ) : null)}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <Button size="lg" className="mt-5 w-full" onClick={start} disabled={!!busy}>
        {busy ? <><Loader2 className="animate-spin" /> {busy}</> : <><FileDown /> Download PDF</>}
      </Button>
      </>}
    </Sheet>
  );
}
