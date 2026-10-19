/**
 * The PAAG WhatsApp community: the one place where families talk to each other and share ideas.
 * The invite link is set in Vercel (NEXT_PUBLIC_WA_COMMUNITY_URL); until it is set, no button is shown anywhere.
 * Only a real WhatsApp invite address is accepted, so a typing mistake can never send people to another site.
 */
const ALLOWED = /^https:\/\/(chat\.whatsapp\.com\/[A-Za-z0-9_-]{6,}|(www\.)?whatsapp\.com\/(channel|invite)\/[A-Za-z0-9_-]{6,}|wa\.me\/[A-Za-z0-9/_-]+)(\?[^\s]*)?$/i;

/** the cleaned invite link, or undefined when none is set (or it is not a WhatsApp address) */
export function cleanCommunityUrl(raw: string | undefined | null): string | undefined {
  const v = (raw ?? "").trim();
  return v && ALLOWED.test(v) ? v : undefined;
}

// each name must be written out in full: Next.js only puts a NEXT_PUBLIC value into the page when it sees the exact name
export const communityUrl = () => cleanCommunityUrl(process.env.NEXT_PUBLIC_WA_COMMUNITY_URL) ?? cleanCommunityUrl(process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL);

/** the words used on every button and card, in English and Hindi */
export const COMMUNITY_TEXT = {
  en: { cta: "Join our WhatsApp community", line: "Talk with other Maithil families, ask questions and share ideas." },
  hi: { cta: "हमारे व्हाट्सऐप समुदाय से जुड़िए", line: "दूसरे मैथिल परिवारों से बात कीजिए, सवाल पूछिए और विचार बाँटिए।" },
} as const;
