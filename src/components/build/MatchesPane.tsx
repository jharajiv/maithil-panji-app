import { GitMerge, Lock, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Placeholder for the future "find and connect existing family trees" feature. Nothing here is real data. */
export function MatchesPane({ className }: { className?: string }) {
  return (
    <aside className={cn("flex min-h-0 flex-col bg-card", className)} aria-label="Matching family trees (coming soon)">
      <div className="border-b px-4 py-2.5">
        <h2 className="font-display text-base font-semibold leading-tight">Matching family trees</h2>
        <p className="text-xs text-muted-foreground">Search the Panji database</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"><Lock className="size-3" /> Coming up</span>
          <h3 className="font-display mt-3 text-lg font-semibold leading-snug">Searchable database to connect and merge your family tree</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            As the Panjikar records are digitised, we will suggest family trees that match the names, gotra, mool and villages you enter. You will be able to preview each match and connect it to your own tree with one tap.
          </p>
        </div>

        <div aria-hidden className="space-y-3 opacity-60">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview of what this will look like</p>
          {["Possible match · 3 shared ancestors", "Possible match · same mool and village"].map((t) => (
            <div key={t} className="rounded-xl border bg-background p-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground"><GitMerge className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="h-3 w-3/5 rounded bg-secondary" />
                  <div className="mt-2 h-2.5 w-4/5 rounded bg-secondary/70" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t}</p>
              <div className="mt-2 flex gap-2"><span className="rounded-md border px-3 py-1 text-xs">Preview</span><span className="rounded-md bg-primary/80 px-3 py-1 text-xs text-primary-foreground">Connect to my tree</span></div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm text-muted-foreground" aria-hidden><Search className="size-4" /> Search by name, mool or village…</div>
      </div>
    </aside>
  );
}
