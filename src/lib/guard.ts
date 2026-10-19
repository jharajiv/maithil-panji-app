/**
 * Protection against copying many family trees with a program (B-109). A shared link can always be screenshotted or forwarded by a person;
 * this only makes automated bulk copying hard:
 *   - the data behind a shared link is refused to programs that say what they are (curl, python, scrapy, headless browsers…) and to requests with no browser name at all;
 *   - one visitor who opens many DIFFERENT shared trees in an hour is slowed down;
 *   - the owner can add a password to the view link (see view.ts).
 * Link previews in WhatsApp / Facebook only read the small picture and title, which do not go through the data address, so they keep working.
 */
const PROGRAM = /\b(?:curl|wget|libwww|python-requests|python-urllib|python|aiohttp|httpx|httpclient|http_client|scrapy|go-http-client|java|okhttp\/[0-9.]+ \(bot|axios|node-fetch|undici|got \(|phantomjs|headlesschrome|selenium|puppeteer|playwright|postman|insomnia|crawler|spider|scraper|bot)\b/i;

/** true when the request is clearly not a person's browser */
export function automated(req: Request): boolean {
  const ua = req.headers.get("user-agent")?.trim() ?? "";
  if (ua.length < 12) return true; // real browsers always send a long name
  return PROGRAM.test(ua);
}
