import Link from "next/link";
import { PaagLogo } from "@/components/brand/Logo";
import { NewsletterForm } from "./NewsletterForm";
import { contactEmail, ORG_LONG, ORG_NAME, SITE_DOMAIN } from "@/lib/site";

/** footer for the public pages: who is behind the site, and where to read more */
export function SiteFooter({ dark }: { dark?: boolean }) {
  const mail = contactEmail();
  const link = `underline underline-offset-2 ${dark ? "hover:text-cream" : "hover:text-foreground"}`;
  return (
    <footer className={`px-5 py-8 text-center text-sm ${dark ? "bg-indigo text-cream/70" : "border-t bg-secondary/40 text-muted-foreground"}`}>
      <NewsletterForm dark={dark} />
      <Link href="/about" aria-label={ORG_NAME} className="mb-2 inline-block"><PaagLogo height={36} onDark={dark} /></Link>
      <span className="sr-only">{ORG_NAME}</span>
      <p>{ORG_NAME} ({ORG_LONG}) · a community project for Maithil families</p>
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
