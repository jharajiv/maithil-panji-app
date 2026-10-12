"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Network } from "lucide-react";
import { LiveTree } from "./LiveTree";
import type { DFamily } from "@/lib/family";
import type { TemplateId } from "@/lib/types";
import type { Lang } from "@/lib/hi";

const KEY = "maithil-panji.strip.v1";

/**
 * Phone only: a small live picture of the tree above the chat, so people SEE the boxes appear as they answer.
 * It can be hidden for more room; the hidden bar is a link to the My tree tab (and has a small "Show" button to bring the picture back).
 */
export function TreeStrip({ family, template, lang, people, fresh, onOpenTree, onSeen }: {
  family: DFamily; template: TemplateId; lang: Lang; people: number; /** people added since the tree was last looked at in full */ fresh: number;
  onOpenTree: () => void; onSeen: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [typing, setTyping] = useState(false);
  /* small phones start with the one-line bar (the picture is one tap away); a choice made once is remembered */
  useEffect(() => { try { const v = localStorage.getItem(KEY); setHidden(v === "hidden" || (v === null && window.innerHeight < 700)); } catch { /* ignore */ } }, []);
  /* while a text box has the keyboard open the picture folds into a one-line bar, so the chat keeps its room; it comes back by itself */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const check = () => { const a = document.activeElement; setTyping(!!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT")); };
    const later = () => { if (t) clearTimeout(t); t = setTimeout(check, 120); };
    document.addEventListener("focusin", later); document.addEventListener("focusout", later);
    return () => { if (t) clearTimeout(t); document.removeEventListener("focusin", later); document.removeEventListener("focusout", later); };
  }, []);
  const folded = hidden || typing;
  useEffect(() => { if (!folded && fresh > 0) onSeen(); }, [folded, fresh, onSeen]);
  const set = (v: boolean) => { setHidden(v); try { localStorage.setItem(KEY, v ? "hidden" : "shown"); } catch { /* ignore */ } };
  const hi = lang === "hi";
  const count = hi ? `${people} लोग` : `${people} ${people === 1 ? "person" : "people"}`;

  if (folded) return (
    <div className="flex items-stretch border-b bg-card">
      <button type="button" onClick={onOpenTree} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 px-4 py-1.5 text-left text-sm font-medium text-primary">
        <Network className="size-4 shrink-0" /><span className="truncate">{hi ? "आपकी वंशावली" : "Your tree"} · {count}{fresh > 0 ? ` · ${fresh} ${hi ? "नए" : "new"}` : ""}</span><span aria-hidden className="ml-auto shrink-0">→</span>
      </button>
      {hidden && <button type="button" onClick={() => set(false)} aria-label={hi ? "वंशावली का चित्र दिखाइए" : "Show the tree picture"} className="flex shrink-0 items-center gap-1 border-l px-3 text-xs font-medium text-muted-foreground"><ChevronDown className="size-4" />{hi ? "दिखाइए" : "Show"}</button>}
    </div>
  );
  return (
    <div className="border-b bg-card">
      <div className="relative mx-2 mt-1.5 h-[11dvh] min-h-[72px] max-h-[96px] overflow-hidden rounded-lg">
        <LiveTree compact family={family} template={template} onTemplate={() => {}} onSelect={onOpenTree} className="absolute inset-0 flex flex-col" />
      </div>
      <div className="flex items-center justify-between gap-2 px-3">
        <button type="button" onClick={onOpenTree} className="flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-primary"><Network className="size-4" />{hi ? "आपकी वंशावली" : "Your tree"} · {count} <span aria-hidden>→</span></button>
        <button type="button" onClick={() => set(true)} aria-label={hi ? "चित्र छिपाइए" : "Hide the tree picture"} className="flex min-h-9 items-center gap-1 px-2 text-xs font-medium text-muted-foreground"><ChevronUp className="size-4" />{hi ? "छिपाइए" : "Hide"}</button>
      </div>
    </div>
  );
}
