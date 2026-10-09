import type { Metadata } from "next";
import { PaagLogo } from "@/components/brand/Logo";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";

export const metadata: Metadata = { title: "Privacy — Maithil Panji · PAAG Foundation", description: "What Maithil Panji (PAAG Foundation) keeps, who can see it, and how to have it removed." };

const UPDATED = "8 October 2026";
const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

function H({ children }: { children: React.ReactNode }) { return <h2 className="font-display mt-9 text-xl font-semibold text-indigo">{children}</h2>; }
function P({ children }: { children: React.ReactNode }) { return <p className="mt-2 leading-relaxed text-foreground/85">{children}</p>; }
function L({ children }: { children: React.ReactNode }) { return <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-foreground/85">{children}</ul>; }

export default function Privacy() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Maithil Panji home</Link>
        <PaagLogo height={34} className="mt-5" />
        <h1 className="font-display mt-4 text-3xl font-bold text-indigo sm:text-4xl">Privacy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated {UPDATED}</p>

        <section lang="hi" className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5" aria-label="हिन्दी में सार">
          <h2 className="font-display text-lg font-semibold text-indigo">संक्षेप में (हिन्दी)</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
            <li>आपकी वंशावली आपकी है। हम आपकी जानकारी बेचते नहीं हैं और न ही विज्ञापन के लिए किसी को देते हैं।</li>
            <li>जब तक आप “ऑनलाइन सेव करें” नहीं चुनते, आपकी वंशावली सिर्फ़ आपके फ़ोन या कंप्यूटर में रहती है।</li>
            <li>जीवित रिश्तेदारों की जानकारी या फ़ोटो उनकी सहमति से ही डालें।</li>
            <li>वंशावली को सोशल मीडिया या WhatsApp पर दिखाने के लिए “सिर्फ़ देखने वाला” लिंक बनता है। उसमें कोई बदलाव या डाउनलोड नहीं कर सकता। शुरू से जीवित लोगों का सिर्फ़ पहला नाम दिखता है; जन्म-तिथि, गाँव और फ़ोटो छिपे रहते हैं।</li>
            <li>आप जब चाहें अपनी ऑनलाइन वंशावली मिटा सकते हैं (Share → “Delete online copy”)।</li>
          </ul>
        </section>

        <H>Who we are</H>
        <P>Maithil Panji is run by <Link href="/about" className="underline">PAAG Foundation</Link> (Panji Ancestry &amp; Graph), at paag.org.in. When this page says “we”, it means PAAG Foundation.</P>

        <H>The short version</H>
        <L>
          <li>Maithil Panji is a community project of PAAG Foundation (Panji Ancestry &amp; Graph, paag.org.in) to help Maithil families record their lineage in the Panji Prabandh tradition.</li>
          <li>Your tree belongs to you. We do not sell your data, show advertising, or pass it to marketers.</li>
          <li>Until you choose to save it online, your tree stays on your own phone or computer.</li>
          <li>You can delete your online tree yourself at any time.</li>
        </L>

        <H>What we keep, and why</H>
        <L>
          <li><strong>Your tree</strong> — names, relationships, and anything you choose to add such as birth year, village, gotra, mool and photos. It is kept on this device. If you save it online, a copy is stored on our database provider so you can open it on other phones and invite relatives.</li>
          <li><strong>Your email address and name</strong> — to sign you in with a one-time code (no password). We use the email address only for sign-in codes and, if you ask, for a message about your tree.</li>
          <li><strong>Sign in with Google</strong> — if you choose “Continue with Google”, Google tells us your email address (confirmed) and your name, and nothing else. We do not receive your Google password, contacts or other data.</li>
          <li><strong>Your profile</strong> — if you add them in “My profile”: your mobile number, pravar, native village, city, address, marital status, occupation and a short note about yourself. Gotra and mool come from your tree. None of it is public or searchable.</li>
          <li><strong>Phone numbers of relatives</strong> — only if you invite someone on WhatsApp. The number is used to open WhatsApp for you. It is never shown on shared view-only pages.</li>
          <li><strong>Your consent</strong> — we record that you agreed to the terms of sharing a family tree, and when.</li>
          <li><strong>Simple usage counts</strong> — we count how often the sample tree is opened, trees are started and saved, PDFs are downloaded, share buttons are used, corrections are suggested, women are linked, owners are put in touch, and people sign in with Google. Each count is only a name and a time: no name, no tree, no IP address, no cookie.</li>
          <li><strong>Roughly where you are</strong> — the country your connection comes from, used only to suggest a sensible contribution amount. It is not stored.</li>
        </L>

        <H>The assistant and your answers</H>
        <P>The chat reads your answers using an AI service. To do that, your answers and the names and details already in your tree are sent to the AI provider. Photos and phone numbers are never sent. Under the provider’s current business terms, information sent this way is not used to train its models. If the AI service is unavailable, a simpler built-in reader takes over.</P>

        <H>Other services that see some of your data</H>
        <L>
          <li><strong>Database and hosting</strong> — saved trees are stored with our database provider and the site runs on a hosting provider.</li>
          <li><strong>Email delivery</strong> — your email address and the one-time code pass through our email provider.</li>
          <li><strong>Village search</strong> — when you type a village name, the letters you type are sent from your browser to a public place-name search service to suggest matches.</li>
        </L>

        <H>Sharing your tree with others</H>
        <P>There are two ways to share, and they are different on purpose.</P>
        <L>
          <li><strong>Let families find each other (off until you switch it on).</strong> If you do, your tree is compared with other trees that also agreed: married women are matched, and trees with the same gotra and mool are compared to see whether the same family was entered twice. Another owner sees a preview only for a tree that looks similar to theirs, with living people by first name only. If you ask an owner to connect — or accept their request — your name and profile details are shown to that one owner, and your mobile number and email too, because you agree to that for that request. Nothing is merged or linked unless the owners confirm it.</li>
          <li><strong>Invite someone to help.</strong> Invited relatives can edit your tree. Only invite people you trust. You can remove access at any time.</li>
          <li><strong>Show your tree (view-only link).</strong> Anyone who has the link can look at the tree. They cannot edit it, download it, or see phone numbers or private notes. By default, living relatives appear by first name only; their birth dates, villages and photos stay hidden, and people not recorded as having passed away are treated as living. You can choose “show full details” instead, but then everything entered about living relatives is visible to anyone who gets the link — including if it is forwarded.</li>
        </L>
        <P>When a link is pasted into WhatsApp, Facebook or similar apps, a preview picture appears. It shows the family name, the number of people and generations, and the gotra and mool — never a living person’s name. A printed QR code on a downloaded tree opens the same protected view-only page. Anyone can take a screenshot of what they can see, so please share only with people you are comfortable with.</P>

        <H>Suggested corrections</H>
        <P>Anyone who opens a view-only link can tap a person and suggest a correction. What they type (what is wrong, what it should be, an optional note, and an optional name) is kept for you and your helpers until one of you applies or dismisses it. Nothing in your tree changes by itself. Please do not add phone numbers or web links to a suggestion; they are not accepted.</P>

        <H>Connecting families through married women</H>
        <P>This is off until the owner of a tree switches it on, and can be switched off any time. When on, married women in your tree are compared with married women in other trees that also switched it on, using first name, year of birth, gotra, mool and the husband’s name. Nothing is linked until someone confirms. To confirm, the person sees a short preview of the other tree — the woman, her husband, parents, brothers, sisters and children — and living people appear by first name only. Once linked, both trees show that she also appears in the other. Either side can remove the link. When a helper makes a link, the owner is told.</P>

        <H>Living relatives and children</H>
        <P>Please add details or photos of living relatives only if they are comfortable with it. If you are adding a child’s details, you are responsible for keeping them private — we suggest first name only. If someone asks you to remove their details, please do so; you can edit or remove anyone from the tree at any time.</P>

        <H>Deleting your data</H>
        <L>
          <li>On this device: use “Start over” in the builder, or clear your browser’s site data.</li>
          <li>Online tree: open <em>Share</em> and choose <em>Delete online copy</em>. This removes the tree and every person in it from our database for you and everyone you invited, and all view-only links stop working.</li>
          <li>Anything else, including your account: {contact ? <>write to <a className="underline" href={`mailto:${contact}`}>{contact}</a>.</> : "contact the person who invited you to Maithil Panji."}</li>
        </L>

        <H>Cookies</H>
        <P>When you sign in we set one cookie that keeps you signed in. We do not use advertising or tracking cookies. The builder also keeps your draft tree and chosen style in your browser’s local storage on your device.</P>

        <H>Changes</H>
        <P>If this page changes in a way that matters, we will say so here.</P>
        {contact && <P>Questions: <a className="underline" href={`mailto:${contact}`}>{contact}</a></P>}
      </div>
      <SiteFooter />
    </div>
  );
}
