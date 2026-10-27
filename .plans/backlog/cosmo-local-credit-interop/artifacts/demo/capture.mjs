// Captures the clickable demo's screens into ./assets/screens (not committed) and writes each
// screen's source, size, measured hotspot and back regions into index.html's #flows block.
//
// The demo follows one season at Tech and Sun's hub, TAS HUB in Awka, in eight chapters: the
// steward records the need and starts the season with a bootcamp promise, a member takes it up and
// logs the bootcamp for it, the steward approves it (which keeps the promise), the kept promise pays
// vouchers that buy a hub day (in pilot), and a supporter follows the public record and donates.
// Each chapter is a set of sessions that start where a person starts and walk the app and
// dashboard on develop, clicking, typing and choosing, with Tech and Sun's record behind them. A
// step that would need a signature is never pressed; the states after it, the states the hub's
// record does not have, and every voucher screen come from Storybook built from develop, with the
// hub's content swapped in and, where the app shows them inside a page, drawn into that real page.
//
// Needs, run before capturing (README, Capture, build and check):
// - the develop app and dashboard on http://localhost:3122 and https://localhost:3102 (.claude/launch.json
//   "demo-client" and "demo-admin", serving a develop worktree, chain 42161, the hosted indexer);
// - Storybook: the deployed one, or a local static build passed as --storybook=<origin>;
// - the photos in ./assets/photos (awka-hub.jpg, and the record-NN.jpg that photos.mjs saves).
//
// Usage, from the repository root:
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs                       every screen
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs --only=season-console  one session
// --html=<file> writes another page's #flows block; --accept keeps a run's screens despite problems
// while iterating; --debug prints each screen's text.
// After a screen settles, names and fixture copy are swapped in its text (see the tables below):
// every person's name is invented, addresses become invented handles, and fixture places, dates
// and photos become the hub's. Components, layout, controls and state stay as rendered.
// Screens land in a staging folder and replace the current set only when the run has no problem,
// so a failed capture leaves the existing screens and index.html untouched. It fails when a step
// fails, a swap rule matches nothing, a fixture name or a real ENS name survives, a photo is missing
// or does not decode, a record photo's title no longer matches RECORDS, Storybook shows its
// not-found view, a screen without a hotspot shows neither its `expect` copy nor one of its own
// swaps, or a hotspot or back target is missing or off screen.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "assets", "screens");
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").slice(name.length + 3);
// --html=<file> reads and writes the #flows block of another page, so a capture can run while
// index.html itself is being edited.
const htmlPath = arg("html") || join(here, "index.html");
mkdirSync(out, { recursive: true });
const only = arg("only").split(",").filter(Boolean);
const debug = process.argv.includes("--debug");
const problems = [];
const note = (message) => { problems.push(message); console.log(`  problem: ${message}`); };

const PHONE = { width: 390, height: 844, scale: 2 };
const DESKTOP = { width: 1440, height: 900, scale: 1.5 };
const APP = "http://localhost:3122";
const ADMIN = "https://localhost:3102";
const TAS = "0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3";
const HOME = `${APP}/home?mockAuth=deployer&presentation=pwa`;
// Storybook built from develop. The deployed one (design.greengoods.app) is the default; --storybook=
// points at a local static build, which a capture needs while the deployed one cannot render.
const STORYBOOK = arg("storybook") || "https://design.greengoods.app";
const story = (id) => `${STORYBOOK}/iframe.html?viewMode=story&id=${id}`;

const PHOTOS = join(here, "assets", "photos");
const photo = (name) => {
  const path = join(PHOTOS, name);
  return existsSync(path) ? `data:image/jpeg;base64,${readFileSync(path).toString("base64")}` : null;
};
const BANNER = "awka-hub.jpg";
// The record photos the sessions use, by the titles the hub's page gave them on 26 October 2026.
// photos.mjs numbers files by page position, and the page lists newest first, so a new approved
// submission would renumber every later photo; a file whose title no longer matches fails the
// capture instead of putting an unrelated photo on a screen.
const RECORDS = {
  "record-03.jpg": "Hub usage May 2026",
  "record-04.jpg": "Hub usage June 2026",
  "record-06.jpg": "A one week content creation bootcamp with AI",
  "record-07.jpg": "Workshop Delivered Garden participant",
};
const tsvPath = join(PHOTOS, "record-photos.tsv");
const recordTitles = existsSync(tsvPath) ? Object.fromEntries(readFileSync(tsvPath, "utf8").split("\n").filter(Boolean).map((line) => line.split("\t"))) : {};
for (const [name, fragment] of Object.entries(RECORDS)) {
  if (!recordTitles[name]) note(`${name} is not listed in record-photos.tsv; run photos.mjs`);
  else if (!recordTitles[name].includes(fragment)) note(`${name} is now "${recordTitles[name].slice(0, 70)}", expected the record "${fragment}"; the hub's list changed, so re-map RECORDS in capture.mjs`);
}

// The season and its course request, from Tech and Sun's record (pool 3, read 26 October 2026).
const SEASON = "Climate and Tech Education";
const COURSE = "Complete the UN CC:Learn climate course";
// The steward's assessment and the bootcamp, as this demo tells them.
const NEED_TITLE = "Climate and tech skills for members";
const NEED_ABOUT = "Members have steady power and internet at the hub. Few have climate or digital training, and most want paid work.";
const NEED_CHALLENGE = "Members want paid work, but few have the climate or digital skills that clients ask for.";
// The Work flow replays how the hub's real bootcamp reached its record, so the note is the record's
// own description; the hours and facilitator count are sample.
const BOOTCAMP_NOTE = "A one week content creation bootcamp with AI";

// Names. Every person is invented: Obinna the steward, Ifeoma the member who runs the bootcamp,
// Funmi the supporter, and Nneka, another member booking a hub day in the voucher fixtures. Any
// other shortened address becomes one of ADDRESS_NAMES, the same one for the same address.
const ADDRESS_NAMES = ["tobenna.eth", "kelechi.eth", "nneka.eth", "ada.eth", "uche.eth", "ngozi.eth", "chidi.eth", "amaka.eth"];
const PEOPLE = [
  ["afo", "obinna", undefined, true],
  ["tomas", "obinna", undefined, true],
  // The hub's two other stewards, named as confirmers and on its public page.
  ["nansel.eth", "adaeze.eth"],
  ["amioantho.eth", "ikenna.eth"],
];
// The only names a screen may show; any other name ending in .eth is a real one left over.
// lina.eth is the app's own example in the confirmer field's hint.
const INVENTED = new Set([...ADDRESS_NAMES, "adaeze.eth", "ikenna.eth", "funmi.eth", "lina.eth"]);
// Storybook fixtures' hub and season.
const HUB = [
  ["Riverside Commons Garden", "TAS HUB"],
  ["Riverside District", "Awka, Nigeria"],
  ["Autumn Planting 2026", SEASON],
];
const BASE = [...HUB, ...PEOPLE];
// Home's recent activity: the steward's own pending entry is a node log, which the pitch leaves out.
const HOME_ACTIVITY = [["Node Operation Log", "Energy & Uptime Check"]];

// The steward's assessment in the Storybook "sent" screen, matching what the wizard was given.
const ASSESSMENT = [
  ["East plot, Rio Rainforest Lab", "TAS HUB", 0],
  ["East plot, Rio Rainforest Lab", "Awka, Nigeria"],
  ["Agroforestry", "Education"],
  ["Rio canopy baseline, wet season", NEED_TITLE],
  ["Canopy cover and seedling survival across the east plot, measured before the wet-season planting.", NEED_ABOUT],
  ["Cattle grazing thinned the canopy along the east boundary, and the seedlings planted last season have no shade.", NEED_CHALLENGE],
  ["The east plot regains its canopy", "Members earn the UN CC:Learn climate certificate"],
  ["Trees planted · 200 trees", "Participants · 24 people"],
  ["Seedlings survive their first dry season", "The hub runs hands-on bootcamp sessions"],
  ["Area covered · 5 ha", "Sessions delivered · 5 sessions"],
  ["Canopy baseline", "Workshop Delivered"],
  ["Jul 1 – Sep 30, 2026", "Oct 10, 2026 – Jan 31, 2027"],
];

// The season's new promise, as Obinna seeds it in the dashboard and Ifeoma keeps it in the app.
// The hub's real bootcamp is the work that keeps it, so the record it ends on is the hub's own.
const BOOTCAMP = "Run a one-week AI content bootcamp";
const BOOTCAMP_ASK = "Run the hub's one-week content creation bootcamp with AI, then log it as Workshop Delivered with photos.";
const BOOTCAMP_DUE = "Nov 25, 2026";
// The hub has no assessment on the chain yet; the one it "already has" is demo data.
const EARLIER = "Reliable power and internet at the hub";
// The dashboard shows a reward only while settlement is switched on; develop has it off, so the
// review's "None" reads as it will with the switch on.
const REWARD = "$20.00, paid in G$ once it's kept";
// About $20 at the rate the Storybook fixtures fix ($5.00 is 38,865 G$).
const REWARD_GD = "155,460 G$";
// Fixture people in the voucher stories.
const VOUCHER_PEOPLE = [["Kwesi", "Ifeoma"], ["Lina", "Nneka"], ["lina", "ifeoma"]];

// The Hub's assessments tab before this season's: one earlier assessment, as demo data.
const HUB_LIST = [
  ["Rio Rainforest Lab", "TAS HUB"],
  ["Rainforest canopy strategy", EARLIER],
  ["Jan 3, 2026", "Apr 6, 2026"],
  ["Agroforestry", "Solar"],
];
// "Start a Season" and the pool's cycles card, written for another garden in the fixtures.
const SEASON_SETUP = [["Rocinha’s pool", "TAS HUB’s pool"], ["Season of First Rains", SEASON]];
// Take Part over Home, at the season: the course the season already asks for, and the bootcamp.
const TAKE_PART = [
  ["In Riverside Commons Garden", "In TAS HUB"],
  ["Sep 1 – Nov 30 · 3 of 7 kept", "Oct 10 – Jan 31 · 1 of 2 kept"],
  ["Teach the composting basics workshop for new members", BOOTCAMP],
  ["Water the seedling beds every morning while the Okafor family is traveling", COURSE],
  // The pool's requests are the steward's.
  ["0x5e...0b2", "obinna"],
];
// The bootcamp's group page and take-up sheet (a support fixture with one copy).
const GROUP = [
  ["Survey household water use on Mill Lane", BOOTCAMP],
  ["Visit one household, ask the six survey questions, and photograph the meter.", BOOTCAMP_ASK],
  ["2 hours · Due Oct 30, 2026", `20 hours · Due ${BOOTCAMP_DUE}`],
  ["2 hours", "20 hours"],
  ["Oct 30, 2026", BOOTCAMP_DUE],
  ["You can hold up to 2 promises from this pool at once.", "You can hold up to 24 promises from this pool at once."],
  ["4 available · 3 in progress · 3 kept", "1 available · 0 in progress · 0 kept"],
  ["$5.00", "$20.00"],
];
// Her promise once taken up: a garden-work promise, kept when the stewards approve its work.
const IN_PROGRESS = [
  ["Repair the north fence panel by the compost bays before the first frost", BOOTCAMP],
  ["Two slats are split and loose after the storm. Materials are in the tool shed.", BOOTCAMP_ASK],
  ["1 repair", "20 hours"],
  ["Oct 20, 2026", BOOTCAMP_DUE],
  ["amara", "ifeoma", undefined, true],
  ["tomas", "obinna", undefined, true],
];
// Submit Work for her promise (Start, Media and Review stories), and the details she gives.
const START = [["Workshop photos", BOOTCAMP], ["3 of 12 approved", "0 of 1 approved"], ["due Jan 31, 2027", `due ${BOOTCAMP_DUE}`]];
const FOR_PROMISE = [
  ["Transplant 36 seedlings into the east beds", BOOTCAMP],
  ["Take a clear photo of the moved seedlings, or choose one from your photos.", "Add photos from the session: the room, the people and what they made."],
  ["Seedling Transplant", "Workshop Delivered"],
  ["Plants moved", "Facilitators"],
  ["36", "2", undefined, true],
];
// The Hub's work queue and the work's dialog: the steward's own pending node log, which the pitch
// leaves out, stands in for Ifeoma's bootcamp a few minutes after she uploads it.
const QUEUE = [
  ["Node Operation Log", "Workshop Delivered"],
  ["Action #4", "Workshop Delivered"],
  ["afo", "ifeoma", undefined, true],
  ["submitted 3 weeks ago", "submitted 12 minutes ago"],
  ["Oct 1, 2026, 12:59 PM", "Oct 26, 2026, 4:48 PM"],
];
const REVIEW_FORM = [["0x11...111", "ifeoma"], ["Rio Rainforest Lab's", "TAS HUB's"]];
// The kept promise's rewards: vouchers from Tech and Sun's reserve and G$ from the hub's pool.
const EARN = [
  ["Teach two compost workshops", BOOTCAMP],
  ["120 G$", REWARD_GD],
  ["2 workshops", "20 hours"],
  ["Dec 14, 2026", BOOTCAMP_DUE],
  ["Run two hands-on compost workshops for neighbors at the garden, one in November and one in December.", BOOTCAMP_ASK],
  ["Riverside Commons Garden's pool", "TAS HUB's pool"],
  ["No approved work yet · no proof yet", "1 approved work · no proof yet"],
];
// The hub day she books in January, and the booking's dates in the fixtures.
const HUB_DAY = [["Nov 2", "Jan 20"], ["Oct 26", "Jan 13"]];
// The app lists WETH before DAI (funding-3); the stories list DAI first.
const wethFirst = {
  script: () => {
    const button = (label) => [...document.querySelectorAll("button")].find((b) => [...b.querySelectorAll("*")].some((el) => el.children.length === 0 && el.textContent.trim() === label));
    const [dai, weth] = [button("DAI"), button("WETH")];
    if (dai && weth && dai.compareDocumentPosition(weth) & Node.DOCUMENT_POSITION_FOLLOWING) weth.after(dai);
  },
};
const DONATE = [["$50.00", "$500.00"], ["50.00", "500.00", undefined, true], ["0x5eed...00a1", "funmi.eth"]];

// Fixture text that must not survive in a Storybook screen.
const LEFTOVERS = [/Riverside/, /Rio (Rainforest|canopy)/, /Mill Lane/, /frost/, /fence/i, /Autumn/, /\btomas\b/, /\bamara\b/, /\bdele\b/i, /Greenpill NYC/, /vault-owner/, /[Ss]eedling/, /lettuce/, /Mulch/, /Pond/, /canopy/i, /\bafo\b/, /Node Operation/, /Muizenberg/, /Rocinha/, /First Rains/, /Okafor/, /compost/i, /\bKwesi\b/i, /\bLina\b/, /Botanic/, /Market rides/, /Harvest Season/, /Seed Swap/, /Step \d+ of \d+/];

// Hides the card around `text`: its nearest opaque ancestor at least `minHeight` tall.
const hideCard = (text, minHeight = 80) => ({
  script: ({ text, minHeight }) => {
    const owner = [...document.querySelectorAll("body *")].find((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim() === text));
    for (let el = owner; el && el !== document.body; el = el.parentElement) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg !== "transparent" && !bg.endsWith(", 0)") && el.getBoundingClientRect().height >= minHeight) { el.style.setProperty("display", "none", "important"); el.setAttribute("data-demo-hidden", ""); return; }
    }
  },
  arg: { text, minHeight },
});
const showCards = { script: () => document.querySelectorAll("[data-demo-hidden]").forEach((el) => { el.style.removeProperty("display"); el.removeAttribute("data-demo-hidden"); }) };
// The voucher journeys' story harness (its "Step n of m" line and buttons) is not part of the app.
const hideHarness = { script: () => document.querySelectorAll('[data-component="VoucherJourneyNarration"]').forEach((el) => el.style.setProperty("display", "none", "important")) };

// Sessions. Each opens one browser context at `url` and runs `steps` in order. A step is an
// action ({ click }, { fill, value }, { select, value }, { pickDate }, { files }, { reveal },
// { remove }, { script, arg }, { scrollTo }, { scroll }) or a screen ({ shot, tap, swaps, photos, banner,
// gardenCard, box, over, under }). `tap` names the control the hotspot sits on, measured after the
// swaps; each chapter's last screen has none. Session `swaps` apply to every screen in the session,
// after the screen's own; a `live` session keeps its page's own copy and counts, and swaps only
// names. `box` records where a real panel sits (found by its title text); `over` draws a Storybook
// panel in its place on that real screen (`fit` sizes the story to the panel's width, `align: "start"`
// pins it to the panel's top left, `root` takes the story's whole root as the panel), or, with
// `scrim`, draws a story's sheet or dialog and its scrim over a whole screen. An `under` shot is a
// real screen kept only to draw over; it is not a demo screen.
const SESSIONS = [
  // Needs: Obinna signs in to the dashboard, sees the hub's earlier assessment and records the
  // season's need, every step of the wizard.
  { id: "needs-signin", device: DESKTOP, url: `${ADMIN}/`, app: true, ready: "Connect to continue", steps: [{ shot: "needs-1", expect: ["Connect to continue"], tap: { role: "button", name: "Sign in with Passkey" } }] },
  { id: "needs-2", device: DESKTOP, url: story("admin-workspaces-hub--assessments-tab"), steps: [{ shot: "needs-2", swaps: [...HUB_LIST, ...BASE], tap: { role: "button", name: "Create Assessment" } }] },
  {
    id: "needs-admin", device: DESKTOP, url: `${ADMIN}/hub/assess?gardenId=${TAS}&mockAuth=deployer`, app: true, ready: "Create Assessment", swaps: PEOPLE,
    steps: [
      { click: { role: "button", name: "Create Assessment" }, wait: 5000 },
      { click: { role: "radio", name: "Education" }, force: true, wait: 800 },
      { fill: { label: /^Title/ }, value: NEED_TITLE },
      { fill: { label: /^Location/ }, value: "Awka, Nigeria" },
      { fill: { label: /^Description/ }, value: NEED_ABOUT },
      { shot: "needs-3", back: { role: "button", name: "Cancel" }, tap: { role: "button", name: "Next" } },
      { click: { role: "button", name: "Next" }, wait: 3000 },
      { fill: { css: '[role="dialog"] textarea[data-component="Textarea"]' }, value: NEED_CHALLENGE },
      { fill: { css: 'input[placeholder="A sentence about people or land"]' }, value: "Members earn the UN CC:Learn climate certificate" },
      { select: { css: 'select[data-component="NativeSelect"]' }, value: { label: "Participants (people)" } },
      { fill: { css: '[role="dialog"] input[type="number"]' }, value: "24" },
      { click: { role: "button", name: "Add Outcome" }, wait: 1000 },
      { fill: { css: 'input[placeholder="A sentence about people or land"]', nth: 1 }, value: "The hub runs hands-on bootcamp sessions" },
      { select: { css: 'select[data-component="NativeSelect"]', nth: 1 }, value: { label: "Sessions delivered (sessions)" } },
      { fill: { css: '[role="dialog"] input[type="number"]', nth: 1 }, value: "5" },
      { click: { text: "Complicated" }, wait: 800 },
      { shot: "needs-4", back: { role: "button", name: "Back" }, tap: { role: "button", name: "Next" } },
      { click: { role: "button", name: "Next" }, wait: 3000 },
      { click: { text: "Workshop Delivered" }, wait: 800 },
      { pickDate: { trigger: "#reportingPeriodStart", day: "2026-10-10" }, wait: 800 },
      { pickDate: { trigger: "#reportingPeriodEnd", day: "2027-01-31" }, wait: 800 },
      { shot: "needs-5", back: { role: "button", name: "Back" }, tap: { role: "button", name: "Next" } },
      { click: { role: "button", name: "Next" }, wait: 3000 },
      { shot: "needs-6", back: { role: "button", name: "Back" }, box: { text: "Create Assessment", minHeight: 400 }, tap: { role: "button", name: "Submit Assessment" } },
    ],
  },
  // After Submit the wallet signs; the saved state is the Storybook dialog, drawn over the real page.
  { id: "needs-7", device: DESKTOP, url: story("admin-workflows-assessment-reviewstep--in-flow-sent"), steps: [{ shot: "needs-7", swaps: [...ASSESSMENT, ...BASE], over: { screen: "needs-6", text: "Create Assessment", minHeight: 400 } }] },

  // Season: Obinna starts the season in the hub's Promises console and seeds the bootcamp promise.
  // The hub's season is already running, so the console before it, and the dialog that starts it,
  // are the Storybook card and dialog drawn into the real console.
  {
    id: "season-under", device: DESKTOP, url: `${ADMIN}/garden/pool?gardenId=${TAS}&mockAuth=deployer`, app: true, ready: "Seed Promises", swaps: PEOPLE,
    steps: [
      // Pool Funding reads the settlement switch, which develop has off; the pitch shows payouts on.
      hideCard("Pool Funding", 120),
      // Before the season there are no promises in it.
      { remove: { text: COURSE, card: true } },
      { shot: "season-1-under", under: true, box: { text: SEASON, minHeight: 100 } },
    ],
  },
  { id: "season-1", device: DESKTOP, url: story("admin-pool-poolcyclescard--no-season"), steps: [{ shot: "season-1", over: { screen: "season-1-under", text: "No season running", minHeight: 100, fit: true, align: "start", style: '[data-component="PoolCyclesCard"] { width: {width} !important; max-width: none !important; margin: 0 !important; }' }, tap: { role: "button", name: "Start Season" } }] },
  {
    id: "season-2", device: DESKTOP, url: story("admin-pool-poolsetupflow--new-season"),
    steps: [
      { fill: { css: 'input[placeholder="Season of First Rains"]' }, value: SEASON },
      { fill: { css: 'input[type="date"]' }, value: "2026-10-10" },
      { fill: { css: 'input[type="date"]', nth: 1 }, value: "2027-01-31" },
      { shot: "season-2", back: [{ role: "button", name: "Close" }, { role: "button", name: "Cancel" }], swaps: SEASON_SETUP, over: { screen: "season-1", text: "Start a Season", minHeight: 300, scrim: '[data-component="AdminDialog"]' }, tap: { role: "button", name: "Next" } },
    ],
  },
  {
    id: "season-console", device: DESKTOP, url: `${ADMIN}/garden/pool?gardenId=${TAS}&mockAuth=deployer`, app: true, ready: "Seed Promises", swaps: PEOPLE,
    steps: [
      hideCard("Pool Funding", 120),
      { shot: "season-3", expect: [SEASON, "Seed Promises"], tap: { role: "button", name: "Seed Promises" } },
      // In January the booking fills Review Promises, which grows down the column.
      hideCard("Pool Status", 120),
      { shot: "vouchers-6-under", under: true, box: { text: "Review Promises", minHeight: 60 } },
      showCards,
      hideCard("Pool Funding", 120),
      { click: { role: "button", name: "Seed Promises" }, wait: 4000 },
      { click: { text: "Garden work" }, wait: 800 },
      { click: { text: "The pool requests" }, wait: 800 },
      { fill: { label: "Title" }, value: BOOTCAMP },
      { fill: { label: "Note" }, value: BOOTCAMP_ASK, wait: 1000 },
      { shot: "season-4", back: { role: "button", name: "Cancel" }, tap: { role: "button", name: "Next" } },
      { click: { role: "button", name: "Next" }, wait: 3000 },
      { fill: { css: '[role="dialog"] input[inputmode="numeric"]', nth: 1 }, value: "20" },
      { click: { text: "30 days" }, wait: 500 },
      { click: { text: "Lead-managed team" }, wait: 500 },
      { click: { role: "button", name: "Add Action" }, wait: 1500 },
      { select: { css: 'select[name="requirements.0.actionUID"]' }, value: { label: "Workshop Delivered" }, wait: 1500 },
      { scrollTo: { text: "Each promise asks for", align: "start", top: 150 } },
      { shot: "season-5", back: { role: "button", name: "Back" }, tap: { role: "button", name: "Next" } },
      { click: { role: "button", name: "Next" }, wait: 3000 },
      { shot: "season-6", back: { role: "button", name: "Back" }, tap: { role: "button", name: "Next" } },
      { click: { role: "button", name: "Next" }, wait: 4000 },
      // The review's rows, down to the reward, under the dialog's header.
      { scrollTo: { text: "Cycle", align: "start", top: 150 } },
      { shot: "season-7", back: { role: "button", name: "Back" }, swaps: [["None", REWARD, 0, true]] },
    ],
  },

  // Promise: Ifeoma finds the bootcamp in Take Part on the hub's Home and takes it up.
  {
    id: "promise-home", device: PHONE, url: HOME, app: true, swaps: PEOPLE,
    steps: [
      { click: { text: "TAS HUB" }, wait: 7000 },
      // Stewards see what waits on them at the top of Home; Ifeoma is a member.
      { remove: { text: "Needs Your Attention" }, up: 1, optional: true },
      // Develop's Home lists no open promise for the hub today, so Take Part is the Storybook
      // section with the bootcamp, drawn where the real one sits.
      { scrollTo: { text: "Take Part", align: "start", top: 300 } },
      { shot: "promise-1-under", under: true, swaps: HOME_ACTIVITY, photos: ["record-03.jpg", "record-03.jpg"], box: { css: '[data-component="TakePart"]' } },
    ],
  },
  {
    id: "promise-1", device: PHONE, url: story("client-home-takepart--default"),
    steps: [
      { remove: { text: "Water the seedling beds every morning while the Okafor family is traveling", card: true } },
      { remove: { text: "Teach the composting basics workshop for new members", card: true } },
      { shot: "promise-1", swaps: [["Two hours sorting the seed library", BOOTCAMP], ["0x5e...0b2", "obinna"], ...BASE], over: { screen: "promise-1-under", css: '[data-component="TakePart"]', fit: true, align: "start", style: '[data-component="TakePart"] { width: {width} !important; max-width: none !important; margin: 0 !important; }' }, tap: { text: "See All" } },
    ],
  },
  {
    id: "promise-2", device: PHONE, url: story("client-home-takepartsheet--at-the-season"),
    steps: [
      // Tech and Sun runs no campaign this season.
      { remove: { role: "button", name: "Show promises in Seed Swap Weekend" } },
      { shot: "promise-2", back: { role: "button", name: "Close" }, swaps: [...TAKE_PART, ["Offered", "Asked for", undefined, true], ...BASE], over: { screen: "promise-1", text: "Take Part", minHeight: 300, scrim: '[data-component="PwaSheet"]:not([role])' }, tap: { text: BOOTCAMP, card: true } },
    ],
  },
  { id: "promise-3", device: PHONE, url: story("client-commitments-promisegrouppage--open"), steps: [{ shot: "promise-3", back: { role: "button", name: "Go back" }, swaps: [...GROUP, ...BASE], tap: { role: "button", name: "Take Up One" } }] },
  { id: "promise-4", device: PHONE, url: story("client-commitments-takeuponesheet--ready"), steps: [{ shot: "promise-4", back: [{ role: "button", name: "Close" }, { role: "button", name: "Cancel" }], swaps: [...GROUP, ...BASE], over: { screen: "promise-3", text: "Take up one of these promises", minHeight: 200, scrim: '[data-component="PwaSheet"]:not([role])' }, tap: { role: "button", name: "Take Up One" } }] },
  {
    id: "promise-5", device: PHONE, url: story("client-commitments-gardencommitment--in-progress"),
    steps: [
      // She leads it alone at first.
      { remove: { text: /is helping/ }, up: 1 },
      { remove: { css: 'section[data-component="CommitmentTeam"] li:nth-child(2)' } },
      { shot: "promise-5", back: { role: "button", name: "Go back" }, swaps: [...IN_PROGRESS, ...BASE] },
    ],
  },

  // Work: after the bootcamp, Ifeoma logs it for her promise: three photos, the details, review.
  {
    id: "work-1", device: PHONE, url: story("client-work-submitwork--start-on-promises"),
    steps: [
      // Her only promise here; the node log is not part of the pitch.
      { remove: { text: "Node uptime log", card: true } },
      { shot: "work-1", back: { role: "button", name: "Go back" }, swaps: [...START, ...BASE], tap: { text: BOOTCAMP, card: true } },
    ],
  },
  {
    id: "work-2", device: PHONE, url: story("client-work-submitwork--media-for-a-promise"),
    steps: [
      // The hub's record of the bootcamp carries one photo, so her upload does too.
      { shot: "work-2", photos: ["record-06.jpg"], back: { role: "button", name: "Go back" }, swaps: [...FOR_PROMISE, ...BASE], tap: { role: "button", name: "Details" } },
    ],
  },
  {
    id: "work-3", device: PHONE, url: story("client-work-submitwork--review-for-a-promise"),
    steps: [
      // One photo, as on the record: the fixture's second goes.
      { script: () => { const imgs = [...document.querySelectorAll("img")].filter((img) => img.getBoundingClientRect().width >= 60); let tile = imgs[1]; while (tile?.parentElement && tile.parentElement.querySelectorAll("img").length < 2) tile = tile.parentElement; tile?.style.setProperty("display", "none", "important"); } },
      { shot: "work-3", back: { role: "button", name: "Go back" }, swaps: [["3", "14", 0, true], ...FOR_PROMISE, ...BASE], photos: ["record-06.jpg"] },
    ],
  },

  // Approval: Obinna reviews the bootcamp in the dashboard's Hub and approves it, which keeps
  // Ifeoma's promise. The real dialog's review panel is the Storybook review form, since the only
  // work waiting at the hub is the viewer's own.
  {
    id: "approval-app", device: DESKTOP, url: `${ADMIN}/hub/work?gardenId=${TAS}&mockAuth=deployer`, app: true, ready: "Review and triage", swaps: PEOPLE,
    steps: [
      { remove: { text: "waiting over a week" }, up: 1 },
      { shot: "approval-1", swaps: QUEUE, photos: ["record-06.jpg"], tap: { text: "Workshop Delivered", card: true } },
      { click: { text: /^(Workshop Delivered|Node Operation Log)$/ }, wait: 6000 },
      // A steward who can review sees the review form here, which makes the panel and its dialog taller.
      {
        script: () => {
          const title = [...document.querySelectorAll("body *")].find((el) => el.children.length === 0 && el.textContent.trim() === "Steward Review");
          for (let el = title; el && el !== document.body; el = el.parentElement) {
            const bg = getComputedStyle(el).backgroundColor;
            if (bg !== "transparent" && !bg.endsWith(", 0)") && el.getBoundingClientRect().height >= 120) { el.style.minHeight = "640px"; return; }
          }
        },
        wait: 800,
      },
      { shot: "approval-2-under", under: true, back: { role: "button", name: /close/i }, swaps: QUEUE, photos: ["record-06.jpg", "record-06.jpg"], box: { text: "Steward Review", minHeight: 120 } },
      { shot: "approval-4-under", under: true, back: { role: "button", name: /close/i }, swaps: [["Pending", "Approved", 2, true]], box: { text: "Steward Review", minHeight: 120 } },
    ],
  },
  { id: "approval-2", device: DESKTOP, url: story("admin-workflows-hub-reviewform--actionable"), steps: [{ shot: "approval-2", swaps: REVIEW_FORM, over: { screen: "approval-2-under", root: true, padding: "0 24px 24px", fit: true, align: "start", inheritBack: true }, tap: { css: 'button[aria-label="High confidence"]' } }] },
  {
    id: "approval-3", device: DESKTOP, url: story("admin-workflows-hub-reviewform--actionable"),
    steps: [
      { click: { css: 'button[aria-label="High confidence"]' }, wait: 600 },
      { fill: { css: "#feedback" }, value: "Three full days of sessions, and the photos match what I saw at the hub." },
      { shot: "approval-3", swaps: REVIEW_FORM, over: { screen: "approval-2-under", root: true, padding: "0 24px 24px", fit: true, align: "start", inheritBack: true }, tap: { role: "button", name: "Approve" } },
    ],
  },
  { id: "approval-4", device: DESKTOP, url: story("admin-workflows-hub-reviewform--already-reviewed"), steps: [{ shot: "approval-4", swaps: REVIEW_FORM, expect: ["Approved"], over: { screen: "approval-4-under", root: true, padding: "0 24px 24px", fit: true, align: "start", inheritBack: true } }] },

  // Vouchers (in pilot): approval pays Ifeoma 2 Tech and Sun vouchers and G$; she spends a voucher
  // on a hub day, and Obinna accepts the booking. Every voucher screen is a Storybook state: the
  // pilot's reads are not live.
  {
    id: "vouchers-1", device: PHONE, url: story("client-commitments-voucher-journeys--earn-vouchers"),
    steps: [
      { click: { role: "button", name: "Green Goods records Lina's agreement" }, wait: 2000 },
      { click: { role: "button", name: "The stewards confirm her work" }, wait: 2000 },
      { click: { role: "button", name: "The vouchers arrive" }, wait: 2000 },
      { click: { role: "button", name: "The G$ payout fails" }, wait: 2000 },
      { click: { role: "button", name: "The retried payout arrives" }, wait: 2500 },
      hideHarness,
      { remove: { text: /cannot be shown right now/ } },
      { shot: "vouchers-1", back: { role: "button", name: "Go back" }, swaps: [...EARN, ...VOUCHER_PEOPLE, ...BASE], tap: { text: "2 Tech and Sun vouchers" } },
    ],
  },
  { id: "vouchers-2", device: PHONE, url: story("client-wallet-voucherstab--voucher-open"), steps: [{ shot: "vouchers-2", expect: ["Tech and Sun vouchers"], tap: { role: "button", name: "Book a Service" } }] },
  {
    id: "vouchers-hubday", device: PHONE, url: story("client-commitments-voucher-journeys--redeem-hub-day"),
    steps: [
      hideHarness,
      { shot: "vouchers-3", back: { role: "button", name: "Go back" }, swaps: [...HUB_DAY, ...VOUCHER_PEOPLE, ...BASE], tap: { role: "button", name: "Review and Redeem" } },
      { click: { role: "button", name: "Review and Redeem" }, wait: 2500 },
      hideHarness,
      { shot: "vouchers-4", back: { role: "button", name: "Close" }, swaps: [...HUB_DAY, ...VOUCHER_PEOPLE, ...BASE], tap: { role: "button", name: "Agree to These Terms" } },
    ],
  },
  { id: "vouchers-5", device: PHONE, url: story("client-commitments-voucher-journeys--hub-day-agree-and-deposit"), steps: [hideHarness, { shot: "vouchers-5", back: { role: "button", name: "Go back" }, swaps: [...HUB_DAY, ...VOUCHER_PEOPLE, ...BASE], tap: { text: /^Your vouchers are in escrow/ } }] },
  {
    id: "vouchers-6", device: DESKTOP, url: story("admin-pool-poolclaimscard--voucher-accept"),
    steps: [
      { script: () => document.querySelector('[data-component="AdminDialog"]')?.style.setProperty("display", "none", "important") },
      { shot: "vouchers-6", swaps: VOUCHER_PEOPLE, over: { screen: "vouchers-6-under", text: "Review Promises", minHeight: 60, fit: true, align: "start", style: '[data-component="PoolClaimsCard"] { width: {width} !important; max-width: none !important; margin: 0 !important; }' }, tap: { text: "Accept…", card: true } },
    ],
  },
  { id: "vouchers-7", device: DESKTOP, url: story("admin-pool-poolclaimscard--voucher-accept"), steps: [{ shot: "vouchers-7", back: [{ role: "button", name: "Close" }, { role: "button", name: "Cancel" }], swaps: VOUCHER_PEOPLE, over: { screen: "vouchers-6", text: "Writing to", minHeight: 300, scrim: '[data-component="AdminDialog"]' }, tap: { role: "button", name: "Accept Ifeoma" } }] },
  { id: "vouchers-8", device: PHONE, url: story("client-wallet-voucherstab--booked"), steps: [{ shot: "vouchers-8", expect: ["Booked", "in a booking"] }] },

  // Impact: Funmi finds Green Goods on the web and follows its record to the hub and the bootcamp.
  {
    id: "impact-app", device: DESKTOP, url: `${APP}/`, app: true, live: true, swaps: PEOPLE,
    steps: [
      { shot: "impact-1", expect: ["Explore Gardens"], tap: { role: "link", name: "Impact" } },
      { click: { role: "link", name: "Impact" }, wait: 7000 },
      { scrollTo: { text: "Recent submissions and assessments.", align: "start", top: 72 } },
      { click: { role: "button", name: "Education" }, wait: 3000 },
      { scrollTo: { text: BOOTCAMP_NOTE, align: "start", card: "img", top: 160 } },
      { shot: "impact-2", expect: [BOOTCAMP_NOTE], tap: { text: BOOTCAMP_NOTE } },
      { click: { text: BOOTCAMP_NOTE }, wait: 6000 },
      { shot: "impact-3", expect: [BOOTCAMP_NOTE], back: { role: "button", name: "Close", nth: 1 } },
    ],
  },

  // Funding: Funmi backs the hub from its page with a donation to its shared fund.
  {
    id: "funding-app", device: DESKTOP, url: `${APP}/gardens/tas-hub`, app: true, live: true, swaps: PEOPLE,
    steps: [
      // "Support This Garden" closes the hub's page, under its stewards.
      { scroll: 99999, wait: 2500 },
      { shot: "funding-1", tap: { role: "link", name: "Support This Garden" } },
      { click: { role: "link", name: "Support This Garden" }, wait: 7000 },
      { shot: "funding-2", tap: { card: "TAS HUB", role: "button", name: "Donate" } },
      { click: { card: "TAS HUB", role: "button", name: "Donate" }, wait: 3500 },
      { fill: { css: '[role="dialog"] input' }, value: "500" },
      { shot: "funding-3", back: { role: "button", name: /close/i }, box: { text: "Donate to", minHeight: 150 }, tap: { role: "button", name: "Connect Wallet" } },
    ],
  },
  // Once a wallet is connected: the Storybook dialog states, drawn over the real Fund page.
  { id: "funding-4", device: DESKTOP, url: story("public-documentation-funding--donate"), steps: [wethFirst, { shot: "funding-4", back: { role: "button", name: /close/i }, swaps: [...DONATE, ...BASE], over: { screen: "funding-3", text: "Donate to", minHeight: 150 }, tap: { role: "button", name: "Donate $500.00 in DAI" } }] },
  { id: "funding-5", device: DESKTOP, url: story("public-documentation-funding--donated"), steps: [{ shot: "funding-5", back: { role: "button", name: /close/i }, swaps: [...DONATE, ...BASE], over: { screen: "funding-3", text: "Donate to", minHeight: 150 } }] },
];

function locate(page, spec) {
  let scope = spec.within ? page.locator(spec.within).last() : page;
  if (spec.card && spec.role) scope = page.locator("article, li, section > div, div").filter({ hasText: spec.card }).filter({ has: page.getByRole(spec.role, { name: spec.name, exact: true }) }).last();
  if (spec.css) return scope.locator(spec.css).nth(spec.nth ?? 0);
  if (spec.label) return scope.getByLabel(spec.label).first();
  if (spec.role) return scope.getByRole(spec.role, { name: spec.name, exact: true }).nth(spec.nth ?? 0);
  // Only text a person can see: a hidden fixture row keeps its text in the page.
  const text = scope.getByText(spec.text, { exact: true }).filter({ visible: true }).nth(spec.nth ?? 0);
  // A row or card that opens something: the nearest pressable ancestor of its text.
  return spec.card ? text.locator("xpath=ancestor-or-self::*[self::button or self::a or @role='button' or @role='link' or @role='radio' or @data-pressable][1]") : text;
}

// A control's box as fractions of the screen, or null (noted) when it is missing or off screen.
async function measure(page, step, spec, what, width, height) {
  const box = await hotspotBox(page, spec);
  if (!box) { note(`${step.shot}: ${what} target ${JSON.stringify(spec)} not found`); return null; }
  if (box.x < 0 || box.y < 0 || box.x + box.width > width + 1 || box.y + box.height > height + 1) { note(`${step.shot}: ${what} target is outside the screen (${JSON.stringify(box)})`); return null; }
  return [box.x / width, box.y / height, box.width / width, box.height / height].map((v) => Math.round(v * 10000) / 10000);
}

async function hotspotBox(page, spec) {
  const target = locate(page, spec);
  if (await target.count()) return target.boundingBox();
  return spec.text ? page.getByText(spec.text, { exact: true }).nth(spec.nth ?? 0).boundingBox() : null;
}

async function applySwaps(page, swaps, withNth) {
  return page.evaluate(({ rules, withNth, names }) => {
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
      // A shortened address becomes the same invented handle wherever it appears.
      return v.replace(/0x[0-9a-fA-F]{2,8}\.{2,3}[0-9a-fA-F]{2,8}/g, (address) => {
        let h = 0;
        for (const ch of address.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return names[h % names.length];
      });
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
  }, { rules: swaps, withNth, names: ADDRESS_NAMES });
}

// The garden page's header photo.
async function swapBanner(page, src) {
  return page.evaluate(async (src) => {
    const imgs = [...document.querySelectorAll("img")].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.top < 120 && r.width > 300 && r.height > 100;
    });
    let swapped = 0;
    for (const img of imgs) {
      img.closest("picture")?.querySelectorAll("source").forEach((s) => s.remove());
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = src;
      img.alt = "TAS HUB in Awka";
      // A banner that does not decode would be baked into the screen, so it never counts as swapped.
      if (await img.decode().then(() => img.naturalWidth > 0 && img.naturalHeight > 0, () => false)) swapped += 1;
    }
    return { swapped, found: imgs.length };
  }, src);
}

// Content photos in page order: every image at least 60px wide that is not a header banner. A
// null in the list keeps that image.
async function swapPhotos(page, sources) {
  return page.evaluate(async (sources) => {
    const imgs = [...document.querySelectorAll("img")].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width >= 60 && r.height >= 40 && !(r.top < 120 && r.width > 300);
    });
    let swapped = 0;
    const failed = [];
    for (const [i, img] of imgs.entries()) {
      if (!sources[i]) continue;
      img.closest("picture")?.querySelectorAll("source").forEach((s) => s.remove());
      img.removeAttribute("srcset");
      img.src = sources[i];
      // A photo that does not decode (an HTML error body saved as a .jpg, truncated bytes) would
      // bake a broken image into the screen, so it counts as a failure, never as a swap.
      const decoded = await img.decode().then(() => img.naturalWidth > 0 && img.naturalHeight > 0, () => false);
      if (decoded) swapped += 1; else failed.push(i);
    }
    return { swapped, found: imgs.length, failed };
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

// Hides an element the hub's record does not have: the located element, `up` levels above it, or
// its nearest pressable ancestor with `card`. Hidden rather than removed, so the app's own later
// updates still find their nodes.
async function removeTarget(page, spec, up) {
  const target = spec.whole ? page.getByText(spec.text, { exact: true }).first() : locate(page, spec);
  if (!(await target.count())) return false;
  await target.first().evaluate((el, up) => {
    let node = el;
    for (let i = 0; i < up && node.parentElement; i += 1) node = node.parentElement;
    node.style.setProperty("display", "none", "important");
  }, up ?? 0);
  return true;
}

async function scrollTarget(page, spec) {
  let target = spec.card === "img" ? page.getByText(spec.text, { exact: true }).nth(spec.nth ?? 0) : locate(page, spec);
  if (!(await target.count()) && spec.text) target = page.getByText(spec.text, { exact: true }).nth(spec.nth ?? 0);
  await target.waitFor({ state: "attached", timeout: 60000 });
  // Twice, since images that load after the first scroll can move the target.
  for (let pass = 0; pass < 2; pass += 1) {
    await target.evaluate((el, { align, margin, card, top }) => {
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

// Opens a date picker and pages its calendar to `day` (YYYY-MM-DD), then picks it.
async function pickDate(page, { trigger, day }) {
  await page.locator(trigger).click();
  const popover = page.locator('[data-component="DatePickerPopover"]').last();
  await popover.waitFor({ timeout: 10000 });
  for (let turn = 0; turn < 24; turn += 1) {
    const cell = popover.locator(`td[data-day="${day}"] button`);
    if (await cell.count()) { await cell.first().click(); return; }
    const shown = await popover.locator("td[data-day]").evaluateAll((cells) => cells.map((c) => c.getAttribute("data-day")).sort()[15]);
    await popover.getByRole("button", { name: shown < day ? "Go to the Next Month" : "Go to the Previous Month" }).click();
    await page.waitForTimeout(250);
  }
  throw new Error(`no ${day} in the date picker`);
}

async function waitReady(page, session) {
  if (session.ready) { await page.getByText(session.ready).first().waitFor({ timeout: 900000 }); return; }
  if (!session.app) { await page.waitForSelector("#storybook-root > *", { timeout: 120000 }); return; }
  await page.waitForFunction(() => (document.getElementById("root")?.childElementCount ?? 0) > 0 && document.getElementById("boot-fallback")?.hidden !== false, null, { timeout: 900000, polling: 1000 });
}

async function shoot(page, session, step, width, height) {
  const banner = photo(BANNER);
  if (step.banner || step.gardenCard) {
    if (!banner) note(`${step.shot}: ${BANNER} is missing; place it per README`);
    else if (step.banner) {
      const { swapped, found } = await swapBanner(page, banner);
      if (!found) note(`${step.shot}: no banner image found to swap`);
      else if (swapped !== found) note(`${step.shot}: ${BANNER} did not decode; replace it with the approved Awka photo`);
    } else if (step.gardenCard && !(await swapGardenCard(page, banner))) note(`${step.shot}: no garden card pattern found to swap`);
  }
  if (step.photos) {
    const sources = step.photos.map((name) => (name ? photo(name) : null));
    step.photos.forEach((name, i) => { if (name && !sources[i]) note(`${step.shot}: ${name} is missing; run photos.mjs`); });
    const { swapped, found, failed } = await swapPhotos(page, sources);
    if (failed.length) note(`${step.shot}: ${failed.map((i) => step.photos[i]).join(", ")} did not decode; refresh it with photos.mjs`);
    const wanted = step.photos.filter(Boolean).length;
    if (swapped !== wanted) note(`${step.shot}: ${found} content photos on screen, ${swapped} swapped, ${wanted} listed`);
  }
  const swaps = [...(step.swaps || []), ...(session.swaps || [])];
  const hits = swaps.map(() => 0);
  const swap = async (withNth) => (await applySwaps(page, swaps, withNth)).forEach((n, i) => { hits[i] += n; });
  await swap(true);
  await page.waitForTimeout(600);
  await swap(false);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  swaps.forEach(([from, to], i) => { swapHits.set(`${from} → ${to}`, (swapHits.get(`${from} → ${to}`) || 0) + hits[i]); });
  // The text a person sees: a closed dropdown's options are not on the screen.
  const text = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts = [];
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (el && !el.closest("select, script, style") && el.getClientRects().length) parts.push(walker.currentNode.nodeValue);
    }
    return parts.join("\n");
  });
  if (!session.live) for (const word of LEFTOVERS) if (word.test(text)) note(`${step.shot}: fixture text ${word} is still visible`);
  // Every screen has to show what the demo says it shows: Storybook's not-found view also fills
  // #storybook-root, a hotspot target proves its screen rendered, and a screen without one needs
  // its own `expect` copy or at least one of its own swap rules to have matched here.
  if (/couldn't find story|story not found|no story matched/i.test(text)) note(`${step.shot}: Storybook shows its not-found view instead of the story`);
  for (const expected of step.expect || []) if (!text.includes(expected)) note(`${step.shot}: expected "${expected}" on the screen`);
  if (!step.under && !step.tap && !step.expect && !hits.some((n) => n > 0)) note(`${step.shot}: no hotspot target, no expected copy and no swap matched; it did not render what the demo shows`);
  for (const name of new Set(text.match(/\b[\w-]+\.eth\b/g) || [])) if (!INVENTED.has(name)) note(`${step.shot}: the name ${name} is on screen`);
  if (debug) console.log(`--- ${step.shot}\n${(await page.evaluate(() => document.body.innerText)).slice(0, 2500)}`);
  let hotspot = null;
  if (step.tap) hotspot = await measure(page, step, step.tap, "hotspot", width, height);
  // The app's own back arrow, close button or Cancel on this screen: the demo goes back a screen there.
  let back = [];
  for (const spec of step.back ? [step.back].flat() : []) {
    const rect = await measure(page, step, spec, "back", width, height);
    if (rect) back.push(rect);
  }
  if (step.under && back.length) saveBox(`${step.shot}#back`, back);
  const file = join(staging, `${step.shot}.jpg`);
  if (step.over) {
    ({ hotspot, back } = await composeOver(page, session, step, file, { hotspot, back }));
    // A panel drawn over a real screen keeps that screen's own back control (a dialog's close).
    if (step.over.inheritBack) back = readBoxes()[`${step.over.screen}#back`] || [];
  } else await page.screenshot({ path: file, type: "jpeg", quality: 82 });
  // A screen a Storybook dialog will be drawn over: where its dialog sits, and the same screen
  // without that dialog (backdrop kept), saved beside it as <shot>-bare.jpg.
  if (step.box) {
    const box = await markPanel(page, step.box);
    if (!box) note(`${step.shot}: no dialog around "${step.box.text}" to record`);
    else {
      saveBox(step.shot, box);
      const hide = await page.addStyleTag({ content: "[data-demo-panel], [data-demo-panel] * { visibility: hidden !important; }" });
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(staging, `${step.shot}-bare.jpg`), type: "jpeg", quality: 82 });
      await hide.evaluate((el) => el.remove());
    }
  }
  const source = session.url.startsWith(STORYBOOK) ? session.url.split("id=")[1] : session.url.replace(/\?.*$/, "").replace(APP, "app").replace(ADMIN, "dashboard");
  console.log(`${step.shot}.jpg  ${source}${step.over ? ` over ${step.over.screen}` : ""}`);
  if (!step.under) results.set(step.shot, { story: source, width, height, hotspot, back: back.length === 1 ? back[0] : back.length ? back : null });
}

// This run's file when it made one, else the last clean run's.
const latest = (name) => (existsSync(join(staging, name)) ? join(staging, name) : join(out, name));
const readBoxes = () => (existsSync(latest("boxes.json")) ? JSON.parse(readFileSync(latest("boxes.json"), "utf8")) : {});
function saveBox(shot, box) { writeFileSync(join(staging, "boxes.json"), JSON.stringify({ ...readBoxes(), [shot]: box }, null, 2)); }

// The visible panel of a dialog or sheet: the nearest opaque ancestor, at least `minHeight` tall
// and smaller than the whole screen, of the last element whose own text is `text`. It is marked
// data-demo-panel so a style can single it out.
async function markPanel(page, { text, minHeight = 120, css }) {
  return page.evaluate(({ text, minHeight, css }) => {
    document.querySelectorAll("[data-demo-panel]").forEach((el) => el.removeAttribute("data-demo-panel"));
    // A section found by its selector is the panel as it is, with or without a background.
    if (css) {
      const el = [...document.querySelectorAll(css)].find((e) => e.getClientRects().length);
      if (!el) return null;
      el.setAttribute("data-demo-panel", "");
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    const owners = [...document.querySelectorAll("body *")].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim() === text));
    for (const owner of owners.reverse()) {
      for (let el = owner; el && el !== document.body; el = el.parentElement) {
        const bg = getComputedStyle(el).backgroundColor;
        const alpha = bg.startsWith("rgba") ? Number(bg.match(/[\d.]+/g)[3]) : 1;
        const r = el.getBoundingClientRect();
        const fullScreen = r.width >= window.innerWidth - 2 && r.height >= window.innerHeight - 2;
        if (bg !== "transparent" && alpha > 0.95 && r.height >= minHeight && !fullScreen) {
          el.setAttribute("data-demo-panel", "");
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }
      }
    }
    return null;
  }, { text, minHeight, css });
}

// Cuts the story's dialog panel out (everything else hidden, the page transparent) and draws it on
// the real screen it follows, with that screen's own dialog taken out, centred where that dialog
// was. Returns the hotspot moved with it.
async function composeOver(page, session, step, file, rects) {
  const { width, height, scale } = session.device;
  let { hotspot, back } = rects;
  if (step.over.scrim) { await composeSheet(page, session, step, file); return rects; }
  const under = latest(`${step.over.screen}-bare.jpg`);
  const ubox = readBoxes()[step.over.screen];
  if (!existsSync(under) || !ubox) { note(`${step.shot}: cannot draw over ${step.over.screen}; capture it first`); return rects; }
  // `fit` lays the story out at the real panel's width; `root` takes the story's whole root, on the
  // panel's own background, as the panel.
  if (step.over.fit) await page.addStyleTag({ content: `#storybook-root { width: ${Math.round(ubox.width)}px !important; max-width: ${Math.round(ubox.width)}px !important; margin: 0 !important; }` });
  // `style` sizes the story's own component to the real slot ({width} is the slot's width).
  if (step.over.style) await page.addStyleTag({ content: step.over.style.replaceAll("{width}", `${Math.round(ubox.width)}px`) });
  if (step.over.root) await page.addStyleTag({ content: `#storybook-root > * { background: ${step.over.background || "#fff"} !important; border-radius: 16px; padding: ${step.over.padding || "24px"} !important; box-sizing: border-box; height: ${Math.round(ubox.height)}px !important; min-height: 0 !important; overflow: hidden; }` });
  await page.waitForTimeout(400);
  const sbox = step.over.root
    ? await page.evaluate(() => { const el = document.querySelector("#storybook-root > *"); el.setAttribute("data-demo-panel", ""); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })
    : await markPanel(page, step.over);
  if (!sbox) { note(`${step.shot}: no panel around "${step.over.text}" in the story`); return rects; }
  // Its hotspot and back regions, measured before the layout changes above, are measured again.
  if (step.over.fit || step.over.root) {
    if (step.tap) hotspot = await measure(page, step, step.tap, "hotspot", width, height);
    back = [];
    for (const spec of step.back ? [step.back].flat() : []) { const rect = await measure(page, step, spec, "back", width, height); if (rect) back.push(rect); }
  }
  await page.addStyleTag({ content: "html, body { background: transparent !important; } body * { visibility: hidden !important; } [data-demo-panel], [data-demo-panel] * { visibility: visible !important; }" });
  await page.waitForTimeout(300);
  const clip = await page.screenshot({ type: "png", omitBackground: true, clip: sbox });
  const start = step.over.align === "start";
  const left = start ? ubox.x : ubox.x + (ubox.width - sbox.width) / 2;
  const top = start ? ubox.y : ubox.y + (ubox.height - sbox.height) / 2;
  const canvas = await page.context().browser().newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await canvas.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${readFileSync(under).toString("base64")}" style="position:absolute;inset:0;width:${width}px;height:${height}px"><img src="data:image/png;base64,${clip.toString("base64")}" style="position:absolute;left:${left}px;top:${top}px;width:${sbox.width}px;height:${sbox.height}px"></body>`);
  await canvas.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
  await canvas.screenshot({ path: file, type: "jpeg", quality: 82 });
  await canvas.close();
  const move = ([x, y, w, h]) => [x + (left - sbox.x) / width, y + (top - sbox.y) / height, w, h].map((v) => Math.round(v * 10000) / 10000);
  return { hotspot: hotspot && move(hotspot), back: back.map(move) };
}

// A sheet that opens over a screen with no dialog of its own: the story's sheet and its scrim, in
// place, drawn over that whole screen.
async function composeSheet(page, session, step, file) {
  const { width, height, scale } = session.device;
  const under = latest(`${step.over.screen}.jpg`);
  if (!existsSync(under) || !(await markPanel(page, step.over))) { note(`${step.shot}: cannot draw over ${step.over.screen}; capture it first`); return; }
  await page.addStyleTag({ content: `html, body { background: transparent !important; } body * { visibility: hidden !important; } ${step.over.scrim} { visibility: visible !important; } [data-demo-panel], [data-demo-panel] * { visibility: visible !important; }` });
  await page.waitForTimeout(300);
  const layer = await page.screenshot({ type: "png", omitBackground: true });
  const canvas = await page.context().browser().newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await canvas.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${readFileSync(under).toString("base64")}" style="position:absolute;inset:0;width:${width}px;height:${height}px"><img src="data:image/png;base64,${layer.toString("base64")}" style="position:absolute;inset:0;width:${width}px;height:${height}px"></body>`);
  await canvas.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
  await canvas.screenshot({ path: file, type: "jpeg", quality: 82 });
  await canvas.close();
}

async function runSession(browser, session) {
  const { width, height, scale } = session.device;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: "light", reducedMotion: "reduce", ignoreHTTPSErrors: true, serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.goto(session.url, { waitUntil: "domcontentloaded", timeout: 900000 });
    await waitReady(page, session);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(session.app ? 5000 : 3000);
    for (const step of session.steps) {
      if (step.shot) { await shoot(page, session, step, width, height); continue; }
      if (step.click) await locate(page, step.click).click({ timeout: 60000, force: Boolean(step.force) });
      if (step.fill) await locate(page, step.fill).fill(step.value, { timeout: 30000 });
      if (step.select) await locate(page, step.select).selectOption(step.value, { timeout: 30000 });
      if (step.files) await page.locator(step.files).first().setInputFiles(step.photos.map((name) => join(PHOTOS, name)));
      if (step.pickDate) await pickDate(page, step.pickDate);
      if (step.reveal) await locate(page, step.reveal).evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "center" }));
      if (step.remove && !(await removeTarget(page, step.remove, step.up)) && !step.optional) note(`${session.id}: nothing to remove for ${JSON.stringify(step.remove)}`);
      if (step.script) await page.evaluate(step.script, step.arg);
      if (step.scrollTo) await scrollTarget(page, step.scrollTo);
      if (step.scroll !== undefined) await page.evaluate((y) => window.scrollTo(0, y), step.scroll);
      await page.waitForTimeout(step.wait ?? 600);
      if (step.dump && debug) writeFileSync(join(out, `${session.id}-${step.dump}.txt`), await page.evaluate(() => document.body.innerText));
    }
  } catch (error) {
    note(`${session.id}: ${error.message.split("\n")[0]}`);
    await page.screenshot({ path: join(out, `${session.id}-failed.png`) }).catch(() => {});
    if (debug) writeFileSync(join(out, `${session.id}-failed.txt`), await page.evaluate(() => document.body.innerText).catch(() => ""));
  } finally {
    await context.close();
  }
}

// Storybook sessions run three at a time; the app sessions one at a time, since the dev servers
// share one busy machine. Then the #flows block is updated once.
let html = readFileSync(htmlPath, "utf8");
const block = html.match(/<script type="application\/json" id="flows">([\s\S]*?)<\/script>/);
if (!block) throw new Error("index.html has no #flows JSON block");
const data = JSON.parse(block[1]);
const screens = data.flows.flatMap((flow) => flow.screens);
const shots = SESSIONS.flatMap((s) => s.steps.filter((st) => st.shot && !st.under).map((st) => st.shot));
for (const s of screens) if (!shots.includes(s.file)) note(`index.html lists ${s.file}, which no session captures`);
for (const file of shots) if (!screens.some((s) => s.file === file)) note(`a session captures ${file}, which index.html does not list`);
for (const session of SESSIONS) {
  for (const step of session.steps) for (const name of [...(step.photos || [])]) if (/^record-/.test(name) && !RECORDS[name]) note(`${session.id} uses ${name}, which RECORDS does not bind to a submission title`);
}
// An `--only` id with no session would leave an empty queue and a clean exit, so it stops the run
// before anything is captured or index.html is rewritten.
const unknown = only.filter((id) => !SESSIONS.some((s) => s.id === id));
if (unknown.length) throw new Error(`--only names ${unknown.join(", ")}, which ${unknown.length === 1 ? "is not a session" : "are not sessions"}; nothing was captured or rewritten`);
const selected = SESSIONS.filter((s) => !only.length || only.includes(s.id));
// A run that was stopped leaves its staging folder behind; only one run may write at a time.
for (const name of readdirSync(out)) if (name.startsWith(".capture-")) rmSync(join(out, name), { recursive: true, force: true });
const staging = mkdtempSync(join(out, ".capture-"));
const results = new Map();
const swapHits = new Map();
const browser = await pw.chromium.launch();
const drawnOver = (s) => s.steps.some((st) => st.over);
const stories = selected.filter((s) => !s.app && !drawnOver(s));
const apps = selected.filter((s) => s.app);
await Promise.all([
  (async () => { for (const s of apps) await runSession(browser, s); })(),
  ...Array.from({ length: 3 }, async () => { while (stories.length) await runSession(browser, stories.shift()); }),
]);
for (const s of selected.filter(drawnOver)) await runSession(browser, s);
await browser.close();
// A rule that never matched on any screen it was listed for is stale, the shared rules included:
// each screen shows only some of them, but a full capture visits every screen, so a rule that
// matched nowhere means a fixture or the app moved and the demo may now show it. A partial
// `--only` capture can validate only the rules no unselected session lists; the rest are reported
// as not validated, and a full capture is needed before a build.
const listedOn = new Map();
for (const session of SESSIONS) for (const step of session.steps.filter((st) => st.shot)) for (const [from, to] of [...(step.swaps || []), ...(session.swaps || [])]) {
  const key = `${from} → ${to}`;
  if (!listedOn.has(key)) listedOn.set(key, new Set());
  listedOn.get(key).add(session.id);
}
const unvalidated = [];
for (const [pair, n] of swapHits) {
  if (n) continue;
  const elsewhere = [...(listedOn.get(pair) || [])].filter((id) => !only.includes(id));
  if (only.length && elsewhere.length) unvalidated.push(pair); else note(`swap "${pair}" matched nothing`);
}
if (unvalidated.length) console.log(`partial capture: ${unvalidated.length} swap(s) shared with sessions outside --only were not validated; run a full capture before building`);
for (const s of screens) {
  const r = results.get(s.file);
  if (!r) continue;
  s.story = r.story;
  s.size = [r.width, r.height];
  if (r.hotspot) s.hotspot = r.hotspot; else delete s.hotspot;
  if (r.back) s.back = r.back; else delete s.back;
}
// --accept keeps a run's screens despite its problems, while iterating; a capture for the page runs without it.
if (problems.length && process.argv.includes("--accept")) console.log(`--accept: keeping this run's screens despite ${problems.length} problem(s)`);
else if (problems.length) {
  // The failed run's screens stay in .last-failed for a look; they never replace the current set.
  const failed = join(out, ".last-failed");
  rmSync(failed, { recursive: true, force: true });
  renameSync(staging, failed);
  console.log(`capture failed with ${problems.length} problem(s); the existing screens and index.html are untouched (this run's screens: ${failed})`);
  process.exit(1);
}
for (const name of readdirSync(staging)) renameSync(join(staging, name), join(out, name));
rmSync(staging, { recursive: true, force: true });
const json = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
html = html.replace(block[0], `<script type="application/json" id="flows">\n${json}\n</script>`);
writeFileSync(htmlPath, html);
console.log(`captured ${results.size} screens into ${out}; ${problems.length} problems`);
