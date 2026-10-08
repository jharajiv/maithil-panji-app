"use client";
import { useCallback, useEffect, useState } from "react";
import { GitMerge, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CombinePreview, CombineView, ConnectRequest, Similar } from "./useSimilar";

const FIELD: Record<string, string> = { birth: "birth date", death: "death date", status: "living / passed away", place: "village", name_dev: "name in Hindi", married_to: "husband", gender: "gender", gotra: "gotra", mool: "mool", name: "name" };
const label = (f: string) => FIELD[f] ?? f;

/** Combine two connected trees: one owner offers, the other previews and applies; the receiving owner can undo. */
export function CombinePanel({ r, sim }: { r: ConnectRequest; sim: Similar }) {
  const [view, setView] = useState<CombineView>({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [agree, setAgree] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CombinePreview | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ added: number; filled: number; conflicts: number } | null>(null);
  const { combineGet, combineDo, canAct } = sim;
  const cb = r.combine;

  useEffect(() => { let live = true; if (cb) combineGet(r.id).then((v) => { if (live) setView(v); }); else setView({}); return () => { live = false; }; }, [cb?.status, cb?.from, r.id, combineGet]); // eslint-disable-line react-hooks/exhaustive-deps

  const look = useCallback(async (x: Set<string>) => {
    setBusy("look"); setErr("");
    const v = await combineGet(r.id, [...x]);
    setBusy("");
    if (v.error) setErr(v.error); else if (v.preview) setPreview(v.preview);
  }, [combineGet, r.id]);
  const act = async (a: "offer" | "withdraw" | "decline" | "apply" | "undo", extra: Record<string, unknown> = {}) => {
    setBusy(a); setErr("");
    const x = await combineDo(r.id, a, extra);
    setBusy("");
    if (!x.ok) { setErr(x.error ?? "Could not save."); return; }
    if (a === "apply") { setDone({ added: x.added ?? 0, filled: x.filled ?? 0, conflicts: x.conflicts ?? 0 }); setOpen(false); setPreview(null); }
    if (a === "offer") { setAgree(false); setOpen(false); }
    if (a === "decline") { setOpen(false); setPreview(null); }
  };
  const toggle = (id: string) => { const n = new Set(off); if (n.has(id)) n.delete(id); else n.add(id); setOff(n); void look(n); };
  const Spin = ({ k }: { k: string }) => (busy === k ? <Loader2 className="animate-spin" /> : null);

  if (!canAct) return null;
  const title = `“${r.title}”`;
  return (
    <div className="mt-3 rounded-xl border border-dashed bg-card p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium"><GitMerge className="size-4 text-primary" /> Combine the two trees</p>

      {done && <p className="mt-2 rounded-lg bg-green-50 p-2 text-green-900">Done. {done.added} {done.added === 1 ? "person was" : "people were"} added to your tree{done.filled ? `, ${done.filled} missing ${done.filled === 1 ? "detail was" : "details were"} filled in` : ""}. {done.conflicts ? `${done.conflicts} ${done.conflicts === 1 ? "difference was" : "differences were"} left as you had them.` : ""} You can undo this below.</p>}

      {!cb && (
        <>
          <p className="mt-1 text-muted-foreground">If you both agree this is one family, one of you can offer to give their whole tree to the other. The tree that gives stays exactly as it is.</p>
          {!open ? <Button variant="outline" className="mt-2 h-11" onClick={() => setOpen(true)}>Offer my tree to {title}…</Button> : (
            <div className="mt-2 space-y-2">
              <p><strong>Everyone in your tree, including living people with their birth year and village, can be copied into {title}, and its owner can then edit them.</strong></p>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 size-5" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> <span>I agree. I have talked with the owner of {title}.</span></label>
              <div className="flex gap-2"><Button className="h-11" disabled={!agree || !!busy} onClick={() => act("offer", { confirm: true })}><Spin k="offer" /> Offer my tree</Button><Button variant="ghost" className="h-11" onClick={() => setOpen(false)}>Cancel</Button></div>
            </div>
          )}
        </>
      )}

      {cb?.status === "offered" && view.role === "giver" && (
        <div className="mt-1 space-y-2"><p>You offered your tree. Waiting for the owner of {title} to look at it and combine.</p><Button variant="outline" className="h-11" disabled={!!busy} onClick={() => act("withdraw")}><Spin k="withdraw" /> Take back my offer</Button></div>
      )}

      {cb?.status === "offered" && view.role === "receiver" && (
        <div className="mt-1 space-y-2">
          <p>{title} offered to give you its whole tree. Look at what would change first — nothing happens until you press the button.</p>
          {!preview ? <Button className="h-11" disabled={!!busy} onClick={() => { setOpen(true); void look(off); }}><Spin k="look" /> See what would change</Button> : (
            <div className="space-y-3">
              <div>
                <p className="font-medium">1. These people look the same in both trees ({preview.used} ticked)</p>
                <p className="text-xs text-muted-foreground">Untick anyone who is a different person.</p>
                <ul className="mt-1 space-y-1">{preview.pairs.map((p) => (
                  <li key={p.id}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1 size-5" checked={!off.has(p.id)} onChange={() => toggle(p.id)} disabled={busy === "look"} /><span>{p.mine}{p.mine !== p.theirs ? ` (${p.theirs})` : ""} <span className="text-xs text-muted-foreground">{p.reasons.slice(0, 3).join(" · ")}</span></span></label></li>
                ))}</ul>
              </div>
              {preview.ok ? (
                <>
                  <div>
                    <p className="font-medium">2. {preview.addedCount} new {preview.addedCount === 1 ? "person" : "people"} will be added</p>
                    {preview.addedCount > 0 && <p className="text-muted-foreground">{preview.added.slice(0, 14).map((a) => a.name + (a.years ? ` (${a.years})` : "")).join(", ")}{preview.addedCount > 14 ? ` and ${preview.addedCount - 14} more` : ""}</p>}
                  </div>
                  {preview.filledCount > 0 && <p><span className="font-medium">3. {preview.filledCount} missing {preview.filledCount === 1 ? "detail" : "details"} will be filled in</span> <span className="text-muted-foreground">(such as {[...new Set(preview.filled.slice(0, 40).map((f) => label(f.field)))].slice(0, 4).join(", ")})</span></p>}
                  {preview.conflictCount > 0 && (
                    <div>
                      <p className="font-medium">Differences — your version stays</p>
                      <ul className="list-disc pl-5 text-muted-foreground">{preview.conflicts.slice(0, 8).map((c, i) => <li key={i}>{c.person}: {label(c.field)} — yours “{c.mine}”, theirs “{c.theirs}”</li>)}{preview.conflictCount > 8 && <li>and {preview.conflictCount - 8} more</li>}</ul>
                    </div>
                  )}
                  {(preview.leftOut > 0 || preview.skippedRelations > 0) && <p className="text-xs text-muted-foreground">{preview.leftOut > 0 ? `${preview.leftOut} people are not connected to anyone in your tree and are not copied. ` : ""}{preview.skippedRelations > 0 ? `${preview.skippedRelations} relationships were left out because they would not fit your tree (for example a second father).` : ""}</p>}
                </>
              ) : <p role="alert" className="rounded-lg bg-amber-50 p-2 text-amber-900">{preview.reason}</p>}
              <div className="flex flex-wrap gap-2">
                <Button className="h-11" disabled={!preview.ok || !!busy} onClick={() => act("apply", { exclude: [...off] })}><Spin k="apply" /> Combine now</Button>
                <Button variant="ghost" className="h-11" disabled={!!busy} onClick={() => act("decline")}><Spin k="decline" /> Not now, decline</Button>
              </div>
              <p className="text-xs text-muted-foreground">You can undo it afterwards. {title} is not changed.</p>
            </div>
          )}
        </div>
      )}

      {cb?.status === "applied" && !done && (
        <p className="mt-1">{view.role === "receiver" ? `${title} was combined into your tree.` : `Your tree was combined into ${title}.`}</p>
      )}
      {cb?.status === "applied" && view.role === "receiver" && view.canUndo && (
        <div className="mt-2"><Button variant="outline" className="h-11" disabled={!!busy} onClick={() => act("undo")}><Spin k="undo" /> <Undo2 /> Undo the combine</Button><p className="mt-1 text-xs text-muted-foreground">People that came from {title} are removed again, and details it filled in become blank. Changes you made to those people since are lost.</p></div>
      )}
      {err && <p role="alert" className="mt-2 text-terracotta">{err}</p>}
    </div>
  );
}
