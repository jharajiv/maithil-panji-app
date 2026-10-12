import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/env";
import { siteUrl } from "@/lib/site";

const ALLOW = ["/", "/about", "/faq", "/hi", "/gotra", "/mool", "/sample", "/privacy", "/safety", "/llms.txt", "/llms-full.txt"];
const DISALLOW = ["/api/", "/app", "/admin", "/build", "/join/", "/view/", "/login", "/tree", "/intake"];

/** AI assistants that fetch a page to answer a person's question (they may quote and link to us) */
const AI_SEARCH = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];
/** crawlers that gather text to train AI models; allowed unless AI_TRAINING_CRAWLERS=block is set in Vercel */
const AI_TRAINING = ["GPTBot", "ClaudeBot", "anthropic-ai", "Google-Extended", "Applebot-Extended", "CCBot"];

/** public pages may be found; accounts, trees, shared views, admin and the API may not. A bot with its own group ignores the "*" group, so each repeats the lists. */
export default function robots(): MetadataRoute.Robots {
  if (isStaging()) return { rules: [{ userAgent: "*", disallow: "/" }] }; // the test copy must never appear in search results
  const blockTraining = process.env.AI_TRAINING_CRAWLERS?.trim().toLowerCase() === "block";
  const rules: MetadataRoute.Robots["rules"] = [
    { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
    { userAgent: AI_SEARCH, allow: ALLOW, disallow: DISALLOW },
    blockTraining ? { userAgent: AI_TRAINING, disallow: "/" } : { userAgent: AI_TRAINING, allow: ALLOW, disallow: DISALLOW },
  ];
  return { rules, sitemap: `${siteUrl()}/sitemap.xml`, host: siteUrl() };
}
