// Captures the clickable demo's screens into ./assets/screens (not committed) and writes each
// screen's story, size and measured hotspot into index.html's #flows block.
// Usage, from the repository root (needs the repository's Playwright install and network access):
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs                  every screen
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs --only=work-3   single screens
// The demo tells one season at Tech and Sun's hub: the steward names the need, members promise the
// season's climate course, the hub delivers the bootcamp, and supporters fund the next cohort.
// Storybook screens come from the deployed Storybook at design.greengoods.app: real components
// with fixture data, into which this script swaps the hub's own content after each screen renders
// (text, the work photos, the garden banners; see the tables below and README.md). The facts come
// from Tech and Sun's public record: its season, request, action forms, dates and photos. People's
// names are invented. The Funding flow's public pages come from greengoods.app as they stand.
// Components, layout, controls and state stay as rendered; where a recipe lists actions, they are
// the clicks and typing a person would do in that same screen.
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

// Photos: the approved Awka photo (README, Photos) and the hub's public submission photos, saved
// as record-NN.jpg by README's photo step. A missing photo leaves the fixture image and is reported.
const PHOTOS = join(here, "assets", "photos");
const photo = (name) => {
  const path = join(PHOTOS, name);
  return existsSync(path) ? `data:image/jpeg;base64,${readFileSync(path).toString("base64")}` : null;
};
const BANNER = "awka-hub.jpg";

// The season, from Tech and Sun's public record (pool 3 on its garden, read 26 October 2026).
const SEASON = "Climate and Tech Education";
const COURSE = "Complete the UN CC:Learn climate course";
const COURSE_NOTE = "Complete the agreed UN CC:Learn course and submit your certificate so the hub can verify your learning.";
const DUE = "Jan 31, 2027";
// The bootcamp: the real Workshop Delivered action's form, with this season's notes.
const BOOTCAMP_NOTE = "One-week bootcamp at the hub. Members worked through the UN CC:Learn climate course and made short videos about it with AI tools.";
// The steward's assessment of what members need.
const NEED_TITLE = "Climate and tech skills for members";
const NEED_ABOUT = "Members have steady power and internet at the hub. Few have climate or digital training, and most want paid work.";

// Demo copy. Each rule replaces exact text inside text nodes and in alt, aria-label, title,
// placeholder and field values: [from, to, nth, whole]. `nth` limits a rule to one visible
// occurrence in page order; `whole` matches only a text node that is exactly `from`.
const HUB = [
  ["Riverside Commons Garden", "TAS Hub"],
  ["Riverside District", "Awka, Nigeria"],
  ["Rio Rainforest Lab", "TAS Hub"],
  ["Botanic Commons", "TAS Hub"],
  ["Founded Mar 14, 2024", "Founded Feb 27, 2026"],
  ["3 members", "14 members", undefined, true],
  ["riverside-commons.example", "tas-hub.example"],
  ["Autumn Planting 2026", SEASON],
  ["Sep 1 – Nov 30 · 3 of 7 kept", "Oct 10 – Jan 31 · 0 of 1 kept"],
  ["Seed Swap Weekend", "Bootcamp week"],
  ["Oct 10 – Oct 11 · 0 of 2 kept", "Oct 19 – Oct 23 · 0 of 1 kept"],
  ["Summer 2026", "Hub opening"],
  ["Jun 1 – Aug 31 · 9 of 11 kept", "Mar 14 – Apr 30 · 4 of 4 kept"],
];
// People. Every name is invented: the steward Obinna, the learner Chiamaka and her study partner
// Uche, the facilitator Ifeoma, another member Tobenna, and the supporter Funmi.
const PEOPLE = [
  ["tomas", "obinna"],
  ["amara", "chiamaka"],
  ["dele", "uche", undefined, true],
  ["0x5e...0b2", "obinna.eth"],
  ["0x22...222", "chiamaka.eth"],
  ["0x5eed...00b2", "ifeoma.eth"],
  ["0x5eed...00a1", "tobenna.eth"],
  ["vault-owner.eth", "funmi.eth"],
];
const BASE = [...HUB, ...PEOPLE];

// The Promises tab: the season's real request, one more member who took it, and other hub asks.
const POOL_LIST = [
  ["Repair the north fence panel by the compost bays before the first frost", "Fix the hub's router before Friday's class"],
  ["Survey one household about rain barrel use", "Host the weekly climate discussion", 1],
  ["Survey one household about rain barrel use", COURSE],
  ["Water the seedling beds every morning while the Okafor family is traveling", "Lend my spare laptop to a new builder"],
  ["Lend the seed dibber set for the swap weekend", "Set up the solar classroom lights"],
  ["Two hours sorting the seed library", COURSE],
  ["Teach the composting basics workshop for new members", "Teach a prompt-writing session for new members"],
];
// The request Chiamaka takes up, in every Promise screen that names it.
const PROMISE = [
  ["Survey household water use on Mill Lane", COURSE],
  ["Repair the north fence panel by the compost bays before the first frost", COURSE],
  ["Visit one household, ask the six survey questions, and photograph the meter.", COURSE_NOTE],
  ["Two slats are split and loose after the storm. Materials are in the tool shed.", COURSE_NOTE],
  ["Replaced two split slats and secured the panel. Dele helped with measuring and fastening.", "Finished the course during the hub's bootcamp week. My certificate is attached."],
  ["receipts/fence-posts", "certificates/chiamaka"],
  ["4 available · 3 in progress · 3 kept", "23 available · 1 in progress · 0 kept"],
  ["2 hours", "1 certificate"],
  ["1 repair", "1 certificate"],
  ["Oct 30, 2026", DUE],
  ["Oct 20, 2026", DUE],
  ["Repair notes", "Course notes"],
];
// The bootcamp in the submit, review and list screens: the real Workshop Delivered labels.
const WORK = [
  ["Upload Media", "Capture Workshop Photo"],
  ["Take a clear photo of the moved seedlings, or choose one from your photos.", "Take a photo of the room, materials, or session in progress."],
  ["Moved 36 lettuce seedlings into the east bed and watered them after transplanting.", BOOTCAMP_NOTE],
  ["Seedling Transplant", "Workshop Delivered"],
  ["Plants moved", "Facilitators"],
  ["Plants Moved", "Facilitators"],
  ["36", "2", undefined, true],
  ["1h 30m", "5h"],
  ["The count and note match the evidence checked at the garden.", "The photos and attendance match the session I saw at the hub."],
];
const WORK_LIST = [
  ["Compost Turn", "Workshop Delivered", 0],
  ["Compost Turn", "Hub Service Session"],
  ["Seed Library Count", "Hub Service Session"],
  ["Path Edging", "Infrastructure Milestone"],
  ["Mulch Delivery Log", "Energy & Uptime Check"],
  ["Herb Spiral Weeding", "Site & Readiness Setup"],
];
const WORK_DONE = [
  ["Compost Turn", "Hub Service Session"],
  ["Path Edging", "Energy & Uptime Check"],
];
// The steward's assessment, in the form's own Education metrics.
const ASSESSMENT = [
  ["East plot, Rio Rainforest Lab", "TAS Hub", 0],
  ["East plot, Rio Rainforest Lab", "Awka, Nigeria"],
  ["Agroforestry", "Education"],
  ["Rio canopy baseline, wet season", NEED_TITLE],
  ["Canopy cover and seedling survival across the east plot, measured before the wet-season planting.", NEED_ABOUT],
  ["Cattle grazing thinned the canopy along the east boundary, and the seedlings planted last season have no shade.", "Members want paid work, but few have the climate or digital skills that clients ask for."],
  ["The east plot regains its canopy", "Members earn the UN CC:Learn climate certificate"],
  ["Trees planted · 200 trees", "Participants · 24 people"],
  ["Seedlings survive their first dry season", "Members make paid-quality content with AI"],
  ["Area covered · 5 ha", "Sessions delivered · 5 sessions"],
  ["Canopy baseline", "Workshop Delivered"],
  ["Jul 1 – Sep 30, 2026", "Oct 10, 2026 – Jan 31, 2027"],
];
const FUNDER = [["Greenpill NYC", "TAS Hub"], ["1.2 WETH", "500 DAI"]];

// Fixture text that must not survive a swap (the Funding flow's live pages are exempt).
const LEFTOVERS = [/Riverside/, /Rio (Rainforest|canopy)/, /Botanic/, /Mill Lane/, /frost/, /fence/i, /Autumn/, /Seed Swap/, /\btomas\b/, /\bamara\b/, /\bdele\b/, /Greenpill NYC/, /vault-owner/, /Cerrado/, /rain barrel/, /[Ss]eedling/, /lettuce/, /Compost/, /Path Edging/, /Herb Spiral/, /Mulch/, /Seed Library/, /canopy/i, /WETH/];

// One recipe per screen, keyed by the file name in index.html's #flows block. `tap` names the
// control the hotspot sits on, measured after the swaps; the last screen of a flow has none.
// `photos` replaces the screen's content images in page order; `gardenCard` puts the hub's banner
// photo in the garden card in place of the no-banner pattern.
const SHOTS = {
  "needs-1": { url: story("admin-workspaces-hub--assessments-tab"), device: DESKTOP, swaps: [["Rainforest canopy strategy", "Solar and internet baseline"], ["Jan 3, 2026", "Mar 14, 2026"], ["Agroforestry", "Solar"], ...BASE], tap: { role: "button", name: "Create Assessment" } },
  "needs-2": {
    url: story("admin-workspaces-hub--create-assessment-route"), device: DESKTOP, swaps: BASE,
    actions: [
      { click: { role: "radio", name: "Education" } },
      { fill: { label: /^Title/ }, value: NEED_TITLE },
      { fill: { label: /^Location/ }, value: "Awka, Nigeria" },
      { fill: { label: /^Description/ }, value: NEED_ABOUT },
    ],
    tap: { role: "button", name: "Next" },
  },
  "needs-3": { url: story("admin-workflows-assessment-reviewstep--in-flow-ready"), device: DESKTOP, swaps: [...ASSESSMENT, ...BASE], tap: { role: "button", name: "Submit Assessment" } },
  "needs-4": { url: story("admin-workflows-assessment-reviewstep--in-flow-sent"), device: DESKTOP, swaps: [...ASSESSMENT, ...BASE], tap: { role: "button", name: "Done" } },
  "needs-5": { url: story("client-garden-assessments--education"), device: PHONE, swaps: [["Gardeners learn to restore and care for their soil", NEED_TITLE], ["Oct 18, 2025 – Jan 16, 2026", "Oct 10, 2026 – Jan 31, 2027"], ...BASE] },

  "promise-1": { url: story("client-commitments-gardenpool--live"), device: PHONE, banner: true, swaps: [...POOL_LIST, ...BASE], scrollTo: { text: COURSE, nth: 1, margin: 128 }, tap: { text: COURSE, nth: 1 } },
  "promise-2": { url: story("client-commitments-promisegrouppage--open"), device: PHONE, swaps: [...PROMISE, ...BASE], tap: { role: "button", name: "Take Up One" } },
  "promise-3": { url: story("client-commitments-takeuponesheet--ready"), device: PHONE, swaps: [...PROMISE, ...BASE], tap: { role: "button", name: "Take Up One" } },
  "promise-4": { url: story("client-commitments-proofcomposer--details"), device: PHONE, swaps: [...PROMISE, ...BASE], tap: { role: "button", name: "Review Proof" } },
  "promise-5": { url: story("client-commitments-confirmsheet--ask-garden-work"), device: PHONE, swaps: BASE, tap: { role: "button", name: "Confirm the Work Was Done" } },
  "promise-6": { url: story("client-commitments-gardencommitment--kept"), device: PHONE, swaps: [...PROMISE, ...BASE] },

  "work-1": { url: story("client-work-submitwork--media-with-example-photo"), device: PHONE, swaps: [...WORK, ...BASE], photos: ["record-06.jpg"], tap: { role: "button", name: "Details" } },
  "work-2": { url: story("client-work-submitwork--review-with-example-photo"), device: PHONE, swaps: [...WORK, ...BASE], photos: ["record-06.jpg"], gardenCard: true, tap: { role: "button", name: "Upload Work" } },
  "work-3": { url: story("client-garden-gardenwork--all-work"), device: PHONE, swaps: [...WORK_LIST, ...BASE], photos: ["record-06.jpg", "record-01.jpg", "record-04.jpg", "record-09.jpg", "record-03.jpg", "record-14.jpg"], tap: { text: "Workshop Delivered" } },
  "work-4": { url: story("client-work-reviewwork--evaluate-example"), device: PHONE, swaps: [...WORK, ...BASE], photos: ["record-06.jpg"], gardenCard: true, tap: { role: "button", name: "Approve" } },
  "work-5": { url: story("client-work-reviewwork--feedback-example"), device: PHONE, swaps: [...WORK, ...BASE], photos: ["record-06.jpg"], gardenCard: true, tap: { role: "button", name: "Submit" } },
  "work-6": { url: story("client-work-workdashboard--completed-with-example-photo"), device: PHONE, swaps: [...WORK, ...WORK_DONE, ...BASE], photos: ["record-06.jpg", "record-04.jpg", "record-03.jpg"] },

  "funding-1": { url: "https://greengoods.app/gardens/tas-hub", live: true, device: DESKTOP, tap: { role: "link", name: "Fund" } },
  "funding-2": { url: "https://greengoods.app/fund", live: true, device: DESKTOP, scrollTo: { text: "TAS HUB", align: "start" }, tap: { card: "TAS HUB", role: "button", name: "Endow" } },
  "funding-3": {
    url: "https://greengoods.app/fund", live: true, device: DESKTOP, scrollTo: { text: "TAS HUB", align: "start" },
    actions: [{ click: { card: "TAS HUB", role: "button", name: "Endow" } }, { fill: { css: '[role="dialog"] input' }, value: "500" }],
    tap: { role: "button", name: "Connect Wallet" },
  },
  "funding-4": { url: story("client-public-vault-vaultmanagepositionspanel--positions"), device: DESKTOP, swaps: [...FUNDER, ...BASE], tap: { role: "button", name: "Close Manage Endowments" } },
  "funding-5": { url: "https://greengoods.app/gardens/tas-hub", live: true, device: DESKTOP, scrollTo: { text: "A one week content creation bootcamp with AI", align: "start", card: "img", top: 28 } },
};

function locate(page, spec) {
  let scope = page;
  if (spec.card) scope = page.locator("article, li, section > div, div").filter({ hasText: spec.card }).filter({ has: page.getByRole(spec.role, { name: spec.name, exact: true }) }).last();
  if (spec.css) return scope.locator(spec.css).first();
  if (spec.label) return scope.getByLabel(spec.label).first();
  if (spec.role) return scope.getByRole(spec.role, { name: spec.name, exact: true }).first();
  // A row or card that opens something: the nearest pressable ancestor of its text.
  return scope.getByText(spec.text, { exact: true }).nth(spec.nth ?? 0)
    .locator("xpath=ancestor-or-self::*[self::button or self::a or @role='button' or @role='link' or @data-pressable][1]");
}

async function hotspotBox(page, spec) {
  const target = locate(page, spec);
  if (await target.count()) return target.boundingBox();
  return spec.text ? page.getByText(spec.text, { exact: true }).nth(spec.nth ?? 0).boundingBox() : null;
}

async function applySwaps(page, swaps, withNth) {
  return page.evaluate(({ rules, withNth }) => {
    const hits = rules.map(() => 0);
    const seen = rules.map(() => 0);
    // A rule with `nth` counts only text a person can see (not, say, a closed select's options),
    // and only on the first pass, since a later pass would count the already swapped page again.
    const replace = (value, counted) => {
      let v = value;
      rules.forEach(([from, to, nth, whole], i) => {
        if (whole ? v.trim() !== from : !v.includes(from)) return;
        if (nth !== undefined && nth !== null) {
          if (!counted || !withNth) return;
          const index = seen[i];
          seen[i] += 1;
          if (index !== nth) return;
        }
        v = whole ? v.replace(from, to) : v.split(from).join(to);
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

// The garden page's header photo.
async function swapBanner(page, src) {
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
  }, src);
}

// Content photos in page order: every image at least 60px wide that is not the header banner.
async function swapPhotos(page, sources) {
  return page.evaluate(async (sources) => {
    const imgs = [...document.querySelectorAll("img")].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width >= 60 && !(r.top < 40 && r.width > 300);
    });
    let swapped = 0;
    for (const [i, img] of imgs.entries()) {
      if (!sources[i]) continue;
      img.closest("picture")?.querySelectorAll("source").forEach((s) => s.remove());
      img.removeAttribute("srcset");
      img.src = sources[i];
      await img.decode().catch(() => {});
      swapped += 1;
    }
    return { swapped, found: imgs.length };
  }, sources);
}

// The garden card draws a teal pattern when a garden has no banner; the hub has one.
async function swapGardenCard(page, src) {
  return page.evaluate((src) => {
    let swapped = 0;
    for (const el of document.querySelectorAll("div")) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg.startsWith("linear-gradient(135deg, rgb(22, 78, 99)")) {
        el.style.backgroundImage = `url("${src}")`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center 40%";
        swapped += 1;
      } else if (bg.startsWith("radial-gradient(circle, rgba(255, 255, 255, 0.12)")) {
        el.style.backgroundImage = "none";
      }
    }
    return swapped;
  }, src);
}

async function scrollTarget(page, spec) {
  let target = spec.card === "img" ? page.getByText(spec.text, { exact: true }).nth(spec.nth ?? 0) : locate(page, spec);
  if (!(await target.count()) && spec.text) target = page.getByText(spec.text, { exact: true }).nth(spec.nth ?? 0);
  await target.waitFor({ state: "attached", timeout: 30000 });
  // Twice, since images that load after the first scroll can move the target.
  for (let pass = 0; pass < 2; pass += 1) {
    await target.evaluate((el, { align, margin, card, top }) => {
      // Scroll the nearest scrolling ancestor (or the page) so the target sits inside the screen:
      // its top `top` px below the top edge, or its bottom `margin` above the bottom edge. With
      // `card: "img"` the target is the card holding the text and its photo, aligned by the photo.
      if (card === "img") { let c = el; while (c && !c.querySelector("img")) c = c.parentElement; el = c?.querySelector("img") || el; }
      let box = el.parentElement;
      while (box && !(box.scrollHeight > box.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      const r = el.getBoundingClientRect();
      const by = align === "start" ? r.top - top : r.bottom - (window.innerHeight - margin);
      if (align !== "start" && by <= 0) return;
      if (box) box.scrollBy(0, by); else window.scrollBy(0, by);
    }, { align: spec.align || "end", margin: spec.margin ?? 24, card: spec.card === "img" ? "img" : null, top: spec.top ?? 96 });
    await page.waitForTimeout(1500);
  }
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
    const banner = photo(BANNER);
    if (shot.banner || shot.gardenCard) {
      if (!banner) console.log(`  ${file}: ${BANNER} is not present locally; the fixture banner stays`);
      else if (shot.banner && !(await swapBanner(page, banner))) note(`${file}: no banner image found to swap`);
      else if (shot.gardenCard && !(await swapGardenCard(page, banner))) note(`${file}: no garden card pattern found to swap`);
    }
    if (shot.photos) {
      const sources = shot.photos.map(photo);
      shot.photos.forEach((name, i) => { if (!sources[i]) note(`${file}: ${name} is missing; run README's photo step`); });
      const { swapped, found } = await swapPhotos(page, sources);
      if (swapped !== shot.photos.length || found !== shot.photos.length) note(`${file}: ${found} content photos on screen, ${swapped} swapped, ${shot.photos.length} listed`);
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
      for (const word of LEFTOVERS) if (word.test(text)) note(`${file}: fixture text ${word} is still visible`);
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
// A rule that never matched on any screen it was listed for is stale (shared hub and people
// rules excepted, since each screen shows only some of them).
if (!only.length) for (const [pair, n] of swapHits) if (!n && !BASE.some(([f, t]) => `${f} → ${t}` === pair)) note(`swap "${pair}" matched nothing`);
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
console.log(`captured ${results.size} screens into ${out}; ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
