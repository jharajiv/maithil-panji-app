import Link from "next/link";
import { contactEmail, ORG_LONG, ORG_NAME, SITE_DOMAIN, SITE_NAME } from "@/lib/site";

/** footer for the public pages: who is behind the site, and where to read more */
export function SiteFooter({ dark }: { dark?: boolean }) {
  const mail = contactEmail();
  const link = `underline underline-offset-2 ${dark ? "hover:text-cream" : "hover:text-foreground"}`;
  return (
    <footer className={`px-5 py-8 text-center text-sm ${dark ? "bg-indigo text-cream/70" : "border-t bg-secondary/40 text-muted-foreground"}`}>
      <p className={`font-display text-base font-semibold ${dark ? "text-cream" : "text-indigo"}`}>{ORG_NAME}</p>
      <p>{ORG_LONG} · {SITE_NAME} is a community project of the foundation</p>
      <nav aria-label="Footer" className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1">
        <Link href="/about" className={link}>About PAAG</Link>
        <Link href="/sample" className={link}>Sample tree</Link>
        <Link href="/privacy" className={link}>Privacy</Link>
        {mail && <a href={`mailto:${mail}`} className={link}>Contact</a>}
      </nav>
      <p className="mt-3 text-xs opacity-80">{SITE_DOMAIN} · Your data is never sold or shared.</p>
    </footer>
  );
}
