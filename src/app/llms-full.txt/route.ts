import { isStaging } from "@/lib/env";
import { llmsFullTxt } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
  if (isStaging()) return new Response("Not found", { status: 404 });
  return new Response(llmsFullTxt(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
