"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Link2, Minus, Move, Plus, Scan, UserPlus, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { applyOps, parentsOf, type DFamily, type DPerson, type Gender, type Op } from "@/lib/family";
import { autoLayout, bounds, BOX_H, BOX_W, type Pos } from "@/lib/freeform-layout";
import { romanToDevanagari } from "@/lib/translit";
import { inputCls } from "./widgets";

type Mode = "move" | "connect";
type View = { k: number; x: number; y: number };
type LinkRef = { type: "parent_of" | "spouse_of"; a: string; b: string };

const INK = "#1f2a5c", RED = "#a63a1d", OCHRE = "#d99a2b";

/**
 * Free-form editing: boxes and connectors. Add a person, drag boxes where you like, join two people with a connector
 * (parent → child, child → parent, or husband and wife), tap a connector to remove it. The tree itself is always drawn
 * automatically from these connections.
 */
export function FreeformEditor({ open, onClose, family, onFamily, onEdit }: {
  open: boolean; onClose: () => void; family: DFamily; onFamily: (f: DFamily) => void; onEdit: (id: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const [pos, setPos] = useState<Map<string, Pos>>(new Map());
  const [view, setView] = useState<View>({ k: 1, x: 24, y: 24 });
  const [mode, setMode] = useState<Mode>("move");
  const [picked, setPicked] = useState<string | null>(null);
  const [pair, setPair] = useState<{ a: string; b: string } | null>(null);
  const [linkMenu, setLinkMenu] = useState<LinkRef | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | undefined>();
  const [msg, setMsg] = useState<string | null>(null);
  const byId = useMemo(() => new Map(family.persons.map((p) => [p.id, p])), [family.persons]);
  const nm = (id: string) => { const p = byId.get(id); return p ? (p.placeholder ? "(name not known)" : p.name_roman) : "?"; };
  const familyRef = useRef(family); familyRef.current = family;
  const posRef = useRef(pos); posRef.current = pos;
  const viewRef = useRef(view); viewRef.current = view;

  const fitView = useCallback((p: Map<string, Pos>, animate = false) => {
    const el = wrap.current, z = zoomRef.current;
    if (!el || !z) return;
    const b = bounds(p);
    const w = el.clientWidth, h = el.clientHeight;
    const k = Math.min(1, (w - 48) / (b.x1 - b.x0), (h - 48) / (b.y1 - b.y0));
    const t = d3.zoomIdentity.translate((w - (b.x1 - b.x0) * k) / 2 - b.x0 * k, Math.max(24, (h - (b.y1 - b.y0) * k) / 2 - b.y0 * k)).scale(k);
    const sel = d3.select(el);
    (animate ? sel.transition().duration(250) : sel).call(z.transform as never, t);
  }, []);

  // pan + zoom (drag the background, wheel or pinch); dragging a box or using a button is handled separately
  useEffect(() => {
    if (!open || !wrap.current) return;
    const el = wrap.current;
    const z = d3.zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.1, 2.5])
      .filter((e: Event) => !(e.target as Element).closest("[data-box],[data-ui]"))
      .on("zoom", (e) => setView({ k: e.transform.k, x: e.transform.x, y: e.transform.y }));
    zoomRef.current = z;
    d3.select(el).call(z).on("dblclick.zoom", null);
    return () => { d3.select(el).on(".zoom", null); zoomRef.current = null; };
  }, [open]);

  // lay everyone out when the editor opens; people who appear later are placed beside the others
  useEffect(() => {
    if (!open) return;
    const fresh = autoLayout(familyRef.current);
    setPos(fresh);
    setMode("move"); setPicked(null); setPair(null); setLinkMenu(null); setAdding(false); setMsg(null);
    // a big family cannot be read when squeezed onto the screen: start at "me" at a readable size ("Fit" shows everything)
    const t = setTimeout(() => {
      const me = familyRef.current.persons.find((p) => p.is_me), at = me && fresh.get(me.id), el = wrap.current, z = zoomRef.current;
      if (familyRef.current.persons.length > 30 && at && el && z) {
        const k = 0.8;
        d3.select(el).call(z.transform as never, d3.zoomIdentity.translate(el.clientWidth / 2 - (at.x + BOX_W / 2) * k, el.clientHeight / 2 - (at.y + BOX_H / 2) * k).scale(k));
      } else fitView(fresh);
    }, 60);
    return () => clearTimeout(t);
  }, [open, fitView]);
  useEffect(() => {
    if (!open) return;
    const missing = family.persons.filter((p) => !posRef.current.has(p.id));
    if (!missing.length) return;
    setPos((cur) => {
      const next = new Map(cur);
      const auto = autoLayout(family);
      const b = bounds(next);
      missing.forEach((p, i) => next.set(p.id, next.has(p.id) ? next.get(p.id)! : cur.size ? { x: b.x1 + 30 + i * (BOX_W + 14), y: auto.get(p.id)?.y ?? 0 } : auto.get(p.id)!));
      return next;
    });
  }, [open, family]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !pair && !linkMenu) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, onClose, pair, linkMenu]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 5000); return () => clearTimeout(t); }, [msg]);

  const run = (ops: Op[]): { ok: boolean; id?: string } => {
    const r = applyOps(familyRef.current, ops);
    const bad = r.results.find((x) => !x.ok);
    if (bad) { setMsg(bad.message); return { ok: false }; }
    onFamily(r.family);
    return { ok: true, id: r.results[0]?.id };
  };

  /* ───────── boxes ───────── */
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const onBoxDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const p = posRef.current.get(id); if (!p) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
  };
  const onBoxMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    const k = viewRef.current.k;
    setPos((cur) => new Map(cur).set(d.id, { x: d.ox + dx / k, y: d.oy + dy / k }));
  };
  const onBoxUp = (id: string) => {
    const d = drag.current; drag.current = null;
    if (d?.moved) return;
    if (mode === "connect") {
      if (!picked) setPicked(id);
      else if (picked === id) setPicked(null);
      else { setPair({ a: picked, b: id }); setPicked(null); }
    } else onEdit(id);
  };

  /* ───────── connectors ───────── */
  const links = useMemo(() => family.rels.filter((r) => pos.has(r.a) && pos.has(r.b)), [family.rels, pos]);
  const path = (r: LinkRef) => {
    const a = pos.get(r.a)!, b = pos.get(r.b)!;
    if (r.type === "parent_of") {
      const x1 = a.x + BOX_W / 2, y1 = a.y + BOX_H, x2 = b.x + BOX_W / 2, y2 = b.y;
      const dy = Math.max(40, Math.abs(y2 - y1) / 2);
      return { d: `M${x1} ${y1} C${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
    }
    const left = a.x <= b.x ? a : b, right = a.x <= b.x ? b : a;
    if (Math.abs(a.y - b.y) < BOX_H) {
      const x1 = left.x + BOX_W, x2 = right.x, y = (left.y + right.y) / 2 + BOX_H / 2;
      return x2 > x1 ? { d: `M${x1} ${y} L${x2} ${y}`, mx: (x1 + x2) / 2, my: y } : { d: `M${left.x + BOX_W / 2} ${left.y + BOX_H} Q${(left.x + right.x) / 2 + BOX_W / 2} ${Math.max(left.y, right.y) + BOX_H + 40} ${right.x + BOX_W / 2} ${right.y + BOX_H}`, mx: (left.x + right.x) / 2 + BOX_W / 2, my: Math.max(left.y, right.y) + BOX_H + 20 };
    }
    const x1 = a.x + BOX_W / 2, y1 = a.y + BOX_H / 2, x2 = b.x + BOX_W / 2, y2 = b.y + BOX_H / 2;
    return { d: `M${x1} ${y1} L${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  };
  const existing = (a: string, b: string) => family.rels.filter((r) => (r.type === "parent_of" ? (r.a === a && r.b === b) || (r.a === b && r.b === a) : (r.a === a && r.b === b) || (r.a === b && r.b === a)));
  const describe = (r: LinkRef) => (r.type === "parent_of" ? `${nm(r.a)} is a parent of ${nm(r.b)}` : `${nm(r.a)} and ${nm(r.b)} are husband and wife`);

  const connect = (type: LinkRef["type"], a: string, b: string) => {
    const r = run([{ op: "link", type, a, b }]);
    if (r.ok) { setPair(null); setMsg(`Connected: ${describe({ type, a, b })}.`); }
  };
  const removeLink = (l: LinkRef) => { if (run([{ op: "unlink", type: l.type, a: l.a, b: l.b }]).ok) { setLinkMenu(null); setMsg("Connection removed."); } };

  const addPerson = () => {
    const n = name.trim();
    if (!n) return;
    const el = wrap.current;
    const v = viewRef.current;
    let x = el ? (el.clientWidth / 2 - v.x) / v.k - BOX_W / 2 : 0;
    const y = el ? (el.clientHeight / 2 - v.y) / v.k - BOX_H / 2 : 0;
    for (let i = 0; i < 40 && [...posRef.current.values()].some((p) => Math.abs(p.x - x) < BOX_W && Math.abs(p.y - y) < BOX_H); i++) x += BOX_W + 16;
    const before = new Set(familyRef.current.persons.map((p) => p.id));
    const r = run([{ op: "add_person", name_roman: n, name_dev: romanToDevanagari(n), gender }]);
    if (!r.ok) return;
    const id = r.id ?? "";
    if (id && !before.has(id)) setPos((cur) => new Map(cur).set(id, { x, y }));
    setName(""); setGender(undefined);
    setMsg(`${n} added. Switch to “Connect” to join them to the family.`);
  };

  const tidy = () => { const p = autoLayout(familyRef.current); setPos(p); setTimeout(() => fitView(p, true), 30); };
  const zoomBtn = (f: number) => { const el = wrap.current, z = zoomRef.current; if (el && z) d3.select(el).transition().duration(200).call(z.scaleBy as never, f); };

  if (!open) return null;
  const connectedIds = new Set(family.rels.flatMap((r) => [r.a, r.b]));
  const cardFor = (p: DPerson) => {
    const female = p.gender === "female";
    const born = p.birth?.slice(0, 4);
    return (
      <div className={cn("flex h-full flex-col justify-center rounded-lg border-2 bg-[#fbf0d2] px-2.5 text-left shadow-sm", picked === p.id ? "ring-4 ring-primary/40" : "", female ? "border-[#a63a1d]" : "border-[#1f2a5c]")}
        style={{ borderLeftWidth: 7 }}>
        <div className="truncate text-[13px] font-bold leading-tight text-[#1f2a5c]">{p.placeholder ? "(name not known)" : p.name_roman}{p.is_me && <span className="ml-1.5 rounded-full bg-[#a63a1d] px-1.5 py-px align-middle text-[9px] font-bold text-white">YOU</span>}</div>
        {p.name_dev && !p.placeholder && <div lang="hi" className="truncate text-[12px] leading-tight text-[#1f2a5c]/80">{p.name_dev}</div>}
        <div className="truncate text-[10.5px] leading-tight text-[#1f2a5c]/65">{[female ? "woman" : "man", born && `b. ${born}`, !connectedIds.has(p.id) && family.persons.length > 1 ? "not connected yet" : ""].filter(Boolean).join(" · ")}</div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[35] flex flex-col bg-background" role="dialog" aria-label="Edit the tree freely">
      <div data-ui className="flex flex-wrap items-center gap-2 border-b bg-card px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-semibold leading-tight">Edit freely</h2>
          <p className="truncate text-xs text-muted-foreground">Boxes and connectors · {family.persons.length} {family.persons.length === 1 ? "person" : "people"}</p>
        </div>
        <Button size="sm" onClick={onClose}><X /> Done</Button>
        <div className="flex w-full flex-wrap items-center gap-1.5">
          <div role="radiogroup" aria-label="Tool" className="flex overflow-hidden rounded-xl border">
            {([["move", "Move & edit", Move], ["connect", "Connect", Link2]] as const).map(([m, label, Icon]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setPicked(null); }}
                className={cn("flex h-9 items-center gap-1.5 px-3 text-sm font-medium", mode === m ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}><Icon className="size-4" />{label}</button>
            ))}
          </div>
          <Button size="sm" variant={adding ? "default" : "outline"} onClick={() => setAdding((v) => !v)} aria-pressed={adding}><UserPlus /> Add a person</Button>
          <Button size="sm" variant="outline" onClick={tidy}><Wand2 /> Tidy up</Button>
          <Button size="icon" variant="outline" aria-label="Zoom out" onClick={() => zoomBtn(1 / 1.3)}><Minus /></Button>
          <Button size="icon" variant="outline" aria-label="Zoom in" onClick={() => zoomBtn(1.3)}><Plus /></Button>
          <Button size="icon" variant="outline" aria-label="Fit everything" onClick={() => fitView(posRef.current, true)}><Scan /></Button>
        </div>
        {adding && (
          <form className="flex w-full flex-wrap items-center gap-2 rounded-xl border bg-secondary/40 p-2" onSubmit={(e) => { e.preventDefault(); addPerson(); }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name in English letters" aria-label="Name of the new person" className={cn(inputCls, "h-10 min-w-0 flex-1 basis-40")} />
            <div role="radiogroup" aria-label="Man or woman" className="flex gap-1.5">
              {([["male", "Man"], ["female", "Woman"]] as const).map(([g, l]) => (
                <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => setGender(g)}
                  className={cn("h-10 rounded-lg border px-3 text-sm font-medium", gender === g ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>{l}</button>
              ))}
            </div>
            <Button type="submit" disabled={!name.trim() || !gender}>Add box</Button>
          </form>
        )}
        <p className="w-full text-xs text-muted-foreground">
          {mode === "connect"
            ? (picked ? <>Now tap the <strong>second</strong> person to join with <strong>{nm(picked)}</strong>.</> : <>Tap the <strong>first</strong> person, then the <strong>second</strong>, to join them.</>)
            : <>Tap a person to edit them · drag a box to move it · drag the background to move around · tap a line to remove it.</>}
        </p>
      </div>

      <div ref={wrap} className="relative min-h-0 flex-1 touch-none overflow-hidden bg-[#f6ecd0]" style={{ backgroundImage: "radial-gradient(#d8c58a 1px, transparent 1px)", backgroundSize: `${24 * view.k}px ${24 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
        data-testid="freeform-canvas">
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden={false}>
            <defs><marker id="ff-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill={INK} /></marker></defs>
            {links.map((r) => {
              const p = path(r);
              const spouse = r.type === "spouse_of";
              return (
                <g key={`${r.type}-${r.a}-${r.b}`}>
                  <path d={p.d} fill="none" stroke={spouse ? RED : INK} strokeWidth={spouse ? 4 : 2.4} strokeLinecap="round" markerEnd={spouse ? undefined : "url(#ff-arrow)"} />
                  {spouse && <path d={p.d} fill="none" stroke={OCHRE} strokeWidth={1.6} strokeLinecap="round" />}
                  <path d={p.d} fill="none" stroke="transparent" strokeWidth={18} className="pointer-events-auto cursor-pointer" data-ui
                    onClick={() => setLinkMenu(r)}><title>{describe(r)} — tap to remove</title></path>
                </g>
              );
            })}
          </svg>
          {family.persons.map((p) => {
            const at = pos.get(p.id); if (!at) return null;
            return (
              <div key={p.id} data-box role="button" tabIndex={0} aria-label={`${nm(p.id)}${mode === "connect" ? " — tap to connect" : " — tap to edit"}`}
                className={cn("absolute select-none touch-none", mode === "connect" ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}
                style={{ left: at.x, top: at.y, width: BOX_W, height: BOX_H }}
                onPointerDown={(e) => onBoxDown(e, p.id)} onPointerMove={onBoxMove} onPointerUp={() => onBoxUp(p.id)} onPointerCancel={() => { drag.current = null; }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBoxUp(p.id); } }}>
                {cardFor(p)}
              </div>
            );
          })}
        </div>
        {!family.persons.length && <div className="absolute inset-0 grid place-items-center p-8 text-center text-muted-foreground">Tap “Add a person” to place the first box.</div>}
        <div data-ui className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-card/90 px-3 py-1.5 text-[11px] text-foreground/75 shadow">
          <span className="flex items-center gap-1.5"><svg width="26" height="8" aria-hidden><path d="M1 4 H20" stroke={INK} strokeWidth="2" /><path d="M19 0.5 L25 4 L19 7.5Z" fill={INK} /></svg> parent → child</span>
          <span className="flex items-center gap-1.5"><svg width="26" height="8" aria-hidden><path d="M1 4 H25" stroke={RED} strokeWidth="4" /><path d="M1 4 H25" stroke={OCHRE} strokeWidth="1.4" /></svg> husband &amp; wife</span>
        </div>
        {msg && <div data-ui role="status" className="absolute left-1/2 top-3 z-10 max-w-[92%] -translate-x-1/2 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">{msg}</div>}
      </div>

      {pair && (
        <Panel title={`${nm(pair.a)} and ${nm(pair.b)}`} onClose={() => setPair(null)}>
          {existing(pair.a, pair.b).length > 0 && (
            <div className="mb-2 rounded-lg bg-secondary/60 p-2 text-sm">
              <div className="font-medium">Already connected:</div>
              {existing(pair.a, pair.b).map((r) => (
                <div key={`${r.type}${r.a}${r.b}`} className="mt-1 flex items-center justify-between gap-2"><span>{describe(r)}</span>
                  <button type="button" className="rounded-lg px-2 py-1 text-sm font-medium text-terracotta hover:bg-card" onClick={() => { removeLink(r); setPair(null); }}>Remove</button></div>
              ))}
            </div>
          )}
          <p className="mb-2 text-sm text-muted-foreground">How are they connected?</p>
          <div className="grid gap-2">
            <ChoiceBtn onClick={() => connect("parent_of", pair.a, pair.b)}>{nm(pair.a)} is a <strong>parent</strong> of {nm(pair.b)}</ChoiceBtn>
            <ChoiceBtn onClick={() => connect("parent_of", pair.b, pair.a)}>{nm(pair.a)} is a <strong>child</strong> of {nm(pair.b)}</ChoiceBtn>
            <ChoiceBtn onClick={() => connect("spouse_of", pair.a, pair.b)}>{nm(pair.a)} and {nm(pair.b)} are <strong>husband and wife</strong></ChoiceBtn>
          </div>
          {(() => { const kids = [pair.a, pair.b].filter((id) => parentsOf(family, id).length >= 2); return kids.length ? <p className="mt-2 text-xs text-muted-foreground">{kids.map(nm).join(" and ")} already {kids.length > 1 ? "have" : "has"} two parents, so {kids.length > 1 ? "they cannot" : "they cannot"} be given another.</p> : null; })()}
        </Panel>
      )}
      {linkMenu && (
        <Panel title="Remove this connection?" onClose={() => setLinkMenu(null)}>
          <p className="mb-3 text-sm">{describe(linkMenu)}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setLinkMenu(null)}>Keep it</Button>
            <Button className="flex-1 bg-terracotta text-white hover:bg-terracotta/90" onClick={() => removeLink(linkMenu)}>Remove</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function ChoiceBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border bg-card px-4 py-3 text-left text-base hover:bg-secondary">{children}</button>;
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div data-ui className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md rounded-t-2xl border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
      <div className="mb-2 flex items-start justify-between gap-2"><h3 className="font-display text-lg font-semibold leading-tight">{title}</h3>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"><X className="size-5" /></button></div>
      {children}
    </div>
  );
}
