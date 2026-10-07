"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Link2, Loader2, LogOut, MessageCircle, Trash2, Users } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { DFamily } from "@/lib/family";
import type { MemberRow, ShareInfo, SyncStatus } from "./useShare";
import { inputCls, Label, PhoneField, phoneState, type PhoneValue } from "./widgets";
import { SocialShare } from "./SocialShare";

interface Props {
  open: boolean; onClose: () => void;
  family: DFamily; enabled?: boolean; share: ShareInfo | null; status: SyncStatus; members: MemberRow[]; ownerLink: string;
  invitePersonId?: string;
  onCreate: (ownerName: string) => Promise<void>;
  onInvite: (name: string, personId?: string, phone?: string) => Promise<string>;
  onLeaveTree: () => Promise<void>;
  /** guest mode on a site with accounts: saving and inviting happen after signing in */
  signInHref?: string;
  ownerName?: string;
  /** read-only links (living relatives protected / shown in full); empty until the tree is online */
  viewUrl?: string; viewUrlFull?: string;
  viewOff?: boolean; onViewLink?: (action: "stop" | "start" | "renew") => Promise<void>;
  onRevoke: (memberId: string) => void;
  onRememberPhone: (personId: string, e164: string) => void;
  onLeave: () => void;
  onDeleteOnline: () => Promise<void>;
}

const STATUS_TEXT: Record<SyncStatus, string> = { off: "", synced: "Saved online", saving: "Saving…", offline: "Offline — will retry", invalid: "This link is no longer valid" };

export function ShareSheet(p: Props) {
  const me = p.family.persons.find((x) => x.is_me);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
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
      const link = await p.onInvite(inviteName, person?.id, p.share?.account ? st.e164 : undefined);
      if (person) p.onRememberPhone(person.id, st.e164);
      const first = inviteName.split(" ")[0];
      const owner = (p.ownerName ?? "").split(" ")[0] || "A family member";
      const text = p.share?.account
        ? `Namaste ${first}, ${owner} here. I am building our family tree (vamsha-vriksha) on Maithil Panji and would be grateful for your help adding and correcting details about our family.\n\nPlease open this link to join — you sign in with your email address, no password needed. The link works only once, for you:\n${link}`
        : `Namaste ${first}, I am building our family tree (vamsha-vriksha) on Maithil Panji and would be grateful for your help adding and correcting details. Please open this private link — no password needed:\n${link}`;
      setReady({ name: first, link, wa: `https://wa.me/${st.e164.replace("+", "")}?text=${encodeURIComponent(text)}` });
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not create the invitation."); } finally { setBusy(false); }
  };

  const title = p.share?.role === "editor" ? "You are helping with this tree" : p.share?.account ? "Invite family" : "Share and save";
  return (
    <Sheet open={p.open} onClose={p.onClose} title={title} className="md:w-[28rem]">
      <h2 className="font-display text-xl font-semibold">{title}</h2>

      {p.enabled === false && (
        <p className="mt-3 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">Online saving and family invitations are not switched on for this site yet. Your tree is safely kept on this device, and you can still download the PDF.</p>
      )}

      {p.signInHref && !p.share && (
        <div className="mt-2 space-y-4">
          <p className="text-muted-foreground">Sign in with your mobile number to save this tree to your account, open it on any phone, and invite relatives on WhatsApp. They sign in with their own number and see the same tree — and add their own branches.</p>
          <p className="text-sm text-muted-foreground">There is no password: we send you a one-time code. The tree you have built so far on this device is kept and can be saved to your account.</p>
          <Button asChild size="lg" className="h-12 w-full"><Link href={p.signInHref}><Link2 /> Sign in and save my tree</Link></Button>
        </div>
      )}

      {p.enabled && !p.share && !p.signInHref && (
        <div className="mt-2 space-y-4">
          <p className="text-sm text-muted-foreground">Save your tree online to open it on any phone, invite relatives on WhatsApp to add and correct their own branches, and share a view-only picture link on WhatsApp or Facebook. No passwords — each person gets a private link.</p>
          <div>
            <Label htmlFor="owner-name">Your first name</Label>
            <input id="owner-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </div>
          <label className="flex gap-3 rounded-xl border p-3 text-sm">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I understand this is a community genealogy project. I have the consent of living relatives whose details or photos I add, anyone with a link can edit this tree, and I can ask for it to be deleted at any time. My data is never sold. <Link href="/privacy" target="_blank" className="underline">Read the privacy page</Link>.</span>
          </label>
          {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
          <Button size="lg" className="h-12 w-full" disabled={!consent || busy || !me} onClick={create}>{busy ? <Loader2 className="animate-spin" /> : <Link2 />} Save online and start sharing</Button>
        </div>
      )}

      {p.enabled && p.share?.role === "owner" && (
        <div className="mt-2 space-y-5">
          <p className="flex items-center gap-2 text-sm text-green-800"><Check className="size-4" /> {STATUS_TEXT[p.status] || "Saved online"}</p>

          <SocialShare viewUrl={p.viewUrl ?? ""} viewUrlFull={p.viewUrlFull ?? ""} viewOff={p.viewOff} onViewLink={p.onViewLink} familyName={`${(p.ownerName ?? me?.name_roman ?? "our").split(" ")[0]}${p.ownerName || me ? "’s" : ""}`} />

          <section aria-label="Invite" className="space-y-3 rounded-xl border p-3">
            <h3 className="flex items-center gap-2 font-medium"><MessageCircle className="size-5 text-[#128c4a]" /> Invite a family member</h3>
            {p.share?.account && <p className="text-sm text-muted-foreground">Add their mobile number so we can open WhatsApp for you. The invitation link works once, for the person you send it to.</p>}
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
                <p className="text-sm text-green-900">{p.share?.account ? `Invitation for ${ready.name} is ready. Tap “Open WhatsApp” and press send — it goes from your own number, so ${ready.name} knows it is really from you. The link works once; ${ready.name} signs in with an email address and sees this same tree.` : `Invitation for ${ready.name} is ready. They can edit this tree with the link — nobody else can.`}</p>
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
                  <span>{m.name} <span className="text-muted-foreground">· {m.role === "owner" ? "you (owner)" : m.status === "invited" ? `invited${m.phone_hint ? ` (${m.phone_hint})` : ""} — not joined yet` : "can edit"}</span></span>
                  {m.role !== "owner" && <button type="button" className="shrink-0 text-terracotta underline-offset-2 hover:underline" onClick={() => p.onRevoke(m.id)}>{m.status === "invited" ? "Cancel invitation" : "Remove access"}</button>}
                </li>
              ))}
            </ul>
          </section>

          {!p.share?.account && <section aria-label="Open on another device" className="space-y-2">
            <h3 className="font-medium">Open on another phone or computer</h3>
            <p className="text-sm text-muted-foreground">This is your private link. Keep it to yourself — anyone who has it can edit and invite.</p>
            <Button variant="outline" className="w-full" onClick={() => copy(p.ownerLink, "own")}>{copied === "own" ? <Check /> : <Copy />} Copy my private link</Button>
          </section>}

          <section aria-label="Delete online copy" className="space-y-2 border-t pt-4">
            <h3 className="font-medium">{p.share?.account ? "Delete this tree" : "Delete my online copy"}</h3>
            <p className="text-sm text-muted-foreground">{p.share?.account ? "Removes this tree and every person in it from our database, for you and everyone you invited. This cannot be undone." : "Removes this tree from our database and stops all shared links. The tree on this device is kept."}</p>
            {!confirmDel ? (
              <Button variant="outline" className="w-full text-terracotta" onClick={() => setConfirmDel(true)}><Trash2 /> Delete online copy…</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDel(false)}>Keep it</Button>
                <Button className="flex-1 bg-terracotta text-white" disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await p.onDeleteOnline(); setConfirmDel(false); } catch (e) { setErr(e instanceof Error ? e.message : "Could not delete."); } finally { setBusy(false); } }}>
                  {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Yes, delete
                </Button>
              </div>
            )}
          </section>
        </div>
      )}

      {p.enabled && p.share?.role === "editor" && (
        <div className="mt-2 space-y-3">
          <p className="flex items-center gap-2 text-sm text-green-800"><Check className="size-4" /> {STATUS_TEXT[p.status] || "Saved online"}</p>
          <p className="text-sm text-muted-foreground">You are editing a family tree shared with you. Tap anyone in the tree to correct details, add a photo, or add relatives. Changes are saved automatically and everyone sees them.</p>
          {p.share?.account ? (
            !confirmDel ? <Button variant="outline" className="w-full" onClick={() => setConfirmDel(true)}><LogOut /> Leave this tree…</Button> : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDel(false)}>Stay</Button>
                <Button className="flex-1 bg-terracotta text-white" disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await p.onLeaveTree(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not leave."); setBusy(false); } }}>{busy ? <Loader2 className="animate-spin" /> : <LogOut />} Yes, leave</Button>
              </div>
            )
          ) : <Button variant="outline" className="w-full" onClick={p.onLeave}>Stop syncing on this device</Button>}
          {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
        </div>
      )}
    </Sheet>
  );
}
