import type { Metadata } from "next";
import { BuildApp } from "@/components/build/BuildApp";

export const metadata: Metadata = { title: "Build your family tree — PAAG Foundation" };

export default function BuildPage() {
  return <BuildApp />;
}
