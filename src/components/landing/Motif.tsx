import { useId } from "react";
import { MOTIFS, framePatternDefs } from "@/lib/motifs";

export function Motif({ name, className }: { name: keyof typeof MOTIFS; className?: string }) {
  // Static, trusted SVG strings from our own motif generators.
  return <span aria-hidden className={className} dangerouslySetInnerHTML={{ __html: MOTIFS[name]() }} />;
}

export function PatternBand({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden className={className} width="100%" height="16" xmlns="http://www.w3.org/2000/svg">
      <g dangerouslySetInnerHTML={{ __html: framePatternDefs(`b${id}`) }} />
      <rect width="100%" height="16" fill={`url(#b${id})`} />
    </svg>
  );
}
