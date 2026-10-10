/** Names and addresses used across the site, in one place. */
export const SITE_NAME = "Maithil Panji";
export const ORG_NAME = "PAAG Foundation";
/** PAAG = Panji Ancestry & Graph */
export const ORG_LONG = "Panji Ancestry & Graph";
export const SITE_DOMAIN = "paag.org.in";
export const TAGLINE = "Preserve your Maithil ancestry. Build a tree. Join the lineage.";

/** the public address: NEXT_PUBLIC_SITE_URL when set (use https://paag.org.in), else Vercel's production address, else local */
export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "")) ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const contactEmail = () => process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || undefined;
