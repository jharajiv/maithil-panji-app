"use client";
import { useState } from "react";
import { Check, Copy, Eye, Loader2, MessageCircle, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";

/**
 * "Show this tree to others": a view-only link for WhatsApp, Facebook, X or anywhere else. People who open it can look, tap a person
 * and zoom — they cannot edit, download or see phone numbers. By default living relatives show by first name only.
 * The owner has to choose "full details" on purpose.
 */
export function SocialShare({ viewUrl, viewUrlFull, familyName, viewOff, onViewLink }: {
  viewUrl: string; viewUrlFull: string; familyName: string;
  /** the owner has switched view-only links off */
  viewOff?: boolean;
  onViewLink?: (action: "stop" | "start" | "renew") => Promise<void>;
}) {
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ask, setAsk] = useState<"stop" | "renew" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const url = full && viewUrlFull ? viewUrlFull : viewUrl;
  const run = async (a: "stop" | "start" | "renew") => {
    if (!onViewLink) return;
    setBusy(true); setErr("");
    try { await onViewLink(a); setAsk(null); } catch (e) { setErr(e instanceof Error ? e.message : "Could not change the link."); } finally { setBusy(false); }
  };
  if (viewOff) return (
    <section aria-label="Show your tree to others" className="space-y-3 rounded-xl border p-3">
      <h3 className="flex items-center gap-2 font-medium"><Share2 className="size-5 text-terracotta" /> Show your tree to others</h3>
      <p className="text-sm text-muted-foreground">View-only links are switched off. Nobody can open the tree with an old link or a printed QR code. Your tree itself is safe, and people you invited to edit can still open it.</p>
      {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
      {onViewLink && <Button variant="outline" className="h-11 w-full" disabled={busy} onClick={() => run("start")}>{busy ? <Loader2 className="animate-spin" /> : <Eye />} Switch view-only links on again</Button>}
    </section>
  );
  if (!viewUrl) return null;
  const text = `Namaste! Here is ${familyName} family tree, made on PAAG Foundation. Have a look — and build your own, it is free:`;
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = async () => { track("share_clicked"); try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };
  const native = async () => { track("share_clicked"); try { await navigator.share({ title: `${familyName} family tree`, text, url }); } catch { /* cancelled */ } };
  const btn = "flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium hover:bg-secondary";
  const opt = (on: boolean) => cn("flex w-full gap-3 rounded-xl border p-3 text-left text-sm", on ? "border-primary bg-primary/5" : "hover:bg-secondary/60");
  return (
    <section aria-label="Show your tree to others" className="space-y-3 rounded-xl border p-3">
      <h3 className="flex items-center gap-2 font-medium"><Share2 className="size-5 text-terracotta" /> Show your tree to others</h3>
      <p className="flex items-start gap-2 text-sm text-muted-foreground"><Eye className="mt-0.5 size-4 shrink-0" /> Anyone with this link can look at the tree — tap people, zoom, move around. They cannot edit it, download it, or see phone numbers or private notes.</p>

      <div role="radiogroup" aria-label="What living relatives show" className="space-y-2">
        <button type="button" role="radio" aria-checked={!full} className={opt(!full)} onClick={() => setFull(false)}>
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-green-700" />
          <span><span className="font-medium">Protect living relatives</span> <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">recommended</span><br /><span className="text-muted-foreground">Living people show by first name only. Their birth dates, villages and photos stay hidden. Ancestors who have passed away show in full.</span></span>
        </button>
        {viewUrlFull && (
          <button type="button" role="radio" aria-checked={full} className={opt(full)} onClick={() => setFull(true)}>
            <Eye className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <span><span className="font-medium">Show full details</span><br /><span className="text-muted-foreground">Everything you entered about living relatives is visible to anyone who gets the link, including if it is forwarded. Choose this only if they are comfortable with it.</span></span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a onClick={() => track("share_clicked")} className={cn(btn, "col-span-2 border-transparent bg-[#25D366] text-white hover:bg-[#25D366]/90")} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}><MessageCircle className="size-5" /> Share on WhatsApp</a>
        <a onClick={() => track("share_clicked")} className={btn} target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}>Facebook</a>
        <a onClick={() => track("share_clicked")} className={btn} target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}>X (Twitter)</a>
        <Button variant="outline" className="h-11" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}</Button>
        {canNative && <Button variant="outline" className="h-11" onClick={native}><Share2 /> More…</Button>}
      </div>
      <p className="text-xs text-muted-foreground">A picture with the family name, number of people and gotra appears when the link is pasted into WhatsApp or Facebook — never a living person’s name.</p>
      {onViewLink && (
        <div className="space-y-2 border-t pt-3">
          <h4 className="text-sm font-medium">Changed your mind about a link?</h4>
          {ask ? (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950" role="alertdialog" aria-label="Confirm">
              <p>{ask === "stop"
                ? "Every view-only link and every printed QR code will stop working. Your tree is not deleted. You can switch links on again later."
                : "A new link is made. Every earlier view-only link and printed QR code stops working, and a new PDF will carry the new QR code."}</p>
              {err && <p role="alert" className="text-terracotta">{err}</p>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" disabled={busy} onClick={() => { setAsk(null); setErr(""); }}>Cancel</Button>
                <Button className="h-11" disabled={busy} onClick={() => run(ask)}>{busy ? <Loader2 className="animate-spin" /> : null} {ask === "stop" ? "Yes, stop sharing" : "Yes, make a new link"}</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={() => setAsk("renew")}>Make a new link</Button>
              <Button variant="outline" className="h-11" onClick={() => setAsk("stop")}>Stop sharing</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
