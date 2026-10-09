/** Writes the logo files in /public/brand (and the favicon) from the one drawing in src/components/brand/Logo.tsx:  npx tsx scripts/build-brand.tsx
 *  The PNG versions (paag-mark-512/192, paag-logo, apple icon) are made from these SVGs: see scripts/build-brand-png.py */
import { writeFileSync, mkdirSync } from "node:fs";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaagBadge, PaagLogo, PaagMark } from "../src/components/brand/Logo";

(globalThis as unknown as { React: typeof React }).React = React; // the script runner uses the classic JSX transform
const svg = (el: React.ReactElement) => renderToStaticMarkup(el).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
mkdirSync("public/brand", { recursive: true });
writeFileSync("public/brand/paag-mark.svg", svg(createElement(PaagMark, { size: 512, detail: "full" })));
writeFileSync("public/brand/paag-mark-small.svg", svg(createElement(PaagMark, { size: 64, detail: "icon" })));
writeFileSync("public/brand/paag-badge.svg", svg(createElement(PaagBadge, { size: 512 })));
writeFileSync("src/app/icon.svg", svg(createElement(PaagBadge, { size: 64, tiny: true })));
writeFileSync("public/brand/paag-logo.svg", svg(createElement(PaagLogo, { height: 64 })));
writeFileSync("public/brand/paag-logo-on-dark.svg", svg(createElement(PaagLogo, { height: 64, onDark: true })));
console.log("brand files written");
