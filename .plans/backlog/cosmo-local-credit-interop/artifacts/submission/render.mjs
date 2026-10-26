// Renders the two submission one-pagers, the Business Model Canvas and the logical architecture,
// to PDF and PNG after checking them. Usage, from the repository root (needs a Playwright install
// on NODE_PATH; see ../README.md):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/submission/render.mjs
// Checks, per page: exactly one A4 landscape page, nothing past its margins or into its footer,
// every image loaded, no em dash, and, with pdftotext installed, every word of the PDF inside the
// page. Outputs render into a staging folder and replace the files in output/ only when every
// check passes, so a failed render exits with status 1 and leaves the last good files in place.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const PAGES = ["business-model-canvas", "logical-architecture"];
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
const problems = [];

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
mkdirSync(out, { recursive: true });
const staging = mkdtempSync(join(out, ".render-"));
const browser = await pw.chromium.launch({ args: ["--allow-file-access-from-files"] });

for (const name of PAGES) {
  const htmlPath = join(here, `${name}.html`);
  const html = readFileSync(htmlPath, "utf8");
  if (/—/.test(html)) problems.push(`${name}: an em dash (U+2014) is present; the brand voice forbids it`);

  const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // fonts.ready also resolves when the Google Fonts stylesheet failed, and the page would then
  // render in Georgia and the system sans with different line breaks, so both faces must be loaded.
  // Each face the page uses is loaded on purpose and must come back loaded: one face of a family
  // loading says nothing about its italic or its other weights.
  const missingFonts = await page.evaluate(async () => {
    const missing = [];
    for (const spec of ["400 16px Fraunces", "italic 400 16px Fraunces", "500 16px Fraunces", "400 16px Inter", "500 16px Inter", "600 16px Inter"]) {
      const faces = await document.fonts.load(spec, "Aa").catch(() => []);
      if (!faces.length || faces.some((f) => f.status !== "loaded")) missing.push(spec);
    }
    return missing;
  });
  if (missingFonts.length) problems.push(`${name}: font face(s) not loaded, so the page fell back: ${missingFonts.join(", ")}`);
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
      for (const el of pg.querySelectorAll("h1, h2, h3, p, li, td, th, dt, dd, figure, img, table, svg, .block, .band, .box")) {
        if (el.closest(".foot, defs")) continue;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        const label = `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("alt") || "").trim().slice(0, 40)}"`;
        if (r.bottom > foot.top - 6) issues.push(`page ${i + 1}: runs into the footer (bottom ${Math.round(r.bottom - box.top)}px): ${label}`);
        if (r.left < left || r.right > right) issues.push(`page ${i + 1}: outside the side margins: ${label}`);
        if (r.top < top) issues.push(`page ${i + 1}: above the top margin (top ${Math.round(r.top - box.top)}px): ${label}`);
        // A block whose content overflows its own box is clipped in print, and a band's overflow
        // spills into the band below it (the services band did, by 9px), so report both here.
        if (el.matches(".block, .box, .band") && el.scrollHeight > el.clientHeight + 1) issues.push(`page ${i + 1}: content overflows its box by ${el.scrollHeight - el.clientHeight}px: ${label}`);
      }
      for (const img of pg.querySelectorAll("img")) if (!(img.complete && img.naturalWidth > 0)) issues.push(`page ${i + 1}: image did not load: ${img.getAttribute("src")}`);
    });
    return { count: pages.length, issues: [...new Set(issues)] };
  });
  if (report.count !== 1) problems.push(`${name}: expected 1 page, found ${report.count}`);
  for (const issue of report.issues) problems.push(`${name}: ${issue}`);

  const pdf = join(staging, `${name}.pdf`);
  await page.pdf({ path: pdf, width: "297mm", height: "210mm", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const png = join(staging, `${name}.png`);
  await (await page.$(".page")).screenshot({ path: png });
  await page.close();

  // Every word of the PDF must sit inside its page; a word past the page edge is a fragmented block.
  let bbox = null;
  try { bbox = execFileSync("pdftotext", ["-bbox", pdf, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); } catch (error) {
    // Only a missing binary is optional; any other failure must fail the check, or an unreadable PDF would pass.
    if (error.code === "ENOENT") console.log(`${name}: pdftotext not installed, word positions not checked`);
    else problems.push(`${name}: pdftotext failed: ${String(error.message).split("\n")[0]}`);
  }
  if (bbox) {
    const pdfPages = [...bbox.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)];
    if (pdfPages.length !== 1) problems.push(`${name}: the PDF has ${pdfPages.length} pages, expected 1`);
    pdfPages.forEach(([, w, h, body], i) => {
      // Coordinates can be negative for a word above or left of the page, which is exactly the
      // overflow this check exists to catch, so the pattern accepts a sign.
      for (const [, xMin, yMin, xMax, yMax, word] of body.matchAll(/<word xMin="(-?[\d.]+)" yMin="(-?[\d.]+)" xMax="(-?[\d.]+)" yMax="(-?[\d.]+)">([^<]*)<\/word>/g)) {
        if (+yMin < -0.5 || +yMax > +h + 0.5 || +xMin < -0.5 || +xMax > +w + 0.5) problems.push(`${name}: PDF page ${i + 1} has a word outside the page: "${word}"`);
      }
    });
  }
}
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
// The backup completes before any output is touched: a copy that fails leaves output/ as it was.
try {
  for (const name of names) if (existsSync(join(out, name))) copyFileSync(join(out, name), join(backup, name));
} catch (error) {
  for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
  throw new Error(`${error.message}; nothing in output/ was replaced`);
}
// Only the names that were promoted are rolled back, each on its own, so one that cannot be
// removed never stops the rest from being restored.
const promoted = [];
try {
  for (const name of names) { renameSync(join(staging, name), join(out, name)); promoted.push(name); console.log(join(out, name)); }
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
console.log(`submission checks: ${PAGES.length} one-pagers, nothing past the margins, into a footer or out of a box, images loaded, PDF words in place`);
