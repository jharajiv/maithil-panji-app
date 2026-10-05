/* Tiny in-memory limiter. Serverless instances do not share memory, so this is a speed bump, not a guarantee —
   add Upstash/Redis limiting before a public launch. */
const buckets = new Map<string, Map<string, number[]>>();

export function limited(bucket: string, ip: string, max: number, windowMs = 10 * 60_000): boolean {
  const hits = buckets.get(bucket) ?? new Map<string, number[]>();
  buckets.set(bucket, hits);
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
