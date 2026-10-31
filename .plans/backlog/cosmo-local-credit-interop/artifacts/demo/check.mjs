// Checks the built demo, then walks the story and every step in a headless browser.
// Usage, from the repository root, after build.mjs (needs a Playwright install on NODE_PATH):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/check.mjs
// Source checks: no em dash in the demo's HTML or Markdown; the intro says "demo data" and the page
// never says "names are changed"; the story has at most twelve screens, each one of the appendix's;
// one-word chapter ids; every surface Dashboard, App or Website; story lines and every caption at
// most eight words, appendix tile lines five, step labels at most five, intros one or two
// sentences, all free of "commitment", "chain", "blockchain", "Arbitrum", "Celo", "Gnosis" and
// "live" (the event's name, SF.Live, aside); a hotspot on every appendix screen but a chapter's
// last; back regions shaped [x, y, w, h] inside the screen; a build newer than index.html and every
// screen; under 15 MB.
// Rendered checks (Chromium, light, 1440x900): the intro with its chapters and its shot; the story
// walked from Start by each screen's hotspot, or Next where it has none, with each image loaded,
// its caption, who you are, where and the "In pilot" chip as declared, the counter and the strip
// marking this screen, and the bar, the body, who you are, the caption and the controls in the
// same place on every screen, with the device centered on one line beside them (wide and
// landscape) or sharing a top and bottom under them (a stage wider than a desktop screen), the
// caption within two lines; Finish to the close and on to every
// step; every chapter walked the same way, its end opening the next chapter; every back region
// going back a screen and the browser's back returning; a tap beside the hotspot not advancing;
// Right, Left, Escape, Back and Intro; focus kept on a visible control when the hotspot or a back
// region goes away, and moved onto the new view's first control when a link, "See every step" or
// Intro changes the view; #story-5, #work-3, #/promise/3, #end and #steps links, and the browser's back
// and forward; the light and dark switch, which survives a reload; no request leaving the page
// but Google Fonts; no console errors. Then the story at 1280x720, 768x1024 and 390x844, held in
// place there too without the page scrolling, and the intro, close and every step at 390x844 and
// in dark mode. Each screen is screenshot to ./output/ with a contact sheet. A failed check exits
// with status 1 after reporting.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
const built = join(out, "green-goods-sf-live-demo.html");
const problems = [];
const note = (message) => { problems.push(message); console.log(`  problem: ${message}`); };
// The event's own name is the one "Live" the copy may carry.
const BANNED = /\b(commitments?|chain|blockchain|arbitrum|celo|gnosis|live)\b/i;
const banned = (text) => BANNED.exec(String(text ?? "").replace(/\b(SF|SustainableFinance)\.Live\b/g, ""));
const WHERE = new Set(["Dashboard", "App", "Website"]);
const ID = /^[a-z][a-z0-9]*$/;
const FLOWS_BLOCK = /<script type="application\/json" id="flows">([\s\S]*?)<\/script>/;
const MAX_STORY = 12;
const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
const sentences = (text) => String(text ?? "").split(/(?<=[.!?])\s+/).filter(Boolean).length;
const rectsOf = (value) => (!value ? [] : Array.isArray(value[0]) ? value : [value]);
const inside = (point, box) => point[0] >= box.x && point[0] <= box.x + box.width && point[1] >= box.y && point[1] <= box.y + box.height;

if (!existsSync(built)) { console.log(`no ${built}; run build.mjs first`); process.exit(1); }
const html = readFileSync(built, "utf8");
const source = readFileSync(join(here, "index.html"), "utf8");
const { story, flows } = JSON.parse(html.match(FLOWS_BLOCK)[1]);
const screens = flows.flatMap((f) => f.screens);
const byFile = new Map(screens.map((s) => [s.file, s]));
// The story as the page plays it: the appendix screen, with the story's own caption and people.
const storyItems = story.chapters.flatMap((c, ci) => c.screens.map((s) => {
  const base = byFile.get(s.file) || {};
  return { ...base, ...s, hotspot: s.hotspot === false ? null : base.hotspot, ci, who: s.who || c.who, where: s.where || c.where };
}));
const starts = flows.map((_, i) => flows.slice(0, i).reduce((n, f) => n + f.screens.length, 0));

// Source checks.
const newest = Math.max(statSync(join(here, "index.html")).mtimeMs, ...screens.map((s) => statSync(join(here, "assets", "screens", `${s.file}.jpg`)).mtimeMs));
if (statSync(built).mtimeMs < newest) note("the build is older than index.html or a screen; run build.mjs");
// A partial capture that could not validate shared swap rules leaves this marker until a full
// capture finishes clean; a build made in between may show fixture copy.
if (existsSync(join(here, "assets", "screens", ".partial-capture.json"))) note("the last capture was partial and left shared swap rules unvalidated; run a full capture.mjs, then build.mjs");
if (statSync(built).size > 15 * 1024 * 1024) note(`the build is ${(statSync(built).size / 1048576).toFixed(1)} MB, over 15 MB`);
const prose = [built, join(here, "index.html"), ...readdirSync(here).filter((f) => f.endsWith(".md")).map((f) => join(here, f))];
for (const file of prose) if (/—/.test(readFileSync(file, "utf8"))) note(`an em dash (U+2014) is in ${file.replace(`${here}/`, "")}`);
if (/names are changed/i.test(source) || /names are changed/i.test(html)) note('the page says "names are changed"');
const intro = (source.match(/<main class="view" id="landing">([\s\S]*?)<\/main>/) || [])[1] || "";
if (!/demo data/i.test(intro)) note('the intro does not say "demo data"');
if (!story?.chapters?.length) note("the #flows block has no story");
if (storyItems.length > MAX_STORY) note(`the story has ${storyItems.length} screens, over ${MAX_STORY}`);
const storyIds = new Set();
for (const c of story.chapters) {
  if (storyIds.has(c.id) || !ID.test(c.id)) note(`story chapter "${c.id}" is not a unique one-word id`);
  storyIds.add(c.id);
  if (!c.label || banned(c.label)) note(`story chapter ${c.id}: the label "${c.label}" is empty or uses a banned word`);
  if (!c.line || words(c.line) > 8 || banned(c.line)) note(`story chapter ${c.id}: the line "${c.line}" is empty, over eight words or uses a banned word`);
  if (!WHERE.has(c.where)) note(`story chapter ${c.id}: where is "${c.where}", not Dashboard, App or Website`);
  if (!c.screens?.length) note(`story chapter ${c.id} has no screens`);
  for (const s of c.screens || []) {
    if (!byFile.has(s.file)) note(`story chapter ${c.id}: ${s.file} is not an appendix screen`);
    if (!s.caption || words(s.caption) > 8 || banned(s.caption)) note(`story ${s.file}: the caption "${s.caption}" is empty, over eight words or uses a banned word`);
    if (s.where !== undefined && !WHERE.has(s.where)) note(`story ${s.file}: where is "${s.where}"`);
    if (s.hotspot !== undefined && s.hotspot !== false) note(`story ${s.file}: hotspot may only be false, to hide the appendix screen's`);
  }
}
for (const s of storyItems) if (!s.who || banned(s.who)) note(`story ${s.file}: who you are, "${s.who}", is empty or uses a banned word`);
const ids = new Set();
for (const flow of flows) {
  if (ids.has(flow.id)) note(`two chapters use the id ${flow.id}`);
  ids.add(flow.id);
  if (!ID.test(flow.id)) note(`${flow.id}: a chapter id must be one lowercase word, so a plain #${flow.id}-2 link opens it`);
  if (flow.id === "story") note('"story" is the story\'s own link; no appendix chapter may use it');
  if (words(flow.line) !== 5) note(`${flow.id}: the tile line "${flow.line}" is not five words`);
  if (!WHERE.has(flow.where)) note(`${flow.id}: where is "${flow.where}", not Dashboard, App or Website`);
  if (!flow.intro || sentences(flow.intro) > 2) note(`${flow.id}: the intro must be one or two sentences`);
  for (const text of [flow.label, flow.line, flow.who, flow.intro, ...flow.screens.map((s) => s.who).filter(Boolean)]) if (!text || banned(text)) note(`${flow.id}: "${text}" is empty or uses a banned word`);
  if (flow.thumb && !flow.screens.some((s) => s.file === flow.thumb)) note(`${flow.id}: its thumbnail ${flow.thumb} is not one of its screens`);
  flow.screens.forEach((s, i) => {
    const last = i === flow.screens.length - 1;
    if (words(s.caption) > 8) note(`${s.file}: the caption "${s.caption}" is over eight words`);
    if (banned(s.caption)) note(`${s.file}: the caption "${s.caption}" uses "${banned(s.caption)[0]}"`);
    if (s.step !== undefined && (!s.step || words(s.step) > 5 || banned(s.step))) note(`${s.file}: the step "${s.step}" is empty, over five words or uses a banned word`);
    if (s.where !== undefined && !WHERE.has(s.where)) note(`${s.file}: where is "${s.where}", not Dashboard, App or Website`);
    if (s.pilot !== undefined && typeof s.pilot !== "boolean") note(`${s.file}: pilot is not true or false`);
    if (!last && !s.hotspot) note(`${s.file}: no hotspot`);
    if (!s.story) note(`${s.file}: no source recorded`);
    // A screen reader hears what the screen shows, not only the chapter name and ordinal.
    if (!s.alt || s.alt.trim().length < 8) note(`${s.file}: no description of what the screen shows (alt)`);
    else if (banned(s.alt)) note(`${s.file}: the description "${s.alt}" uses "${banned(s.alt)[0]}"`);
    for (const r of rectsOf(s.back)) {
      if (!Array.isArray(r) || r.length !== 4 || r.some((n) => typeof n !== "number" || n < 0 || n > 1) || r[0] + r[2] > 1.001 || r[1] + r[3] > 1.001) note(`${s.file}: the back region ${JSON.stringify(r)} is not [x, y, w, h] inside the screen`);
      // A back region the size of the screen is a scrim, and any tap on the screen would go back.
      else if (r[2] * r[3] > 0.6) note(`${s.file}: the back region ${JSON.stringify(r)} covers most of the screen`);
    }
  });
}
console.log(`source checks: a ${storyItems.length}-screen story, ${flows.length} chapters, ${screens.length} screens, ${(statSync(built).size / 1048576).toFixed(2)} MB`);

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
// Each section reports what broke and lets the rest run, so one failure never hides another.
async function section(name, fn) {
  try { await fn(); } catch (error) { note(`${name}: ${String(error?.message || error).split("\n")[0]}`); }
}
async function withPage(options, fn) {
  const { context: c, page: p } = await openPage(options);
  try { await fn(p); } finally { await c.close(); }
}
const shotLoaded = (page) => page.waitForFunction(() => { const img = document.getElementById("shot"); return img.complete && img.naturalWidth > 0; }, null, { timeout: 5000 }).then(() => true, () => false);
const state = (page) => page.evaluate(() => ({
  view: document.body.dataset.view,
  track: document.body.dataset.track,
  at: Number(document.body.dataset.at),
  caption: document.getElementById("caption").textContent,
  who: document.getElementById("who").textContent,
  where: document.getElementById("where").hidden ? "" : document.getElementById("where").textContent,
  pilot: !document.getElementById("pilot").hidden,
  counter: document.getElementById("counter").textContent,
  next: document.getElementById("next-label").textContent,
  group: [...document.querySelectorAll("#strip .group")].findIndex((g) => g.classList.contains("current")),
  seg: [...document.querySelectorAll("#strip .seg")].findIndex((s) => s.classList.contains("now")),
}));
const atScreen = (page, track, n) => page.waitForFunction(([t, s]) => document.body.dataset.view === "player" && document.body.dataset.track === t && document.body.dataset.at === String(s), [track, n], { timeout: 3000 }).then(() => true, () => false);
const inView = (page, view) => page.waitForFunction((v) => document.body.dataset.view === v, view, { timeout: 3000 }).then(() => true, () => false);
const background = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3);
const focused = (page) => page.evaluate(() => ({ id: document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName, hidden: Boolean(document.activeElement?.closest("[hidden]")) }));
// Where the player's parts sit, to the half pixel, and whether its text fits them.
const frame = (page) => page.evaluate(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 2) / 2); };
  const caption = document.getElementById("caption");
  const range = document.createRange();
  range.selectNodeContents(caption);
  const who = document.getElementById("who");
  // Wide and landscape, the body lays the stage and the words out as two columns.
  const body = document.querySelector("#player .body");
  return {
    side: getComputedStyle(body).gridTemplateColumns.trim().split(/\s+/).length > 1,
    parts: {
      bar: box(document.querySelector("#player .bar")),
      body: box(body),
      meta: box(document.querySelector("#player .meta")),
      caption: box(caption),
      controls: box(document.querySelector("#player .controls")),
      back: box(document.getElementById("back")),
      next: box(document.getElementById("next")),
    },
    device: box(document.getElementById("device")),
    lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
    whoCut: who.scrollWidth > who.clientWidth + 1 || who.scrollHeight > who.clientHeight + 1,
    tall: document.documentElement.scrollHeight - window.innerHeight,
    wide: document.documentElement.scrollWidth - window.innerWidth,
  };
});
// The first screen's frame is the reference; any part that moves on a later screen is a problem.
function holds(name, base, now, { device = false } = {}) {
  for (const [part, b] of Object.entries(base.parts)) {
    if (now.parts[part].some((v, i) => Math.abs(v - b[i]) > 0.5)) note(`${name}: the ${part} moved, from ${JSON.stringify(b)} to ${JSON.stringify(now.parts[part])}`);
  }
  if (now.side !== base.side) note(`${name}: the player's layout changed`);
  // Beside the words, every device is centered on the body's height: a phone fills it, a desktop
  // screen is bound by its width. Under them, where the stage is wider than a desktop screen, phone
  // and desktop screens share a top and bottom.
  const middle = (d) => d[1] + d[3] / 2;
  if (now.side && Math.abs(middle(now.device) - middle(base.device)) > 1) note(`${name}: the device's middle moved, from ${JSON.stringify(base.device)} to ${JSON.stringify(now.device)}`);
  if (!now.side && device && (Math.abs(now.device[1] - base.device[1]) > 1 || Math.abs(now.device[1] + now.device[3] - base.device[1] - base.device[3]) > 1)) note(`${name}: the device's top or bottom moved, from ${JSON.stringify(base.device)} to ${JSON.stringify(now.device)}`);
  if (now.lines > 2) note(`${name}: the caption runs to ${now.lines} lines`);
  if (now.whoCut) note(`${name}: who you are is cut off`);
  if (now.tall > 1) note(`${name}: the page scrolls by ${now.tall}px`);
  if (now.wide > 0) note(`${name}: the page scrolls sideways by ${now.wide}px`);
}
async function expectItem(page, name, item, { counter, last }) {
  if (!(await shotLoaded(page))) note(`${name}: the screen image did not load`);
  const s = await state(page);
  if (s.caption !== item.caption) note(`${name}: caption "${s.caption}" differs from "${item.caption}"`);
  if (s.who !== item.who) note(`${name}: shows "${s.who}" for who you are, not "${item.who}"`);
  if (s.where !== (item.where || "")) note(`${name}: shows "${s.where}" for where, not "${item.where}"`);
  if (s.pilot !== Boolean(item.pilot)) note(`${name}: the "In pilot" chip is ${s.pilot ? "shown" : "missing"}`);
  if (s.counter !== counter) note(`${name}: the counter says "${s.counter}", not "${counter}"`);
  if (s.next !== (last ? "Finish" : "Next")) note(`${name}: Next says "${s.next}"`);
  return s;
}
async function hotspotOf(page, name) {
  const scr = await page.locator("#screen").boundingBox();
  const hot = await page.locator("#hotspot").boundingBox();
  if (hot && (hot.width < 24 || hot.height < 24)) note(`${name}: the hotspot is too small`);
  if (hot && (hot.x < scr.x - 8 || hot.y < scr.y - 8 || hot.x + hot.width > scr.x + scr.width + 8 || hot.y + hot.height > scr.y + scr.height + 8)) note(`${name}: the hotspot leaves the screen`);
  return { scr, hot };
}
// Moves on the way a viewer would: the hotspot where the screen has one, else Next.
async function advance(page, item) {
  if (item.hotspot) await page.click("#hotspot"); else await page.click("#next");
}
const shots = [];
const backed = [];

const { context, page } = await openPage();
await section("intro", async () => {
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const intro = await page.evaluate(() => ({
    chapters: [...document.querySelectorAll("#outline .chapter")].map((b) => b.querySelector(".cname").textContent),
    hero: (() => { const img = document.getElementById("hero-img"); return img.complete && img.naturalWidth > 0 && img.getBoundingClientRect().width > 0; })(),
    facts: document.getElementById("facts").textContent,
    text: document.body.innerText,
  }));
  if (intro.chapters.join("|") !== story.chapters.map((c) => c.label).join("|")) note(`the intro lists the chapters ${JSON.stringify(intro.chapters)}`);
  if (!intro.hero) note("the intro's shot did not load at 1440");
  if (!intro.facts.includes(`${storyItems.length} screens`)) note(`the intro's facts do not say "${storyItems.length} screens": "${intro.facts}"`);
  if (!/demo data/i.test(intro.facts)) note('the intro\'s facts do not say "demo data"');
  if (/names are changed/i.test(intro.text)) note('the rendered page says "names are changed"');
  await page.screenshot({ path: join(out, "intro-1440.png") });
});

// The story, from Start to the close.
await section("story", async () => {
  if ((await state(page)).view !== "landing") await page.goto(`${url}#intro`, { waitUntil: "load" });
  await page.click("#start");
  if ((await focused(page)).id !== "next") note(`after Start, focus sits on "${(await focused(page)).id}", not on Next`);
  let base = null;
  for (const [i, item] of storyItems.entries()) {
    const name = `story ${i + 1} (${item.file})`;
    if (!(await atScreen(page, "story", i + 1))) {
      note(`${name}: expected the story's screen ${i + 1}, found ${JSON.stringify(await state(page).catch(() => "no demo page"))}`);
      await page.goto(`${url}#story-${i + 1}`, { waitUntil: "load" });
    }
    const last = i === storyItems.length - 1;
    const s = await expectItem(page, name, item, { counter: `${i + 1} of ${storyItems.length}`, last });
    if (s.group !== item.ci) note(`${name}: the strip marks chapter ${s.group + 1}, not ${item.ci + 1}`);
    if (s.seg !== i) note(`${name}: the strip marks screen ${s.seg + 1}, not ${i + 1}`);
    const now = await frame(page);
    base ??= now;
    holds(name, base, now, { device: true });
    const { hot } = await hotspotOf(page, name);
    if (Boolean(hot) !== Boolean(item.hotspot)) note(`${name}: the hotspot is ${hot ? "shown" : "missing"}`);
    const file = join(out, `story-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    shots.push(file);
    await advance(page, item);
  }
  if (!(await inView(page, "end"))) note(`Finish on the story's last screen opened ${JSON.stringify(await state(page))}`);
  if ((await focused(page)).id !== "end-steps") note(`at the close, focus sits on "${(await focused(page)).id}"`);
  await page.screenshot({ path: join(out, "close-1440.png") });
  await page.click("#end-steps");
  if (!(await inView(page, "steps"))) note('"See every step" did not open every step');
});

// Every step, chapter by chapter.
let stepsBase = null;
for (const [ci, flow] of flows.entries()) {
  await section(`steps ${flow.id}`, async () => {
    if ((await state(page)).view !== "steps") await page.goto(`${url}#steps`, { waitUntil: "load" });
    if (ci === 0) {
      const tiles = await page.$$eval(".tile", (els) => els.map((el) => ({ id: el.id, loaded: [...el.querySelectorAll("img")].every((img) => img.complete && img.naturalWidth > 0) })));
      if (tiles.length !== flows.length) note(`every step shows ${tiles.length} tiles for ${flows.length} chapters`);
      tiles.forEach((t) => { if (!t.loaded) note(`${t.id}: its thumbnail did not load`); });
      await page.screenshot({ path: join(out, "steps-1440.png") });
    }
    await page.click(`#tile-${flow.id}`);
    for (const [i, raw] of flow.screens.entries()) {
      const item = { ...raw, who: raw.who || flow.who, where: raw.where || flow.where };
      const n = starts[ci] + i + 1;
      const name = `${raw.file}`;
      if (!(await atScreen(page, "steps", n))) {
        note(`${name}: expected ${flow.id} screen ${i + 1}, found ${JSON.stringify(await state(page).catch(() => "no demo page"))}`);
        await page.goto(`${url}#${flow.id}-${i + 1}`, { waitUntil: "load" });
      }
      const lastOfAll = ci === flows.length - 1 && i === flow.screens.length - 1;
      const s = await expectItem(page, name, item, { counter: `${i + 1} of ${flow.screens.length}`, last: lastOfAll });
      if (s.group !== ci) note(`${name}: the strip marks chapter ${s.group + 1}, not ${ci + 1}`);
      const now = await frame(page);
      stepsBase ??= now;
      holds(name, stepsBase, now, { device: true });
      const { scr, hot } = await hotspotOf(page, name);
      if (Boolean(hot) !== Boolean(item.hotspot)) note(`${name}: the hotspot is ${hot ? "shown" : "missing"}`);
      const file = join(out, `${raw.file}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
      const backs = await page.$$eval("#backspots .backspot", (els) => els.map((b) => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, label: b.getAttribute("aria-label") }; }));
      if (backs.length !== rectsOf(raw.back).length) note(`${name}: ${backs.length} back regions for ${rectsOf(raw.back).length} declared`);
      if (hot) {
        // On every screen, a tap beside the hotspot, and beside any back region, must not move.
        const corners = [[scr.x + 14, scr.y + 14], [scr.x + scr.width - 14, scr.y + 14], [scr.x + 14, scr.y + scr.height - 14], [scr.x + scr.width - 14, scr.y + scr.height - 14]];
        const free = corners.find((p) => !inside(p, hot) && backs.every((b) => !inside(p, b)));
        if (!free) note(`${name}: every corner sits under the hotspot or a back region`);
        else {
          await page.mouse.click(free[0], free[1]);
          if (!(await atScreen(page, "steps", n))) note(`${name}: a tap beside the hotspot moved the chapter`);
        }
      }
      // The app's own back controls go back one screen, and the browser's back returns here.
      for (const [j, b] of backs.entries()) {
        if (b.label !== "Back") note(`${name}: a back region is labeled "${b.label}"`);
        if (b.x < scr.x - 8 || b.y < scr.y - 8 || b.x + b.width > scr.x + scr.width + 8 || b.y + b.height > scr.y + scr.height + 8) note(`${name}: a back region leaves the screen`);
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        const went = n > 1 ? await atScreen(page, "steps", n - 1) : await inView(page, "steps");
        if (!went) note(`${name}: back region ${j + 1} opened ${JSON.stringify(await state(page))}`);
        await page.evaluate(() => history.back());
        if (!(await atScreen(page, "steps", n))) {
          note(`${name}: the browser's back did not return after back region ${j + 1}`);
          await page.goto(`${url}#${flow.id}-${i + 1}`, { waitUntil: "load" });
        }
        backed.push(`${name} region ${j + 1}`);
      }
      await advance(page, item);
    }
    const nextFlow = flows[ci + 1];
    if (nextFlow && !(await atScreen(page, "steps", starts[ci + 1] + 1))) note(`${flow.id}: its last screen did not open ${nextFlow.id}`);
    if (!nextFlow && !(await inView(page, "steps"))) note(`${flow.id}: Finish did not return to every step`);
  });
}
if (!screens.some((s) => s.back)) note("no screen declares a back region, so the in-screen back went unchecked");

await section("keys and controls", async () => {
  await page.goto(`${url}#story-2`, { waitUntil: "load" });
  await page.keyboard.press("ArrowRight");
  if (!(await atScreen(page, "story", 3))) note("Right arrow did not advance");
  await page.keyboard.press("ArrowLeft");
  if (!(await atScreen(page, "story", 2))) note("Left arrow did not go back");
  await page.click("#back");
  if (!(await atScreen(page, "story", 1))) note("Back did not go back");
  await page.click("#back");
  if (!(await inView(page, "landing"))) note("Back on the story's first screen did not return to the intro");
  await page.goto(`${url}#story-3`, { waitUntil: "load" });
  await page.keyboard.press("Escape");
  if (!(await inView(page, "landing"))) note("Escape did not return to the intro");
  await page.goto(`${url}#${flows[1].id}-2`, { waitUntil: "load" });
  await page.click("#home");
  if (!(await inView(page, "steps"))) note('"Chapters" did not return to every step');
  await page.click(`#tile-${flows[1].id}`);
  await page.click("#back");
  if (!(await atScreen(page, "steps", starts[1]))) note(`Back on ${flows[1].id}'s first screen did not open ${flows[0].id}'s last`);
  await page.goto(`${url}#story-1`, { waitUntil: "load" });
  await page.click(`#strip .group:nth-child(${Math.min(3, story.chapters.length)}) .glabel`);
  const jump = story.chapters.slice(0, Math.min(3, story.chapters.length) - 1).reduce((n, c) => n + c.screens.length, 0) + 1;
  if (!(await atScreen(page, "story", jump))) note(`the strip's chapter did not open the story's screen ${jump}`);
  await page.click("#strip .seg >> nth=1");
  if (!(await atScreen(page, "story", 2))) note("a strip bar did not open its screen");
});

// Focus stays on a control a keyboard user can see: Next, when the hotspot or a back region they
// held goes away, and the new view's first control when the button they pressed hides with its view.
await section("keyboard focus", async () => {
  const gap = storyItems.findIndex((s, i) => s.hotspot && storyItems[i + 1] && !storyItems[i + 1].hotspot);
  if (gap >= 0) {
    await page.goto(`${url}#story-${gap + 1}`, { waitUntil: "load" });
    await page.focus("#hotspot");
    await page.keyboard.press("Enter");
    if (!(await atScreen(page, "story", gap + 2))) note(`Enter on the hotspot of story ${gap + 1} did not advance`);
    const f = await focused(page);
    if (f.id !== "next" || f.hidden) note(`after the hotspot went away, focus sits on "${f.id}"`);
  }
  const withBack = starts.length && flows.flatMap((fl, ci) => fl.screens.map((s, i) => ({ s, n: starts[ci] + i + 1 }))).find(({ s, n }) => s.back && n > 1);
  if (withBack) {
    const flow = flows.find((fl) => fl.screens.includes(withBack.s));
    await page.goto(`${url}#${flow.id}-${flow.screens.indexOf(withBack.s) + 1}`, { waitUntil: "load" });
    await page.focus("#backspots .backspot");
    await page.keyboard.press("Enter");
    if (!(await atScreen(page, "steps", withBack.n - 1))) note(`Enter on ${withBack.s.file}'s back region did not go back`);
    const f = await focused(page);
    if (f.hidden || !["next", "backspot"].includes(f.id)) note(`after a back region, focus sits on "${f.id}"`);
  }
  await page.goto(`${url}#story-1`, { waitUntil: "load" });
  await page.focus("#next");
  for (let i = 1; i < storyItems.length; i += 1) await page.keyboard.press("Enter");
  if (!(await atScreen(page, "story", storyItems.length))) note("Enter on Next did not walk the story to its last screen");
  // A link, then the button pressed on its view, each leave focus on the new view's first control.
  const firstControl = { landing: "start", end: "end-steps", steps: `tile-${flows[0].id}` };
  const lands = async (how, view) => {
    if (!(await inView(page, view))) note(`${how} opened ${JSON.stringify(await state(page))}`);
    const f = await focused(page);
    if (f.id !== firstControl[view] || f.hidden) note(`after ${how}, focus sits on "${f.id}", not on #${firstControl[view]}`);
  };
  for (const [hash, view, button, next] of [["#steps", "steps", "steps-home", "landing"], ["#end", "end", "end-steps", "steps"], ["#intro", "landing", "see-steps", "steps"]]) {
    await page.goto(`${url}${hash}`, { waitUntil: "load" });
    await lands(hash, view);
    await page.focus(`#${button}`);
    await page.keyboard.press("Enter");
    await lands(`Enter on #${button}`, next);
  }
});

await section("links and history", async () => {
  const cases = [["#story-5", () => atScreen(page, "story", Math.min(5, storyItems.length))], [`#${flows[Math.min(3, flows.length - 1)].id}-3`, () => atScreen(page, "steps", starts[Math.min(3, flows.length - 1)] + Math.min(3, flows[Math.min(3, flows.length - 1)].screens.length))], [`#/${flows[2].id}/3`, () => atScreen(page, "steps", starts[2] + Math.min(3, flows[2].screens.length))], ["#end", () => inView(page, "end")], ["#steps", () => inView(page, "steps")], ["#intro", () => inView(page, "landing")]];
  for (const [hash, ok] of cases) {
    await page.goto(`${url}${hash}`, { waitUntil: "load" });
    if (!(await ok())) note(`${hash} opened ${JSON.stringify(await state(page))}`);
  }
  await page.goto(`${url}#story-3`, { waitUntil: "load" });
  await page.click("#next");
  await page.evaluate(() => history.back());
  if (!(await atScreen(page, "story", 3))) note("the browser's back did not return to the story's screen 3");
  await page.evaluate(() => history.forward());
  if (!(await atScreen(page, "story", 4))) note("the browser's forward did not return to the story's screen 4");
  await page.click("#home");
  await page.evaluate(() => history.back());
  if (!(await atScreen(page, "story", 4))) note('the browser\'s back from the intro did not reopen the screen "Intro" left');
});
await context.close();

// The artifact copy is the same page without its document wrapper. It has to exist, be as new as
// the build, equal what build.mjs derives from this build, and work inside the wrapper the Artifact
// tool adds: a deep link opens its screen, the intro's shot loads, and every chapter tile's
// thumbnail loads.
await section("artifact copy", async () => {
  const artifact = join(out, "artifact.html");
  if (!existsSync(artifact)) { note("no output/artifact.html; run build.mjs"); return; }
  if (statSync(artifact).mtimeMs < newest) note("output/artifact.html is older than index.html or a screen; run build.mjs");
  const derived = html
    .replace(/<!DOCTYPE html>\s*/i, "")
    .replace(/<html[^>]*>\s*/i, "")
    .replace(/<\/html>\s*$/i, "")
    .replace(/<head>\s*/i, "")
    .replace(/\s*<\/head>/i, "")
    .replace(/<body>\s*/i, "")
    .replace(/\s*<\/body>/i, "")
    .replace(/<meta charset="UTF-8" \/>\s*/i, "")
    .replace(/<meta name="viewport"[^>]*>\s*/i, "");
  const artifactHtml = readFileSync(artifact, "utf8");
  if (artifactHtml !== derived) note("output/artifact.html does not match this build; run build.mjs");
  const wrapped = join(out, ".artifact-wrapped.html");
  writeFileSync(wrapped, `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n${artifactHtml}\n</body></html>`);
  try {
    await withPage({}, async (ap) => {
      await ap.goto(`${pathToFileURL(wrapped).href}#work-3`, { waitUntil: "load" });
      await ap.evaluate(() => document.fonts.ready);
      if (!(await shotLoaded(ap))) note("artifact: the #work-3 screen did not load inside the wrapper");
      const work = flows.findIndex((f) => f.id === "work");
      if (!(await atScreen(ap, "steps", starts[work] + 3))) note(`artifact: the #work-3 link opened ${JSON.stringify(await state(ap))} inside the wrapper`);
      await ap.goto(pathToFileURL(wrapped).href, { waitUntil: "load" });
      if (!(await ap.evaluate(() => { const img = document.getElementById("hero-img"); return img.complete && img.naturalWidth > 0; }))) note("artifact: the intro's shot did not load inside the wrapper");
      await ap.goto(`${pathToFileURL(wrapped).href}#steps`, { waitUntil: "load" });
      const loaded = await ap.$$eval(".tile", (els) => els.filter((el) => [...el.querySelectorAll("img")].every((img) => img.complete && img.naturalWidth > 0)).length);
      if (loaded !== flows.length) note(`artifact: ${loaded} of ${flows.length} chapter tiles loaded inside the wrapper`);
    });
  } finally {
    rmSync(wrapped, { force: true });
  }
});

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
  if ((await p.getAttribute("#theme-player", "aria-checked")) !== "true") note("the player's switch does not show the dark pick");
  await p.goto(`${url}#story-6`, { waitUntil: "load" });
  await p.screenshot({ path: join(out, "story-dark-1440.png") });
  await p.click("#theme-player");
  await p.reload({ waitUntil: "load" });
  if ((await themeOf()) !== "light" || (await background(p)) < 200) note("the light pick did not survive a reload");
}));

// The story holds its place at other sizes too.
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
for (const [name, options] of [["1280x720", { viewport: { width: 1280, height: 720 } }], ["768x1024", { viewport: { width: 768, height: 1024 } }], ["390x844", PHONE]]) {
  await section(`story at ${name}`, () => withPage(options, async (p) => {
    let base = null;
    for (let i = 0; i < storyItems.length; i += 1) {
      await p.goto(`${url}#story-${i + 1}`, { waitUntil: "load" });
      await p.evaluate(() => document.fonts.ready);
      if (!(await shotLoaded(p))) note(`story ${i + 1} at ${name}: the screen image did not load`);
      const now = await frame(p);
      base ??= now;
      // Narrower than a desktop screen, the stage letterboxes it, so only a wide stage pins the device.
      holds(`story ${i + 1} at ${name}`, base, now, { device: options.viewport.width / options.viewport.height > 1.5 });
      if (i === 0 || i === storyItems.findIndex((s) => s.device === "desktop")) await p.screenshot({ path: join(out, `story-${i + 1}-${name}.png`) });
    }
  }));
}

// The other views at phone width and in dark mode: no sideways scroll, and the right ground.
const views = [
  ["intro-dark-1440", { colorScheme: "dark" }, "#intro"],
  ["intro-390", { ...PHONE, colorScheme: "light" }, "#intro"],
  ["intro-dark-390", { ...PHONE, colorScheme: "dark" }, "#intro"],
  ["close-390", { ...PHONE, colorScheme: "light" }, "#end"],
  ["steps-390", { ...PHONE, colorScheme: "light" }, "#steps"],
  ["steps-dark-1440", { colorScheme: "dark" }, "#steps"],
  ...flows.map((f) => [`phone-${f.id}`, { ...PHONE, colorScheme: "light" }, `#${f.id}-1`]),
];
for (const [name, options, hash] of views) {
  await section(name, () => withPage(options, async (p) => {
    await p.goto(`${url}${hash}`, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    const player = (await state(p)).view === "player";
    if (player && !(await shotLoaded(p))) note(`${name}: the screen image did not load`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (wide > 0) note(`${name}: the page scrolls sideways by ${wide}px`);
    if (player && !(await p.locator("#home").isVisible())) note(`${name}: the way back to the chapters is not visible`);
    if (player && !(await p.locator("#who").isVisible())) note(`${name}: who you are is not visible`);
    const shade = await background(p);
    if (options.colorScheme === "dark" && shade > 80) note(`${name}: the background is not dark`);
    if (options.colorScheme === "light" && shade < 200) note(`${name}: the background is not light`);
    await p.screenshot({ path: join(out, `${name}.png`) });
  }));
}

// Contact sheet of every screen as the player shows it.
const sheet = join(out, "contact-sheet.html");
writeFileSync(sheet, `<!DOCTYPE html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#EEE8DE;font:600 18px Inter,system-ui,sans-serif;color:#292524}main{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}figure{margin:0}img{width:100%;display:block;border:1px solid #D9D1C5}figcaption{margin-top:6px}</style><main>${shots.map((f) => `<figure><img src="${pathToFileURL(f).href}"><figcaption>${f.split("/").pop().replace(".png", "")}</figcaption></figure>`).join("")}</main>`);
{
  const { context: c, page: p } = await openPage({ viewport: { width: 2400, height: 1200 } });
  await p.goto(pathToFileURL(sheet).href, { waitUntil: "load" });
  await p.screenshot({ path: join(out, "contact-sheet.png"), fullPage: true });
  await c.close();
}
await browser.close();
console.log(`rendered checks: ${shots.length} screens screenshot to ${out}, ${backed.length} back regions walked, contact sheet written${problems.length ? "" : ", all good"}`);
process.exit(problems.length ? 1 : 0);
