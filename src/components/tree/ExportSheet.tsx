"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportTreePdf } from "@/lib/pdf";
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
  open, onClose, data, template, defaultScope = "full", sample = false,
}: { open: boolean; onClose: () => void; data: FamilyData; template: TemplateId; defaultScope?: ExportScope; sample?: boolean }) {
  const [scope, setScope] = useState<ExportScope>(defaultScope);
  const [format, setFormat] = useState<PageFormat>("a3-landscape");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy("Preparing…");
    try {
      await exportTreePdf({ data, scope, template, format, sample, onProgress: setBusy });
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
      <h2 className="font-display text-xl font-semibold">Download PDF</h2>
      <p className="mb-4 text-sm text-muted-foreground">Print-ready, in your current template.</p>

      <div role="radiogroup" aria-label="What to include" className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to include</div>
        <Choice value="full" current={scope} onSelect={setScope} title="Full family tree" hint="Centred on you: your parents and grandparents, and your children." />
        <Choice value="paternal" current={scope} onSelect={setScope} title="Paternal lineage (Panji-style)" hint="The traditional chart: father’s line, brothers’ lines, spouses attached, daughters as leaves." />
      </div>

      <div role="radiogroup" aria-label="Page" className="mt-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page</div>
        <div className="grid grid-cols-2 gap-2">
          <Choice value="a3-landscape" current={format} onSelect={setFormat} title="A3 landscape" hint="Default, for framing" />
          <Choice value="a4-portrait" current={format} onSelect={setFormat} title="A4 portrait" hint="Home printing" />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <Button size="lg" className="mt-5 w-full" onClick={run} disabled={!!busy}>
        {busy ? <><Loader2 className="animate-spin" /> {busy}</> : <><FileDown /> Download PDF</>}
      </Button>
    </Sheet>
  );
}
