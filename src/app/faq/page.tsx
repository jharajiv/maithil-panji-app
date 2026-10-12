import type { Metadata } from "next";
import { withSocial } from "@/lib/seo";
import { FaqView } from "@/components/faq/FaqView";
import { ORG_NAME } from "@/lib/site";

export const metadata: Metadata = withSocial({
  title: `Questions and answers on gotra, mool and Maithil family trees — ${ORG_NAME}`,
  description: "Gotra, mool, and how a Maithil family is recorded in the Panji way: which gotra a married woman writes, what a mool is, and how to use the app.",
  alternates: { canonical: "/faq", languages: { en: "/faq", hi: "/hi/faq", "x-default": "/faq" } },
}, "/faq");

/** English answers. The old address /faq?lang=hi is redirected to /hi/faq in next.config.ts, so each language has its own page for search engines. */
export default function FaqPage() {
  return <FaqView lang="en" />;
}
