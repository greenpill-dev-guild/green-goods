// Checks the built demo, then walks every chapter in a headless browser.
// Usage, from the repository root, after build.mjs (needs a Playwright install on NODE_PATH):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/check.mjs
// Source checks: no em dash in the demo's HTML or Markdown; the lede says "demo data" and the page
// never says "names are changed"; no "Start from the beginning" button; one-word chapter ids; every
// tile line five words; every chapter's surface (Dashboard, App or Website) and a one or two
// sentence intro; every caption at most eight words and every step label at most five, all free of
// "commitment", "chain", "blockchain", "Arbitrum", "Celo", "Gnosis" and "live"; a hotspot on every
// screen except each chapter's last; back regions shaped [x, y, w, h] inside the screen; a build
// newer than index.html and every screen; under 15 MB.
// Rendered checks (Chromium, light, 1440x900): a two-column landing with one tile per chapter,
// loaded thumbnails and "Start here" on the first tile only; each chapter walked by clicking its
// hotspots, with each step's image loaded, its caption changed, who you are and where shown, the
// "All flows" button visible, the strip listing every chapter with this one marked, the panel's
// steps matching the screens with this one marked, and the "In pilot" chip only where declared;
// every declared back region goes back a screen (across chapters, or to the landing) and the
// browser's back returns; a tap beside the hotspot does not advance; each last screen offers the
// next chapter (the last one, the landing) and "All flows"; a panel step and a strip chapter jump;
// Right, Left and Escape, Back and Restart, "All flows" mid-chapter; focus held on the hotspot
// survives a chapter's last screen and Left from it, and Back or Restart by keyboard; #/promise/3
// opens that screen and the browser's back and forward walk from it; a plain #work-3 link opens;
// the light and dark switch flips data-theme and survives a reload; a desktop screen and the panel
// fit 1440x900 without scrolling; a fixture copy shows the "In pilot" chip; no request leaves the
// page except Google Fonts; no console errors. Then the landing and chapters at 390x844 without
// sideways scroll, one column there, and dark mode. Every step is screenshot to ./output/ with a
// contact sheet. A failed check exits with status 1 after reporting.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
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
const WHERE = new Set(["Dashboard", "App", "Website"]);
const FLOWS_BLOCK = /<script type="application\/json" id="flows">([\s\S]*?)<\/script>/;
const words = (text) => text.trim().split(/\s+/).length;
const rectsOf = (value) => (!value ? [] : Array.isArray(value[0]) ? value : [value]);
const inside = (point, box) => point[0] >= box.x && point[0] <= box.x + box.width && point[1] >= box.y && point[1] <= box.y + box.height;

if (!existsSync(built)) { console.log(`no ${built}; run build.mjs first`); process.exit(1); }
const html = readFileSync(built, "utf8");
const source = readFileSync(join(here, "index.html"), "utf8");
const { flows } = JSON.parse(html.match(FLOWS_BLOCK)[1]);
const screens = flows.flatMap((f) => f.screens);

// Source checks.
const newest = Math.max(statSync(join(here, "index.html")).mtimeMs, ...screens.map((s) => statSync(join(here, "assets", "screens", `${s.file}.jpg`)).mtimeMs));
if (statSync(built).mtimeMs < newest) note("the build is older than index.html or a screen; run build.mjs");
if (statSync(built).size > 15 * 1024 * 1024) note(`the build is ${(statSync(built).size / 1048576).toFixed(1)} MB, over 15 MB`);
const prose = [built, join(here, "index.html"), ...readdirSync(here).filter((f) => f.endsWith(".md")).map((f) => join(here, f))];
for (const file of prose) if (/—/.test(readFileSync(file, "utf8"))) note(`an em dash (U+2014) is in ${file.replace(`${here}/`, "")}`);
if (/names are changed/i.test(source) || /names are changed/i.test(html)) note('the page says "names are changed"');
if (/id="start"/.test(source)) note('the "Start from the beginning" button is back');
const lede = (source.match(/<p class="lede"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "";
if (!/demo data/i.test(lede)) note(`the lede does not say "demo data": "${lede}"`);
if (!flows.length) note("the #flows block has no chapters");
const ids = new Set();
for (const flow of flows) {
  if (ids.has(flow.id)) note(`two chapters use the id ${flow.id}`);
  ids.add(flow.id);
  if (!/^[a-z][a-z0-9]*$/.test(flow.id)) note(`${flow.id}: a chapter id must be one lowercase word, so a plain #${flow.id}-2 link opens it`);
  if (words(flow.line) !== 5) note(`${flow.id}: the tile line "${flow.line}" is not five words`);
  if (!WHERE.has(flow.where)) note(`${flow.id}: where is "${flow.where}", not Dashboard, App or Website`);
  if (!flow.intro || flow.intro.split(/(?<=[.!?])\s+/).filter(Boolean).length > 2) note(`${flow.id}: the intro must be one or two sentences`);
  for (const text of [flow.line, flow.who, flow.intro, ...flow.screens.map((s) => s.who).filter(Boolean)]) if (!text || BANNED.test(text)) note(`${flow.id}: "${text}" is empty or uses a banned word`);
  if (flow.thumb && !flow.screens.some((s) => s.file === flow.thumb)) note(`${flow.id}: its thumbnail ${flow.thumb} is not one of its screens`);
  flow.screens.forEach((s, i) => {
    const last = i === flow.screens.length - 1;
    if (words(s.caption) > 8) note(`${s.file}: the caption "${s.caption}" is over eight words`);
    if (BANNED.test(s.caption)) note(`${s.file}: the caption "${s.caption}" uses "${s.caption.match(BANNED)[0]}"`);
    if (s.step !== undefined && (!s.step || words(s.step) > 5 || BANNED.test(s.step))) note(`${s.file}: the step "${s.step}" is empty, over five words or uses a banned word`);
    if (s.where !== undefined && !WHERE.has(s.where)) note(`${s.file}: where is "${s.where}", not Dashboard, App or Website`);
    if (s.pilot !== undefined && typeof s.pilot !== "boolean") note(`${s.file}: pilot is not true or false`);
    if (!last && !s.hotspot) note(`${s.file}: no hotspot`);
    if (last && s.hotspot) note(`${s.file}: the last screen has a hotspot`);
    if (!s.story) note(`${s.file}: no source recorded`);
    for (const r of rectsOf(s.back)) {
      if (!Array.isArray(r) || r.length !== 4 || r.some((n) => typeof n !== "number" || n < 0 || n > 1) || r[0] + r[2] > 1.001 || r[1] + r[3] > 1.001) note(`${s.file}: the back region ${JSON.stringify(r)} is not [x, y, w, h] inside the screen`);
    }
  });
}
console.log(`source checks: ${flows.length} chapters, ${screens.length} screens, ${(statSync(built).size / 1048576).toFixed(2)} MB`);

// Rendered checks.
const { chromium } = pw;
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const url = pathToFileURL(built).href;
async function openPage(options) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("request", (r) => { if (!/^(data:|file:|blob:|https:\/\/fonts\.(googleapis|gstatic)\.com\/)/.test(r.url())) note(`request outside the page: ${r.url()}`); });
  page.on("console", (m) => { if (m.type() === "error") note(`console error: ${m.text()}`); });
  page.on("pageerror", (e) => note(`page error: ${e.message}`));
  return { context, page };
}
const shotLoaded = (page) => page.waitForFunction(() => { const img = document.getElementById("shot"); return img.complete && img.naturalWidth > 0; }, null, { timeout: 5000 }).then(() => true, () => false);
const state = (page) => page.evaluate(() => ({ view: document.body.dataset.view, flow: document.body.dataset.flow, step: Number(document.body.dataset.step), caption: document.getElementById("caption").textContent, who: document.getElementById("who").textContent }));
const at = (page, id, n) => page.waitForFunction(([f, s]) => document.body.dataset.view === "flow" && document.body.dataset.flow === f && document.body.dataset.step === String(s), [id, n], { timeout: 3000 }).then(() => true, () => false);
const columns = (page) => page.evaluate(() => getComputedStyle(document.getElementById("tiles")).gridTemplateColumns.split(" ").filter(Boolean).length);
const background = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3);
const active = (page) => page.evaluate(() => ({ id: document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName, hidden: document.activeElement?.hidden ?? true, current: document.activeElement?.getAttribute("aria-current") }));
// The named chapters these checks were written against, or stand-ins when the story changes.
const pick = (id, fallback) => flows.find((f) => f.id === id) || flows[Math.min(fallback, flows.length - 1)];
const promise = pick("promise", 1);
const work = pick("work", 2);

// Each section reports what broke and lets the rest run, so one failure never hides another.
async function section(name, fn) {
  try { await fn(); } catch (error) { note(`${name}: ${String(error?.message || error).split("\n")[0]}`); }
}
async function withPage(options, fn) {
  const { context: c, page: p } = await openPage(options);
  try { await fn(p); } finally { await c.close(); }
}
const steps = [];
const backed = [];

const { context, page } = await openPage();
await section("landing", async () => {
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const tiles = await page.$$eval(".tile", (els) => els.map((el) => ({ id: el.id, text: el.textContent, loaded: [...el.querySelectorAll("img")].every((img) => img.complete && img.naturalWidth > 0) })));
  if (tiles.length !== flows.length) note(`the landing shows ${tiles.length} tiles for ${flows.length} chapters`);
  tiles.forEach((t, i) => {
    if (!t.loaded) note(`${t.id}: its thumbnail did not load`);
    if (t.text.includes("Start here") !== (i === 0)) note(`${t.id}: "Start here" is ${i === 0 ? "missing from the first tile" : "on a later tile"}`);
  });
  if ((await columns(page)) !== 2) note(`the landing grid has ${await columns(page)} columns at 1440, not two`);
  if (await page.locator("#start").count()) note('"Start from the beginning" is on the page');
  if (!/demo data/i.test(await page.textContent("#lede"))) note('the rendered lede does not say "demo data"');
  if (/names are changed/i.test(await page.evaluate(() => document.body.innerText))) note('the rendered page says "names are changed"');
});

// Walk every chapter by its hotspots.
for (const [index, flow] of flows.entries()) {
  await section(`walk ${flow.id}`, async () => {
    const next = flows[index + 1];
    if ((await state(page).catch(() => ({}))).view !== "landing") await page.goto(`${url}#/`, { waitUntil: "load" });
    await page.click(`#tile-${flow.id}`);
    const furniture = await page.evaluate(() => ({
      chips: [...document.querySelectorAll("#strip .chip")].map((c) => ({ label: c.querySelector(".chip-label").textContent, current: c.getAttribute("aria-current") === "true" })),
      steps: document.querySelectorAll("#steplist .stepbtn").length,
      intro: document.getElementById("intro").textContent,
      panel: getComputedStyle(document.getElementById("panel-body")).display !== "none" && document.getElementById("panel").getBoundingClientRect().width > 0,
    }));
    if (furniture.chips.length !== flows.length) note(`${flow.id}: the strip lists ${furniture.chips.length} chapters, not ${flows.length}`);
    furniture.chips.forEach((c, i) => {
      if (c.label !== flows[i]?.label) note(`${flow.id}: strip chapter ${i + 1} says "${c.label}"`);
      if (c.current !== (i === index)) note(`${flow.id}: the strip marks chapter ${i + 1} ${c.current ? "as current" : "as not current"}`);
    });
    if (furniture.steps !== flow.screens.length) note(`${flow.id}: the panel lists ${furniture.steps} steps for ${flow.screens.length} screens`);
    if (furniture.intro !== flow.intro) note(`${flow.id}: the panel's intro reads "${furniture.intro}"`);
    if (!furniture.panel) note(`${flow.id}: the side panel's steps are not shown at 1440`);
    let previous = "";
    for (let i = 0; i < flow.screens.length; i += 1) {
      const s = flow.screens[i];
      const last = i === flow.screens.length - 1;
      // A failure above may have left another screen showing; report it and come back to this one.
      if (!(await at(page, flow.id, i + 1))) {
        note(`${s.file}: expected ${flow.id} step ${i + 1}, found ${JSON.stringify(await state(page).catch(() => "no demo page"))}`);
        await page.goto(`${url}#/${flow.id}/${i + 1}`, { waitUntil: "load" });
        previous = "";
      }
      if (!(await shotLoaded(page))) note(`${s.file}: the screen image did not load`);
      const now = await state(page);
      if (now.caption !== s.caption) note(`${s.file}: caption "${now.caption}" differs from "${s.caption}"`);
      if (now.caption === previous) note(`${s.file}: the caption did not change`);
      if (now.who !== (s.who || flow.who)) note(`${s.file}: shows "${now.who}" for who you are`);
      if (!(await page.locator("#home-flow").isVisible())) note(`${s.file}: the "All flows" button is not visible`);
      previous = now.caption;
      const detail = await page.evaluate(() => ({
        step: [...document.querySelectorAll("#steplist .stepbtn")].findIndex((b) => b.getAttribute("aria-current") === "step"),
        where: document.getElementById("where").textContent,
        pilot: !document.getElementById("pilot").hidden,
        backs: [...document.querySelectorAll("#backspots .backspot")].map((b) => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, label: b.getAttribute("aria-label") }; }),
      }));
      if (detail.step !== i) note(`${s.file}: the panel marks step ${detail.step + 1}, not ${i + 1}`);
      if (detail.where !== (s.where || flow.where)) note(`${s.file}: shows "${detail.where}" for where`);
      if (detail.pilot !== Boolean(s.pilot)) note(`${s.file}: the "In pilot" chip is ${detail.pilot ? "shown" : "missing"}`);
      if (detail.backs.length !== rectsOf(s.back).length) note(`${s.file}: ${detail.backs.length} back regions for ${rectsOf(s.back).length} declared`);
      const scr = await page.locator("#screen").boundingBox();
      for (const b of detail.backs) {
        if (b.label !== "Back") note(`${s.file}: a back region is labeled "${b.label}"`);
        if (b.x < scr.x - 8 || b.y < scr.y - 8 || b.x + b.width > scr.x + scr.width + 8 || b.y + b.height > scr.y + scr.height + 8) note(`${s.file}: a back region leaves the screen`);
      }
      const file = join(out, `${s.file}.png`);
      await page.screenshot({ path: file });
      steps.push(file);
      const hot = await page.locator("#hotspot").boundingBox();
      if (last) {
        if (hot) note(`${s.file}: a hotspot shows on the last screen`);
        const label = (await page.locator("#next-flow").textContent()).trim();
        if (label !== (next ? `Next: ${next.label}` : "All flows")) note(`${s.file}: the closing button says "${label}"`);
        if (next) {
          if (!(await page.locator("#all-end").isVisible())) note(`${s.file}: "All flows" is not offered at the end`);
          await page.click("#next-flow");
          const after = await state(page);
          if (after.flow !== next.id || after.step !== 1) note(`${s.file}: "${label}" opened ${JSON.stringify(after)}`);
          await page.click("#home-flow");
        } else await page.click("#next-flow");
        if ((await state(page)).view !== "landing") note(`${flow.id}: the end of the chapter did not return to the landing`);
        continue;
      }
      if (!hot || hot.width < 24 || hot.height < 24) { note(`${s.file}: the hotspot is missing or too small`); return; }
      if (hot.x < scr.x - 8 || hot.y < scr.y - 8 || hot.x + hot.width > scr.x + scr.width + 8 || hot.y + hot.height > scr.y + scr.height + 8) note(`${s.file}: the hotspot leaves the screen`);
      if (i === 0) {
        // A tap beside the hotspot, and beside any back region, must not move.
        const corners = [[scr.x + 14, scr.y + 14], [scr.x + scr.width - 14, scr.y + 14], [scr.x + 14, scr.y + scr.height - 14], [scr.x + scr.width - 14, scr.y + scr.height - 14]];
        const free = corners.find((p) => !inside(p, hot) && detail.backs.every((b) => !inside(p, b)));
        if (!free) note(`${s.file}: every corner sits under the hotspot or a back region`);
        else {
          await page.mouse.click(free[0], free[1]);
          const still = await state(page);
          if (still.view !== "flow" || still.step !== 1) note(`${flow.id}: a tap beside the hotspot moved the chapter`);
        }
      }
      // The app's own back controls go back one screen, and the browser's back returns here.
      for (const [j, b] of detail.backs.entries()) {
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        const went = await state(page);
        const prev = flows[index - 1];
        const expected = i > 0 ? [flow.id, i] : prev ? [prev.id, prev.screens.length] : null;
        const ok = expected ? went.view === "flow" && went.flow === expected[0] && went.step === expected[1] : went.view === "landing";
        if (!ok) note(`${s.file}: back region ${j + 1} opened ${JSON.stringify(went)}`);
        await page.evaluate(() => history.back());
        if (!(await at(page, flow.id, i + 1))) {
          note(`${s.file}: the browser's back did not return after back region ${j + 1}`);
          await page.goto(`${url}#/${flow.id}/${i + 1}`, { waitUntil: "load" });
        }
        backed.push(`${s.file} region ${j + 1}`);
      }
      await page.click("#hotspot");
    }
  });
}
if (!screens.some((s) => s.back)) note("no screen declares a back region, so the in-screen back went unchecked");

// A panel step and a strip chapter jump, and a clicked step keeps focus.
await section("panel and strip", async () => {
  await page.goto(`${url}#/`, { waitUntil: "load" });
  await page.click(`#tile-${flows[0].id}`);
  const target = Math.min(3, flows[0].screens.length);
  await page.click(`#steplist li:nth-child(${target}) .stepbtn`);
  if ((await state(page)).step !== target) note(`panel step ${target} opened ${JSON.stringify(await state(page))}`);
  if ((await active(page)).current !== "step") note("focus left the panel step that was clicked");
  if (flows[1]) {
    await page.click(`#chip-${flows[1].id}`);
    const jumped = await state(page);
    if (jumped.flow !== flows[1].id || jumped.step !== 1) note(`the strip's chapter 2 opened ${JSON.stringify(jumped)}`);
  }
  await page.click("#home-flow");
  if ((await state(page)).view !== "landing") note('"All flows" did not return to the landing mid-chapter');
});
await section("keys, Back and Restart", async () => {
  await page.goto(`${url}#/`, { waitUntil: "load" });
  await page.click(`#tile-${promise.id}`);
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
});
// A keyboard user who holds the hotspot keeps a visible control focused across the last screen
// and back from it: Enter walks the chapter, the last screen hands focus to the next-chapter
// button, and Left from there hands it back to the hotspot. Back from the second screen and
// Restart from a later one disable the button that was pressed, so focus has to move to the
// hotspot, or Enter would stop working.
await section("keyboard focus", async () => {
  await page.goto(`${url}#/`, { waitUntil: "load" });
  await page.click(`#tile-${promise.id}`);
  await page.focus("#hotspot");
  for (let i = 1; i < promise.screens.length; i += 1) await page.keyboard.press("Enter");
  if ((await state(page)).step !== promise.screens.length) note("Enter on the hotspot did not reach the last screen");
  if ((await active(page)).id !== "next-flow") note(`focus on the last screen sits on "${(await active(page)).id}", not on the next-chapter button`);
  await page.keyboard.press("ArrowLeft");
  const after = await active(page);
  if (after.id !== "hotspot" || after.hidden) note(`focus after Left from the last screen sits on "${after.id}"${after.hidden ? " (hidden)" : ""}, not on the hotspot`);
  await page.keyboard.press("Escape");
  await page.click(`#tile-${promise.id}`);
  await page.keyboard.press("ArrowRight");
  await page.focus("#back");
  await page.keyboard.press("Enter");
  const afterBack = await active(page);
  if ((await state(page)).step !== 1) note("Enter on Back did not go back");
  if (afterBack.id !== "hotspot" || afterBack.hidden) note(`focus after Back from the second screen sits on "${afterBack.id}", not on the hotspot`);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.focus("#restart");
  await page.keyboard.press("Enter");
  const afterRestart = await active(page);
  if ((await state(page)).step !== 1) note("Enter on Restart did not return to the first screen");
  if (afterRestart.id !== "hotspot" || afterRestart.hidden) note(`focus after Restart sits on "${afterRestart.id}", not on the hotspot`);
  await page.keyboard.press("Escape");
});
// A plain anchor, the only kind an artifact link carries, opens a screen too.
await section("plain link", async () => {
  await page.goto(`${url}#${work.id}-3`, { waitUntil: "load" });
  const plain = await state(page);
  if (plain.flow !== work.id || plain.step !== Math.min(3, work.screens.length)) note(`the #${work.id}-3 link opened ${JSON.stringify(plain)}`);
});
await context.close();

// A deep link, then the browser's back and forward walk the screens.
await section("deep link and history", () => withPage({}, async (p) => {
  const n = Math.min(3, promise.screens.length - 1);
  await p.goto(`${url}#/${promise.id}/${n}`, { waitUntil: "load" });
  const deep = await state(p);
  if (deep.view !== "flow" || deep.flow !== promise.id || deep.step !== n) note(`#/${promise.id}/${n} opened ${JSON.stringify(deep)}`);
  await p.click("#hotspot");
  if (!(await at(p, promise.id, n + 1))) note(`the hotspot on #/${promise.id}/${n} did not advance`);
  await p.evaluate(() => history.back());
  if (!(await at(p, promise.id, n))) note(`the browser's back from ${promise.id} ${n + 1} did not return to ${n}`);
  await p.evaluate(() => history.forward());
  if (!(await at(p, promise.id, n + 1))) note(`the browser's forward did not return to ${promise.id} ${n + 1}`);
  await p.click("#home-flow");
  await p.evaluate(() => history.back());
  if (!(await at(p, promise.id, n + 1))) note('the browser\'s back from the landing did not reopen the screen "All flows" left');
}));

// The light and dark switch flips data-theme and the pick survives a reload.
await section("theme switch", () => withPage({}, async (p) => {
  await p.goto(url, { waitUntil: "load" });
  const themeOf = () => p.evaluate(() => document.documentElement.dataset.theme || "");
  if ((await themeOf()) !== "") note(`a first visit already sets data-theme="${await themeOf()}"`);
  await p.click("#theme-landing");
  if ((await themeOf()) !== "dark" || (await p.getAttribute("#theme-landing", "aria-checked")) !== "true") note("the switch did not turn dark mode on");
  if ((await background(p)) > 80) note("dark mode left the background light");
  await p.reload({ waitUntil: "load" });
  if ((await themeOf()) !== "dark") note("the dark pick did not survive a reload");
  if ((await p.getAttribute("#theme-flow", "aria-checked")) !== "true") note("the chapter view's switch does not show the dark pick");
  await p.click("#theme-landing");
  await p.reload({ waitUntil: "load" });
  if ((await themeOf()) !== "light" || (await background(p)) < 200) note("the light pick did not survive a reload");
}));

// A desktop screen and the side panel fit 1440x900 without scrolling.
await section("desktop fit", () => withPage({}, async (p) => {
  const where = flows.flatMap((f) => f.screens.map((s, i) => ({ f, s, i }))).find((x) => x.s.device === "desktop");
  if (!where) return;
  await p.goto(`${url}#/${where.f.id}/${where.i + 1}`, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  const fit = await p.evaluate(() => ({ tall: document.documentElement.scrollHeight - window.innerHeight, panel: document.getElementById("panel").getBoundingClientRect().right, device: document.getElementById("device").getBoundingClientRect().left }));
  if (fit.tall > 1) note(`${where.s.file} at 1440x900 scrolls by ${fit.tall}px`);
  if (fit.panel > fit.device) note(`${where.s.file} at 1440x900: the panel and the screen overlap`);
  await p.screenshot({ path: join(out, "chapter-1440.png") });
}));

// A fixture copy marks one screen as in pilot, so the chip is checked whatever the story holds.
await section("pilot chip", async () => {
  const fixture = JSON.parse(JSON.stringify({ flows }));
  const f = fixture.flows[Math.min(1, fixture.flows.length - 1)];
  const n = Math.max(0, Math.min(1, f.screens.length - 2));
  f.screens.forEach((s, i) => { s.pilot = i === n; });
  const path = join(out, "check-fixture.html");
  writeFileSync(path, html.replace(FLOWS_BLOCK, () => `<script type="application/json" id="flows">${JSON.stringify(fixture).replace(/<\//g, "<\\/")}</script>`));
  try {
    await withPage({}, async (p) => {
      await p.goto(`${pathToFileURL(path).href}#/${f.id}/${n + 1}`, { waitUntil: "load" });
      const chip = await p.evaluate(() => ({ shown: !document.getElementById("pilot").hidden && document.getElementById("pilot").getBoundingClientRect().width > 0, text: document.getElementById("pilot").textContent, caption: document.getElementById("caption").textContent }));
      if (!chip.shown || chip.text !== "In pilot") note(`the fixture's pilot screen shows ${JSON.stringify(chip)}`);
      if (chip.caption !== f.screens[n].caption) note("the pilot chip changed the caption's text");
      await p.click("#hotspot");
      if (!(await p.evaluate(() => document.getElementById("pilot").hidden))) note("the pilot chip stayed on the next screen");
    });
  } finally { unlinkSync(path); }
});

// Phone width and dark mode.
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const end = flows[flows.length - 1];
const views = [
  ["landing-light-1440", { colorScheme: "light" }, "", 2],
  ["landing-dark-1440", { colorScheme: "dark" }, "", 2],
  ["landing-light-390", { ...PHONE, colorScheme: "light" }, "", 1],
  ["landing-dark-390", { ...PHONE, colorScheme: "dark" }, "", 1],
  ["chapter-390", PHONE, `#/${work.id}/2`],
  ["chapter-dark-1440", { colorScheme: "dark" }, `#/${flows[0].id}/${Math.min(3, flows[0].screens.length)}`],
  ...flows.map((f) => [`phone-${f.id}`, PHONE, `#/${f.id}/1`]),
  [`phone-${end.id}-end`, PHONE, `#/${end.id}/${end.screens.length}`],
];
for (const [name, options, hash, cols] of views) {
  await section(name, () => withPage(options, async (p) => {
    await p.goto(`${url}${hash}`, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    if (hash && !(await shotLoaded(p))) note(`${name}: the screen image did not load`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (wide > 0) note(`${name}: the page scrolls sideways by ${wide}px`);
    if (hash && !(await p.locator("#home-flow").isVisible())) note(`${name}: the "All flows" button is not visible`);
    if (hash && !(await p.locator("#who").isVisible())) note(`${name}: who you are is not visible`);
    if (cols && (await columns(p)) !== cols) note(`${name}: the landing grid has ${await columns(p)} columns, not ${cols}`);
    const shade = await background(p);
    if (options.colorScheme === "dark" && shade > 80) note(`${name}: the background is not dark`);
    if (options.colorScheme === "light" && shade < 200) note(`${name}: the background is not light`);
    await p.screenshot({ path: join(out, `${name}.png`) });
  }));
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
console.log(`rendered checks: ${steps.length} steps screenshot to ${out}, ${backed.length} back regions walked, contact sheet written${problems.length ? "" : ", all good"}`);
process.exit(problems.length ? 1 : 0);
