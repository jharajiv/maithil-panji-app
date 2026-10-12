"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsAddress, CONSENT_EVENT, gaId, readConsent } from "@/lib/consent";

type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; __paagGa?: boolean };

/**
 * Google Analytics 4. Nothing is loaded, and nothing is sent to Google, unless NEXT_PUBLIC_GA_ID is set AND this visitor has tapped "Allow"
 * (see lib/consent.ts). A visitor who taps "No thanks" or ignores the banner never contacts Google. Page views are sent by hand so that
 * private addresses (shared trees, invitations, accounts) are reported without their key.
 */
export function Analytics() {
  const pathname = usePathname();
  const here = useRef(pathname);
  here.current = pathname;

  useEffect(() => {
    const id = gaId();
    if (!id) return;
    const w = window as W;
    const start = () => {
      if (w.__paagGa) return;
      w.__paagGa = true;
      w.dataLayer = w.dataLayer || [];
      // gtag must push the "arguments" object itself
      w.gtag = function gtag() { // eslint-disable-next-line prefer-rest-params
        (w.dataLayer as unknown[]).push(arguments); };
      w.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      w.gtag("consent", "update", { analytics_storage: "granted" });
      w.gtag("js", new Date());
      w.gtag("config", id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
      const s = document.createElement("script"); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`; document.head.appendChild(s);
    };
    const view = () => {
      if (here.current.startsWith("/admin")) return;
      const a = analyticsAddress(here.current, window.location.search);
      const href = `${window.location.origin}${a.path}${a.query}`;
      w.gtag?.("set", { page_location: href, page_path: a.path });
      w.gtag?.("event", "page_view", { page_location: href, page_path: a.path, page_title: document.title });
    };
    const onChange = () => { if (readConsent() === "granted") { start(); view(); } };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  /* every page change, for a visitor who has said yes */
  useEffect(() => {
    const id = gaId();
    const w = window as W;
    if (!id || readConsent() !== "granted" || pathname.startsWith("/admin")) return;
    if (!w.__paagGa) { window.dispatchEvent(new Event(CONSENT_EVENT)); return; } // a returning visitor who already said yes: start now (the listener sends the first view)
    const a = analyticsAddress(pathname, window.location.search);
    const href = `${window.location.origin}${a.path}${a.query}`;
    w.gtag?.("set", { page_location: href, page_path: a.path });
    w.gtag?.("event", "page_view", { page_location: href, page_path: a.path, page_title: document.title });
  }, [pathname]);
  return null;
}
