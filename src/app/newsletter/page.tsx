import type { Metadata } from "next";
import Link from "next/link";
import { PaagLogo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/landing/SiteFooter";

export const metadata: Metadata = { title: "Newsletter — PAAG Foundation", robots: { index: false } };

const MSG: Record<string, { h: string; p: string }> = {
  confirmed: { h: "Thank you, you are subscribed", p: "We will write to you now and then with new features and stories of Maithil families. Every email has an unsubscribe link." },
  invalid: { h: "This link is not valid any more", p: "It may be too old or already used. Please fill in the form at the bottom of the home page again and we will send a new one." },
};

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const m = MSG[s ?? ""] ?? MSG.invalid!;
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-md px-5 pb-16 pt-10 text-center">
        <PaagLogo height={40} className="mx-auto" />
        <h1 className="font-display mt-8 text-2xl font-bold text-indigo">{m.h}</h1>
        <p className="mt-3 leading-relaxed text-foreground/85">{m.p}</p>
        <Link href="/" className="mt-8 inline-block rounded-xl bg-terracotta px-5 py-3 font-semibold text-white hover:bg-terracotta/90">Go to the home page</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
