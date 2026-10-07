"use client";
import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { DFamily } from "@/lib/family";
import { currentValue, fieldLabel } from "@/lib/suggest";
import type { SuggestionsState } from "./useSuggestions";

/** Inbox: corrections viewers have suggested. Apply (name, dates, place), mark done (changed by hand), or dismiss. */
export function SuggestionsSheet({ open, onClose, family, sg, onEdit }: { open: boolean; onClose: () => void; family: DFamily; sg: SuggestionsState; onEdit: (personId: string) => void }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const run = async (id: string, a: "apply" | "done" | "dismiss") => { setBusy(id + a); setErr(""); try { await sg.act(id, a); } catch (e) { setErr(e instanceof Error ? e.message : "Could not do that."); } finally { setBusy(""); } };
  return (
    <Sheet open={open} onClose={onClose} title="Suggested corrections" className="md:w-[28rem]">
      <h2 className="font-display text-xl font-semibold">Suggested corrections</h2>
      <p className="mt-1 text-sm text-muted-foreground">People who looked at your tree think these details need a correction. Nothing changes until you apply it.</p>
      {err && <p role="alert" className="mt-2 text-sm text-terracotta">{err}</p>}
      {sg.list.length === 0 && <p className="mt-4 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">No suggestions waiting.</p>}
      <ul className="mt-4 space-y-3">
        {sg.list.map((s) => {
          const person = family.persons.find((p) => p.id === s.person_id);
          const now = currentValue(family, s.person_id, s.field);
          return (
            <li key={s.id} className="rounded-2xl border bg-background p-3 text-sm">
              <p className="font-medium">{person?.name_roman ?? "A person who is no longer in the tree"} · {fieldLabel(s.field)}</p>
              <p className="mt-1">{now ? <><span className="text-muted-foreground line-through">{now}</span> → </> : null}<strong>{s.value}</strong></p>
              {s.note && <p className="mt-1 text-muted-foreground">“{s.note}”</p>}
              <p className="mt-1 text-xs text-muted-foreground">From {s.from_name || "someone who viewed the tree"} · {new Date(s.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.canApply
                  ? <Button className="h-11" disabled={!!busy} onClick={() => run(s.id, "apply")}>{busy === s.id + "apply" ? <Loader2 className="animate-spin" /> : <Check />} Apply this</Button>
                  : <>
                    {person && <Button className="h-11" variant="outline" onClick={() => { onClose(); onEdit(person.id); }}>Open {person.name_roman.split(" ")[0]}</Button>}
                    <Button className="h-11" variant="outline" disabled={!!busy} onClick={() => run(s.id, "done")}><Check /> I have fixed it</Button>
                  </>}
                <Button className="h-11" variant="ghost" disabled={!!busy} onClick={() => run(s.id, "dismiss")}><X /> Not right</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
