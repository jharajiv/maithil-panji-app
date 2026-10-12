import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Landmark, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { PaagLogo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { ORG_NAME } from "@/lib/site";
import { withSocial } from "@/lib/seo";

export const metadata: Metadata = withSocial({
  title: `Your family’s data is safe with ${ORG_NAME}`,
  description: "Where your family tree is kept (a data centre in India), who can see it, who helps run the site, and how to delete it. Never sold, never used for advertising.",
  alternates: { canonical: "/safety" },
}, "/safety");

function H({ children }: { children: React.ReactNode }) { return <h2 className="font-display mt-10 text-2xl font-semibold text-indigo">{children}</h2>; }
function P({ children }: { children: React.ReactNode }) { return <p className="mt-2 leading-relaxed text-foreground/85">{children}</p>; }

const PROMISES = [
  { icon: Landmark, title: "Kept in India", hi: "भारत में सुरक्षित", text: "Saved family trees and accounts are stored in a data centre in Mumbai, India. The website’s own servers also run in Mumbai." },
  { icon: Lock, title: "Never sold", hi: "कभी बेचा नहीं जाता", text: "No advertising, no marketers, no selling or renting of anyone’s family information. Ever." },
  { icon: ShieldCheck, title: "You decide who sees it", hi: "कौन देखे, आप तय करें", text: "Your tree is private. Relatives you invite can help; a view-only link shows living people by first name only." },
  { icon: Trash2, title: "Delete it any time", hi: "जब चाहें मिटाएँ", text: "One tap removes your online tree and every person in it from our database, and every shared link stops working." },
] as const;

export default function Safety() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> {ORG_NAME} home</Link>
        <PaagLogo height={34} className="mt-5" />
        <h1 className="font-display mt-4 text-3xl font-bold text-indigo sm:text-4xl">Your family’s information is safe here</h1>
        <p lang="hi" className="font-display mt-2 text-xl text-indigo/85">आपके परिवार की जानकारी यहाँ सुरक्षित है</p>
        <p className="mt-4 text-lg leading-relaxed text-foreground/85">A family tree holds names, places and relationships that matter to people. This page says plainly where it is kept, who can see it and who helps us run the site.</p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {PROMISES.map((p) => (
            <li key={p.title} className="rounded-2xl border bg-card p-4">
              <p.icon className="size-6 text-terracotta" aria-hidden />
              <p className="mt-2 font-semibold text-indigo">{p.title} <span lang="hi" className="font-medium text-muted-foreground">· {p.hi}</span></p>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground/80">{p.text}</p>
            </li>
          ))}
        </ul>

        <section lang="hi" className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5" aria-label="हिन्दी में सार">
          <h2 className="font-display text-lg font-semibold text-indigo">संक्षेप में (हिन्दी)</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
            <li>आपकी वंशावली और खाते की जानकारी भारत (मुंबई) के डेटा सेंटर में रखी जाती है।</li>
            <li>हम आपकी जानकारी न बेचते हैं, न विज्ञापन के लिए किसी को देते हैं।</li>
            <li>आपकी वंशावली निजी रहती है। देखने के लिए “सिर्फ़ देखने वाला” लिंक बनता है, जिसमें जीवित लोगों का सिर्फ़ पहला नाम दिखता है।</li>
            <li>आप जब चाहें अपनी ऑनलाइन वंशावली मिटा सकते हैं।</li>
            <li>लिंक या PDF आप जिसे देते हैं, वह उसे रख या आगे भेज सकता है। इसलिए सिर्फ़ भरोसेमंद लोगों से साझा करें।</li>
          </ul>
        </section>

        <H>Why PAAG exists</H>
        <P>The records of Maithil families have long lived in paper volumes, scans and loose files, each held by a few hands. Digital is the way forward, and we believe it should be done with care, by Maithils, for Maithil families. {ORG_NAME} is one place where a family’s own record is kept respectfully, so that families can look at their history together. The family decides who may see its tree.</P>

        <H>Who can see your tree</H>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-foreground/85">
          <li><strong>You</strong>, signed in with your email address (there is no password to steal; you receive a one-time code, or you use Google).</li>
          <li><strong>Relatives you invite</strong>. They can add and correct. You can remove them at any time.</li>
          <li><strong>People you give a view-only link.</strong> They can look at the tree, nothing more: no editing, no downloading, no phone numbers. Living relatives appear by first name only, with no birth date, village or photo, unless you choose otherwise. You can switch the link off at any time.</li>
          <li><strong>A very small PAAG team</strong>, only to help families and keep the service running. They sign in with named accounts.</li>
          <li><strong>Nobody else.</strong> There is no public list of families or people. A visitor who is not signed in cannot search or browse trees, and shared links are kept out of search engines.</li>
        </ul>

        <H>The companies that help us run the site</H>
        <P>We use a few well-known services. Each receives only what its job needs.</P>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-foreground/85">
          <li><strong>Supabase</strong> keeps the database, in a data centre in Mumbai, India.</li>
          <li><strong>Vercel</strong> hosts the website, in its Mumbai region.</li>
          <li><strong>Resend</strong> delivers our emails: sign-in codes, birthday reminders you ask for, and the newsletter you ask for.</li>
          <li><strong>The chat assistant</strong> reads your answers with an AI service from Anthropic. This is the one part that is not in India: your answers and the names and details already in your tree are sent to it so it can understand them. Photos and phone numbers are never sent, and under the provider’s business terms the information is not used to train its models.</li>
          <li><strong>Google</strong>, only if you choose “Continue with Google”, search for a village, or tap “Allow” on the visit-counting banner.</li>
        </ul>

        <H>What you share is your choice</H>
        <P>When you give someone a view-only link, a PDF or a screenshot, they can keep it or pass it on. We cannot control what people do with what you share with them, so share with people you trust, and think before adding details about living relatives, especially children. What you do with your own family’s information is up to you.</P>

        <H>Your rights</H>
        <P>You can see your tree, correct it and delete it yourself, and you can ask us to remove your account. Birthday reminders and the newsletter are off until you switch them on, and every email has a link to stop them. More detail is on the <Link href="/privacy" className="underline">Privacy page</Link>.</P>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/build" className="rounded-xl bg-terracotta px-5 py-3 font-semibold text-white hover:bg-terracotta/90">Start your family tree</Link>
          <Link href="/privacy" className="rounded-xl border px-5 py-3 font-medium hover:bg-secondary">Read the full Privacy page</Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
