// Renders the companion brief to PDF and one PNG per page, after checking it.
// Usage, from the repository root (needs a Playwright install on NODE_PATH and the deck's local
// photos and screens; see ../README.md):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/brief/render.mjs
// Checks: six A4 pages, nothing past a page's margins or into its footer, every image loaded,
// and no em dash. Outputs render into a staging folder and replace the files in output/ only when
// every check passes, so a failed check exits with status 1 and leaves the last good files there.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const EXPECTED_PAGES = 6;
const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "index.html");
const out = join(here, "output");
const problems = [];
const html = readFileSync(htmlPath, "utf8");
if (/\u2014/.test(html)) problems.push("an em dash (U+2014) is present; the brand voice forbids it");

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
mkdirSync(out, { recursive: true });
const staging = mkdtempSync(join(out, ".render-"));
const browser = await pw.chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
// fonts.ready also resolves when the Google Fonts stylesheet failed, and the page would then render
// in Georgia and the system sans with different line breaks, so both faces must be loaded.
// Each face the pages use is loaded on purpose and must come back loaded: one face of a family
// loading says nothing about its italic or its other weights.
const missingFonts = await page.evaluate(async () => {
  const missing = [];
  for (const spec of ["400 16px Fraunces", "italic 400 16px Fraunces", "500 16px Fraunces", "400 16px Inter", "500 16px Inter", "600 16px Inter"]) {
    const faces = await document.fonts.load(spec, "Aa").catch(() => []);
    if (!faces.length || faces.some((f) => f.status !== "loaded")) missing.push(spec);
  }
  return missing;
});
if (missingFonts.length) problems.push(`font face(s) not loaded, so the pages fell back: ${missingFonts.join(", ")}`);
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(300);
const report = await page.evaluate(() => {
  const issues = [];
  const pages = [...document.querySelectorAll(".page")];
  pages.forEach((pg, i) => {
    const box = pg.getBoundingClientRect();
    const cs = getComputedStyle(pg);
    const left = box.left + parseFloat(cs.paddingLeft) - 0.5;
    const right = box.right - parseFloat(cs.paddingRight) + 0.5;
    const top = box.top + parseFloat(cs.paddingTop) - 0.5;
    const foot = pg.querySelector(".foot").getBoundingClientRect();
    for (const el of pg.querySelectorAll("h1, h2, h3, p, li, td, th, dt, dd, figure, img, table, svg, .box, .chain")) {
      if (el.closest(".foot, defs")) continue;
      if (el.matches("img") && el.closest(".frame, .hero")) continue; // measured by their clipping frame
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const name = `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("alt") || "").trim().slice(0, 40)}"`;
      if (r.bottom > foot.top - 6) issues.push(`page ${i + 1}: runs into the footer (bottom ${Math.round(r.bottom - box.top)}px): ${name}`);
      if (r.left < left || r.right > right) issues.push(`page ${i + 1}: outside the side margins: ${name}`);
      if (r.top < top) issues.push(`page ${i + 1}: above the top margin (top ${Math.round(r.top - box.top)}px): ${name}`);
    }
    for (const img of pg.querySelectorAll("img")) if (!(img.complete && img.naturalWidth > 0)) issues.push(`page ${i + 1}: image did not load: ${img.getAttribute("src")}`);
  });
  return { count: pages.length, issues: [...new Set(issues)] };
});
if (report.count !== EXPECTED_PAGES) problems.push(`expected ${EXPECTED_PAGES} pages, found ${report.count}`);
problems.push(...report.issues);

const pdf = join(staging, "brief.pdf");
await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
const handles = await page.$$(".page");
for (let i = 0; i < handles.length; i += 1) await handles[i].screenshot({ path: join(staging, `page-${i + 1}.png`) });
await browser.close();
if (problems.length) {
  rmSync(staging, { recursive: true, force: true });
  console.log(`${problems.length} problem(s); the files in output/ are untouched:`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
// The outputs are replaced as a set: the current files are backed up, and a rename that fails
// halfway removes every promoted name and puts the backup back.
const backup = mkdtempSync(join(out, ".previous-"));
const names = readdirSync(staging);
// The render replaces the whole set, so page images it no longer produces go too.
const stale = readdirSync(out).filter((name) => /^page-\d+\.png$/.test(name) && !names.includes(name));
// The backup completes before any output is touched: a copy that fails leaves output/ as it was.
try {
  for (const name of [...names, ...stale]) if (existsSync(join(out, name))) copyFileSync(join(out, name), join(backup, name));
} catch (error) {
  for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
  throw new Error(`${error.message}; nothing in output/ was replaced`);
}
// Only the names that were promoted are rolled back, each on its own, so one that cannot be
// removed never stops the rest from being restored.
const promoted = [];
try {
  for (const name of names) { renameSync(join(staging, name), join(out, name)); promoted.push(name); console.log(join(out, name)); }
  for (const name of stale) rmSync(join(out, name), { force: true });
} catch (error) {
  // A restore that fails keeps the backup folder and names it, so the last good output is never lost.
  const unrestored = [];
  for (const name of promoted) { try { rmSync(join(out, name), { force: true }); } catch { unrestored.push(name); } }
  for (const name of readdirSync(backup)) { try { copyFileSync(join(backup, name), join(out, name)); } catch { unrestored.push(name); } }
  rmSync(staging, { recursive: true, force: true });
  if (unrestored.length) throw new Error(`${error.message}; the rollback could not restore ${[...new Set(unrestored)].join(", ")}, so the backup is kept at ${backup}`);
  rmSync(backup, { recursive: true, force: true });
  throw new Error(`${error.message}; the previous outputs were put back`);
}
for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
console.log(`brief checks: ${report.count} pages, nothing past the margins or into a footer, images loaded`);
