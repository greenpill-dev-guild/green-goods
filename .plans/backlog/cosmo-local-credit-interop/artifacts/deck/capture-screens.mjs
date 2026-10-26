// Captures the deck's two product screens into ./assets/screens (not committed).
// Usage, from the repository root (needs the repository's Playwright install and network access):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/capture-screens.mjs
// Both screens come from the deployed Storybook: real components with demo data. The deck and
// brief show them on the commitment pooling slide and page.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "assets", "screens");
mkdirSync(out, { recursive: true });
const story = (id) => `https://design.greengoods.app/iframe.html?viewMode=story&id=${id}`;
// Slide 3 crops each phone screen in CSS: the garden page below its demo photo, and the whole
// confirm sheet, captured at a shorter viewport so the sheet fits its content.
// `expect` names copy the story must show: Storybook's own "story not found" view also fills
// #storybook-root, so a removed or renamed story would otherwise overwrite a screen with an error
// page that the deck and brief checks, which only test that the image loads, would pass.
const shots = [
  { file: "garden-promises.png", url: story("client-commitments-gardenpool--live"), w: 390, h: 1100, storybook: true, expect: ["3 of 7 kept", "Needs you"] },
  { file: "confirm.png", url: story("client-commitments-confirmsheet--ask-garden-work"), w: 390, h: 740, storybook: true, expect: ["Was the work you asked for done?"] },
];
// Both screens are staged and replace the current pair together, only once every story has
// passed its check, so a failure never leaves one new screen beside one old one.
const staging = mkdtempSync(join(out, ".capture-"));
const browser = await pw.chromium.launch();
try {
  for (const s of shots) {
    const context = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2, colorScheme: "light" });
    const page = await context.newPage();
    await page.goto(s.url, { waitUntil: "networkidle", timeout: 90000 });
    if (s.storybook) await page.waitForSelector("#storybook-root > *", { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(s.storybook ? 2500 : 6000);
    // The stories' own fonts: fonts.ready also resolves after a font request fails, and text set in
    // a fallback face would be rasterized into the screen, so no face may be in error and every
    // face used by visible text must be loaded.
    const fontProblems = await page.evaluate(() => {
      const errors = [...document.fonts].filter((f) => f.status === "error").map((f) => `${f.family.replace(/["']/g, "")} ${f.weight} ${f.style} failed to load`);
      const fallback = new Set();
      for (const el of document.querySelectorAll("body *")) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        if (!document.fonts.check(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`)) fallback.add(cs.fontFamily.split(",")[0].replace(/["']/g, ""));
      }
      return [...errors, ...[...fallback].map((family) => `${family} is not loaded for visible text`)];
    });
    if (fontProblems.length) throw new Error(`${s.file}: ${fontProblems.join("; ")}; neither screen was replaced`);
    const text = await page.evaluate(() => document.body.innerText);
    const missing = s.expect.filter((t) => !text.includes(t));
    if (/couldn't find story|story not found|no story matched/i.test(text) || missing.length) {
      throw new Error(`${s.file}: the story did not show ${missing.length ? `"${missing.join('", "')}"` : "its content"}; neither screen was replaced`);
    }
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.mouse.move(1, 1);
    await page.screenshot({ path: join(staging, s.file) });
    await context.close();
  }
  // The current pair is backed up first, so a rename that fails halfway puts the old pair back
  // rather than leaving one new screen beside one old one.
  const backup = mkdtempSync(join(out, ".previous-"));
  // The backup completes before either screen is touched, and only the screens that were
  // promoted are rolled back, each on its own.
  try {
    for (const s of shots) if (existsSync(join(out, s.file))) copyFileSync(join(out, s.file), join(backup, s.file));
  } catch (error) {
    rmSync(backup, { recursive: true, force: true });
    throw new Error(`${error.message}; neither screen was replaced`);
  }
  const promoted = [];
  try {
    for (const s of shots) { renameSync(join(staging, s.file), join(out, s.file)); promoted.push(s.file); console.log(join(out, s.file)); }
  } catch (error) {
    for (const name of promoted) { try { rmSync(join(out, name), { force: true }); } catch {} }
    for (const name of readdirSync(backup)) { try { copyFileSync(join(backup, name), join(out, name)); } catch {} }
    throw new Error(`${error.message}; the previous pair was put back`);
  } finally {
    rmSync(backup, { recursive: true, force: true });
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
  await browser.close();
}
