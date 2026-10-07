"use client";
import { useState } from "react";
import { Check, Copy, Eye, MessageCircle, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Show this tree to others": a view-only link for WhatsApp, Facebook, X or anywhere else. People who open it can look, tap a person
 * and zoom — they cannot edit, download or see phone numbers. By default living relatives show by first name only.
 * The owner has to choose "full details" on purpose.
 */
export function SocialShare({ viewUrl, viewUrlFull, familyName }: { viewUrl: string; viewUrlFull: string; familyName: string }) {
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = full && viewUrlFull ? viewUrlFull : viewUrl;
  if (!viewUrl) return null;
  const text = `Namaste! Here is ${familyName} family tree, made on Maithil Panji. Have a look — and build your own, it is free:`;
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };
  const native = async () => { try { await navigator.share({ title: `${familyName} family tree`, text, url }); } catch { /* cancelled */ } };
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
        <a className={cn(btn, "col-span-2 border-transparent bg-[#25D366] text-white hover:bg-[#25D366]/90")} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}><MessageCircle className="size-5" /> Share on WhatsApp</a>
        <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}>Facebook</a>
        <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}>X (Twitter)</a>
        <Button variant="outline" className="h-11" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}</Button>
        {canNative && <Button variant="outline" className="h-11" onClick={native}><Share2 /> More…</Button>}
      </div>
      <p className="text-xs text-muted-foreground">A picture with the family name, number of people and gotra appears when the link is pasted into WhatsApp or Facebook — never a living person’s name. To switch a shared link off for good, delete the online copy at the bottom of this page.</p>
    </section>
  );
}
