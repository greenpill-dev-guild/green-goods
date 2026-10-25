// Checks the deck, then renders every slide to PNG, a contact sheet and the whole deck to PDF.
// Usage, from the repository root (rendering needs a Playwright install on NODE_PATH):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs              check, then render to ./output
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs --check      checks only, no browser
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs --sync       copy the Markdown notes into index.html, then check
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs --only=3,7   render and probe only those slides
// Source checks: 18 slides, the corner symbol on every slide, slide numbers in order (the title and
// the closing slide carry none), the HTML notes equal the Markdown notes, data-time equals each
// notes heading, the spoken timings total 8:00, and no em dashes. While rendering it also reports
// text outside the 128px side margins or in the corner band, text or artwork over the headline,
// artwork over the corner symbol, any headline over two lines (three on the title), any image
// that did not load, and any block whose layout box (before transforms) leaves the slide, because
// print lays blocks out before transforms and fragments what overruns the page. After the PDF it
// checks, with pdftotext where installed, that every word sits inside its page.
// A failed check exits with status 1 after reporting.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const EXPECTED_SLIDES = 18;
const EXPECTED_SECONDS = 8 * 60;
const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "index.html");
const notesPath = join(here, "speaker-notes.md");
const out = join(here, "output");
const argv = process.argv.slice(2);
const args = new Set(argv);
const only = (argv.find((a) => a.startsWith("--only=")) || "").replace("--only=", "").split(",").filter(Boolean).map(Number);
const problems = [];
const note = (message) => problems.push(message);

// Markdown notes: one "## N. Label · m:ss" heading followed by one paragraph each.
function markdownNotes(markdown) {
  const lines = markdown.split("\n");
  const notes = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^## (\d+)\. (.+?) · (\d+:\d\d)$/);
    if (!match) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j += 1;
    const paragraph = [];
    while (j < lines.length && lines[j].trim() !== "" && !lines[j].startsWith("## ")) {
      paragraph.push(lines[j].trim());
      j += 1;
    }
    notes.push({ index: Number(match[1]), label: match[2], timing: match[3], text: paragraph.join(" ") });
  }
  return notes;
}

function htmlNotes(html) {
  const match = html.match(/<script type="application\/json" id="speaker-notes">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("index.html has no #speaker-notes JSON block");
  return { raw: match[0], notes: JSON.parse(match[1]) };
}

const seconds = (label) => {
  const match = /^(\d+):(\d\d)$/.exec(label || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const clock = (total) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

let html = readFileSync(htmlPath, "utf8");
const markdown = readFileSync(notesPath, "utf8");
const mdNotes = markdownNotes(markdown);

if (args.has("--sync")) {
  const { raw } = htmlNotes(html);
  const json = JSON.stringify(mdNotes.map((n) => n.text), null, 2).replace(/<\//g, "<\\/");
  html = html.replace(raw, `<script type="application/json" id="speaker-notes">\n${json}\n</script>`);
  writeFileSync(htmlPath, html);
  console.log(`synced ${mdNotes.length} notes into index.html`);
}

// Structural checks on the source.
const slides = [...html.matchAll(/<section class="slide([^"]*)" data-label="([^"]+)" data-time="([^"]+)">/g)]
  .map((m) => ({ label: m[2], time: m[3] }));
if (slides.length !== EXPECTED_SLIDES) note(`expected ${EXPECTED_SLIDES} slides, found ${slides.length}`);
html.split(/<section class="slide/).slice(1).forEach((block, i) => {
  const body = block.split("</section>")[0];
  if (!/class="corner"/.test(body)) note(`slide ${i + 1} has no corner symbol`);
  if (i === 0) return; // the title carries the event line instead of a number
  if (block.startsWith(" s-thanks")) return; // the closing slide keeps only the thank-you, the link, its code and the symbol
  const m = body.match(/<span class="num">(\d+) \/ (\d+)<\/span>/);
  if (!m) note(`slide ${i + 1} has no slide number`);
  else if (Number(m[1]) !== i + 1 || Number(m[2]) !== EXPECTED_SLIDES) note(`slide ${i + 1} is numbered "${m[1]} / ${m[2]}"`);
});

const { notes: embedded } = htmlNotes(html);
if (mdNotes.length !== EXPECTED_SLIDES) note(`speaker-notes.md has ${mdNotes.length} slide sections, expected ${EXPECTED_SLIDES}`);
if (embedded.length !== mdNotes.length) note(`index.html embeds ${embedded.length} notes, speaker-notes.md has ${mdNotes.length}`);
mdNotes.forEach((n, i) => {
  if (n.index !== i + 1) note(`notes heading ${i + 1} is numbered ${n.index}`);
  if (embedded[i] !== n.text) note(`note ${i + 1} differs between index.html and speaker-notes.md (run --sync)`);
  if (slides[i] && slides[i].time !== n.timing) note(`slide ${i + 1} data-time "${slides[i].time}" differs from the notes heading "${n.timing}"`);
  if (slides[i] && slides[i].label !== n.label) note(`slide ${i + 1} label "${slides[i].label}" differs from the notes heading "${n.label}"`);
});
const spoken = mdNotes.map((n) => seconds(n.timing));
const total = spoken.reduce((a, b) => a + (b || 0), 0);
if (total !== EXPECTED_SECONDS) note(`timings total ${clock(total)}, expected ${clock(EXPECTED_SECONDS)}`);
if (/\u2014/.test(html) || /\u2014/.test(markdown)) note("an em dash (U+2014) is present; the brand voice forbids it");

console.log(`source checks: ${slides.length} slides, ${mdNotes.length} notes, timings ${clock(total)}${problems.length ? "" : ", all good"}`);
for (const p of problems) console.log(`  problem: ${p}`);
if (args.has("--check") || args.has("--sync")) process.exit(problems.length ? 1 : 0);

// Render.
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const { chromium } = pw;
mkdirSync(out, { recursive: true });
const url = pathToFileURL(htmlPath).href;

const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: "light" });
const page = await context.newPage();
const targets = only.length ? only : slides.map((_, i) => i + 1);
const files = [];
for (const i of targets) {
  await page.goto(`${url}?static=1&slide=${i}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const report = await page.evaluate((isTitle) => {
    const slide = document.querySelector(".slide.active");
    const issues = [];
    const corner = slide.querySelector(".corner").getBoundingClientRect();
    const h1 = slide.querySelector("h1");
    const h1r = h1.getBoundingClientRect();
    const name = (el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("alt") || "").trim().slice(0, 40)}"`;
    const visible = (r) => r.width > 0 || r.height > 0;
    // A cropped screen is measured by its frame, which clips it, rather than by the whole image.
    const texts = [...slide.querySelectorAll("h1, h2, h3, p, li, figcaption, span, text, img, .frame")]
      .filter((el) => !el.closest(".num, .event, .corner, defs, marker, .bar") && !el.matches(".corner") && !(el.matches("img") && el.closest(".frame")));
    for (const el of texts) {
      const r = el.getBoundingClientRect();
      if (!visible(r)) continue;
      if (r.left < 127.5 || r.right > 1792.5) issues.push(`outside the side margins (${Math.round(r.left)}..${Math.round(r.right)}): ${name(el)}`);
      if (r.top < 0 || r.bottom > corner.top - 16) issues.push(`runs into the corner band (bottom ${Math.round(r.bottom)} > ${Math.round(corner.top - 16)}): ${name(el)}`);
      if (el !== h1 && !h1.contains(el) && r.top < h1r.bottom + 12 && r.bottom > h1r.top && r.right > h1r.left && r.left < h1r.right) issues.push(`overlaps the headline: ${name(el)}`);
    }
    for (const g of slide.querySelectorAll("svg.art line, svg.art path, svg.art circle")) {
      if (g.closest("defs, marker")) continue;
      const r = g.getBoundingClientRect();
      if (!visible(r)) continue;
      if (r.top < h1r.bottom + 8 && r.bottom > h1r.top && r.right > h1r.left && r.left < h1r.right) issues.push(`artwork touches the headline: ${g.tagName} ${g.getAttribute("class") || ""}`);
      if (r.bottom > corner.top - 8 && r.left < corner.right + 8) issues.push(`artwork touches the corner symbol: ${g.tagName}`);
    }
    const lines = Math.round(h1r.height / parseFloat(getComputedStyle(h1).lineHeight));
    if (lines > (isTitle ? 3 : 2)) issues.push(`headline runs to ${lines} lines`);
    // Layout boxes ignore transforms (offsetTop does, getBoundingClientRect does not), which is what print paginates by.
    for (const el of slide.querySelectorAll("div, figure, h1, h2, h3, p, ul, li, img")) {
      if (!el.offsetHeight || el.closest(".num, .event, .corner") || el.matches(".corner")) continue;
      if (el.matches("img") && el.closest(".frame")) continue; // cropped by its frame on purpose
      let top = 0;
      for (let n = el; n && n !== slide; n = n.offsetParent) top += n.offsetTop;
      if (top < -0.5 || top + el.offsetHeight > 1080.5) issues.push(`layout box leaves the page before transforms (${Math.round(top)}..${Math.round(top + el.offsetHeight)}): ${name(el)}`);
    }
    for (const img of slide.querySelectorAll("img")) {
      if (!(img.complete && img.naturalWidth > 0)) issues.push(`image did not load: ${img.getAttribute("src")}`);
    }
    return { issues: [...new Set(issues)], lines };
  }, i === 1);
  for (const issue of report.issues) note(`slide ${i} (${slides[i - 1].label}): ${issue}`);
  const file = join(out, `slide-${String(i).padStart(2, "0")}.png`);
  await page.screenshot({ path: file, type: "png", clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  files.push({ i, file, lines: report.lines });
  console.log(`${file} (headline ${report.lines} line${report.lines === 1 ? "" : "s"})`);
}

if (!only.length) {
  // Contact sheet: every slide at 480 x 270, four per row. Loaded from a file so local images resolve.
  const sheetHtml = join(out, "contact-sheet.html");
  writeFileSync(sheetHtml, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#1C1917;padding:24px;width:2064px;font:500 14px Inter,system-ui,sans-serif;color:#A8A29E">
<div style="display:grid;grid-template-columns:repeat(4,480px);gap:24px">${files.map(({ i, file }) => `<figure style="margin:0"><img src="${pathToFileURL(file).href}" width="480" height="270" style="display:block;outline:1px solid #44403C"><figcaption style="margin-top:6px">${i} · ${slides[i - 1].label.replace(/&/g, "&amp;")}</figcaption></figure>`).join("")}</div></body></html>`);
  await page.setViewportSize({ width: 2112, height: 1200 });
  await page.goto(pathToFileURL(sheetHtml).href, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const sheetFile = join(out, "contact-sheet.png");
  await page.screenshot({ path: sheetFile, type: "png", fullPage: true });
  console.log(sheetFile);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${url}?static=1&slide=1`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print" });
  const pdf = join(out, "deck.pdf");
  await page.pdf({ path: pdf, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  console.log(pdf);

  // Every word of the PDF must sit inside its page; a word past the page edge is a fragmented block.
  let bbox = null;
  try { bbox = execFileSync("pdftotext", ["-bbox", pdf, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); } catch { console.log("pdf check: pdftotext not installed, word positions not checked"); }
  if (bbox) {
    const pages = [...bbox.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)];
    if (pages.length !== EXPECTED_SLIDES) note(`deck.pdf has ${pages.length} pages, expected ${EXPECTED_SLIDES}`);
    pages.forEach(([, w, h, body], i) => {
      for (const [, xMin, yMin, xMax, yMax, word] of body.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)) {
        if (+yMin < -0.5 || +yMax > +h + 0.5 || +xMin < -0.5 || +xMax > +w + 0.5) note(`page ${i + 1}: word outside the page (${Math.round(+xMin)},${Math.round(+yMin)} to ${Math.round(+xMax)},${Math.round(+yMax)} of ${Math.round(+w)}x${Math.round(+h)}): "${word}"`);
      }
    });
    console.log(`pdf check: ${pages.length} pages, word positions read`);
  }
}
await browser.close();

if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log("render checks: margins, corner band, headline clearance, headline length, images, layout boxes and PDF word positions all clean");
