// Renders every slide of index.html to PNG and the whole deck to PDF.
// Usage, from the repository root:
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs
// Needs the repository's Playwright install (chromium). Writes to ./output next to this file.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const { chromium } = pw;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
mkdirSync(out, { recursive: true });
const url = pathToFileURL(join(here, "index.html")).href;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 0.5, colorScheme: "light" });
const page = await context.newPage();
await page.goto(`${url}?static=1&slide=1`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => document.querySelectorAll(".slide").length);
for (let i = 1; i <= total; i += 1) {
  await page.goto(`${url}?static=1&slide=${i}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const file = join(out, `slide-${String(i).padStart(2, "0")}.png`);
  await page.screenshot({ path: file, type: "png", clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log(file);
}
await page.goto(`${url}?static=1&slide=1`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: "print" });
const pdf = join(out, "deck.pdf");
await page.pdf({ path: pdf, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
console.log(pdf);
await browser.close();
