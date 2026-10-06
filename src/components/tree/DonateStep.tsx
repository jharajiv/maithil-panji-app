"use client";
import { useEffect, useMemo, useState } from "react";
import { FileDown, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INR, cardLink, donateConfig, guessCountry, markDonated, tierFor, upiLink } from "@/lib/donate";

/**
 * Shown just before the PDF is made. A small, optional contribution; "Skip" is always there and the download never depends on paying.
 * Returns null (and the caller goes straight to the download) when no payment method has been configured.
 */
export function DonateStep({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const cfg = useMemo(donateConfig, []);
  const [country, setCountry] = useState("");
  const [method, setMethod] = useState<"upi" | "card">(cfg.upiId ? "upi" : "card");
  const [amount, setAmount] = useState<number | null>(null);
  const [paid, setPaid] = useState(false);
  const [qr, setQr] = useState("");
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    const guess = guessCountry();
    setCountry(guess);
    let live = true;
    fetch("/api/geo").then((r) => r.json()).then((j: { country?: string }) => { if (live && j.country) setCountry(j.country); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // India → UPI when it is set up; everyone else → the card link when it is set up
  useEffect(() => {
    if (cfg.upiId && cfg.cardUrl) setMethod(country === "IN" || country === "" ? "upi" : "card");
  }, [country, cfg.upiId, cfg.cardUrl]);

  const tier = method === "upi" ? INR : tierFor(country);
  useEffect(() => { setAmount(tier.pick); }, [tier.code, tier.pick]);

  const href = amount == null ? "" : method === "upi" ? upiLink(cfg, amount) : cardLink(cfg, amount, tier.code);
  useEffect(() => {
    if (method !== "upi" || mobile || !href) { setQr(""); return; }
    let live = true;
    import("qrcode").then((Q) => Q.toDataURL(href, { margin: 1, width: 200 })).then((u) => { if (live) setQr(u); }).catch(() => {});
    return () => { live = false; };
  }, [href, method, mobile]);

  if (paid) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><Heart className="size-7" /></div>
        <h2 className="font-display text-2xl font-semibold">Thank you</h2>
        <p className="mt-2 text-muted-foreground">Dhanyavaad. Your support helps more Maithil families keep their Panji alive.</p>
        <Button size="lg" className="mt-6 w-full" onClick={onContinue}><FileDown /> Download my tree</Button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-2 text-sm text-muted-foreground underline-offset-2 hover:underline">← Back</button>
      <h2 className="font-display text-2xl font-semibold">Your family tree is ready</h2>
      <p className="mt-2 text-muted-foreground">
        Maithil Panji is a free community project to keep our family records safe for the next generation. If it was useful to you, a small contribution helps us keep it free for every family.
      </p>

      <div role="radiogroup" aria-label="Contribution amount" className="mt-4 grid grid-cols-4 gap-2 max-sm:grid-cols-2">
        {tier.amounts.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={amount === a} onClick={() => setAmount(a)}
            className={cn("h-12 rounded-xl border text-base font-semibold transition-colors", amount === a ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-secondary")}>
            {tier.symbol}{a}
          </button>
        ))}
      </div>

      {href && method === "upi" && !mobile && qr && (
        <div className="mt-4 flex items-center gap-4 rounded-xl border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="UPI QR code" className="size-32 rounded-lg" />
          <p className="text-sm text-muted-foreground">Scan with any UPI app (PhonePe, Google Pay, Paytm, BHIM) to contribute {tier.symbol}{amount}.</p>
        </div>
      )}

      {href && (method === "card" || mobile) && (
        <Button asChild size="lg" className="mt-4 w-full">
          <a href={href} target={method === "card" ? "_blank" : undefined} rel="noopener noreferrer" onClick={() => { markDonated(); setPaid(true); }}>
            <Heart /> {method === "upi" ? `Contribute ${tier.symbol}${amount} with UPI` : `Contribute ${tier.symbol}${amount}`}
          </a>
        </Button>
      )}
      {method === "upi" && !mobile && href && (
        <Button size="lg" className="mt-3 w-full" onClick={() => { markDonated(); onContinue(); }}>I have contributed — download my tree</Button>
      )}
      {method === "card" && href && !cfg.cardUrl.includes("{amount}") && (
        <p className="mt-2 text-center text-xs text-muted-foreground">You can change the amount on the next page.</p>
      )}

      <Button size="lg" variant="outline" className="mt-3 w-full" onClick={onContinue}>Skip — download my tree</Button>

      {cfg.upiId && cfg.cardUrl && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {method === "upi" ? "Not in India? " : "In India? "}
          <button type="button" className="underline underline-offset-2" onClick={() => setMethod(method === "upi" ? "card" : "upi")}>
            {method === "upi" ? "Pay by card instead" : "Pay by UPI instead"}
          </button>
        </p>
      )}
    </div>
  );
}

/** whether the contribution step can be shown at all on this site */
export const donationConfigured = () => { const c = donateConfig(); return !!(c.upiId || /^https:\/\//.test(c.cardUrl)); };
