"use client";
import { useState } from "react";
import { Check, GitMerge, Link2, Loader2, ShieldCheck, Unlink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DFamily } from "@/lib/family";
import type { Candidate, Preview } from "@/lib/connect";
import type { Connect } from "./useConnect";
import type { Activity } from "./useShare";
import type { Similar } from "./useSimilar";
import { SimilarTrees } from "./SimilarTrees";

/** the other tree, as much as is safe to show: the woman herself and her immediate family (living people by first name only) */
export function PreviewBody({ preview }: { preview: Preview }) {
  return (
    <div className="rounded-xl border bg-background p-3 text-sm">
      <p className="font-medium">{preview.person.name}{preview.person.year ? ` · born ${preview.person.year}` : ""}</p>
      <p className="text-xs text-muted-foreground">{preview.treeTitle}{preview.gotra ? ` · gotra ${preview.gotra}` : ""}{preview.mool ? ` · mool ${preview.mool}` : ""}</p>
      {preview.connects.length ? (
        <ul className="mt-2 space-y-1">
          {preview.connects.map((c, i) => (
            <li key={i} className="flex gap-2"><span className="w-24 shrink-0 lowercase text-muted-foreground first-letter:uppercase">{c.relation}</span><span>{c.name}{c.years ? <span className="text-muted-foreground"> ({c.years})</span> : null}</span></li>
          ))}
        </ul>
      ) : <p className="mt-2 text-muted-foreground">No relatives are recorded next to her in that tree yet.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Living relatives show by first name only.</p>
    </div>
  );
}

function CandidateCard({ m, connect, canAct }: { m: Candidate; connect: Connect; canAct: boolean }) {
  const [pv, setPv] = useState<{ loading?: boolean; preview?: Preview; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const req = { person: m.person, tree: m.tree, p: m.treePerson };
  const look = async () => { setPv({ loading: true }); setPv(await connect.preview(req)); };
  const link = async () => { setBusy(true); setErr(""); try { await connect.confirm(req); } catch (e) { setErr(e instanceof Error ? e.message : "Could not link."); setBusy(false); } };
  return (
    <li className="rounded-2xl border bg-background p-3">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"><GitMerge className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{m.personName} <span className="font-normal text-muted-foreground">(in your tree)</span></p>
          <p className="text-sm text-muted-foreground">may be the same as <span className="text-foreground">{m.name}</span> in “{m.treeTitle}”</p>
          <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", m.strength === "strong" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900")}>{m.strength === "strong" ? "Strong match" : "Possible match"}</span>
          <p className="mt-1 text-xs text-muted-foreground">{m.reasons.join(" · ")}</p>
        </div>
      </div>
      {pv.preview && <div className="mt-3"><PreviewBody preview={pv.preview} /></div>}
      {pv.error && <p role="alert" className="mt-2 text-sm text-terracotta">{pv.error}</p>}
      {err && <p role="alert" className="mt-2 text-sm text-terracotta">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!pv.preview && <Button variant="outline" className="h-11" onClick={look} disabled={pv.loading}>{pv.loading ? <Loader2 className="animate-spin" /> : null} See her family there</Button>}
        {canAct && <Button className="h-11" onClick={link} disabled={!pv.preview || busy} title={pv.preview ? undefined : "Look at her family first"}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Yes, same woman — link</Button>}
        <Button variant="ghost" className="h-11" onClick={() => connect.dismiss(m)}>Not her</Button>
      </div>
      {!pv.preview && canAct && <p className="mt-2 text-xs text-muted-foreground">Look at her family first, then confirm if it is the same woman.</p>}
    </li>
  );
}

function LinkedRow({ family, personId, connect, onSee }: { family: DFamily; personId: string; connect: Connect; onSee: (person: string, tree: string, p: string) => void }) {
  const p = family.persons.find((x) => x.id === personId)!;
  const [busy, setBusy] = useState(false);
  return (
    <>
      {(p.links ?? []).map((l) => (
        <li key={l.tree + l.person} className="rounded-xl border bg-background p-3 text-sm">
          <p className="font-medium">{p.name_roman}</p>
          <p className="text-muted-foreground">also in “{l.title ?? "another tree"}”{l.by ? ` · linked by ${l.by}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onSee(p.id, l.tree, l.person)}>See her family there</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await connect.unlink(p.id, l.tree); } finally { setBusy(false); } }}><Unlink /> Remove link</Button>
          </div>
        </li>
      ))}
    </>
  );
}

export interface MatchesProps {
  className?: string;
  family: DFamily;
  /** the tree is saved online (matching needs that) */
  online: boolean;
  role?: "owner" | "editor";
  connect: Connect;
  similar: Similar;
  discoverable: boolean;
  onDiscoverable: (on: boolean) => Promise<void>;
  activity: Activity[];
  onSee: (person: string, tree: string, p: string) => void;
  onOpenShare: () => void;
}

export function MatchesPane({ className, family, online, role, connect, similar, discoverable, onDiscoverable, activity, onSee, onOpenShare }: MatchesProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const linked = family.persons.filter((p) => p.links?.length);
  const toggle = async (on: boolean) => { setBusy(true); setErr(""); try { await onDiscoverable(on); } catch (e) { setErr(e instanceof Error ? e.message : "Could not change this."); } finally { setBusy(false); } };
  const women = connect.data?.women ?? 0;

  return (
    <aside className={cn("flex min-h-0 flex-col bg-card", className)} aria-label="Matching family trees">
      <div className="border-b px-4 py-2.5">
        <h2 className="font-display text-base font-semibold leading-tight">Matching family trees</h2>
        <p className="text-xs text-muted-foreground">Every Maithil woman is in two trees — her father’s and her husband’s</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {!online ? (
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
            <h3 className="font-display text-lg font-semibold leading-snug">Connect your tree to her father’s (or husband’s) family</h3>
            <p className="mt-2 text-sm text-muted-foreground">When you add a married woman, we can look for the same woman in another family’s tree and let you link the two. To do this, your tree must first be saved online.</p>
            <Button className="mt-3 h-11" onClick={onOpenShare}>Save my tree online</Button>
          </div>
        ) : !discoverable ? (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"><ShieldCheck className="size-3" /> Your choice</span>
            <h3 className="font-display mt-3 text-lg font-semibold leading-snug">Let families find each other</h3>
            <p className="mt-2 text-sm text-muted-foreground">If you agree, we compare the <strong>married women</strong> in your tree with other trees that agreed too — by first name, year of birth, gotra, mool and husband’s name. Nothing is linked until you confirm.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Other families can see a woman, her husband and children only after <em>you</em> confirm they match — and living people appear by first name only.</li>
              <li>You can switch this off any time.</li>
            </ul>
            {role === "owner"
              ? <Button className="mt-3 h-11" onClick={() => toggle(true)} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Yes, switch this on</Button>
              : <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm">Only the owner of this tree can switch this on. Please ask them.</p>}
            {err && <p role="alert" className="mt-2 text-sm text-terracotta">{err}</p>}
          </div>
        ) : (
          <>
            <SimilarTrees sim={similar} />

            <section aria-label="Possible matches" className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Married women who may be in another tree</h3>
              {connect.loading && !connect.data && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Looking…</p>}
              {connect.error && <p role="alert" className="text-sm text-terracotta">{connect.error} <button className="underline" onClick={() => connect.reload()}>Try again</button></p>}
              {connect.matches.length > 0 && <ul className="space-y-3">{connect.matches.map((m) => <CandidateCard key={`${m.person}|${m.tree}|${m.treePerson}`} m={m} connect={connect} canAct />)}</ul>}
              {connect.data && !connect.matches.length && (
                <p className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
                  {women === 0 ? "Add a married woman — a wife, or a daughter who is married — and we will look for her in other trees." : "No matching woman found in other trees yet. We look again whenever you add or change a married woman, or when another family joins."}
                </p>
              )}
              <button className="inline-flex items-center gap-1 text-xs text-muted-foreground underline" onClick={() => connect.reload()}>Check again</button>
            </section>

            {linked.length > 0 && (
              <section aria-label="Linked women" className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked to other trees</h3>
                <ul className="space-y-2">{linked.map((p) => <LinkedRow key={p.id} family={family} personId={p.id} connect={connect} onSee={onSee} />)}</ul>
              </section>
            )}

            {role === "owner" && activity.length > 0 && (
              <section aria-label="Recent changes" className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent changes by others</h3>
                <ul className="space-y-1.5 text-sm">{[...activity].reverse().slice(0, 8).map((a, i) => <li key={i} className="rounded-lg bg-secondary/60 px-3 py-2">{a.text}<span className="block text-xs text-muted-foreground">{new Date(a.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span></li>)}</ul>
              </section>
            )}

            {role === "owner" && (
              <div className="rounded-xl border p-3 text-sm">
                <p className="flex items-center gap-2 font-medium"><Link2 className="size-4" /> Other families can find this tree</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => toggle(false)} disabled={busy}>Switch off</Button>
              </div>
            )}
          </>
        )}
        <p className="flex items-start gap-2 text-xs text-muted-foreground"><Users className="mt-0.5 size-3.5 shrink-0" /> Later: search the digitised Panjikar records too.</p>
      </div>
    </aside>
  );
}
