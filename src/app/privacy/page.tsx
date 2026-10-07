import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = { title: "Privacy — Maithil Panji", description: "What Maithil Panji keeps, who can see it, and how to have it removed." };

const UPDATED = "7 October 2026";
const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

function H({ children }: { children: React.ReactNode }) { return <h2 className="font-display mt-9 text-xl font-semibold text-indigo">{children}</h2>; }
function P({ children }: { children: React.ReactNode }) { return <p className="mt-2 leading-relaxed text-foreground/85">{children}</p>; }
function L({ children }: { children: React.ReactNode }) { return <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-foreground/85">{children}</ul>; }

export default function Privacy() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Maithil Panji home</Link>
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

        <H>The short version</H>
        <L>
          <li>Maithil Panji is a community project to help Maithil families record their lineage in the Panji Prabandh tradition.</li>
          <li>Your tree belongs to you. We do not sell your data, show advertising, or pass it to marketers.</li>
          <li>Until you choose to save it online, your tree stays on your own phone or computer.</li>
          <li>You can delete your online tree yourself at any time.</li>
        </L>

        <H>What we keep, and why</H>
        <L>
          <li><strong>Your tree</strong> — names, relationships, and anything you choose to add such as birth year, village, gotra, mool and photos. It is kept on this device. If you save it online, a copy is stored on our database provider so you can open it on other phones and invite relatives.</li>
          <li><strong>Your email address and name</strong> — to sign you in with a one-time code (no password). We use the email address only for sign-in codes and, if you ask, for a message about your tree.</li>
          <li><strong>Phone numbers of relatives</strong> — only if you invite someone on WhatsApp. The number is used to open WhatsApp for you. It is never shown on shared view-only pages.</li>
          <li><strong>Your consent</strong> — we record that you agreed to the terms of sharing a family tree, and when.</li>
          <li><strong>Simple usage counts</strong> — we count how often the sample tree is opened, trees are started and saved, PDFs are downloaded and share buttons are used. Each count is only a name and a time: no name, no tree, no IP address, no cookie.</li>
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
          <li><strong>Invite someone to help.</strong> Invited relatives can edit your tree. Only invite people you trust. You can remove access at any time.</li>
          <li><strong>Show your tree (view-only link).</strong> Anyone who has the link can look at the tree. They cannot edit it, download it, or see phone numbers or private notes. By default, living relatives appear by first name only; their birth dates, villages and photos stay hidden, and people not recorded as having passed away are treated as living. You can choose “show full details” instead, but then everything entered about living relatives is visible to anyone who gets the link — including if it is forwarded.</li>
        </L>
        <P>When a link is pasted into WhatsApp, Facebook or similar apps, a preview picture appears. It shows the family name, the number of people and generations, and the gotra and mool — never a living person’s name. A printed QR code on a downloaded tree opens the same protected view-only page. Anyone can take a screenshot of what they can see, so please share only with people you are comfortable with.</P>

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
    </div>
  );
}
