"use client";
import { PaagMark } from "@/components/brand/Logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { Button } from "@/components/ui/button";
import { inputCls, Label, PhoneField, phoneState, type PhoneValue } from "@/components/build/widgets";
import { safeNext, useAccount } from "./useAccount";

type Step = "email" | "code";
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export function LoginForm({ next, invitedBy, defaultName, defaultPhone, onSignedIn, error }: {
  next?: string; invitedBy?: string; defaultName?: string; defaultPhone?: string; onSignedIn?: () => void; error?: string;
}) {
  const router = useRouter();
  const auth = useAccount();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState(defaultName ?? "");
  const [phone, setPhone] = useState<PhoneValue>(() => {
    const p = defaultPhone ? parsePhoneNumberFromString(defaultPhone) : undefined;
    return p?.country ? { country: p.country, national: p.nationalNumber } : { country: "IN", national: "" };
  });
  const [consent, setConsent] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [tester, setTester] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const st = phoneState(phone);
  const target = safeNext(next);

  if (auth.account) {
    return (
      <Shell compact={!!invitedBy}>
        <p className="text-lg">You are signed in as <strong>{auth.account.name}</strong>.</p>
        <Button size="lg" className="mt-5 h-12 w-full" onClick={() => router.replace(target)}>Continue</Button>
        <button type="button" className="mt-4 text-sm text-muted-foreground underline" onClick={auth.logout}>Use a different email</button>
      </Shell>
    );
  }
  if (!auth.loading && !auth.enabled) {
    return <Shell><p className="rounded-xl bg-secondary p-4 text-muted-foreground">Sign-in is not switched on for this site yet. You can still build a tree on this device.</p><Button asChild size="lg" className="mt-5 h-12 w-full"><Link href="/build">Build a tree on this device</Link></Button></Shell>;
  }

  const googleHref = `/api/auth/google/start?next=${encodeURIComponent(target)}`;
  const finishGoogle = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/google/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent, name, phone: st.e164 }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not create your account.");
      onSignedIn?.();
      router.replace(target);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not create your account."); setBusy(false); }
  };

  const send = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not send the code.");
      setIsNew(!!j.isNew); setTester(!!j.tester); setDevCode(j.devCode ?? ""); setCode(""); setStep("code");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not send the code."); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code, name, phone: st.e164, consent }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not sign you in.");
      onSignedIn?.();
      router.replace(target);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not sign you in."); setBusy(false); }
  };

  if (auth.pending) {
    return (
      <Shell compact={!!invitedBy} title="One last step">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); finishGoogle(); }}>
          <p>Welcome, <strong>{auth.pending.name}</strong>. Google confirmed <strong>{auth.pending.email}</strong>.</p>
          <div>
            <Label htmlFor="g-name" helper="You can change how your name appears.">Your name</Label>
            <input id="g-name" className={inputCls} autoComplete="name" value={name || auth.pending.name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <PhoneField value={phone} onChange={setPhone} />
            <p className="mt-1 text-xs text-muted-foreground">Optional. Your family can reach you on WhatsApp with this number. It is not shown to anyone else unless you choose to share it.</p>
          </div>
          <label className="flex gap-3 rounded-xl border p-3 text-sm">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I understand this is a community genealogy project. I will add details and photos of living relatives only with their consent, family members I invite can edit the tree, and I can ask for my tree to be deleted at any time. My data is never sold. <Link href="/privacy" target="_blank" className="underline">Read the privacy page</Link>.</span>
          </label>
          {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
          <Button type="submit" size="lg" className="h-12 w-full" disabled={busy || !consent || (!!phone.national.replace(/\D/g, "") && !st.valid)}>{busy && <Loader2 className="animate-spin" />} Create my account</Button>
        </form>
      </Shell>
    );
  }

  const googleErr = error && ERRORS[error];
  const googleButton = auth.google ? (
    <div className="space-y-3">
      <Button asChild size="lg" variant="outline" className="h-12 w-full gap-3 text-base">
        <a href={googleHref}><GoogleMark /> Continue with Google</a>
      </Button>
      {auth.email && <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> or use your email <span className="h-px flex-1 bg-border" /></div>}
    </div>
  ) : null;

  return (
    <Shell compact={!!invitedBy}>
      {invitedBy && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">{invitedBy} invited you to help with a family tree. Sign in with your email address to join — there is no password.</p>}
      {googleErr && <p role="alert" className="mb-4 rounded-xl bg-terracotta/10 p-3 text-sm text-terracotta">{googleErr}</p>}
      {step === "email" && googleButton}
      {step === "email" && !auth.email ? null : step === "email" ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (looksLikeEmail(email)) send(); }}>
          <p className="text-muted-foreground">Enter your email address. We email you a one-time code — there is no password to remember.</p>
          <div>
            <Label htmlFor="email">Email address</Label>
            <input id="email" type="email" className={inputCls} inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
          <Button type="submit" size="lg" className="h-12 w-full" disabled={!looksLikeEmail(email) || busy}>{busy && <Loader2 className="animate-spin" />} Email me a code</Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); verify(); }}>
          <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground" onClick={() => { setStep("email"); setErr(""); }}><ChevronLeft className="size-4" /> Change email</button>
          {tester
            ? <p><strong>{email.trim().toLowerCase()}</strong> is on the tester list. No email is sent — enter the access code that was given to you.</p>
            : <p>We sent a 6-digit code to <strong>{email.trim().toLowerCase()}</strong>. Check your inbox (and spam folder).</p>}
          {devCode && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Test mode: the code is <strong>{devCode}</strong>.</p>}
          <div>
            <Label htmlFor="otp">{tester ? "Access code" : "Code"}</Label>
            <input id="otp" className={`${inputCls} text-center text-2xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={10} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          {isNew && (
            <>
              <div>
                <Label htmlFor="acct-name" helper="So the people you invite — and the people who invite you — know who you are.">Your name</Label>
                <input id="acct-name" className={inputCls} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <PhoneField value={phone} onChange={setPhone} />
                <p className="mt-1 text-xs text-muted-foreground">Your family can reach you on WhatsApp with this number. It is not shown to anyone else.</p>
              </div>
              <label className="flex gap-3 rounded-xl border p-3 text-sm">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I understand this is a community genealogy project. I will add details and photos of living relatives only with their consent, family members I invite can edit the tree, and I can ask for my tree to be deleted at any time. My data is never sold. <Link href="/privacy" target="_blank" className="underline">Read the privacy page</Link>.</span>
              </label>
            </>
          )}
          {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
          <Button type="submit" size="lg" className="h-12 w-full" disabled={busy || code.length < 4 || (isNew && (!name.trim() || !st.valid || !consent))}>{busy && <Loader2 className="animate-spin" />} {isNew ? "Create my account" : "Sign in"}</Button>
          {!tester && <button type="button" className="text-sm text-muted-foreground underline" disabled={busy} onClick={send}>Send the code again</button>}
        </form>
      )}
    </Shell>
  );
}

const ERRORS: Record<string, string> = {
  "google-cancelled": "Google sign-in was cancelled. You can try again, or use your email.",
  "google-failed": "We could not confirm your Google account. Please try again.",
  "google-state": "That sign-in link has expired. Please try again.",
  "google-busy": "Too many attempts. Please wait a little and try again.",
  "google-off": "Google sign-in is not switched on for this site.",
};

/** Google's "G" (their brand guidelines ask for the four colours) */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function Shell({ children, compact, title }: { children: React.ReactNode; compact?: boolean; title?: string }) {
  return (
    <main className={compact ? "mx-auto max-w-md px-5 py-6" : "mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10"}>
      {!compact && <Link href="/" aria-label="PAAG Foundation — Maithil Panji home" className="mb-6 flex items-center gap-3"><PaagMark size={34} /><span className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Maithil Panji</span></Link>}
      <h1 className="font-display text-3xl font-bold text-indigo">{title ?? (compact ? "Sign in to join" : "Sign in")}</h1>
      <div className="mt-5">{children}</div>
    </main>
  );
}
