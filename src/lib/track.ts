import type { EventName } from "./events";

/** anonymous usage count (see events.ts). `once` counts it at most once per browser tab session / per browser. */
export function track(name: EventName, once?: "session" | "browser") {
  if (typeof window === "undefined") return;
  try {
    if (once) {
      const store = once === "browser" ? localStorage : sessionStorage;
      const k = `maithil-panji.ev.${name}`;
      if (store.getItem(k)) return;
      store.setItem(k, "1");
    }
  } catch { /* storage blocked: count it anyway */ }
  /* the same count also goes to Google Analytics (when it is set up), so conversions can be seen by where the visitor came from */
  try { (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", name); } catch { /* ignore */ }
  try { fetch("/api/ev", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }), keepalive: true }).catch(() => {}); } catch { /* ignore */ }
}
