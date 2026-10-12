import type { Metadata } from "next";
import { withSocial } from "@/lib/seo";
import { FaqView } from "@/components/faq/FaqView";
import { ORG_NAME } from "@/lib/site";

export const metadata: Metadata = withSocial({
  title: `गोत्र, मूल और मैथिल वंशावली — प्रश्न और उत्तर | ${ORG_NAME}`,
  description: "गोत्र और मूल क्या होते हैं, विवाहित स्त्री कौन-सा गोत्र लिखती है, और पंजी के अनुसार मैथिल परिवार कैसे दर्ज होता है — सरल हिन्दी में उत्तर।",
  alternates: { canonical: "/hi/faq", languages: { en: "/faq", hi: "/hi/faq", "x-default": "/faq" } },
}, "/hi/faq", "hi_IN");

export default function HindiFaqPage() { return <FaqView lang="hi" />; }
