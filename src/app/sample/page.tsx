import type { Metadata } from "next";
import { withSocial } from "@/lib/seo";
import { SampleClient } from "@/components/account/SampleClient";

export const metadata: Metadata = withSocial({
  title: "A sample family tree — PAAG Foundation",
  description: "A sample only, not an official family tree: see how a Maithil family tree looks, using the publicly known Darbhanga Raj line. Tap anyone, drag and zoom.",
  alternates: { canonical: "/sample" },
}, "/sample");

export default function SamplePage() {
  return <SampleClient />;
}
