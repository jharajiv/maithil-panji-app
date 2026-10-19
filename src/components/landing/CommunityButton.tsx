"use client";
import { track } from "@/lib/track";
import { COMMUNITY_TEXT, communityUrl } from "@/lib/community";

const WaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.84 9.84 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.69 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" /></svg>
);

/** "Join our WhatsApp community" — shows nothing until the community link is set. `card` = a larger block with one line of explanation. */
export function CommunityButton({ card, hindi, onDark, source, className }: { card?: boolean; hindi?: boolean; onDark?: boolean; source?: string; className?: string }) {
  const url = communityUrl();
  if (!url) return null;
  const t = COMMUNITY_TEXT.en, h = COMMUNITY_TEXT.hi;
  const count = () => track("community_clicked");
  const btn = (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={count} data-source={source}
      className={`inline-flex min-h-12 items-center justify-center gap-2.5 rounded-lg px-5 py-2.5 text-base font-semibold shadow-sm transition-colors ${onDark ? "bg-[#25D366] text-[#053b1d] hover:bg-[#3be07a]" : "bg-[#128C4A] text-white hover:bg-[#0f7a40]"} ${className ?? ""}`}>
      <WaIcon className="size-6 shrink-0" />
      <span className="text-left leading-tight">{t.cta}{hindi !== false && <span lang="hi" className="block text-sm font-medium opacity-90">{h.cta}</span>}</span>
    </a>
  );
  if (!card) return btn;
  return (
    <div className={`rounded-2xl border p-5 ${onDark ? "border-cream/25 bg-cream/10 text-cream" : "bg-card"} ${className ?? ""}`}>
      <p className={`text-base leading-relaxed ${onDark ? "text-cream/90" : "text-foreground/85"}`}>{t.line}</p>
      <p lang="hi" className={`mt-1 text-sm ${onDark ? "text-cream/70" : "text-muted-foreground"}`}>{h.line}</p>
      <div className="mt-4">{btn}</div>
    </div>
  );
}
