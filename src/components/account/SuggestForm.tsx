"use client";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUGGEST_FIELDS } from "@/lib/suggest";

const NAME_KEY = "maithil-panji.suggester.v1";
const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-3 text-base";

/** "Something wrong?" — anyone viewing the tree can tell the family what to correct. Nothing changes until the family applies it. */
export function SuggestForm({ treeId, v, personId, personName, onClose }: { treeId: string; v: string; personId: string; personName: string; onClose: () => void }) {
  const [field, setField] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => { try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* ignore */ } }, []);

  const first = personName.split(" ")[0] || "this person";
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/trees/${encodeURIComponent(treeId)}/suggest`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ v, person: personId, field, value, note, from_name: name }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not send. Please try again.");
      try { if (name.trim()) localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
      setSent(true);
    } catch (x) { setErr(x instanceof Error ? x.message : "Could not send."); } finally { setBusy(false); }
  };

  if (sent) return (
    <div role="status" className="space-y-3 text-sm">
      <p className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-green-900"><Check className="mt-0.5 size-4 shrink-0" /> Thank you. The family who keeps this tree will see your suggestion and can correct it.</p>
      <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
    </div>
  );
  return (
    <form onSubmit={send} className="space-y-3 text-sm">
      <p className="text-muted-foreground">Tell the family what is wrong about {first}. They will check it and correct the tree — nothing changes by itself.</p>
      <div>
        <label htmlFor="sg-field" className="mb-1 block font-medium">What is wrong?</label>
        <select id="sg-field" required className={inputCls} value={field} onChange={(e) => setField(e.target.value)}>
          <option value="">Choose…</option>
          {SUGGEST_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sg-value" className="mb-1 block font-medium">What should it be?</label>
        <input id="sg-value" required className={inputCls} value={value} maxLength={200} autoComplete="off" onChange={(e) => setValue(e.target.value)}
          placeholder={field === "birth" || field === "death" ? "for example 14 March 1958, or 1958" : field === "name" ? "the correct name" : ""} />
      </div>
      <div>
        <label htmlFor="sg-note" className="mb-1 block font-medium">Anything else? <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea id="sg-note" className={inputCls} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div>
        <label htmlFor="sg-name" className="mb-1 block font-medium">Your name <span className="font-normal text-muted-foreground">(optional, so the family knows who to ask)</span></label>
        <input id="sg-name" className={inputCls} value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </div>
      {err && <p role="alert" className="text-terracotta">{err}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="h-12 flex-1" disabled={busy || !field || !value.trim()}>{busy ? <Loader2 className="animate-spin" /> : null} Send to the family</Button>
      </div>
    </form>
  );
}
