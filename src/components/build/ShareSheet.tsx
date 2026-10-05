"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageCircle, Users } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { DFamily } from "@/lib/family";
import type { MemberRow, ShareInfo, SyncStatus } from "./useShare";
import { inputCls, Label, PhoneField, phoneState, type PhoneValue } from "./widgets";

interface Props {
  open: boolean; onClose: () => void;
  family: DFamily; enabled?: boolean; share: ShareInfo | null; status: SyncStatus; members: MemberRow[]; ownerLink: string;
  invitePersonId?: string;
  onCreate: (ownerName: string) => Promise<void>;
  onInvite: (name: string, personId?: string) => Promise<string>;
  onRevoke: (memberId: string) => void;
  onRememberPhone: (personId: string, e164: string) => void;
  onLeave: () => void;
}

const STATUS_TEXT: Record<SyncStatus, string> = { off: "", synced: "Saved online", saving: "Saving…", offline: "Offline — will retry", invalid: "This link is no longer valid" };

export function ShareSheet(p: Props) {
  const me = p.family.persons.find((x) => x.is_me);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [who, setWho] = useState<string>("");
  const [custom, setCustom] = useState("");
  const [phone, setPhone] = useState<PhoneValue>({ country: "IN", national: "" });
  const [ready, setReady] = useState<{ name: string; link: string; wa: string } | null>(null);
  const [copied, setCopied] = useState("");

  const candidates = useMemo(() => p.family.persons.filter((x) => !x.is_me && !x.placeholder && x.status !== "deceased"), [p.family]);
  useEffect(() => { if (p.open) setName(me?.name_roman.split(" ")[0] ?? ""); }, [p.open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (p.open && p.invitePersonId) setWho(p.invitePersonId); }, [p.open, p.invitePersonId]);
  useEffect(() => {
    const person = p.family.persons.find((x) => x.id === who);
    setReady(null); setErr("");
    const parsed = person?.whatsapp ? parsePhoneNumberFromString(person.whatsapp) : undefined;
    if (parsed?.country) setPhone({ country: parsed.country, national: parsed.nationalNumber });
  }, [who]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = phoneState(phone);
  const person = p.family.persons.find((x) => x.id === who);
  const inviteName = (person?.name_roman ?? custom).trim();
  const copy = async (text: string, key: string) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 2000); } catch { /* ignore */ } };

  const create = async () => {
    setBusy(true); setErr("");
    try { await p.onCreate(name.trim() || me?.name_roman || "Owner"); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  };
  const invite = async () => {
    setBusy(true); setErr("");
    try {
      const link = await p.onInvite(inviteName, person?.id);
      if (person) p.onRememberPhone(person.id, st.e164);
      const first = inviteName.split(" ")[0];
      const text = `Namaste ${first}, I am building our family tree (vamsha-vriksha) on Maithil Panji and would be grateful for your help adding and correcting details. Please open this private link — no password needed:\n${link}`;
      setReady({ name: first, link, wa: `https://wa.me/${st.e164.replace("+", "")}?text=${encodeURIComponent(text)}` });
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not create the invitation."); } finally { setBusy(false); }
  };

  const title = p.share?.role === "editor" ? "You are helping with this tree" : "Share and save";
  return (
    <Sheet open={p.open} onClose={p.onClose} title={title} className="md:w-[28rem]">
      <h2 className="font-display text-xl font-semibold">{title}</h2>

      {p.enabled === false && (
        <p className="mt-3 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">Online saving and family invitations are not switched on for this site yet. Your tree is safely kept on this device, and you can still download the PDF.</p>
      )}

      {p.enabled && !p.share && (
        <div className="mt-2 space-y-4">
          <p className="text-sm text-muted-foreground">Save your tree online to open it on any phone, and invite relatives on WhatsApp to add and correct their own branches. No passwords — each person gets a private link.</p>
          <div>
            <Label htmlFor="owner-name">Your first name</Label>
            <input id="owner-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </div>
          <label className="flex gap-3 rounded-xl border p-3 text-sm">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I understand this is a community genealogy project. I have the consent of living relatives whose details or photos I add, anyone with a link can edit this tree, and I can ask for it to be deleted at any time. My data is never sold.</span>
          </label>
          {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
          <Button size="lg" className="h-12 w-full" disabled={!consent || busy || !me} onClick={create}>{busy ? <Loader2 className="animate-spin" /> : <Link2 />} Save online and start sharing</Button>
        </div>
      )}

      {p.enabled && p.share?.role === "owner" && (
        <div className="mt-2 space-y-5">
          <p className="flex items-center gap-2 text-sm text-green-800"><Check className="size-4" /> {STATUS_TEXT[p.status] || "Saved online"}</p>

          <section aria-label="Invite" className="space-y-3 rounded-xl border p-3">
            <h3 className="flex items-center gap-2 font-medium"><MessageCircle className="size-5 text-[#128c4a]" /> Invite a family member</h3>
            <div>
              <Label htmlFor="who">Who is this?</Label>
              <select id="who" className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Someone not in the tree yet…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name_roman}</option>)}
              </select>
              {!who && <input className={`${inputCls} mt-2`} placeholder="Their name" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Their name" />}
            </div>
            <PhoneField value={phone} onChange={setPhone} />
            {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
            {!ready ? (
              <Button className="h-12 w-full" disabled={busy || !st.valid || !inviteName} onClick={invite}>{busy ? <Loader2 className="animate-spin" /> : <MessageCircle />} Create invitation</Button>
            ) : (
              <div className="space-y-2 rounded-xl bg-green-50 p-3">
                <p className="text-sm text-green-900">Invitation for {ready.name} is ready. They can edit this tree with the link — nobody else can.</p>
                <a href={ready.wa} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-medium text-white"><MessageCircle className="size-5" /> Open WhatsApp</a>
                <Button variant="outline" className="w-full" onClick={() => copy(ready.link, "inv")}>{copied === "inv" ? <Check /> : <Copy />} Copy link instead</Button>
              </div>
            )}
          </section>

          <section aria-label="People with access" className="space-y-2">
            <h3 className="flex items-center gap-2 font-medium"><Users className="size-5" /> People with access</h3>
            <ul className="divide-y rounded-xl border text-sm">
              {p.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span>{m.name} <span className="text-muted-foreground">· {m.role === "owner" ? "you (owner)" : "can edit"}</span></span>
                  {m.role !== "owner" && <button type="button" className="text-terracotta underline-offset-2 hover:underline" onClick={() => p.onRevoke(m.id)}>Remove access</button>}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Open on another device" className="space-y-2">
            <h3 className="font-medium">Open on another phone or computer</h3>
            <p className="text-sm text-muted-foreground">This is your private link. Keep it to yourself — anyone who has it can edit and invite.</p>
            <Button variant="outline" className="w-full" onClick={() => copy(p.ownerLink, "own")}>{copied === "own" ? <Check /> : <Copy />} Copy my private link</Button>
          </section>
        </div>
      )}

      {p.enabled && p.share?.role === "editor" && (
        <div className="mt-2 space-y-3">
          <p className="flex items-center gap-2 text-sm text-green-800"><Check className="size-4" /> {STATUS_TEXT[p.status] || "Saved online"}</p>
          <p className="text-sm text-muted-foreground">You are editing a family tree shared with you. Tap anyone in the tree to correct details, add a photo, or add relatives. Changes are saved automatically and everyone sees them.</p>
          <Button variant="outline" className="w-full" onClick={p.onLeave}>Stop syncing on this device</Button>
        </div>
      )}
    </Sheet>
  );
}
