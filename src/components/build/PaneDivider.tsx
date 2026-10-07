"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "maithil-panji.layout.v1";
export const CHAT_DEFAULT = 400;
const MIN = 300;           // narrowest the chat can be while open
const COLLAPSE_BELOW = 230; // dragging past this folds the chat away
const keys = { ArrowLeft: -24, ArrowRight: 24 } as const;

/** how wide the chat column is on a big screen, and whether it is folded away — remembered on this device */
export function usePaneLayout() {
  const [width, setWidth] = useState(CHAT_DEFAULT);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as { width?: number; collapsed?: boolean } | null;
      if (s && typeof s.width === "number" && s.width >= MIN && s.width <= 1200) setWidth(s.width);
      if (s?.collapsed) setCollapsed(true);
    } catch { /* ignore */ }
  }, []);
  const save = useCallback((w: number, c: boolean) => { try { localStorage.setItem(KEY, JSON.stringify({ width: w, collapsed: c })); } catch { /* ignore */ } }, []);
  const set = useCallback((w: number, c = false) => { setWidth(w); setCollapsed(c); save(w, c); }, [save]);
  return { width, collapsed, set, toggle: () => set(width, !collapsed), reset: () => set(CHAT_DEFAULT, false) };
}

/**
 * The draggable bar between the chat and the tree. Drag it, use the arrow keys, double-click to reset,
 * or use the little arrow to fold the chat away (and again to bring it back).
 */
export function PaneDivider({ width, collapsed, container, onChange, onToggle, onReset, onSettled }: {
  width: number; collapsed: boolean; container: React.RefObject<HTMLElement | null>;
  onChange: (w: number, collapsed: boolean) => void; onToggle: () => void; onReset: () => void; onSettled?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const max = () => Math.max(MIN + 40, Math.min(760, (container.current?.clientWidth ?? 1200) * 0.62));
  const clamp = (w: number) => Math.min(max(), Math.max(MIN, w));
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
    const w = e.clientX - box.left;
    if (w < COLLAPSE_BELOW) onChange(wRef.current, true); else onChange(clamp(w), false);
  };
  const end = () => { if (dragging) { setDragging(false); onSettled?.(); } };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key in keys) { e.preventDefault(); onChange(clamp(width + keys[e.key as keyof typeof keys]), false); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
    else if (e.key === "Home") { e.preventDefault(); onReset(); }
  };

  return (
    <div role="separator" aria-orientation="vertical" tabIndex={0} aria-label="Resize the chat. Drag, or use the left and right arrow keys. Enter folds the chat away."
      aria-valuenow={collapsed ? 0 : Math.round(width)} aria-valuemin={0} aria-valuemax={Math.round(max())}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end} onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onReset(); }} onKeyDown={onKey}
      className={cn("group relative z-10 w-2 shrink-0 cursor-col-resize touch-none select-none bg-border/60 outline-none transition-colors hover:bg-primary/40 focus-visible:bg-primary/60", dragging && "bg-primary/60")}>
      <button type="button" onClick={onToggle} aria-label={collapsed ? "Show the chat" : "Hide the chat to give the tree more room"} title={collapsed ? "Show the chat" : "Hide the chat"}
        className="absolute left-1/2 top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-card text-muted-foreground shadow hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
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
