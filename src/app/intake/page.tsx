import type { Metadata } from "next";
import { IntakeFlow } from "@/components/intake/IntakeFlow";

export const metadata: Metadata = { title: "Build your family tree — Maithil Panji" };

export default function IntakePage() {
  return <IntakeFlow />;
}
