// Captures Storybook fixture stories from the deployed Storybook as PNGs, for docs screenshots.
// Fixture data only: never point this at a live garden.
// Usage, from the repository root:
//   node .plans/active/community-docs-revamp/artifacts/storybook-capture.mjs "$PWD" <pngDir> \
//     .plans/active/community-docs-revamp/artifacts/captures.json
// Each job: { name, story, viewport: "phone" | "desktop", settle?, steps?, expect?, dump? }.
// A report with what each page showed is written beside the PNGs. Read it before using a frame:
// several route stories render an error state on the deployed build.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [root, outDir, jobsFile] = process.argv.slice(2);
const require = createRequire(`${root}/package.json`);
const { chromium } = require("@playwright/test");
const jobs = JSON.parse(readFileSync(jobsFile, "utf8"));
mkdirSync(outDir, { recursive: true });
const BASE = "https://design.greengoods.app/iframe.html";
const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const browser = await chromium.launch();
const report = [];
for (const job of jobs) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[job.viewport],
    deviceScaleFactor: 2,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US",
  });
  const page = await context.newPage();
  const entry = { name: job.name, story: job.story, ok: false, texts: {}, notes: [] };
  try {
    await page.goto(`${BASE}?viewMode=story&id=${job.story}&globals=theme:light`, { waitUntil: "networkidle", timeout: 150000 });
    await page.waitForSelector("#storybook-root > *", { timeout: 150000 });
    await page.addStyleTag({ content: ".storybook-browser-preview{padding:0!important}.storybook-canvas-frame{height:100vh!important}" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(job.settle ?? 2500);
    for (const step of job.steps ?? []) {
      if (step.click) await page.getByRole(step.role ?? "button", { name: step.click, exact: step.exact ?? false }).first().click({ timeout: 20000 });
      if (step.fill) await page.getByLabel(step.fill, { exact: false }).first().fill(step.value, { timeout: 20000 });
      if (step.press) await page.keyboard.press(step.press);
      if (step.wait) await page.waitForTimeout(step.wait);
      if (step.shot) await page.screenshot({ path: path.join(outDir, `${step.shot}.png`), fullPage: Boolean(step.fullPage) });
      if (step.text) entry.texts[step.text] = await page.getByText(step.text, { exact: false }).count();
      if (step.buttons) entry[step.buttons] = await page.getByRole("button").evaluateAll((els) => els.map((el) => `${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 60)}${el.disabled ? " [disabled]" : ""}`));
      if (step.dumpText) entry[step.dumpText] = (await page.locator("body").innerText()).slice(0, 1500);
      if (step.clickSelector) await page.locator(step.clickSelector).first().click({ timeout: 20000 });
      if (step.fillSelector) await page.locator(step.fillSelector).first().fill(step.value, { timeout: 20000 });
    }
    for (const text of job.expect ?? []) entry.texts[text] = await page.getByText(text, { exact: false }).count();
    if (job.dump) entry.dump = (await page.locator("body").innerText()).slice(0, job.dump);
    if (!job.noFinalShot) await page.screenshot({ path: path.join(outDir, `${job.name}.png`), fullPage: Boolean(job.fullPage) });
    entry.ok = true;
  } catch (error) {
    entry.notes.push(String(error).slice(0, 400));
    try { await page.screenshot({ path: path.join(outDir, `${job.name}.error.png`) }); } catch {}
  }
  report.push(entry);
  await context.close();
}
await browser.close();
writeFileSync(path.join(outDir, `report-${path.basename(jobsFile)}`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
