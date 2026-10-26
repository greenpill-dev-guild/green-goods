// Checks the built demo, then walks every flow in a headless browser.
// Usage, from the repository root, after build.mjs (needs a Playwright install on NODE_PATH):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/check.mjs
// Source checks: no em dash in the demo's HTML or Markdown; every caption at most eight words and
// free of "commitment", "chain", "blockchain", "Arbitrum", "Celo", "Gnosis" and "live"; every tile
// line five words; a hotspot on every screen except each flow's last; a build newer than index.html
// and every screen; under 15 MB.
// Rendered checks (Chromium, light, 1440x900): four tiles with loaded thumbnails; each flow walked by
// clicking its hotspots, with each step's image loaded and its caption changed; a tap beside the
// hotspot does not advance; Right, Left and Escape, Back and Restart, and a #work-3 deep link work;
// "Try another flow" returns to the landing; no request leaves the page except Google Fonts; no
// console errors. Then 390x844 without sideways scroll, and dark mode. Every step is screenshot to
// ./output/ with a contact sheet. A failed check exits with status 1 after reporting.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
const built = join(out, "green-goods-sf-live-demo.html");
const problems = [];
const note = (message) => { problems.push(message); console.log(`  problem: ${message}`); };
const BANNED = /\b(commitments?|chain|blockchain|arbitrum|celo|gnosis|live)\b/i;

if (!existsSync(built)) { console.log(`no ${built}; run build.mjs first`); process.exit(1); }
const html = readFileSync(built, "utf8");
const { flows } = JSON.parse(html.match(/<script type="application\/json" id="flows">([\s\S]*?)<\/script>/)[1]);
const screens = flows.flatMap((f) => f.screens);

// Source checks.
const newest = Math.max(statSync(join(here, "index.html")).mtimeMs, ...screens.map((s) => statSync(join(here, "assets", "screens", `${s.file}.jpg`)).mtimeMs));
if (statSync(built).mtimeMs < newest) note("the build is older than index.html or a screen; run build.mjs");
if (statSync(built).size > 15 * 1024 * 1024) note(`the build is ${(statSync(built).size / 1048576).toFixed(1)} MB, over 15 MB`);
const prose = [built, join(here, "index.html"), ...readdirSync(here).filter((f) => f.endsWith(".md")).map((f) => join(here, f))];
for (const file of prose) if (/—/.test(readFileSync(file, "utf8"))) note(`an em dash (U+2014) is in ${file.replace(`${here}/`, "")}`);
if (flows.length !== 4) note(`expected four flows, found ${flows.length}`);
for (const flow of flows) {
  if (flow.line.split(/\s+/).length !== 5) note(`${flow.id}: the tile line "${flow.line}" is not five words`);
  flow.screens.forEach((s, i) => {
    const last = i === flow.screens.length - 1;
    if (s.caption.split(/\s+/).length > 8) note(`${s.file}: the caption "${s.caption}" is over eight words`);
    if (BANNED.test(s.caption)) note(`${s.file}: the caption "${s.caption}" uses "${s.caption.match(BANNED)[0]}"`);
    if (!last && !s.hotspot) note(`${s.file}: no hotspot`);
    if (last && s.hotspot) note(`${s.file}: the last screen has a hotspot`);
    if (!s.story) note(`${s.file}: no source recorded`);
  });
}
console.log(`source checks: ${flows.length} flows, ${screens.length} screens, ${(statSync(built).size / 1048576).toFixed(2)} MB`);

// Rendered checks.
const { chromium } = pw;
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const url = pathToFileURL(built).href;
async function openPage(options) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  page.on("request", (r) => { if (!/^(data:|file:|blob:|https:\/\/fonts\.(googleapis|gstatic)\.com\/)/.test(r.url())) note(`request outside the page: ${r.url()}`); });
  page.on("console", (m) => { if (m.type() === "error") note(`console error: ${m.text()}`); });
  page.on("pageerror", (e) => note(`page error: ${e.message}`));
  return { context, page };
}
const shotLoaded = (page) => page.waitForFunction(() => { const img = document.getElementById("shot"); return img.complete && img.naturalWidth > 0; }, null, { timeout: 5000 }).then(() => true, () => false);
const state = (page) => page.evaluate(() => ({ view: document.body.dataset.view, flow: document.body.dataset.flow, step: Number(document.body.dataset.step), caption: document.getElementById("caption").textContent }));

const { context, page } = await openPage();
await page.goto(url, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const tiles = await page.$$eval(".tile", (els) => els.map((el) => ({ id: el.id, loaded: [...el.querySelectorAll("img")].every((img) => img.complete && img.naturalWidth > 0) })));
if (tiles.length !== 4) note(`the landing shows ${tiles.length} tiles, expected four`);
for (const t of tiles) if (!t.loaded) note(`${t.id}: its thumbnail did not load`);
await page.screenshot({ path: join(out, "landing.png") });
const steps = [];
for (const flow of flows) {
  await page.click(`#tile-${flow.id}`);
  let previous = "";
  for (let i = 0; i < flow.screens.length; i += 1) {
    const s = flow.screens[i];
    const last = i === flow.screens.length - 1;
    if (!(await shotLoaded(page))) note(`${s.file}: the screen image did not load`);
    const now = await state(page);
    if (now.view !== "flow" || now.flow !== flow.id || now.step !== i + 1) note(`${s.file}: expected ${flow.id} step ${i + 1}, found ${JSON.stringify(now)}`);
    if (now.caption !== s.caption) note(`${s.file}: caption "${now.caption}" differs from "${s.caption}"`);
    if (now.caption === previous) note(`${s.file}: the caption did not change`);
    previous = now.caption;
    const file = join(out, `${s.file}.png`);
    await page.screenshot({ path: file });
    steps.push(file);
    const hot = await page.locator("#hotspot").boundingBox();
    if (last) {
      if (hot) note(`${s.file}: a hotspot shows on the last screen`);
      if (await page.locator("#another").isVisible()) await page.click("#another");
      else { note(`${s.file}: "Try another flow" is not visible`); await page.keyboard.press("Escape"); }
      if ((await state(page)).view !== "landing") note(`${flow.id}: "Try another flow" did not return to the landing`);
      continue;
    }
    if (!hot || hot.width < 24 || hot.height < 24) { note(`${s.file}: the hotspot is missing or too small`); await page.keyboard.press("Escape"); break; }
    const scr = await page.locator("#screen").boundingBox();
    if (hot.x < scr.x - 8 || hot.y < scr.y - 8 || hot.x + hot.width > scr.x + scr.width + 8 || hot.y + hot.height > scr.y + scr.height + 8) note(`${s.file}: the hotspot leaves the screen`);
    if (i === 0) {
      // A tap beside the hotspot must not advance.
      const corners = [[scr.x + 14, scr.y + 14], [scr.x + scr.width - 14, scr.y + 14], [scr.x + 14, scr.y + scr.height - 14], [scr.x + scr.width - 14, scr.y + scr.height - 14]];
      const [mx, my] = corners.find(([x, y]) => x < hot.x || x > hot.x + hot.width || y < hot.y || y > hot.y + hot.height);
      await page.mouse.click(mx, my);
      if ((await state(page)).step !== 1) note(`${flow.id}: a tap beside the hotspot advanced the flow`);
    }
    await page.click("#hotspot");
  }
}
// Keys, Back, Restart and a deep link.
await page.click("#tile-promise");
await page.keyboard.press("ArrowRight");
if ((await state(page)).step !== 2) note("Right arrow did not advance");
await page.keyboard.press("ArrowLeft");
if ((await state(page)).step !== 1) note("Left arrow did not go back");
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
await page.click("#back");
if ((await state(page)).step !== 2) note("Back did not go back");
await page.click("#restart");
if ((await state(page)).step !== 1) note("Restart did not return to the first screen");
await page.keyboard.press("Escape");
if ((await state(page)).view !== "landing") note("Escape did not return to the landing");
await page.goto(`${url}#work-3`, { waitUntil: "load" });
const deep = await state(page);
if (deep.flow !== "work" || deep.step !== 3) note(`the #work-3 link opened ${JSON.stringify(deep)}`);
await context.close();

// Phone width and dark mode.
for (const [name, options, hash] of [["phone-landing", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, ""], ["phone-promise", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, "#promise-1"], ["phone-funding", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, "#funding-2"], ["dark-landing", { colorScheme: "dark" }, ""], ["dark-needs", { colorScheme: "dark" }, "#needs-3"]]) {
  const { context: c, page: p } = await openPage(options);
  await p.goto(`${url}${hash}`, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  if (hash && !(await shotLoaded(p))) note(`${name}: the screen image did not load`);
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (wide > 0) note(`${name}: the page scrolls sideways by ${wide}px`);
  if (name.startsWith("dark")) {
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
    if (bg.reduce((a, b) => a + b, 0) / 3 > 80) note(`${name}: the background is not dark (${bg})`);
  }
  await p.screenshot({ path: join(out, `${name}.png`) });
  await c.close();
}

// Contact sheet of every step.
const sheet = join(out, "contact-sheet.html");
writeFileSync(sheet, `<!DOCTYPE html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#EEE8DE;font:600 18px Inter,system-ui,sans-serif;color:#292524}main{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}figure{margin:0}img{width:100%;display:block;border:1px solid #D9D1C5}figcaption{margin-top:6px}</style><main>${steps.map((f) => `<figure><img src="${pathToFileURL(f).href}"><figcaption>${f.split("/").pop().replace(".png", "")}</figcaption></figure>`).join("")}</main>`);
{
  const { context: c, page: p } = await openPage({ viewport: { width: 2400, height: 1200 } });
  await p.goto(pathToFileURL(sheet).href, { waitUntil: "load" });
  await p.screenshot({ path: join(out, "contact-sheet.png"), fullPage: true });
  await c.close();
}
await browser.close();
console.log(`rendered checks: ${steps.length} steps screenshot to ${out}, contact sheet written${problems.length ? "" : ", all good"}`);
process.exit(problems.length ? 1 : 0);
