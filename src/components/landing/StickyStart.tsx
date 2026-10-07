"use client";
import { useEffect, useState } from "react";

/** phones only: a bar with the main button that appears once the hero button has scrolled out of view */
export function StickyStart({ watch, children }: { watch: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(watch);
    if (!el || typeof IntersectionObserver === "undefined") { setShow(true); return; }
    const io = new IntersectionObserver(([e]) => setShow(!e!.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);
  return (
    <div aria-hidden={!show} className={`fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur transition-transform duration-200 sm:hidden ${show ? "translate-y-0" : "pointer-events-none translate-y-full"}`}>
      {children}
    </div>
  );
}
