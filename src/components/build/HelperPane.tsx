"use client";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Motif } from "@/components/landing/Motif";
import { cn } from "@/lib/utils";

/** Shown instead of the chat to family members who were invited to help: they edit the tree directly. */
export function HelperPane({ className, name, onOpenShare }: { className?: string; name?: string; onOpenShare: () => void }) {
  return (
    <section className={cn("flex min-h-0 flex-col overflow-y-auto bg-background p-6", className)} aria-label="Welcome">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-4 flex justify-center gap-3 text-primary"><Motif name="lotus" className="size-12" /><Motif name="fish" className="size-12" /></div>
        <h2 className="font-display text-2xl font-semibold">Namaste{name ? `, ${name.split(" ")[0]}` : ""}</h2>
        <p className="mt-2 text-muted-foreground">You have been invited to help with a family tree. Your changes are saved automatically and everyone with access sees them.</p>
      </div>
      <ol className="mx-auto mt-6 max-w-sm space-y-3 text-sm">
        {[
          "Tap any person in the tree to correct their name, years, village, gotra or mool, or to add a photo.",
          "In the same box, use “Add a relative” to add a wife, husband, son, daughter, brother, sister or parent.",
          "As in the Panji, a wife’s parents are not recorded — only her name.",
          "Switch the style at the top: Mithila Madhubani, Classic or Modern. Download a PDF any time.",
        ].map((t, i) => (
          <li key={i} className="flex gap-3 rounded-xl border bg-card p-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span><span>{t}</span></li>
        ))}
      </ol>
      <div className="mx-auto mt-6 w-full max-w-sm"><Button variant="outline" className="w-full" onClick={onOpenShare}><Share2 /> Sharing details</Button></div>
    </section>
  );
}
