/**
 * Which copy of the site is this? "production" is https://paag.org.in. "staging" is the test copy (https://staging.paag.org.in) where a change
 * is tried before it goes live. Set NEXT_PUBLIC_APP_ENV=staging for the staging copy in Vercel (Preview scope); Vercel's own preview
 * deployments are also treated as staging. A staging copy: shows a banner, asks search engines to stay away, and sends email only to addresses
 * you list in STAGING_MAIL_ALLOW — so a test can never write to real people.
 */
export const isStaging = () =>
  process.env.NEXT_PUBLIC_APP_ENV === "staging" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "preview";

export const envName = (): "staging" | "production" | "development" => (isStaging() ? "staging" : process.env.NODE_ENV === "production" ? "production" : "development");

/** STAGING_MAIL_ALLOW="me@example.com, @myvyoma.io" — full addresses or whole domains (starting with @). Empty = no email leaves a staging copy. */
export function stagingMailAllowed(to: string): boolean {
  const list = (process.env.STAGING_MAIL_ALLOW ?? "").split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const a = to.trim().toLowerCase();
  return list.some((x) => (x.startsWith("@") ? a.endsWith(x) : a === x));
}
