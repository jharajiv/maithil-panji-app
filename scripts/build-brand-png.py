"""PNG versions of the logo (needs playwright):  python3 scripts/build-brand-png.py   (run scripts/build-brand.tsx first)"""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "public/brand")
async def render(b, svg, out, w, h, bg=None):
    pg = await b.new_page(viewport={"width": w, "height": h})
    tmp = os.path.join(os.path.dirname(svg), "_tmp.html")  # a real file, so the browser may load the picture from disk
    open(tmp, "w").write(f"<body style='margin:0;background:{bg or 'transparent'}'><img src='{os.path.basename(svg)}' style='width:{w}px;height:{h}px;display:block'></body>")
    await pg.goto("file://" + tmp)
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=out, omit_background=bg is None); await pg.close(); os.remove(tmp)
import re
def lockup_w():
    m = re.search(r'viewBox="0 0 ([0-9.]+) 64"', open(os.path.join(B, 'paag-logo.svg')).read())
    return float(m.group(1))
LW = lockup_w()
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); lh = lambda w: round(w * 64 / LW)
        await render(b, f"{B}/paag-badge.svg", f"{B}/paag-mark-512.png", 512, 512)
        await render(b, f"{B}/paag-badge.svg", f"{B}/paag-mark-192.png", 192, 192)
        await render(b, f"{B}/paag-badge.svg", f"{ROOT}/src/app/apple-icon.png", 180, 180)
        await render(b, f"{B}/paag-mark.svg", f"{B}/paag-mark.png", 900, 928)
        await render(b, f"{B}/paag-logo.svg", f"{B}/paag-logo.png", 1200, lh(1200))
        await render(b, f"{B}/paag-logo-on-dark.svg", f"{B}/paag-logo-on-dark.png", 1200, lh(1200), "#1f2a5c")
        await b.close()
asyncio.run(main())
