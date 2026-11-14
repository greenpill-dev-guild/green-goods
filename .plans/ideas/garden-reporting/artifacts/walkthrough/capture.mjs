// Captures the walkthrough's screens from a running Storybook and measures, on each, the
// hotspot, the app control that goes back, and the parts the prototype adds. Writes
// output/screens/<id>.webp and output/boxes.json (boxes as fractions of the viewport).
// Usage, from the repository root with Storybook running:
//   node .plans/ideas/garden-reporting/artifacts/walkthrough/capture.mjs "$PWD" [baseUrl] [screenId...]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCREENS, VIEWPORT } from "./screens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [repoRoot, base = "http://127.0.0.1:3004", ...only] = process.argv.slice(2);
const require = createRequire(join(repoRoot, "package.json"));
const { chromium } = require("@playwright/test");
const sharp = require("sharp");
const outDir = join(here, "output", "screens");
mkdirSync(outDir, { recursive: true });
const boxesFile = join(here, "output", "boxes.json");
const boxes = existsSync(boxesFile) ? JSON.parse(readFileSync(boxesFile, "utf8")) : {};

function locate(page, target) {
  let locator = target.role
    ? page.getByRole(target.role, { name: target.name })
    : page.locator(target.css);
  if (target.hasText) locator = locator.filter({ hasText: target.hasText });
  return target.nth === undefined ? locator.first() : locator.nth(target.nth);
}

async function box(page, target) {
  if (!target) return null;
  const found = await locate(page, target).boundingBox({ timeout: 5000 }).catch(() => null);
  if (!found) throw new Error(`target not found: ${JSON.stringify(target)}`);
  const round = (value) => Math.round(value * 10000) / 10000;
  return {
    x: round(found.x / VIEWPORT.width),
    y: round(found.y / VIEWPORT.height),
    w: round(found.width / VIEWPORT.width),
    h: round(found.height / VIEWPORT.height),
    ...(target.label ? { label: target.label } : {}),
  };
}

const browser = await chromium.launch();
const report = [];
for (const screen of SCREENS.filter((item) => only.length === 0 || only.includes(item.id))) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 200));
  });
  // Not "networkidle": the dev server's style updates keep the network busy.
  await page.goto(`${base}/iframe.html?viewMode=story&id=${screen.story}&globals=theme:light`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector('[data-component="LabCanvas"]', { timeout: 60_000 });
  // A screen that follows a press: make it, as the steward would.
  if (screen.click) await locate(page, screen.click).click();
  if (screen.dialog) await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
  await page.evaluate(() => document.fonts.ready);
  // Decode what is on screen; a lazy image below the fold never loads, so never wait on it.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        [...document.images]
          .filter((image) => image.getBoundingClientRect().top < innerHeight)
          .map((image) => image.decode().catch(() => undefined))
      ),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])
  );
  // A card further down the tab: scroll the main area so it sits just under the sticky header.
  if (screen.scrollTo) {
    await page.evaluate((css) => {
      const main = document.querySelector('[data-region="main-scroll-area"]');
      const target = document.querySelector(css);
      if (!main || !target) throw new Error(`scroll target missing: ${css}`);
      const sticky = [...main.querySelectorAll("*")].find(
        (element) => getComputedStyle(element).position === "sticky"
      );
      const top = sticky ? sticky.getBoundingClientRect().bottom : main.getBoundingClientRect().top;
      main.scrollTop += target.getBoundingClientRect().top - top - 16;
    }, screen.scrollTo);
  }
  // A target inside a scrolling dialog is brought into view first, as a reader would scroll.
  if (screen.reveal) await locate(page, screen.reveal).scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const measured = {
    hotspot: await box(page, screen.hotspot),
    back: await box(page, screen.back),
    fresh: await Promise.all((screen.fresh ?? []).map((target) => box(page, target))),
  };
  // An app control scrolled off screen cannot be pressed: the screen goes without it.
  const onScreen = (b) => b && b.x >= 0 && b.y >= 0 && b.x + b.w <= 1 && b.y + b.h <= 1;
  if (measured.back && !onScreen(measured.back)) measured.back = null;
  if (!onScreen(measured.hotspot)) throw new Error(`${screen.id}: hotspot is off screen`);
  // A box that covers most of the screen is no hotspot: the steward could not miss it.
  if (measured.hotspot && measured.hotspot.w * measured.hotspot.h > 0.6) {
    throw new Error(`${screen.id}: hotspot covers over 60% of the screen`);
  }
  boxes[screen.id] = measured;
  const png = await page.screenshot({ type: "png" });
  await sharp(png).webp({ quality: 84 }).toFile(join(outDir, `${screen.id}.webp`));
  const text = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return (dialog ?? document.querySelector('[data-component="LabCanvas"]'))
      ?.innerText.replace(/\s+/g, " ")
      .slice(0, 420);
  });
  const images = await page.evaluate(() => {
    const all = [...document.images];
    return `${all.filter((image) => image.complete && image.naturalWidth > 0).length}/${all.length}`;
  });
  report.push({ id: screen.id, errors, images, text });
  await context.close();
}
await browser.close();
writeFileSync(boxesFile, JSON.stringify(boxes, null, 1));
console.log(JSON.stringify(report, null, 1));
