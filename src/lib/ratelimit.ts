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

/** how many DIFFERENT things one visitor has asked for in a window — opening many different trees in an hour is copying, not looking */
const seen = new Map<string, Map<string, Map<string, number>>>();
export function distinctLimited(bucket: string, ip: string, item: string, max: number, windowMs = 60 * 60_000): boolean {
  const b = seen.get(bucket) ?? new Map<string, Map<string, number>>();
  seen.set(bucket, b);
  const now = Date.now();
  const mine = b.get(ip) ?? new Map<string, number>();
  for (const [k, t] of mine) if (now - t > windowMs) mine.delete(k);
  mine.set(item, now);
  b.set(ip, mine);
  if (b.size > 5000) b.clear();
  return mine.size > max;
}
