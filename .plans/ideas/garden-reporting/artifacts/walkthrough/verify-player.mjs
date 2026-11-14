// Checks the built player headless: every screen keeps the bar, frame and panel blocks in one
// place and one height; each hotspot and its Next button sit inside the frame; the hotspot,
// the app's own back control, the end card, the chapter list and the keys all move as they
// should; and the page logs no errors. Saves a picture of a few screens at two widths.
// Usage: node .plans/ideas/garden-reporting/artifacts/walkthrough/verify-player.mjs "$PWD"
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [repoRoot] = process.argv.slice(2);
const { chromium } = createRequire(join(repoRoot, "package.json"))("@playwright/test");
const url = pathToFileURL(join(here, "output", "index.html")).href;
const shots = join(here, "output", "verify");
mkdirSync(shots, { recursive: true });

const BLOCKS = [".bar", "#frame", "#chapterLine", "#chapterTitle", "#where", "#caption", "#who", ".legend", ".controls"];
const problems = [];
const browser = await chromium.launch();

for (const viewport of [{ width: 1440, height: 900 }, { width: 1100, height: 760 }]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const fresh = async () => {
    await page.goto("about:blank");
    await page.goto(`${url}#hub-queue`);
    await page.waitForFunction(() => document.getElementById("shot").complete);
  };

  for (const every of [false, true]) {
    await fresh();
    if (every) await page.click("#everyBtn");
    const total = await page.evaluate(() => Number(document.getElementById("count").textContent.split("/")[1]));
    let reference = null;
    for (let index = 0; index < total; index += 1) {
      await page.waitForFunction(() => document.getElementById("shot").complete);
      const state = await page.evaluate((blocks) => {
        const rect = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
        };
        const frame = document.getElementById("frame").getBoundingClientRect();
        const inside = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return box.left >= frame.left - 1 && box.right <= frame.right + 1 && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1;
        };
        const hot = document.getElementById("hotspot").getBoundingClientRect();
        const next = document.getElementById("hotNext").getBoundingClientRect();
        const overlap = !(next.right <= hot.left || next.left >= hot.right || next.bottom <= hot.top || next.top >= hot.bottom);
        const caption = document.getElementById("caption");
        return {
          id: location.hash.slice(1),
          blocks: Object.fromEntries(blocks.map((selector) => [selector, rect(selector)])),
          hotspotInside: inside("#hotspot"),
          nextInside: inside("#hotNext"),
          overlap,
          captionClipped: caption.scrollHeight > caption.clientHeight + 1,
          count: document.getElementById("count").textContent,
        };
      }, BLOCKS);
      const where = `${viewport.width}px ${every ? "every" : "story"} ${state.id}`;
      if (!state.hotspotInside) problems.push(`${where}: hotspot outside the frame`);
      if (!state.nextInside) problems.push(`${where}: Next button outside the frame`);
      if (state.overlap) problems.push(`${where}: Next button covers the hotspot`);
      if (state.captionClipped) problems.push(`${where}: caption scrolls (too long for its block)`);
      if (reference) {
        for (const [selector, box] of Object.entries(state.blocks)) {
          if (JSON.stringify(box) !== JSON.stringify(reference[selector])) {
            problems.push(`${where}: ${selector} moved ${JSON.stringify(reference[selector])} -> ${JSON.stringify(box)}`);
          }
        }
      } else reference = state.blocks;
      if (!every && viewport.width === 1440) {
        await page.screenshot({ path: join(shots, `${viewport.width}-${index + 1}-${state.id}.png`) });
      }
      // Go on by the hotspot itself, as a reader would.
      await page.click("#hotspot");
    }
    const ended = await page.evaluate(() => !document.getElementById("end").hidden);
    if (!ended) problems.push(`${viewport.width}px ${every ? "every" : "story"}: no end card after the last screen`);
    if (!every && viewport.width === 1440) await page.screenshot({ path: join(shots, "1440-end.png") });
  }

  // The app's own back control returns a screen; the arrow keys move; the chapter list jumps.
  await fresh();
  await page.click("#hotspot");
  const second = await page.evaluate(() => location.hash);
  await page.keyboard.press("ArrowRight");
  const third = await page.evaluate(() => location.hash);
  const backVisible = await page.evaluate(() => !document.getElementById("backSpot").hidden);
  if (backVisible) {
    await page.click("#backSpot");
    if ((await page.evaluate(() => location.hash)) !== second) problems.push(`${viewport.width}px: the screen's back control did not return a screen`);
  }
  await page.keyboard.press("ArrowLeft");
  await page.click("#chaptersBtn");
  const listed = await page.locator("#chapters button").count();
  await page.locator("#chapters button").last().click();
  const jumped = await page.evaluate(() => location.hash);
  console.log(JSON.stringify({ viewport: viewport.width, second, third, backVisible, listed, jumped, errors }));
  if (errors.length > 0) problems.push(`${viewport.width}px: console errors ${errors.join(" | ")}`);
  await page.close();
}
await browser.close();
console.log(problems.length === 0 ? "PLAYER OK" : `PROBLEMS\n${problems.join("\n")}`);
