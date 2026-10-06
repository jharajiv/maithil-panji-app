"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageCircle, Pencil, Shuffle } from "lucide-react";
import { fatherOf, spousesOf, type DFamily } from "@/lib/family";
import type { ListKind } from "@/lib/interview";

export interface TreeMenuState { id: string; x: number; y: number; /** opened by a long-press: keep the menu out from under the finger */ touch?: boolean }

/** what can be asked about this person in the chat — the same fixed questions the interview uses */
export function chatChoices(f: DFamily, id: string): { kind: ListKind; label: string }[] {
  const p = f.persons.find((x) => x.id === id);
  if (!p || p.placeholder) return [];
  if (p.gender === "female") {
    // a sister or daughter: her husband is kept as a one-line note. A married-in wife is recorded by name only.
    return fatherOf(f, id) && spousesOf(f, id).length === 0 ? [{ kind: "husband", label: "Add her husband (name and village)" }] : [];
  }
  return [
    { kind: "brothers", label: "Add his brothers" }, { kind: "sisters", label: "Add his sisters" },
    { kind: "wife", label: "Add his wife" }, { kind: "sons", label: "Add his sons" }, { kind: "daughters", label: "Add his daughters" },
  ];
}

/** Right-click / long-press menu on a person's box: continue the chat about THIS person, edit, or repair a wrong relationship. */
export function TreeMenu({ family, menu, onClose, onChat, onEdit, onChange }: {
  family: DFamily; menu: TreeMenuState | null; onClose: () => void;
  onChat: (kind: ListKind, id: string) => void; onEdit: (id: string) => void; onChange: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const opened = useRef(0);
  /** ignore the tail end of the press that opened the menu */
  const armed = () => Date.now() - opened.current > 350;
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    opened.current = Date.now();
    // a finger that is still down must not land on an item: open the menu below it (or above, near the bottom of the screen)
    const gap = menu.touch ? 28 : 0;
    const left = menu.touch ? menu.x - r.width / 2 : menu.x;
    const top = menu.y + gap + r.height > window.innerHeight - 8 ? menu.y - r.height - gap : menu.y + gap;
    setPos({ left: Math.max(8, Math.min(left, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(top, window.innerHeight - r.height - 8)) });
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [menu, onClose]);
  if (!menu) return null;
  const p = family.persons.find((x) => x.id === menu.id);
  if (!p) return null;
  const choices = chatChoices(family, menu.id);
  const item = "flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-[15px] hover:bg-secondary active:bg-secondary";
  return (
    <div className="fixed inset-0 z-50" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div ref={ref} role="menu" aria-label={`About ${p.name_roman}`} style={pos} onPointerDown={(e) => e.stopPropagation()}
        className="fixed w-72 max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border bg-card py-1 shadow-xl">
        <p className="truncate border-b px-4 pb-2 pt-2 text-sm font-semibold">{p.placeholder ? "Name not known" : p.name_roman}</p>
        {choices.length > 0 && <p className="px-4 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Continue the chat about {p.name_roman.split(" ")[0]}</p>}
        {choices.map((c) => (
          <button key={c.kind} role="menuitem" type="button" className={item} onClick={() => { if (!armed()) return; onClose(); onChat(c.kind, menu.id); }}><MessageCircle className="size-4 shrink-0 text-primary" /> {c.label}</button>
        ))}
        <div className="my-1 border-t" />
        <button role="menuitem" type="button" className={item} onClick={() => { if (!armed()) return; onClose(); onEdit(menu.id); }}><Pencil className="size-4 shrink-0 text-muted-foreground" /> Edit details</button>
        {!p.is_me && <button role="menuitem" type="button" className={item} onClick={() => { if (!armed()) return; onClose(); onChange(menu.id); }}><Shuffle className="size-4 shrink-0 text-muted-foreground" /> Wrong relationship? Change it</button>}
      </div>
    </div>
  );
}
