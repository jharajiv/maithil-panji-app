"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookHeart, Camera, Check, Flag, Loader2, Trash2, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { shrink } from "@/lib/photo-client";
import { MAX_STORY_TEXT, type StoryView } from "@/lib/stories";
import type { DFamily } from "@/lib/family";
import type { ShareInfo } from "./useShare";
import { inputCls } from "./widgets";

type Act = "approve" | "reject" | "remove" | "flag" | "unflag";

/**
 * With `personId`: the story board of one person (read, add, flag). Without: what is waiting for me
 * (stories to approve; for the owner also stories that family members flagged).
 */
export function StoriesSheet({ open, onClose, family, share, qs, body, personId, onChanged }: {
  open: boolean; onClose: () => void; family: DFamily; share: ShareInfo | null; qs: string; body: Record<string, unknown>;
  personId?: string; onChanged: () => void;
}) {
  const treeId = share?.treeId;
  const person = family.persons.find((p) => p.id === personId);
  const [list, setList] = useState<StoryView[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [ask, setAsk] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [note, setNote] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!treeId) return;
    try {
      const res = await fetch(`/api/trees/${treeId}/stories?${[personId ? `person=${encodeURIComponent(personId)}` : "", qs].filter(Boolean).join("&")}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not load the stories.");
      setList((personId ? j.stories : j.inbox) as StoryView[]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not load the stories."); }
  }, [treeId, personId, qs]);
  useEffect(() => { if (open) { setList(null); setErr(""); setNote(""); setAsk(""); load(); } }, [open, load]);
  useEffect(() => { if (!open) { setText(""); setPhoto(""); } }, [open, personId]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/trees/${treeId}/stories`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...payload }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Could not do that.");
    return j as { status?: "pending" | "shown" };
  };
  const run = async (id: string, a: Act) => {
    setBusy(id + a); setErr(""); setAsk("");
    try { await post({ action: a, id }); await load(); onChanged(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not do that."); } finally { setBusy(""); }
  };
  const add = async () => {
    if (!personId) return;
    setBusy("add"); setErr(""); setNote("");
    try {
      const j = await post({ action: "add", person: personId, text, photo: photo || undefined });
      setText(""); setPhoto("");
      setNote(j.status === "pending" ? `Thank you. It will be shown after ${person?.name_roman.split(" ")[0] ?? "the person"} has approved it.` : "Added.");
      await load(); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not add it."); } finally { setBusy(""); }
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    try { setPhoto(await shrink(f)); } catch { setErr("This photo could not be used. Please try a JPEG or PNG picture."); }
  };

  const first = person?.name_roman.split(" ")[0];
  const title = personId ? `Stories about ${first ?? "this person"}` : "Waiting for you";
  const living = person && person.status !== "deceased" && !person.death;
  return (
    <Sheet open={open} onClose={onClose} title={title} className="md:w-[28rem]">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><BookHeart className="size-5 text-terracotta" /> {title}</h2>
      {personId ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {living
            ? `Photos and memories of ${first} that the family adds. Each one is shown only after ${first} has approved it.`
            : `Photos and memories of ${first}. They are shown to the family at once. The owner of the tree can remove any of them, and anyone can flag one that is not right.`}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Stories that need your answer, and stories family members flagged as not right.</p>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-terracotta">{err}</p>}

      {personId && (
        <div className="mt-4 space-y-2 rounded-2xl border bg-background p-3">
          <label htmlFor="story-text" className="text-sm font-medium">Add a memory or a photo</label>
          <textarea id="story-text" className={`${inputCls} h-24 py-3`} maxLength={MAX_STORY_TEXT} placeholder={living ? `For example: ${first} taught us to ride a bicycle in the village.` : `For example: how ${first} used to start each day.`} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => file.current?.click()} className="inline-flex h-11 items-center gap-1.5 rounded-xl border px-4 text-sm font-medium hover:bg-secondary"><Camera className="size-4" /> {photo ? "Change photo" : "Add a photo"}</button>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            {photo && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Your photo, ready to add" className="size-11 rounded-lg border object-cover" />
                <button type="button" onClick={() => setPhoto("")} className="text-sm text-muted-foreground underline">Remove</button>
              </>
            )}
          </div>
          <Button className="h-12 w-full" disabled={busy === "add" || (!text.trim() && !photo)} onClick={add}>{busy === "add" && <Loader2 className="animate-spin" />} Add to {first}’s stories</Button>
          {note && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{note}</p>}
        </div>
      )}

      {list === null && !err && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {list && list.length === 0 && <p className="mt-4 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{personId ? "No stories yet. Be the first to add one." : "Nothing is waiting for you."}</p>}
      <ul className="mt-4 space-y-3">
        {(list ?? []).map((s) => {
          const who = family.persons.find((p) => p.id === s.person_id);
          return (
            <li key={s.id} className="rounded-2xl border bg-background p-3 text-sm">
              {!personId && <p className="mb-1 font-medium">About {who?.name_roman ?? "someone no longer in the tree"}</p>}
              {s.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photo} alt={`A photo added by ${s.by}`} className="mb-2 max-h-64 w-full rounded-xl border object-cover" />
              )}
              {s.text && <p className="whitespace-pre-wrap">{s.text}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Added by {s.mine ? "you" : s.by} · {new Date(s.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
              {s.status === "pending" && !s.canApprove && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">Waiting for {s.waitingFor ?? "approval"}. Only you and {s.waitingFor ?? "they"} can see it until then.</p>}
              {s.status === "pending" && s.canApprove && s.onBehalf && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">{who?.name_roman.split(" ")[0] ?? "This person"} has not joined the tree. Approve only if they have seen this and agreed.</p>}
              {s.flagged > 0 && <p className="mt-2 text-xs text-terracotta">{s.flagged === 1 ? "1 person flagged this as not right." : `${s.flagged} people flagged this as not right.`}</p>}
              {ask === s.id ? (
                <div className="mt-2 space-y-2 rounded-xl bg-amber-50 p-3 text-amber-950" role="alertdialog" aria-label="Confirm">
                  <p>Remove this for everyone? This cannot be undone.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11" onClick={() => setAsk("")}>Keep it</Button>
                    <Button className="h-11" disabled={!!busy} onClick={() => run(s.id, "remove")}>{busy === s.id + "remove" && <Loader2 className="animate-spin" />} Yes, remove</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.canApprove && <Button className="h-11" disabled={!!busy} onClick={() => run(s.id, "approve")}>{busy === s.id + "approve" ? <Loader2 className="animate-spin" /> : <Check />} Approve</Button>}
                  {s.canApprove && <Button className="h-11" variant="outline" disabled={!!busy} onClick={() => run(s.id, "reject")}><X /> Not this one</Button>}
                  {s.canFlag && (s.flaggedByMe
                    ? <Button className="h-11" variant="ghost" disabled={!!busy} onClick={() => run(s.id, "unflag")}><Flag /> Flagged · undo</Button>
                    : <Button className="h-11" variant="ghost" disabled={!!busy} onClick={() => run(s.id, "flag")}><Flag /> Not right</Button>)}
                  {s.canRemove && s.status === "shown" && <Button className="h-11" variant="ghost" disabled={!!busy} onClick={() => setAsk(s.id)}><Trash2 /> Remove</Button>}
                  {s.canRemove && s.status === "pending" && s.mine && <Button className="h-11" variant="ghost" disabled={!!busy} onClick={() => run(s.id, "remove")}><Trash2 /> Withdraw</Button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
