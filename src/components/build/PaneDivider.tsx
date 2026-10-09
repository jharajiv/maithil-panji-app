"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GitMerge, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "maithil-panji.layout.v1";
export const CHAT_DEFAULT = 400;
const MIN = 300;           // narrowest the chat can be while open
const COLLAPSE_BELOW = 230; // dragging past this folds the chat away
const keys = { ArrowLeft: -24, ArrowRight: 24 } as const;

export const SOON_DEFAULT = 300;
const SOON_MIN = 220;

/** how wide the chat column and the Families column are on a big screen, and whether each is folded away — remembered on this device */
export function usePaneLayout() {
  const [width, setWidth] = useState(CHAT_DEFAULT);
  const [collapsed, setCollapsed] = useState(false);
  const [soonWidth, setSoonWidth] = useState(SOON_DEFAULT);
  const [soonCollapsed, setSoonCollapsed] = useState(true); // the Families panel starts folded: the first screen is the chat and the tree
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as { width?: number; collapsed?: boolean; soonWidth?: number; soonCollapsed?: boolean } | null;
      if (s && typeof s.width === "number" && s.width >= MIN && s.width <= 1200) setWidth(s.width);
      if (s?.collapsed) setCollapsed(true);
      if (s && typeof s.soonWidth === "number" && s.soonWidth >= SOON_MIN && s.soonWidth <= 800) setSoonWidth(s.soonWidth);
      if (s && s.soonCollapsed === false) setSoonCollapsed(false); // opened it before: keep it open
    } catch { /* ignore */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify({ width, collapsed, soonWidth, soonCollapsed })); } catch { /* ignore */ }
  }, [width, collapsed, soonWidth, soonCollapsed]);
  return {
    width, collapsed, set: (w: number, c = false) => { setWidth(w); setCollapsed(c); },
    toggle: () => setCollapsed((c) => !c), reset: () => { setWidth(CHAT_DEFAULT); setCollapsed(false); },
    soonWidth, soonCollapsed, setSoon: (w: number, c = false) => { setSoonWidth(w); setSoonCollapsed(c); },
    toggleSoon: () => setSoonCollapsed((c) => !c), resetSoon: () => { setSoonWidth(SOON_DEFAULT); setSoonCollapsed(false); },
  };
}

/**
 * The draggable bar between the chat and the tree. Drag it, use the arrow keys, double-click to reset,
 * or use the little arrow to fold the chat away (and again to bring it back).
 */
export function PaneDivider({ side = "left", width, collapsed, container, onChange, onToggle, onReset, onSettled }: {
  /** "left": the divider sits right of the chat. "right": it sits left of the Families column. */
  side?: "left" | "right";
  width: number; collapsed: boolean; container: React.RefObject<HTMLElement | null>;
  onChange: (w: number, collapsed: boolean) => void; onToggle: () => void; onReset: () => void; onSettled?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const right = side === "right";
  const lo = right ? SOON_MIN : MIN;
  const max = () => Math.max(lo + 40, Math.min(right ? 520 : 760, (container.current?.clientWidth ?? 1200) * (right ? 0.4 : 0.62)));
  const clamp = (w: number) => Math.min(max(), Math.max(lo, w));
  const wRef = useRef(width); wRef.current = width;

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const box = container.current?.getBoundingClientRect();
    if (!box) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const box = container.current?.getBoundingClientRect();
    if (!box) return;
    const w = right ? box.right - e.clientX : e.clientX - box.left;
    if (w < (right ? SOON_MIN - 60 : COLLAPSE_BELOW)) onChange(wRef.current, true); else onChange(clamp(w), false);
  };
  const end = () => { if (dragging) { setDragging(false); onSettled?.(); } };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key in keys) { e.preventDefault(); onChange(clamp(width + keys[e.key as keyof typeof keys] * (right ? -1 : 1)), false); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
    else if (e.key === "Home") { e.preventDefault(); onReset(); }
  };

  return (
    <div role="separator" aria-orientation="vertical" tabIndex={0} aria-label={right ? "Resize the Families panel. Drag, or use the left and right arrow keys. Enter folds it away." : "Resize the chat. Drag, or use the left and right arrow keys. Enter folds the chat away."}
      aria-valuenow={collapsed ? 0 : Math.round(width)} aria-valuemin={0} aria-valuemax={Math.round(max())}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end} onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onReset(); }} onKeyDown={onKey}
      className={cn("group relative z-10 w-2 shrink-0 cursor-col-resize touch-none select-none bg-border/60 outline-none transition-colors hover:bg-primary/40 focus-visible:bg-primary/60", dragging && "bg-primary/60")}>
      <button type="button" onClick={onToggle} aria-label={right ? (collapsed ? "Show the Families panel" : "Hide the Families panel to give the tree more room") : (collapsed ? "Show the chat" : "Hide the chat to give the tree more room")} title={right ? (collapsed ? "Show the Families panel" : "Hide the Families panel") : (collapsed ? "Show the chat" : "Hide the chat")}
        className="absolute left-1/2 top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-card text-muted-foreground shadow hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {(right ? !collapsed : collapsed) ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
      </button>
    </div>
  );
}

/** what is left of the chat when it is folded away: one tap brings it back */
export function ChatRail({ onOpen, unread }: { onOpen: () => void; unread?: boolean }) {
  return (
    <button type="button" onClick={onOpen} aria-label="Open the chat" className="relative flex w-12 shrink-0 flex-col items-center gap-3 border-r bg-card pt-4 text-muted-foreground hover:bg-secondary hover:text-foreground">
      <MessageCircle className="size-5" />
      <span className="text-xs font-medium [writing-mode:vertical-rl]">Chat</span>
      {unread && <span className="absolute right-2 top-3 size-2.5 rounded-full bg-terracotta" aria-label="New message" />}
    </button>
  );
}

/** what is left of the Families panel when it is folded away */
export function FamiliesRail({ onOpen, dot }: { onOpen: () => void; dot?: boolean }) {
  return (
    <button type="button" onClick={onOpen} aria-label="Open the Families panel" className="relative flex w-12 shrink-0 flex-col items-center gap-3 border-l bg-card pt-4 text-muted-foreground hover:bg-secondary hover:text-foreground">
      <GitMerge className="size-5" />
      <span className="text-xs font-medium [writing-mode:vertical-rl]">Families</span>
      {dot && <span className="absolute left-2 top-3 size-2.5 rounded-full bg-terracotta" aria-label="Possible matches found" />}
    </button>
  );
}
