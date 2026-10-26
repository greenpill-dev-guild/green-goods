// Captures the clickable demo's screens into ./assets/screens (not committed) and writes each
// screen's story, size and measured hotspot into index.html's #flows block.
// Usage, from the repository root (needs the repository's Playwright install and network access):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs                  every screen
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs --only=work-3   single screens
// Storybook screens come from the deployed Storybook at design.greengoods.app: real components
// with demo data. The Funding flow's public pages come from greengoods.app as they stand.
// After a screen renders, demo copy is swapped in its text (see SWAPS and README.md) and, on the
// garden page, the banner photo; components, layout, controls and state stay as rendered. Where a
// recipe lists actions, they are the clicks and typing a person would do in that same screen.
// Exits with status 1 when a swap matched nothing, a hotspot target is missing or off screen, or a
// fixture name survives the swaps.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "assets", "screens");
const htmlPath = join(here, "index.html");
mkdirSync(out, { recursive: true });
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").replace("--only=", "").split(",").filter(Boolean);
const problems = [];
const note = (message) => { problems.push(message); console.log(`  problem: ${message}`); };

const PHONE = { width: 390, height: 844, scale: 2 };
const DESKTOP = { width: 1440, height: 900, scale: 1.5 };
const story = (id) => `https://design.greengoods.app/iframe.html?viewMode=story&id=${id}`;

// The hub banner: the approved Awka photo when it is present locally (README, Photos).
const photoCandidates = [join(here, "assets", "photos", "awka-hub.jpg"), join(here, "..", "deck", "assets", "photos", "awka-hub.jpg")];
const bannerPath = photoCandidates.find((p) => existsSync(p));
const banner = bannerPath ? `data:image/jpeg;base64,${readFileSync(bannerPath).toString("base64")}` : null;

// Demo copy. Each pair replaces exact text inside text nodes and in alt, aria-label, title,
// placeholder and field values; `nth` limits a pair to one occurrence of its text in page order.
const PLACE = [
  ["Riverside Commons Garden", "TAS Hub"],
  ["Riverside District", "Awka, Nigeria"],
  ["Rio Rainforest Lab", "TAS Hub"],
  ["Botanic Commons", "TAS Hub"],
  ["riverside-commons.example", "tas-hub.example"],
];
const SEASONS = [
  ["Autumn Planting 2026", "Hub season 1"],
  ["Summer 2026", "Pilot season"],
  ["Seed Swap Weekend", "Solar classroom build"],
];
const PEOPLE = [["tomas", "emeka"], ["vault-owner.eth", "ngozi.eth"]];
const REQUEST = "Mentor a new builder";
const REQUEST_ASK = "Spend two hours with one new builder on their first project, then share a short note.";
// The promise the judge takes up, in every Promise screen that names it.
const PROMISE = [
  ["Survey household water use on Mill Lane", REQUEST],
  ["Repair the north fence panel by the compost bays before the first frost", REQUEST],
  ["Visit one household, ask the six survey questions, and photograph the meter.", REQUEST_ASK],
  ["Two slats are split and loose after the storm. Materials are in the tool shed.", REQUEST_ASK],
  ["Replaced two split slats and secured the panel. Dele helped with measuring and fastening.", "Helped Obi build his first web page. Dele joined for the last hour."],
  ["receipts/fence-posts", "notes/first-web-page"],
  ["1 repair", "2 hours"],
  ["Oct 20, 2026", "Oct 30, 2026"],
  ["Repair notes", "Mentoring notes"],
];
// The rest of the Promises tab, so the list reads as the hub's.
const POOL_LIST = [
  ["Repair the north fence panel by the compost bays before the first frost", "Fix the hub's router before Friday's class"],
  ["Survey one household about rain barrel use", "Clean the solar panels on Saturday", 1],
  ["Survey one household about rain barrel use", "Host the weekly climate discussion"],
  ["Water the seedling beds every morning while the Okafor family is traveling", "Lend my spare laptop to a new builder"],
  ["Lend the seed dibber set for the swap weekend", "Set up the solar classroom lights"],
  ["Two hours sorting the seed library", REQUEST],
  ["Teach the composting basics workshop for new members", "Teach the coding basics workshop for new members"],
];
// The steward's assessment: what the hub needs, in the form's own Solar metrics.
const ASSESSMENT_TITLE = "Steady power and internet at the hub";
const ASSESSMENT_ABOUT = "Hours of power and working internet each day, measured before the solar classroom opens.";
const ASSESSMENT = [
  ["East plot, Rio Rainforest Lab", "TAS Hub", 0],
  ["East plot, Rio Rainforest Lab", "Awka, Nigeria"],
  ["Agroforestry", "Solar"],
  ["Rio canopy baseline, wet season", ASSESSMENT_TITLE],
  ["Canopy cover and seedling survival across the east plot, measured before the wet-season planting.", ASSESSMENT_ABOUT],
  ["Cattle grazing thinned the canopy along the east boundary, and the seedlings planted last season have no shade.", "Power cuts stop classes most afternoons, and the internet drops when the hub is full."],
  ["The east plot regains its canopy", "The hub keeps steady power all day"],
  ["Trees planted · 200 trees", "Energy generated · 900 kWh"],
  ["Seedlings survive their first dry season", "Two more hubs open nearby"],
  ["Area covered · 5 ha", "Hubs onboarded · 2 hubs"],
  ["Canopy baseline", "Hub Service Session"],
];
const FUNDER = [["Greenpill NYC", "TAS Hub"], ...PEOPLE];
const STORY_COPY = [...PLACE, ...SEASONS, ...PEOPLE];

// Fixture text that must not survive a swap (the Funding flow's live pages are exempt).
const LEFTOVERS = ["Riverside", "Rio Rainforest", "Rio canopy", "Botanic Commons", "Mill Lane", "frost", "fence panel", "Autumn Planting", "Seed Swap", "tomas", "Greenpill NYC", "vault-owner", "Cerrado", "rain barrel"];

// One recipe per screen, keyed by the file name in index.html's #flows block. `tap` names the
// control the hotspot sits on, measured after the swaps; the last screen of a flow has none.
const SHOTS = {
  "needs-1": { url: story("admin-workspaces-hub--assessments-tab"), device: DESKTOP, swaps: [...STORY_COPY, ["Rainforest canopy strategy", "Tree planting plan for the hub"]], tap: { role: "button", name: "Create Assessment" } },
  "needs-2": {
    url: story("admin-workspaces-hub--create-assessment-route"), device: DESKTOP, swaps: STORY_COPY,
    actions: [
      { click: { role: "radio", name: "Solar" } },
      { fill: { label: /^Title/ }, value: ASSESSMENT_TITLE },
      { fill: { label: /^Location/ }, value: "Awka, Nigeria" },
      { fill: { label: /^Description/ }, value: ASSESSMENT_ABOUT },
    ],
    tap: { role: "button", name: "Next" },
  },
  "needs-3": { url: story("admin-workflows-assessment-reviewstep--in-flow-ready"), device: DESKTOP, swaps: [...ASSESSMENT, ...STORY_COPY], tap: { role: "button", name: "Submit Assessment" } },
  "needs-4": { url: story("admin-workflows-assessment-reviewstep--in-flow-sent"), device: DESKTOP, swaps: [...ASSESSMENT, ...STORY_COPY], tap: { role: "button", name: "Done" } },
  "needs-5": { url: story("client-garden-assessments--solar"), device: PHONE, swaps: [["Reliable solar power for households in the garden community", ASSESSMENT_TITLE], ["Oct 18, 2025 – Jan 16, 2026", "Jul 1, 2026 – Sep 30, 2026"], ...STORY_COPY] },

  "promise-1": { url: story("client-commitments-gardenpool--live"), device: PHONE, banner: true, swaps: [...POOL_LIST, ...STORY_COPY], scrollTo: { text: REQUEST, margin: 128 }, tap: { text: REQUEST } },
  "promise-2": { url: story("client-commitments-promisegrouppage--open"), device: PHONE, swaps: [...PROMISE, ...STORY_COPY], tap: { role: "button", name: "Take Up One" } },
  "promise-3": { url: story("client-commitments-takeuponesheet--ready"), device: PHONE, swaps: [...PROMISE, ...STORY_COPY], tap: { role: "button", name: "Take Up One" } },
  "promise-4": { url: story("client-commitments-proofcomposer--details"), device: PHONE, swaps: [...PROMISE, ...STORY_COPY], tap: { role: "button", name: "Review Proof" } },
  "promise-5": { url: story("client-commitments-confirmsheet--ask-garden-work"), device: PHONE, swaps: STORY_COPY, tap: { role: "button", name: "Confirm the Work Was Done" } },
  "promise-6": { url: story("client-commitments-gardencommitment--kept"), device: PHONE, swaps: [...PROMISE, ...STORY_COPY] },

  "work-1": { url: story("client-work-submitwork--media-with-example-photo"), device: PHONE, swaps: STORY_COPY, tap: { role: "button", name: "Details" } },
  "work-2": { url: story("client-work-submitwork--review-with-example-photo"), device: PHONE, swaps: STORY_COPY, tap: { role: "button", name: "Upload Work" } },
  "work-3": { url: story("client-garden-gardenwork--all-work"), device: PHONE, swaps: [["Compost Turn", "Seedling Transplant", 0], ...STORY_COPY], tap: { text: "Seedling Transplant" } },
  "work-4": { url: story("client-work-reviewwork--evaluate-example"), device: PHONE, swaps: STORY_COPY, tap: { role: "button", name: "Approve" } },
  "work-5": { url: story("client-work-reviewwork--feedback-example"), device: PHONE, swaps: STORY_COPY, tap: { role: "button", name: "Submit" } },
  "work-6": { url: story("client-work-workdashboard--completed-with-example-photo"), device: PHONE, swaps: STORY_COPY },

  "funding-1": { url: "https://greengoods.app/gardens/tas-hub", live: true, device: DESKTOP, tap: { role: "link", name: "Fund" } },
  "funding-2": { url: "https://greengoods.app/fund", live: true, device: DESKTOP, scrollTo: { text: "TAS HUB", align: "start" }, tap: { card: "TAS HUB", role: "button", name: "Endow" } },
  "funding-3": {
    url: "https://greengoods.app/fund", live: true, device: DESKTOP, scrollTo: { text: "TAS HUB", align: "start" },
    actions: [{ click: { card: "TAS HUB", role: "button", name: "Endow" } }, { fill: { css: '[role="dialog"] input' }, value: "50" }],
    tap: { role: "button", name: "Connect Wallet" },
  },
  "funding-4": { url: story("client-public-vault-vaultmanagepositionspanel--positions"), device: DESKTOP, swaps: FUNDER, tap: { role: "button", name: "Close Manage Endowments" } },
  "funding-5": { url: "https://greengoods.app/gardens/tas-hub", live: true, device: DESKTOP, scrollTo: { text: "Recent approved submissions", align: "start" } },
};

function locate(page, spec) {
  let scope = page;
  if (spec.card) scope = page.locator("article, li, section > div, div").filter({ hasText: spec.card }).filter({ has: page.getByRole(spec.role, { name: spec.name, exact: true }) }).last();
  if (spec.css) return scope.locator(spec.css).first();
  if (spec.label) return scope.getByLabel(spec.label).first();
  if (spec.role) return scope.getByRole(spec.role, { name: spec.name, exact: true }).first();
  // A row or card that opens something: the nearest pressable ancestor of its text.
  return scope.getByText(spec.text, { exact: true }).first()
    .locator("xpath=ancestor-or-self::*[self::button or self::a or @role='button' or @role='link' or @data-pressable][1]");
}

async function hotspotBox(page, spec) {
  const target = locate(page, spec);
  if (await target.count()) return target.boundingBox();
  return spec.text ? page.getByText(spec.text, { exact: true }).first().boundingBox() : null;
}

async function applySwaps(page, swaps, withNth) {
  return page.evaluate(({ rules, withNth }) => {
    const hits = rules.map(() => 0);
    const seen = rules.map(() => 0);
    // A pair with `nth` counts only text a person can see (not, say, a closed select's options),
    // and only on the first pass, since a later pass would count the already swapped page again.
    const replace = (value, counted) => {
      let v = value;
      rules.forEach(([from, to, nth], i) => {
        if (!v.includes(from)) return;
        if (nth !== undefined) {
          if (!counted || !withNth) return;
          const index = seen[i];
          seen[i] += 1;
          if (index !== nth) return;
        }
        v = v.split(from).join(to);
        hits[i] += 1;
      });
      return v;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const shown = Boolean(node.parentElement?.getClientRects().length);
      const next = replace(node.nodeValue, shown);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    for (const el of document.querySelectorAll("*")) {
      for (const name of ["alt", "aria-label", "title", "placeholder"]) {
        const value = el.getAttribute(name);
        if (value) { const next = replace(value, false); if (next !== value) el.setAttribute(name, next); }
      }
      if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.value) {
        const next = replace(el.value, false);
        if (next !== el.value) el.value = next;
      }
    }
    return hits;
  }, { rules: swaps, withNth });
}

async function swapBanner(page) {
  return page.evaluate(async (src) => {
    const imgs = [...document.querySelectorAll("img")].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.top < 40 && r.width > 300 && r.height > 100;
    });
    for (const img of imgs) {
      img.closest("picture")?.querySelectorAll("source").forEach((s) => s.remove());
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = src;
      img.alt = "TAS Hub in Awka";
      await img.decode().catch(() => {});
    }
    return imgs.length;
  }, banner);
}

async function scrollTarget(page, spec) {
  let target = locate(page, spec);
  if (!(await target.count()) && spec.text) target = page.getByText(spec.text, { exact: true }).first();
  await target.waitFor({ state: "attached", timeout: 30000 });
  await target.evaluate((el, { align, margin }) => {
    // Scroll the nearest scrolling ancestor (or the page) so the target sits inside the screen,
    // its top 96px below the top edge, or its bottom `margin` above the bottom edge.
    let box = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    const r = el.getBoundingClientRect();
    const by = align === "start" ? r.top - 96 : r.bottom - (window.innerHeight - margin);
    if (align !== "start" && by <= 0) return;
    if (box) box.scrollBy(0, by); else window.scrollBy(0, by);
  }, { align: spec.align || "end", margin: spec.margin ?? 24 });
}

async function capture(browser, file, shot) {
  const { width, height, scale } = shot.device;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: "light", reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(shot.url, { waitUntil: "networkidle", timeout: 90000 });
    if (!shot.live) await page.waitForSelector("#storybook-root > *", { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(shot.live ? 6000 : 3000);
    if (shot.banner) {
      if (!banner) console.log(`  ${file}: awka-hub.jpg is not present locally; the fixture banner stays`);
      else if (!(await swapBanner(page))) note(`${file}: no banner image found to swap`);
    }
    // Swap first so scroll and hotspot targets can name the demo copy, then again after the
    // scroll, the actions and a short wait, in case a re-render restored fixture text.
    const hits = (shot.swaps || []).map(() => 0);
    const swap = async (withNth) => { if (shot.swaps) (await applySwaps(page, shot.swaps, withNth)).forEach((n, i) => { hits[i] += n; }); };
    await swap(true);
    if (shot.scrollTo) { await scrollTarget(page, shot.scrollTo); await page.waitForTimeout(shot.live ? 3000 : 800); }
    for (const action of shot.actions || []) {
      const target = locate(page, action.click || action.fill);
      if (action.click) await target.click({ force: true, timeout: 15000 });
      if (action.fill) await target.fill(action.value, { timeout: 15000 });
      await page.waitForTimeout(shot.live ? 2500 : 700);
    }
    await page.waitForTimeout(500);
    await swap(false);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.mouse.move(1, 1);
    await page.waitForTimeout(400);
    (shot.swaps || []).forEach(([from, to], i) => { swapHits.set(`${from} → ${to}`, (swapHits.get(`${from} → ${to}`) || 0) + hits[i]); });
    const used = (shot.swaps || []).filter((_, i) => hits[i] > 0).map(([from, to]) => `${from} → ${to}`);
    if (!shot.live) {
      const text = await page.evaluate(() => document.body.innerText);
      for (const word of LEFTOVERS) if (text.includes(word)) note(`${file}: fixture text "${word}" is still visible`);
    }
    let hotspot = null;
    if (shot.tap) {
      const box = await hotspotBox(page, shot.tap);
      if (!box) note(`${file}: hotspot target ${JSON.stringify(shot.tap)} not found`);
      else if (box.x < 0 || box.y < 0 || box.x + box.width > width + 1 || box.y + box.height > height + 1) note(`${file}: hotspot target is outside the screen (${JSON.stringify(box)})`);
      else hotspot = [box.x / width, box.y / height, box.width / width, box.height / height].map((v) => Math.round(v * 10000) / 10000);
    }
    await page.screenshot({ path: join(out, `${file}.jpg`), type: "jpeg", quality: 82 });
    console.log(`${file}.jpg  ${shot.live ? shot.url : shot.url.split("id=")[1]}${used.length ? `\n    swaps: ${used.join(" | ")}` : ""}`);
    return { story: shot.live ? shot.url : shot.url.split("id=")[1], width, height, hotspot };
  } finally {
    await context.close();
  }
}

// Captures run four at a time; each writes its own file, then the #flows block is updated once.
let html = readFileSync(htmlPath, "utf8");
const block = html.match(/<script type="application\/json" id="flows">([\s\S]*?)<\/script>/);
if (!block) throw new Error("index.html has no #flows JSON block");
const data = JSON.parse(block[1]);
const screens = data.flows.flatMap((flow) => flow.screens);
for (const s of screens) if (!SHOTS[s.file]) note(`index.html lists ${s.file}, which has no capture recipe`);
for (const file of Object.keys(SHOTS)) if (!screens.some((s) => s.file === file)) note(`capture recipe ${file} is not in index.html`);
const queue = screens.filter((s) => SHOTS[s.file] && (!only.length || only.includes(s.file)));
const browser = await pw.chromium.launch();
const results = new Map();
const swapHits = new Map();
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try { results.set(s.file, await capture(browser, s.file, SHOTS[s.file])); }
    catch (error) { note(`${s.file}: ${error.message.split("\n")[0]}`); }
  }
}));
await browser.close();
// A demo pair that never matched on any screen it was listed for is stale (base copy excepted).
if (!only.length) for (const [pair, n] of swapHits) if (!n && !STORY_COPY.some(([f, t]) => `${f} → ${t}` === pair)) note(`swap "${pair}" matched nothing`);
for (const s of screens) {
  const r = results.get(s.file);
  if (!r) continue;
  s.story = r.story;
  s.size = [r.width, r.height];
  if (r.hotspot) s.hotspot = r.hotspot; else delete s.hotspot;
}
const json = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
html = html.replace(block[0], `<script type="application/json" id="flows">\n${json}\n</script>`);
writeFileSync(htmlPath, html);
console.log(`captured ${results.size} screens into ${out}${banner ? "" : " (fixture banner kept)"}; ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
