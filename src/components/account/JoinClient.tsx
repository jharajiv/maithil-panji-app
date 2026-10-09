"use client";
import { PaagLogo } from "@/components/brand/Logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./LoginForm";
import { useAccount } from "./useAccount";

interface Info { title: string; owner: string; inviteName?: string; invitePhone?: string }

/** Landing page of a WhatsApp invitation: the link's secret is the proof; sign in with an email and the tree opens. */
export function JoinClient({ treeId, invite }: { treeId: string; invite: string }) {
  const router = useRouter();
  const auth = useAccount();
  const [info, setInfo] = useState<Info | null | undefined>();
  const [err, setErr] = useState("");
  const here = `/join/${treeId}?i=${encodeURIComponent(invite)}`;

  useEffect(() => {
    fetch(`/api/trees/${treeId}/join?i=${encodeURIComponent(invite)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setInfo).catch(() => setInfo(null));
  }, [treeId, invite]);

  // already signed in: if this person is already in the tree just open it, otherwise use the invitation
  useEffect(() => {
    if (auth.loading || !auth.account) return;
    if (info === undefined) return;
    (async () => {
      const res = await fetch(`/api/trees/${treeId}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ i: invite }) });
      if (res.ok) { router.replace(`/app/tree/${treeId}`); return; }
      setErr((await res.json().catch(() => ({}))).error ?? "Could not open this invitation.");
    })();
  }, [auth.loading, auth.account, info, treeId, invite, router]);

  if (info === undefined || auth.loading) return <div className="grid h-dvh place-items-center text-muted-foreground">Loading…</div>;
  if (auth.account) return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center gap-4 px-5 text-center">
      {err ? (
        <>
          <h1 className="font-display text-2xl font-bold text-indigo">We could not open this invitation</h1>
          <p role="alert" className="text-muted-foreground">{err}</p>
          <Button asChild><Link href="/app">Go to my trees</Link></Button>
        </>
      ) : <p className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> Opening the family tree…</p>}
    </main>
  );
  if (info === null) return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center gap-4 px-5 text-center">
      <h1 className="font-display text-2xl font-bold text-indigo">This invitation is not valid any more</h1>
      <p className="text-muted-foreground">It may have been used already, replaced by a newer one, or cancelled. Please ask the person who invited you to send it again.</p>
      <Button asChild variant="outline"><Link href="/">Go to PAAG Foundation</Link></Button>
    </main>
  );
  return (
    <div>
      <div className="bg-indigo px-5 py-6 text-center text-cream">
        <PaagLogo height={36} onDark className="mx-auto mb-3" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/70">Family tree invitation</p>
        <h1 className="font-display mt-2 text-2xl font-bold">{info.owner ? `${info.owner} invited you` : "You are invited"}</h1>
        <p className="mt-1 text-cream/80">to help with {info.title}</p>
      </div>
      <LoginForm next={here} invitedBy={info.owner || "Someone in your family"} defaultName={info.inviteName} defaultPhone={info.invitePhone} onSignedIn={auth.refresh} />
    </div>
  );
}
