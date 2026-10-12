"use client";
import { useEffect, useRef, useState } from "react";
import { Download, MessageSquareWarning, MoreHorizontal, RotateCcw, Share2 } from "lucide-react";
import { tr, type Lang } from "@/lib/hi";

/**
 * Phone only: the "⋯" button at the end of the slim header. Corrections, Share, PDF and Start over live here
 * so the header stays one thin row and the chat gets the room.
 */
export function HeaderMenu({ lang, corrections, onCorrections, onShare, onPdf, onReset }: {
  lang: Lang; corrections: number;
  onCorrections: () => void; onShare?: () => void; onPdf?: () => void; onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const item = (key: string, Icon: typeof Share2, label: string, fn: () => void, extra?: React.ReactNode, danger?: boolean) => (
    <button key={key} type="button" role="menuitem" onClick={() => { setOpen(false); fn(); }}
      className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-[16px] hover:bg-secondary ${danger ? "text-terracotta" : ""}`}><Icon className="size-5 shrink-0" /><span className="min-w-0 flex-1">{label}</span>{extra}</button>
  );
  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={tr(lang, "More")}
        className="relative grid size-10 place-items-center rounded-full text-foreground hover:bg-secondary"><MoreHorizontal className="size-6" />
        {corrections > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[10px] font-semibold leading-4 text-white" aria-label={`${corrections} ${tr(lang, "Suggested corrections")}`}>{corrections}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-2xl border bg-card py-1 shadow-xl">
          {corrections > 0 && item("c", MessageSquareWarning, tr(lang, "Suggested corrections"), onCorrections, <span className="rounded-full bg-terracotta px-2 text-xs font-semibold text-white">{corrections}</span>)}
          {onShare && item("s", Share2, tr(lang, "Share and invite family"), onShare)}
          {onPdf && item("p", Download, tr(lang, "Download PDF"), onPdf)}
          {onReset && item("r", RotateCcw, tr(lang, "Start over"), onReset, undefined, true)}
        </div>
      )}
    </div>
  );
}
