"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { Button } from "@/components/ui/button";
import { inputCls, Label, PhoneField, phoneState, PlaceField, type PhoneValue } from "@/components/build/widgets";
import { MARITAL, nativePlace, type Profile } from "@/lib/profile";
import { useAccount } from "./useAccount";

const MARITAL_LABEL: Record<(typeof MARITAL)[number], string> = { single: "Unmarried", married: "Married", widowed: "Widowed", divorced: "Divorced", other: "Other" };
type Loaded = { account: { name: string; email: string; phone: string }; profile: Profile; complete: number; stock: { gotra?: string; mool?: string } };

/** "Village, District, State" → the three stored parts (two parts = village + country/state) */
function splitNative(v: string): Pick<Profile, "native_village" | "native_district" | "native_state"> {
  const p = v.split(",").map((x) => x.trim()).filter(Boolean);
  if (p.length >= 3) return { native_village: p[0], native_district: p[1], native_state: p.slice(2).join(", ") };
  if (p.length === 2) return { native_village: p[0], native_district: undefined, native_state: p[1] };
  return { native_village: p[0], native_district: undefined, native_state: undefined };
}

export function ProfileClient() {
  const router = useRouter();
  const auth = useAccount();
  const [data, setData] = useState<Loaded | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<PhoneValue>({ country: "IN", national: "" });
  const [pr, setPr] = useState<Profile>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.enabled) { router.replace("/build"); return; }
    if (!auth.account) { router.replace("/login?next=/app/profile"); return; }
    fetch("/api/me/profile", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error();
      const j = (await r.json()) as Loaded;
      setData(j); setName(j.account.name); setPr(j.profile);
      const p = j.account.phone ? parsePhoneNumberFromString(j.account.phone) : undefined;
      setPhone(p?.country ? { country: p.country, national: p.nationalNumber } : { country: "IN", national: "" });
    }).catch(() => setErr("Could not load your profile. Please refresh."));
  }, [auth.loading, auth.enabled, auth.account, router]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setPr((x) => ({ ...x, [k]: v })); setSaved(false); };
  const st = phoneState(phone);
  const phoneBad = !!phone.national.replace(/\D/g, "") && !st.valid;

  const save = async () => {
    setBusy(true); setErr(""); setSaved(false);
    try {
      const res = await fetch("/api/me/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, phone: st.e164, profile: pr }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not save.");
      setData(j); setPr(j.profile); setSaved(true);
      auth.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  };

  if (!data) return <div className="grid h-dvh place-items-center text-muted-foreground">{err || "Loading…"}</div>;
  const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div><h2 className="text-lg font-semibold">{title}</h2>{hint && <p className="text-sm text-muted-foreground">{hint}</p>}</div>
      {children}
    </section>
  );
  const text = (k: keyof Profile, label: string, props: { helper?: string; placeholder?: string; auto?: string } = {}) => (
    <div>
      <Label htmlFor={`pf-${k}`} helper={props.helper}>{label}</Label>
      <input id={`pf-${k}`} className={inputCls} autoComplete={props.auto} placeholder={props.placeholder} value={(pr[k] as string | undefined) ?? ""} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
          <Link href="/app" className="flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="size-4" /> My family trees</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 px-5 py-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">My profile</h1>
          <p className="mt-1 text-muted-foreground">A few facts that help families recognise each other. Nobody can search for you; the owner of a family tree you connect with sees what is marked below.</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Profile completeness" aria-valuenow={data.complete}><div className="h-full bg-primary transition-all" style={{ width: `${data.complete}%` }} /></div>
          <p className="mt-1 text-xs text-muted-foreground">{data.complete}% complete</p>
        </div>

        <Section title="About you">
          <div><Label htmlFor="pf-name">Your name</Label><input id="pf-name" className={inputCls} autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></div>
          <div><PhoneField value={phone} onChange={(v) => { setPhone(v); setSaved(false); }} /></div>
          <div><Label htmlFor="pf-email" helper="This is the address you sign in with.">Email</Label><input id="pf-email" className={`${inputCls} bg-secondary/60`} value={data.account.email} readOnly /></div>
        </Section>

        <Section title="Your family line" hint="Gotra and mool come from your family tree.">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-secondary/60 p-3"><dt className="text-xs text-muted-foreground">Gotra</dt><dd className="font-medium">{data.stock.gotra ?? "— add it in your tree"}</dd></div>
            <div className="rounded-xl bg-secondary/60 p-3"><dt className="text-xs text-muted-foreground">Mool</dt><dd className="font-medium">{data.stock.mool ?? "— add it in your tree"}</dd></div>
          </dl>
          {text("pravar", "Pravar", { helper: "The rishis named with your gotra, for example Bharadwaj, Angiras, Barhaspatya. Ask an elder if you are not sure.", placeholder: "Pravar" })}
        </Section>

        <Section title="Native place" hint="Where your family comes from.">
          <PlaceField label="Native village" helper="Village, then district and state" value={nativePlace(pr)} onChange={(v) => { setPr((x) => ({ ...x, native_village: undefined, native_district: undefined, native_state: undefined, ...splitNative(v) })); setSaved(false); }} />
        </Section>

        <Section title="Where you live now">
          {text("current_city", "City or town", { auto: "address-level2", placeholder: "For example Delhi, Patna, Bengaluru, Chicago" })}
          {text("current_address", "Address", { auto: "street-address", helper: "Shown only if you allow it below." })}
        </Section>

        <Section title="A little more">
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-foreground/80">Marital status</legend>
            <div className="flex flex-wrap gap-2">
              {MARITAL.map((m) => (
                <button key={m} type="button" aria-pressed={pr.marital_status === m} onClick={() => set("marital_status", pr.marital_status === m ? undefined : m)}
                  className={`h-11 rounded-full border px-4 text-sm font-medium ${pr.marital_status === m ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{MARITAL_LABEL[m]}</button>
              ))}
            </div>
          </fieldset>
          {text("occupation", "Occupation", { placeholder: "For example teacher, engineer, farmer" })}
          <div>
            <Label htmlFor="pf-about" helper="Optional. A line or two about you or your family.">About me</Label>
            <textarea id="pf-about" className={`${inputCls} h-24 py-3`} maxLength={400} value={pr.about ?? ""} onChange={(e) => set("about", e.target.value)} />
          </div>
        </Section>

        <Section title="Who can see this">
          <p className="text-sm text-muted-foreground">When you ask another family to connect, or accept their request, the owner sees your name, pravar, native place, city, marital status and occupation.</p>
          <label className="flex gap-3 rounded-xl border p-3 text-sm">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={!!pr.share_contact} onChange={(e) => set("share_contact", e.target.checked)} />
            <span><strong>Also share my mobile number, email and address</strong> with those owners, so they can reach me on WhatsApp. You can switch this off at any time.</span>
          </label>
        </Section>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <p role="status" className="min-h-5 flex-1 text-sm">{err ? <span className="text-terracotta">{err}</span> : saved ? <span className="text-green-700">Saved.</span> : phoneBad ? <span className="text-terracotta">{st.error}</span> : null}</p>
          <Button size="lg" className="h-12 px-8" disabled={busy || !name.trim() || phoneBad} onClick={save}>{busy && <Loader2 className="animate-spin" />} Save profile</Button>
        </div>
      </div>
    </div>
  );
}
