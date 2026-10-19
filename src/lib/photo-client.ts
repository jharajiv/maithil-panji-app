// browser only: makes a picked photo small enough to store
/** Largest photo we keep per person (characters of the data URL) — must stay below the server limit in lib/sanitize.ts. */
export const MAX_PHOTO_CHARS = 70_000;

async function decode(file: File): Promise<{ w: number; h: number; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void }> {
  try {
    const bmp = await createImageBitmap(file);
    return { w: bmp.width, h: bmp.height, draw: (c, w, h) => c.drawImage(bmp, 0, 0, w, h) };
  } catch {
    // some phones / browsers cannot decode certain formats with createImageBitmap — fall back to an <img>
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("decode")); i.src = url; });
      return { w: img.naturalWidth, h: img.naturalHeight, draw: (c, w, h) => c.drawImage(img, 0, 0, w, h) };
    } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }
}

/** Downscale a picked photo to a small JPEG data URL, shrinking further until it is safely small to store and share. */
export async function shrink(file: File): Promise<string> {
  const src = await decode(file);
  if (!src.w || !src.h) throw new Error("empty");
  for (const [max, q] of [[320, 0.82], [320, 0.7], [256, 0.7], [200, 0.65], [160, 0.6]] as const) {
    const k = Math.min(1, max / Math.max(src.w, src.h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(src.w * k)); c.height = Math.max(1, Math.round(src.h * k));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    src.draw(ctx, c.width, c.height);
    const url = c.toDataURL("image/jpeg", q);
    if (url.length <= MAX_PHOTO_CHARS) return url;
  }
  throw new Error("too big");
}

