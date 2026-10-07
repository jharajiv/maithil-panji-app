"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Crosshair, GitMerge, MessageCircle, Plus, Shuffle, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fatherOf, labels, motherOf, RELATION_WORDS, spousesOf, type DFamily, type DPerson, type Gender, type PersonFields, type RelationSpec, type RelationWord } from "@/lib/family";
import { romanToDevanagari } from "@/lib/translit";
import { DateField, Label, NameField, PlaceField, SearchSelect, inputCls } from "./widgets";

/** Largest photo we keep per person (characters of the data URL) — must stay below the server limit in lib/sanitize.ts. */
export const MAX_PHOTO_CHARS = 70_000;

async function decode(file: File): Promise<{ w: number; h: number; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void }> {
  try {
    const bmp = await createImageBitmap(file);
    return { w: bmp.width, h: bmp.height, draw: (c, w, h) => c.drawImage(bmp, 0, 0, w, h) };
  } catch {
    // some phones / browsers cannot decode certain formats with createImageBitmap — fall back to an <img>
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("decode")); i.src = url; });
      return { w: img.naturalWidth, h: img.naturalHeight, draw: (c, w, h) => c.drawImage(img, 0, 0, w, h) };
    } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }
}

/** Downscale a picked photo to a small JPEG data URL, shrinking further until it is safely small to store and share. */
async function shrink(file: File): Promise<string> {
  const src = await decode(file);
  if (!src.w || !src.h) throw new Error("empty");
  for (const [max, q] of [[320, 0.82], [320, 0.7], [256, 0.7], [200, 0.65], [160, 0.6]] as const) {
    const k = Math.min(1, max / Math.max(src.w, src.h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(src.w * k)); c.height = Math.max(1, Math.round(src.h * k));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    src.draw(ctx, c.width, c.height);
    const url = c.toDataURL("image/jpeg", q);
    if (url.length <= MAX_PHOTO_CHARS) return url;
  }
  throw new Error("too big");
}

/* eslint-disable-next-line @next/next/no-img-element */
const PhotoImg = ({ src }: { src: string }) => <img src={src} alt="" className="size-full object-cover" />;

function Seg<T extends string>({ value, options, onChange, label }: { value?: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-2">
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
            className={cn("h-12 rounded-xl border text-base font-medium transition-colors", value === o.v ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-secondary")}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

type Rel = { key: string; label: string; type: RelationSpec["type"]; gender?: Gender };

/** Which relatives can be added from this person's card? Panji records only the NAME of a married-in woman — never her family. */
function relativeChoices(family: DFamily, p: DPerson): Rel[] {
  const married = spousesOf(family, p.id).length > 0;
  const marriedIn = p.gender === "female" && married && !fatherOf(family, p.id) && !p.is_me;
  const out: Rel[] = [];
  if (!married || p.gender === undefined) out.push({ key: "spouse", label: p.gender === "male" ? "Wife" : p.gender === "female" ? "Husband" : "Spouse", type: "spouse_of" });
  out.push({ key: "son", label: "Son", type: "child_of", gender: "male" }, { key: "daughter", label: "Daughter", type: "child_of", gender: "female" });
  if (!marriedIn) {
    out.push({ key: "brother", label: "Brother", type: "sibling_of", gender: "male" }, { key: "sister", label: "Sister", type: "sibling_of", gender: "female" });
    const fa = fatherOf(family, p.id), mo = motherOf(family, p.id);
    if (!fa || fa.placeholder) out.push({ key: "father", label: "Father", type: "father_of", gender: "male" });
    if (!mo || mo.placeholder) out.push({ key: "mother", label: "Mother", type: "mother_of", gender: "female" });
  }
  return out;
}

export function PersonEditSheet({ family, personId, onClose, onSave, onDelete, onCentre, onAdd, canInvite, onInvite, openRelation, onChangeRelation, onSeeLinked, hasMatch, onOpenMatches }: {
  family: DFamily; personId?: string; onClose: () => void;
  onSave: (id: string, set: PersonFields) => void; onDelete: (id: string) => void; onCentre: (id: string) => void;
  onAdd: (toId: string, type: RelationSpec["type"], name: string, gender?: Gender) => void;
  canInvite?: boolean; onInvite?: (id: string) => void;
  /** open the "wrong relationship" panel straight away (from the tree menu) */
  openRelation?: boolean;
  onChangeRelation?: (id: string, toId: string, word: RelationWord) => { ok: boolean; message: string };
  /** she is linked to a woman in another tree: show that tree's view of her */
  onSeeLinked?: (personId: string, tree: string, p: string) => void;
  /** a possible match for her exists in another tree */
  hasMatch?: boolean; onOpenMatches?: () => void;
}) {
  const person = family.persons.find((p) => p.id === personId);
  const [draft, setDraft] = useState<DPerson | undefined>(person);
  const [confirmDel, setConfirmDel] = useState(false);
  const [adding, setAdding] = useState<Rel | null>(null);
  const [newName, setNewName] = useState("");
  const [added, setAdded] = useState("");
  const [photoErr, setPhotoErr] = useState("");
  const [relOpen, setRelOpen] = useState(!!openRelation);
  const [relWord, setRelWord] = useState<RelationWord | "">("");
  const [relTo, setRelTo] = useState("");
  const [relMsg, setRelMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(person ? structuredClone(person) : undefined); setConfirmDel(false); setAdding(null); setNewName(""); setAdded(""); setRelOpen(!!openRelation); setRelWord(""); setRelTo(""); setRelMsg(null); }, [personId, openRelation]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!person || !draft) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const lab = labels(family)[person.id];
  const set = (patch: Partial<DPerson>) => setDraft((d) => ({ ...d!, ...patch }));
  const devTouched = !!draft.name_dev && draft.name_dev !== romanToDevanagari(draft.name_roman);
  const gotraId = draft.gotra?.id;

  const save = () => {
    onSave(person.id, {
      name_roman: draft.name_roman, name_dev: draft.name_dev ?? "", gender: draft.gender, birth: draft.birth ?? "", death: draft.death ?? "",
      status: person.is_me ? "living" : draft.status, place: draft.place ?? "", gotra: draft.gotra ?? null, mool: draft.mool ?? null, photo: draft.photo ?? null,
      ...(draft.gender === "female" ? { married_to: draft.married_to ?? "" } : {}),
    });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`Edit ${person.name_roman}`} className="md:w-[26rem]">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => file.current?.click()} aria-label="Add or change photo"
            className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary text-muted-foreground">
            {draft.photo ? <PhotoImg src={draft.photo} /> : <Camera className="size-7" />}
          </button>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
            setPhotoErr("");
            try { const photo = await shrink(f); set({ photo }); onSave(person.id, { photo }); } catch { setPhotoErr("This photo could not be used. Please try a JPEG or PNG picture."); }
          }} />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold leading-tight">{person.placeholder ? "Name not known" : person.name_roman}</h2>
            <p className="text-sm text-muted-foreground">{lab}</p>
            {draft.photo && <button type="button" className="mt-1 text-xs text-terracotta underline" onClick={() => { set({ photo: undefined }); onSave(person.id, { photo: null }); }}>Remove photo</button>}
            {photoErr && <p role="alert" className="mt-1 text-xs text-terracotta">{photoErr}</p>}
          </div>
        </div>

        <NameField label="Name" roman={draft.placeholder ? "" : draft.name_roman} dev={draft.name_dev ?? ""} devTouched={devTouched}
          onChange={(v) => set({ name_roman: v.roman, name_dev: v.dev, placeholder: false })} />
        <Seg label="Gender" value={draft.gender as Gender | undefined} onChange={(v) => set({ gender: v })} options={[{ v: "male", l: "Male" }, { v: "female", l: "Female" }]} />
        <DateField label="Born" value={draft.birth ?? ""} onChange={(v) => set({ birth: v })} />
        {!person.is_me && <Seg label="Living?" value={draft.status} onChange={(v) => set({ status: v })} options={[{ v: "living", l: "Living" }, { v: "deceased", l: "Passed away" }]} />}
        {draft.status === "deceased" && <DateField label="Passed away" helper="Year is enough." value={draft.death ?? ""} onChange={(v) => set({ death: v })} />}
        <PlaceField value={draft.place ?? ""} onChange={(v) => set({ place: v })} helper="Village, district and state where they live or lived — no street address needed." />

        {draft.gender === "female" && spousesOf(family, person.id).length === 0 && !person.is_me && (
          <div>
            <Label>Husband (name and village)</Label>
            <input className={inputCls} value={draft.married_to ?? ""} maxLength={120} autoComplete="off" placeholder="for example: Rajesh Jha, Darbhanga" onChange={(e) => set({ married_to: e.target.value })} />
            <p className="mt-1 text-xs text-muted-foreground">Shown on her card as a short note. His own family is recorded on his chart.</p>
          </div>
        )}
        {person.links?.length ? (
          <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-950">
            {person.links.map((l) => (
              <div key={l.tree + l.person} className="flex flex-wrap items-center justify-between gap-2">
                <span><GitMerge className="mr-1 inline size-4" /> Also in “{l.title ?? "another tree"}”</span>
                {onSeeLinked && <button type="button" className="font-medium underline" onClick={() => onSeeLinked(person.id, l.tree, l.person)}>See her family there</button>}
              </div>
            ))}
          </div>
        ) : hasMatch && onOpenMatches ? (
          <button type="button" onClick={() => { onClose(); onOpenMatches(); }} className="flex w-full items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-left text-sm font-medium">
            <GitMerge className="size-5 shrink-0 text-primary" /> She may be in another family’s tree. Look at the possible match
          </button>
        ) : null}
        <details className="rounded-xl border p-3" open={!!(draft.gotra || draft.mool)}>
          <summary className="cursor-pointer text-sm font-medium">Panji details — gotra and mool</summary>
          <div className="mt-3 space-y-4">
            <div><Label>Gotra</Label><SearchSelect kind="gotra" value={draft.gotra} onChange={(v) => set({ gotra: v })} /></div>
            <div><Label>Mool</Label><SearchSelect kind="mool" value={draft.mool} gotraId={gotraId} onChange={(v) => set({ mool: v })} /></div>
          </div>
        </details>

        <details className="rounded-xl border p-3" open={!!added}>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><Plus className="size-4" /> Add a relative of {person.name_roman.split(" ")[0] || "this person"}</summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Relationship">
              {relativeChoices(family, person).map((r) => (
                <button key={r.key} type="button" aria-pressed={adding?.key === r.key} onClick={() => { setAdding(r); setAdded(""); }}
                  className={cn("h-11 rounded-xl border text-sm font-medium", adding?.key === r.key ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-secondary")}>{r.label}</button>
              ))}
            </div>
            {adding && (
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const n = newName.trim(); if (!n) return; onAdd(person.id, adding.type, n, adding.gender); setAdded(`${n} added as ${adding.label.toLowerCase()}.`); setNewName(""); }}>
                <label className="text-sm text-muted-foreground" htmlFor="new-rel">Name of the new {adding.label.toLowerCase()}</label>
                <div className="flex gap-2">
                  <input id="new-rel" className={cn(inputCls, "flex-1")} value={newName} autoComplete="off" autoCapitalize="words" onChange={(e) => setNewName(e.target.value)} />
                  <Button type="submit" size="lg" className="h-12" disabled={!newName.trim()}>Add</Button>
                </div>
              </form>
            )}
            {added && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{added} Tap them in the tree to add more details.</p>}
            {fatherOf(family, person.id) === undefined && spousesOf(family, person.id).length > 0 && person.gender === "female" && !person.is_me && (
              <p className="text-xs text-muted-foreground">As in the Panji, a wife’s parents are not recorded here — only her name.</p>
            )}
          </div>
        </details>

        {onChangeRelation && !person.is_me && (
          <details className="rounded-xl border p-3" open={relOpen} onToggle={(e) => setRelOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><Shuffle className="size-4" /> Wrong relationship? Change it</summary>
            <div className="mt-3 space-y-3">
              <p className="text-sm">{person.name_roman.split(" ")[0] || "This person"} is really the…</p>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="New relationship">
                {RELATION_WORDS.map((w) => (
                  <button key={w} type="button" aria-pressed={relWord === w} onClick={() => { setRelWord(w); setRelMsg(null); }}
                    className={cn("h-11 rounded-xl border text-sm font-medium capitalize", relWord === w ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-secondary")}>{w}</button>
                ))}
              </div>
              <label className="block text-sm" htmlFor="rel-to">…of</label>
              <select id="rel-to" className={inputCls} value={relTo} onChange={(e) => { setRelTo(e.target.value); setRelMsg(null); }}>
                <option value="">Choose a person</option>
                {family.persons.filter((x) => x.id !== person.id && !x.placeholder).map((x) => <option key={x.id} value={x.id}>{x.name_roman} — {labels(family)[x.id]}</option>)}
              </select>
              <Button type="button" className="h-11 w-full" disabled={!relWord || !relTo} onClick={() => { if (!relWord || !relTo) return; const r = onChangeRelation(person.id, relTo, relWord); setRelMsg(r); if (r.ok) set({ gender: ["brother", "husband", "son", "father"].includes(relWord) ? "male" : "female" }); }}>Change relationship</Button>
              {relMsg && <p role="status" className={cn("rounded-lg px-3 py-2 text-sm", relMsg.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900")}>{relMsg.message}</p>}
              <p className="text-xs text-muted-foreground">Their old connections to parents and spouse are replaced by the new one. Children who have another parent stay with that parent.</p>
            </div>
          </details>
        )}

        {canInvite && !person.is_me && person.status !== "deceased" && (
          <button type="button" onClick={() => { onSave(person.id, { name_roman: draft.name_roman, name_dev: draft.name_dev ?? "", gender: draft.gender, birth: draft.birth ?? "", status: draft.status, place: draft.place ?? "", gotra: draft.gotra ?? null, mool: draft.mool ?? null, photo: draft.photo ?? null }); onClose(); onInvite?.(person.id); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366] bg-[#25D366]/10 px-4 py-3 text-sm font-medium text-[#0b6b3a]">
            <MessageCircle className="size-5" /> Invite {person.name_roman.split(" ")[0]} on WhatsApp to help with this tree
          </button>
        )}

        <div className="flex gap-2">
          <Button size="lg" className="h-12 flex-1" onClick={save}>Save</Button>
          <Button size="lg" variant="outline" className="h-12" onClick={() => { onCentre(person.id); onClose(); }} aria-label="Centre the tree on this person"><Crosshair /></Button>
        </div>
        {!person.is_me && (
          confirmDel ? (
            <div className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-3 text-sm">
              Remove {person.name_roman} from the tree? Their record is deleted; relatives stay.
              <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => setConfirmDel(false)}>Keep</Button><Button size="sm" className="bg-terracotta text-white hover:bg-terracotta/90" onClick={() => { onDelete(person.id); onClose(); }}>Remove</Button></div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} className="flex items-center gap-2 text-sm text-terracotta"><Trash2 className="size-4" /> Remove this person</button>
          )
        )}
      </div>
    </Sheet>
  );
}
