import type { Metadata } from "next";
import { SampleClient } from "@/components/account/SampleClient";

export const metadata: Metadata = {
  title: "A sample family tree | Maithil Panji",
  description: "A sample only, not an official family tree: see how a Maithil family tree looks, using the publicly known Darbhanga Raj line. Tap anyone, drag and zoom.",
};

export default function SamplePage() {
  return <SampleClient />;
}
