// Captures the clickable demo's screens into ./assets/screens (not committed) and writes each
// screen's source, size and measured hotspot into index.html's #flows block.
//
// The demo follows one season at Tech and Sun's hub, TAS HUB in Awka, through the current app:
// the steward names the need, a member keeps the season's climate course promise, the hub logs
// the bootcamp, and a supporter endows the hub. Each flow is a session that starts where a
// person starts and walks the app on develop, clicking, typing and attaching photos, with Tech
// and Sun's record behind it. A step that would need a signature is never pressed; the screens
// after it come from the deployed Storybook, which is built from develop, with the hub's content
// swapped in.
//
// Needs, run before capturing (README, Capture, build and check):
// - the develop app and dashboard on http://localhost:3122 and https://localhost:3102 (.claude/launch.json
//   "demo-client" and "demo-admin", serving a develop worktree, chain 42161, the hosted indexer);
// - the photos in ./assets/photos (awka-hub.jpg, and the record-NN.jpg and proof-course.jpg
//   that photos.mjs saves).
//
// Usage, from the repository root:
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs                   every screen
//   node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs --only=work-app   one session
// After a screen settles, names and fixture copy are swapped in its text (see the tables below):
// every person's name is invented, addresses become invented handles, and fixture places, dates
// and photos become the hub's. Components, layout, controls and state stay as rendered.
// Screens land in a staging folder and replace the current set only when the run has no problem,
// so a failed capture leaves the existing screens and index.html untouched. It fails when a step
// fails, a swap rule matches nothing, a fixture name or a real ENS name survives, a photo is missing
// or does not decode, a record photo's title no longer matches RECORDS, Storybook shows its
// not-found view, a screen without a hotspot shows neither its `expect` copy nor one of its own
// swaps, or a hotspot target is missing or off screen.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("@playwright/test"); }
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "assets", "screens");
const htmlPath = join(here, "index.html");
mkdirSync(out, { recursive: true });
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").replace("--only=", "").split(",").filter(Boolean);
const debug = process.argv.includes("--debug");
const problems = [];
const note = (message) => { problems.push(message); console.log(`  problem: ${message}`); };

const PHONE = { width: 390, height: 844, scale: 2 };
const DESKTOP = { width: 1440, height: 900, scale: 1.5 };
const APP = "http://localhost:3122";
const ADMIN = "https://localhost:3102";
const TAS = "0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3";
const HOME = `${APP}/home?mockAuth=deployer&presentation=pwa`;
const story = (id) => `https://design.greengoods.app/iframe.html?viewMode=story&id=${id}`;

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

// The season, its request and the one promise kept so far, from Tech and Sun's record (pool 3 and
// its commitment 19, read 26 October 2026).
const SEASON = "Climate and Tech Education";
const COURSE = "Complete the UN CC:Learn climate course";
const COURSE_NOTE = "Complete the agreed UN CC:Learn course and submit your certificate so the hub can verify your learning.";
const DUE = "Jan 31, 2027";
const PROOF_NOTE = "I completed the course, I attached my Proof too.";
const MEMBER = "0x67...e96";
const HUB_ABOUT = "Supporting Nigeria’s innovators and builders with reliable power and internet access.";
// The steward's assessment and the bootcamp, as this demo tells them.
const NEED_TITLE = "Climate and tech skills for members";
const NEED_ABOUT = "Members have steady power and internet at the hub. Few have climate or digital training, and most want paid work.";
const NEED_CHALLENGE = "Members want paid work, but few have the climate or digital skills that clients ask for.";
// The Work flow replays how the hub's real bootcamp reached its record, so the note is the record's
// own description; the hours and facilitator count are sample.
const BOOTCAMP_NOTE = "A one week content creation bootcamp with AI";

// Names. Every person is invented: Obinna the steward, Chiamaka the member who finished the
// course (the record's first finisher), Ifeoma who ran the bootcamp, and Funmi the supporter.
// Any other shortened address becomes one of ADDRESS_NAMES, the same one for the same address.
const ADDRESS_NAMES = ["tobenna.eth", "kelechi.eth", "nneka.eth", "ada.eth", "uche.eth", "ngozi.eth", "chidi.eth", "amaka.eth"];
const PEOPLE = [
  ["afo", "obinna", undefined, true],
  ["tomas", "obinna", undefined, true],
  ["amara", "chiamaka", undefined, true],
  [MEMBER, "chiamaka"],
  // The hub's two other stewards, named as confirmers and on its public page.
  ["nansel.eth", "adaeze.eth"],
  ["amioantho.eth", "ikenna.eth"],
];
// The only names a screen may show; any other name ending in .eth is a real one left over.
const INVENTED = new Set([...ADDRESS_NAMES, "adaeze.eth", "ikenna.eth", "funmi.eth"]);
// Storybook fixtures' hub and season.
const HUB = [
  ["Riverside Commons Garden", "TAS HUB"],
  ["Riverside District", "Awka, Nigeria"],
  ["3 members", "14 members", undefined, true],
  ["Autumn Planting 2026", SEASON],
];
const BASE = [...HUB, ...PEOPLE];
// Home's recent activity: the steward's own pending entry is a node log, which the pitch leaves out.
const HOME_ACTIVITY = [["Node Operation Log", "Energy & Uptime Check"]];
// The steward's Home a few minutes after Ifeoma uploads: her bootcamp waits at the top.
const HOME_REVIEW = [["Node Operation Log", "Workshop Delivered"], ["afo", "ifeoma", undefined, true], ["wk. ago", "min. ago"]];

// Chiamaka's promise in the Storybook screens: the season's real request, its real dates, and
// the real proof (one photo and a note).
const PROMISE = [
  ["Survey household water use on Mill Lane", COURSE],
  ["Repair the north fence panel by the compost bays before the first frost", COURSE],
  ["Visit one household, ask the six survey questions, and photograph the meter.", COURSE_NOTE],
  ["Two slats are split and loose after the storm. Materials are in the tool shed.", COURSE_NOTE],
  ["Replaced two split slats and secured the panel. Dele helped with measuring and fastening.", PROOF_NOTE],
  ["4 available · 3 in progress · 3 kept", "24 available · 0 in progress · 0 kept"],
  ["Proof added: 2 photos, 1 voice note", "Proof added: 1 photo"],
  ["Optional: you already added 2 photos and 1 voice note.", "Optional: you already added 1 photo."],
  ["2 hours", "1 certificate"],
  ["1 repair", "1 certificate"],
  ["Oct 30, 2026", DUE],
  ["Oct 20, 2026", DUE],
  ["Oct 2, 2026 · 4:40 PM", "Oct 13, 2026 · 2:55 PM"],
  ["Oct 3, 2026 · 9:12 AM", "Oct 21, 2026 · 2:53 PM"],
  ["Oct 12, 2026 · 10:24 AM", "Oct 21, 2026 · 2:57 PM"],
  ["Oct 12, 2026 · 10:41 AM", "Oct 21, 2026 · 2:57 PM"],
  ["Oct 14, 2026 · 8:03 AM", "Oct 26, 2026 · 9:05 AM"],
  ["Added Oct 12, 10:24 AM, by", "Added Oct 21, 2:57 PM, by"],
];
// The fixture promise asks for linked garden work; a course promise asks for proof. These are
// the band line and button the app shows for that type (statusBand.ts, GardenCommitment.tsx).
const PROOF_BAND = [
  ["Link the required work below. Garden stewards approve it; no separate send is needed.", "Add proof as you go. When it's complete, send it to be confirmed."],
  ["Link Work", "Add Proof", undefined, true],
];
// The bootcamp in the Storybook review screens: the real Workshop Delivered labels.
const WORK = [
  ["Moved 36 lettuce seedlings into the east bed and watered them after transplanting.", BOOTCAMP_NOTE],
  ["Seedling Transplant", "Workshop Delivered"],
  ["Plants Moved", "Facilitators"],
  ["36", "2", undefined, true],
  ["1h 30m", "20h"],
  ["The count and note match the evidence checked at the garden.", "The photos match the session I saw at the hub."],
];
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
const INSIGHTS = [
  ["Riverside Commons grows food along the river and shares the harvest with its block.", HUB_ABOUT],
  ["Native canopy returns along the riverbank", NEED_TITLE],
  ["Oct 18, 2025 – Jan 16, 2026", "Oct 10, 2026 – Jan 31, 2027"],
  ["Agroforestry", "Education"],
];
const ENDOW = [["$50.00", "$500.00"], ["50.00", "500.00", undefined, true], ["0x5eed...00a1", "funmi.eth"]];

// Fixture text that must not survive in a Storybook screen.
const LEFTOVERS = [/Riverside/, /Rio (Rainforest|canopy)/, /Mill Lane/, /frost/, /fence/i, /Autumn/, /\btomas\b/, /\bamara\b/, /\bdele\b/i, /Greenpill NYC/, /vault-owner/, /[Ss]eedling/, /lettuce/, /Mulch/, /Pond/, /canopy/i, /\bafo\b/, /Node Operation/, /Muizenberg/];

// Sessions. Each opens one browser context at `url` and runs `steps` in order. A step is an
// action ({ click }, { fill, value }, { select, value }, { pickDate }, { files }, { reveal },
// { remove }, { script }, { scrollTo }, { scroll }) or a screen ({ shot, tap, swaps, photos, banner, gardenCard,
// box, over }). `tap` names the control the hotspot sits on, measured after the swaps; each flow's
// last screen has none. Session `swaps` apply to every screen in the session, after the screen's
// own; a `live` session keeps its page's own copy and counts, and swaps only names. `box` records
// where a real dialog sits (found by its title text); `over` draws a Storybook dialog in its place,
// on that real screen, so a state the app reaches only after a signature keeps the page behind it.
const SESSIONS = [
  // Needs: Obinna records the season's need in the dashboard, every step of the wizard.
  {
    id: "needs-admin", device: DESKTOP, url: `${ADMIN}/hub/assess?gardenId=${TAS}&mockAuth=deployer`, app: true, ready: "Create Assessment", swaps: PEOPLE,
    steps: [
      { shot: "needs-1", tap: { role: "button", name: "Create Assessment" } },
      { click: { role: "button", name: "Create Assessment" }, wait: 5000 },
      { click: { role: "radio", name: "Education" }, force: true, wait: 800 },
      { fill: { label: /^Title/ }, value: NEED_TITLE },
      { fill: { label: /^Location/ }, value: "Awka, Nigeria" },
      { fill: { label: /^Description/ }, value: NEED_ABOUT },
      { shot: "needs-2", tap: { role: "button", name: "Next" } },
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
      { shot: "needs-3", tap: { role: "button", name: "Next" } },
      { click: { role: "button", name: "Next" }, wait: 3000, dump: "step3" },
      { click: { text: "Workshop Delivered" }, wait: 800 },
      { pickDate: { trigger: "#reportingPeriodStart", day: "2026-10-10" }, wait: 800 },
      { pickDate: { trigger: "#reportingPeriodEnd", day: "2027-01-31" }, wait: 800 },
      { shot: "needs-4", tap: { role: "button", name: "Next" } },
      { click: { role: "button", name: "Next" }, wait: 3000, dump: "step4" },
      { shot: "needs-5", box: { text: "Create Assessment", minHeight: 400 }, tap: { role: "button", name: "Submit Assessment" } },
    ],
  },
  // After Submit the wallet signs; the saved state is the Storybook dialog, drawn over the real
  // page it replaces (see `over`).
  { id: "needs-6", device: DESKTOP, url: story("admin-workflows-assessment-reviewstep--in-flow-sent"), steps: [{ shot: "needs-6", swaps: [...ASSESSMENT, ...BASE], over: { screen: "needs-5", text: "Create Assessment", minHeight: 400 }, tap: { role: "button", name: "Done" } }] },
  {
    id: "needs-7", device: PHONE, url: story("client-home-gardensheets--insights-with-banner-at-390"),
    steps: [
      // The fixture lists a second, older assessment; the hub has only this one.
      { remove: { text: "Gardeners learn to restore and care for their soil" }, up: 3 },
      // Members open Insights from the hub's Home; the sheet and its scrim are drawn over the real
      // Home (promise-1).
      { shot: "needs-7", swaps: [...INSIGHTS, ...BASE], photos: [BANNER], over: { screen: "promise-1", text: "Insights", minHeight: 300, scrim: '[data-component="PwaSheet"]:not([role])' } },
    ],
  },

  // Promise: Chiamaka opens the season from Home and takes up its request, then keeps it.
  {
    id: "promise-app", device: PHONE, url: HOME, app: true, swaps: PEOPLE,
    steps: [
      { click: { text: "TAS HUB" }, wait: 7000 },
      { shot: "promise-1", swaps: HOME_ACTIVITY, photos: ["record-03.jpg", "record-03.jpg"], tap: { text: SEASON, card: true } },
      { click: { text: SEASON }, wait: 3500 },
      { shot: "promise-2", tap: { role: "button", name: "Show Its Promises" } },
      { click: { role: "button", name: "Show Its Promises" }, wait: 7000 },
      // As the list stood before Chiamaka took hers up: the one already waiting is hers.
      { remove: { text: "Needs you", card: true } },
      { shot: "promise-3", tap: { text: COURSE, card: true } },
    ],
  },
  { id: "promise-4", device: PHONE, url: story("client-commitments-promisegrouppage--open"), steps: [{ shot: "promise-4", swaps: [...PROMISE, ...BASE], tap: { role: "button", name: "Take Up One" } }] },
  { id: "promise-5", device: PHONE, url: story("client-commitments-takeuponesheet--ready"), steps: [{ shot: "promise-5", swaps: [...PROMISE, ...BASE], tap: { role: "button", name: "Take Up One" } }] },
  {
    id: "promise-6", device: PHONE, url: story("client-commitments-gardencommitment--in-progress"),
    steps: [
      // She is doing it alone, as on the record, and a course promise asks for proof, not
      // linked garden work: the app then shows one Add Proof button and the proof line.
      { remove: { text: /is helping/ }, up: 1 },
      { remove: { css: 'section[data-component="CommitmentTeam"] li:nth-child(2)' } },
      { remove: { css: '[data-component="CommitmentActionBarSecondary"]' } },
      { shot: "promise-6", swaps: [...PROOF_BAND, ...PROMISE, ...BASE], tap: { role: "button", name: "Add Proof" } },
    ],
  },
  {
    id: "promise-7", device: PHONE, url: story("client-commitments-proofcomposer--media-added"),
    steps: [
      // The story's remove buttons are inert, so its second photo and voice note go here.
      { script: () => { document.querySelector('img[alt="Uploaded 2"]')?.closest("div.relative")?.remove(); document.querySelector('[aria-label="Delete audio"]')?.parentElement?.parentElement?.remove(); } },
      { shot: "promise-7", swaps: [...PROMISE, ...BASE], photos: ["proof-course.jpg"], tap: { role: "button", name: "Details" } },
    ],
  },
  {
    id: "promise-8", device: PHONE, url: story("client-commitments-proofcomposer--details"),
    steps: [
      { remove: { text: "dele", whole: true }, up: 2 },
      { remove: { css: 'button[aria-label^="Remove link"], [title="https://riverside-commons.example/receipts/fence-posts"]' }, up: 1 },
      { shot: "promise-8", swaps: [...PROMISE, ...BASE], tap: { role: "button", name: "Review Proof" } },
    ],
  },
  {
    id: "promise-9", device: PHONE, url: story("client-commitments-proofcomposer--review-send"),
    steps: [
      {
        script: () => {
          const audio = [...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "Audio notes");
          audio?.nextElementSibling?.remove();
          audio?.remove();
          document.querySelector('img[alt="Proof photo 2"]')?.closest('[role="group"]')?.remove();
          [...document.querySelectorAll(".gg-card")].find((card) => card.textContent.trim().startsWith("Links"))?.remove();
          document.querySelector('img[alt="Proof photo 1"]')?.style.setProperty("object-position", "8% 50%");
        },
      },
      { shot: "promise-9", swaps: [["dele", "", 0, true], [",", "", undefined, true], ["dele", "chiamaka", undefined, true], ...PROMISE, ...BASE], photos: ["proof-course.jpg"], tap: { role: "button", name: "Add and Send" } },
    ],
  },
  {
    id: "promise-steward", device: PHONE, url: `${APP}/home/${TAS}/commitments/19?mockAuth=deployer&presentation=pwa`, app: true, ready: "Progress and proof", swaps: PEOPLE,
    steps: [
      { shot: "promise-10", photos: ["proof-course.jpg"], tap: { role: "button", name: "Confirm It Was Kept" } },
      { click: { role: "button", name: "Confirm It Was Kept" }, wait: 3000, dump: "confirm" },
      { shot: "promise-11", photos: ["proof-course.jpg", "proof-course.jpg"], tap: { role: "button", name: "Confirm the Help Arrived", within: '[role="dialog"]' } },
    ],
  },
  {
    id: "promise-12", device: PHONE, url: story("client-commitments-gardencommitment--kept"),
    steps: [
      { remove: { text: /is helping/ }, up: 1 },
      { remove: { css: 'section[data-component="CommitmentTeam"] li:nth-child(2)' } },
      { shot: "promise-12", swaps: [["No approved work yet · no proof yet", "No approved work yet · 1 proof"], ...PROMISE, ...BASE] },
    ],
  },

  // Work: Ifeoma logs the bootcamp from TAS HUB's Home.
  {
    id: "work-app", device: PHONE, url: HOME, app: true, swaps: PEOPLE,
    steps: [
      { click: { text: "TAS HUB" }, wait: 7000 },
      { shot: "work-1", swaps: HOME_ACTIVITY, photos: ["record-03.jpg", "record-03.jpg"], tap: { role: "link", name: "Garden" } },
      { click: { role: "link", name: "Garden" }, wait: 7000 },
      // The hub's node log leads the Solar actions; the pitch leaves the node out.
      { remove: { text: "Node Operation Log", card: true } },
      { shot: "work-2", tap: { text: "Education" } },
      { click: { text: "Education" }, wait: 3000 },
      { reveal: { text: "Workshop Delivered" } },
      { shot: "work-3", tap: { text: "Workshop Delivered", card: true } },
      { click: { text: "Workshop Delivered" }, wait: 3000 },
      { shot: "work-4", tap: { role: "button", name: "Start Gardening" } },
      { click: { role: "button", name: "Start Gardening" }, wait: 5000 },
      { shot: "work-5", tap: { role: "button", name: "Choose from Your Photos" } },
      { files: "#work-media-upload", photos: ["record-06.jpg", "record-07.jpg", "record-04.jpg"], wait: 9000 },
      { shot: "work-6", tap: { role: "button", name: "Details" } },
      { click: { role: "button", name: "Details" }, wait: 4000 },
      { fill: { css: "#timeSpentMinutes" }, value: "20" },
      { fill: { css: "#deliveredDurationMin" }, value: "1200" },
      { fill: { css: "#facilitators" }, value: "2" },
      { click: { text: "Impact measurement" }, wait: 400 },
      { click: { text: "Other" }, wait: 400 },
      { fill: { css: "#feedback" }, value: BOOTCAMP_NOTE },
      { scroll: 0 },
      { shot: "work-7", tap: { role: "button", name: "Review Work" } },
      { click: { role: "button", name: "Review Work" }, wait: 5000 },
      { shot: "work-8", tap: { role: "button", name: "Upload Work" } },
    ],
  },
  {
    id: "work-steward", device: PHONE, url: HOME, app: true, swaps: PEOPLE,
    steps: [
      { click: { text: "TAS HUB" }, wait: 7000 },
      // The bootcamp entry carries three photos.
      {
        script: () => {
          // The smallest element around the pending row's title (under Recent Activity, not the
          // highlight card) that also holds its photo count.
          const leaves = [...document.querySelectorAll("body *")].filter((el) => el.children.length === 0);
          const below = leaves.find((el) => el.textContent.trim() === "Recent Activity")?.getBoundingClientRect().top ?? 0;
          const title = leaves.find((el) => el.textContent.trim() === "Node Operation Log" && el.getBoundingClientRect().top > below);
          for (let row = title?.parentElement; row; row = row.parentElement) {
            const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
            let count = null;
            while (walker.nextNode()) if (walker.currentNode.nodeValue.trim() === "1") { count = walker.currentNode; break; }
            if (count) { count.nodeValue = count.nodeValue.replace("1", "3"); break; }
          }
        },
      },
      { shot: "work-9", swaps: HOME_REVIEW, photos: ["record-06.jpg", "record-06.jpg"], tap: { text: "Workshop Delivered", nth: 1, card: true } },
    ],
  },
  { id: "work-10", device: PHONE, url: story("client-work-reviewwork--evaluate-example"), steps: [{ shot: "work-10", swaps: [...WORK, ...BASE], photos: ["record-06.jpg"], gardenCard: true, tap: { role: "button", name: "Approve" } }] },
  { id: "work-11", device: PHONE, url: story("client-work-reviewwork--feedback-example"), steps: [{ shot: "work-11", swaps: [...WORK, ...BASE], photos: ["record-06.jpg"], gardenCard: true, tap: { role: "button", name: "Submit" } }] },
  {
    id: "work-12", device: DESKTOP, url: `${APP}/gardens/tas-hub`, app: true, live: true, swaps: PEOPLE,
    steps: [{ scrollTo: { text: "A one week content creation bootcamp with AI", align: "start", card: "img", top: 28 } }, { shot: "work-12", expect: ["Workshop Delivered", "A one week content creation bootcamp with AI"] }],
  },

  // Funding: Funmi finds the hub's public page and endows it.
  {
    id: "funding-app", device: DESKTOP, url: `${APP}/gardens/tas-hub`, app: true, live: true, swaps: PEOPLE,
    steps: [
      // "Support This Garden" closes the hub's page, under its stewards.
      { scroll: 99999, wait: 2500 },
      { shot: "funding-1", tap: { role: "link", name: "Support This Garden" } },
      { click: { role: "link", name: "Support This Garden" }, wait: 7000 },
      { shot: "funding-2", tap: { card: "TAS HUB", role: "button", name: "Endow" } },
      { click: { card: "TAS HUB", role: "button", name: "Endow" }, wait: 3500 },
      { fill: { css: '[role="dialog"] input' }, value: "500" },
      { shot: "funding-3", box: { text: "Endow to", minHeight: 150 }, tap: { role: "button", name: "Connect Wallet" } },
    ],
  },
  // Once a wallet is connected: the Storybook dialog states, drawn over the real Fund page.
  {
    id: "funding-4", device: DESKTOP, url: story("public-documentation-funding--endow"),
    steps: [
      // The app lists WETH before DAI (funding-3); the story lists DAI first.
      {
        script: () => {
          const button = (label) => [...document.querySelectorAll("button")].find((b) => [...b.querySelectorAll("*")].some((el) => el.children.length === 0 && el.textContent.trim() === label));
          const [dai, weth] = [button("DAI"), button("WETH")];
          if (dai && weth && dai.compareDocumentPosition(weth) & Node.DOCUMENT_POSITION_FOLLOWING) weth.after(dai);
        },
      },
      { shot: "funding-4", swaps: [...ENDOW, ...BASE], over: { screen: "funding-3", text: "Endow to", minHeight: 150 }, tap: { role: "button", name: "Endow $500.00 in DAI" } },
    ],
  },
  { id: "funding-5", device: DESKTOP, url: story("public-documentation-funding--endowed"), steps: [{ shot: "funding-5", swaps: [...ENDOW, ...BASE], over: { screen: "funding-3", text: "Endow to", minHeight: 150 }, tap: { within: '[role="status"]', role: "button", name: "Close" } }] },
  {
    id: "funding-6", device: DESKTOP, url: `${APP}/gardens/tas-hub`, app: true, live: true, swaps: PEOPLE,
    steps: [{ scrollTo: { text: "Recent approved submissions", align: "start", top: 48 } }, { shot: "funding-6", expect: ["Recent approved submissions", "Hub Service Session"] }],
  },
];

function locate(page, spec) {
  let scope = spec.within ? page.locator(spec.within).last() : page;
  if (spec.card && spec.role) scope = page.locator("article, li, section > div, div").filter({ hasText: spec.card }).filter({ has: page.getByRole(spec.role, { name: spec.name, exact: true }) }).last();
  if (spec.css) return scope.locator(spec.css).nth(spec.nth ?? 0);
  if (spec.label) return scope.getByLabel(spec.label).first();
  if (spec.role) return scope.getByRole(spec.role, { name: spec.name, exact: true }).first();
  // Only text a person can see: a hidden fixture row keeps its text in the page.
  const text = scope.getByText(spec.text, { exact: true }).filter({ visible: true }).nth(spec.nth ?? 0);
  // A row or card that opens something: the nearest pressable ancestor of its text.
  return spec.card ? text.locator("xpath=ancestor-or-self::*[self::button or self::a or @role='button' or @role='link' or @role='radio' or @data-pressable][1]") : text;
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
  return page.evaluate(async (src) => {
    // A CSS background never reports a decode failure, so the photo is decoded first and a
    // banner that does not decode is reported instead of leaving a blank card on the screen.
    const probe = new Image();
    probe.src = src;
    if (!(await probe.decode().then(() => probe.naturalWidth > 0 && probe.naturalHeight > 0, () => false))) return { swapped: 0, decoded: false };
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
    return { swapped, decoded: true };
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
    } else if (step.gardenCard) {
      const { swapped, decoded } = await swapGardenCard(page, banner);
      if (!decoded) note(`${step.shot}: ${BANNER} did not decode; replace it with the approved Awka photo`);
      else if (!swapped) note(`${step.shot}: no garden card pattern found to swap`);
    }
  }
  if (step.photos) {
    const sources = step.photos.map((name) => (name ? photo(name) : null));
    step.photos.forEach((name, i) => { if (name && !sources[i]) note(`${step.shot}: ${name} is missing; run photos.mjs`); });
    const { swapped, found, failed } = await swapPhotos(page, sources);
    if (failed.length) note(`${step.shot}: ${failed.map((i) => step.photos[i]).join(", ")} did not decode; refresh it with photos.mjs`);
    const wanted = step.photos.filter(Boolean).length;
    if (swapped !== wanted) note(`${step.shot}: ${found} content photos on screen, ${swapped} swapped, ${wanted} listed`);
    // Every content photo on the screen has to be accounted for, a null entry standing for one
    // kept as is, or a fixture image the app or Storybook added would be baked in unnoticed.
    if (found !== step.photos.length) note(`${step.shot}: ${found} content photos on screen but ${step.photos.length} listed; list each one, with null for a photo to keep`);
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
  const text = await page.evaluate(() => document.body.innerText);
  if (!session.live) for (const word of LEFTOVERS) if (word.test(text)) note(`${step.shot}: fixture text ${word} is still visible`);
  // Every screen has to show what the demo says it shows: Storybook's not-found view also fills
  // #storybook-root, a hotspot target proves its screen rendered, and a screen without one needs
  // its own `expect` copy or at least one of its own swap rules to have matched here.
  if (/couldn't find story|story not found|no story matched/i.test(text)) note(`${step.shot}: Storybook shows its not-found view instead of the story`);
  for (const expected of step.expect || []) if (!text.includes(expected)) note(`${step.shot}: expected "${expected}" on the screen`);
  if (!step.tap && !step.expect && !hits.some((n) => n > 0)) note(`${step.shot}: no hotspot target, no expected copy and no swap matched; it did not render what the demo shows`);
  for (const name of new Set(text.match(/\b[\w-]+\.eth\b/g) || [])) if (!INVENTED.has(name)) note(`${step.shot}: the name ${name} is on screen`);
  if (debug) console.log(`--- ${step.shot}\n${(await page.evaluate(() => document.body.innerText)).slice(0, 2500)}`);
  let hotspot = null;
  if (step.tap) {
    const box = await hotspotBox(page, step.tap);
    if (!box) note(`${step.shot}: hotspot target ${JSON.stringify(step.tap)} not found`);
    else if (box.x < 0 || box.y < 0 || box.x + box.width > width + 1 || box.y + box.height > height + 1) note(`${step.shot}: hotspot target is outside the screen (${JSON.stringify(box)})`);
    // A target the size of the screen is a scrim or a backdrop, not the control the caption names,
    // and it would let any tap advance the flow.
    else if (box.width * box.height > width * height * 0.6) note(`${step.shot}: hotspot target covers ${Math.round((box.width * box.height) / (width * height) * 100)}% of the screen; target the visible control (${JSON.stringify(step.tap)})`);
    else hotspot = [box.x / width, box.y / height, box.width / width, box.height / height].map((v) => Math.round(v * 10000) / 10000);
  }
  // Every image a person can see on the screen has to have decoded pixels, the live pages' own
  // photos and banners included, or a failed or undecodable image request would bake a blank
  // picture into the screen that no later check can see.
  const blank = await page.evaluate(() => [...document.querySelectorAll("img")].filter((img) => {
    const r = img.getBoundingClientRect();
    const visible = r.width >= 24 && r.height >= 24 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(img).visibility !== "hidden";
    return visible && !(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  }).map((img) => (img.currentSrc || img.getAttribute("src") || "(no src)").replace(/^data:[^,]*,.*/, "(data URI)").slice(0, 90)));
  if (blank.length) note(`${step.shot}: ${blank.length} visible image(s) did not load or decode: ${blank.join(" | ")}`);
  const file = join(staging, `${step.shot}.jpg`);
  if (step.over) hotspot = await composeOver(page, session, step, file, hotspot);
  else await page.screenshot({ path: file, type: "jpeg", quality: 82 });
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
  const source = session.url.includes("design.greengoods.app") ? session.url.split("id=")[1] : session.url.replace(/\?.*$/, "").replace(APP, "app").replace(ADMIN, "dashboard");
  console.log(`${step.shot}.jpg  ${source}${step.over ? ` over ${step.over.screen}` : ""}`);
  results.set(step.shot, { story: source, width, height, hotspot });
}

// This run's file when it made one, else the last clean run's.
const latest = (name) => (existsSync(join(staging, name)) ? join(staging, name) : join(out, name));
const readBoxes = () => (existsSync(latest("boxes.json")) ? JSON.parse(readFileSync(latest("boxes.json"), "utf8")) : {});
function saveBox(shot, box) { writeFileSync(join(staging, "boxes.json"), JSON.stringify({ ...readBoxes(), [shot]: box }, null, 2)); }

// The visible panel of a dialog or sheet: the nearest opaque ancestor, at least `minHeight` tall
// and smaller than the whole screen, of the last element whose own text is `text`. It is marked
// data-demo-panel so a style can single it out.
async function markPanel(page, { text, minHeight = 120 }) {
  return page.evaluate(({ text, minHeight }) => {
    document.querySelectorAll("[data-demo-panel]").forEach((el) => el.removeAttribute("data-demo-panel"));
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
  }, { text, minHeight });
}

// Cuts the story's dialog panel out (everything else hidden, the page transparent) and draws it on
// the real screen it follows, with that screen's own dialog taken out, centred where that dialog
// was. Returns the hotspot moved with it.
async function composeOver(page, session, step, file, hotspot) {
  const { width, height, scale } = session.device;
  if (step.over.scrim) return composeSheet(page, session, step, file, hotspot);
  const under = latest(`${step.over.screen}-bare.jpg`);
  const ubox = readBoxes()[step.over.screen];
  const sbox = await markPanel(page, step.over);
  if (!existsSync(under) || !ubox || !sbox) { note(`${step.shot}: cannot draw over ${step.over.screen}; capture it first`); return hotspot; }
  await page.addStyleTag({ content: "html, body { background: transparent !important; } body * { visibility: hidden !important; } [data-demo-panel], [data-demo-panel] * { visibility: visible !important; }" });
  await page.waitForTimeout(300);
  const clip = await page.screenshot({ type: "png", omitBackground: true, clip: sbox });
  const left = ubox.x + (ubox.width - sbox.width) / 2;
  const top = ubox.y + (ubox.height - sbox.height) / 2;
  const canvas = await page.context().browser().newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await canvas.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${readFileSync(under).toString("base64")}" style="position:absolute;inset:0;width:${width}px;height:${height}px"><img src="data:image/png;base64,${clip.toString("base64")}" style="position:absolute;left:${left}px;top:${top}px;width:${sbox.width}px;height:${sbox.height}px"></body>`);
  await canvas.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
  await canvas.screenshot({ path: file, type: "jpeg", quality: 82 });
  await canvas.close();
  if (!hotspot) return hotspot;
  const [x, y, w, h] = hotspot;
  return [x + (left - sbox.x) / width, y + (top - sbox.y) / height, w, h].map((v) => Math.round(v * 10000) / 10000);
}

// A sheet that opens over a screen with no dialog of its own: the story's sheet and its scrim, in
// place, drawn over that whole screen.
async function composeSheet(page, session, step, file, hotspot) {
  const { width, height, scale } = session.device;
  const under = latest(`${step.over.screen}.jpg`);
  if (!existsSync(under) || !(await markPanel(page, step.over))) { note(`${step.shot}: cannot draw over ${step.over.screen}; capture it first`); return hotspot; }
  await page.addStyleTag({ content: `html, body { background: transparent !important; } body * { visibility: hidden !important; } ${step.over.scrim} { visibility: visible !important; } [data-demo-panel], [data-demo-panel] * { visibility: visible !important; }` });
  await page.waitForTimeout(300);
  const layer = await page.screenshot({ type: "png", omitBackground: true });
  const canvas = await page.context().browser().newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await canvas.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${readFileSync(under).toString("base64")}" style="position:absolute;inset:0;width:${width}px;height:${height}px"><img src="data:image/png;base64,${layer.toString("base64")}" style="position:absolute;inset:0;width:${width}px;height:${height}px"></body>`);
  await canvas.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
  await canvas.screenshot({ path: file, type: "jpeg", quality: 82 });
  await canvas.close();
  return hotspot;
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
      if (step.remove && !(await removeTarget(page, step.remove, step.up))) note(`${session.id}: nothing to remove for ${JSON.stringify(step.remove)}`);
      if (step.script) await page.evaluate(step.script);
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
const shots = SESSIONS.flatMap((s) => s.steps.filter((st) => st.shot).map((st) => st.shot));
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
}
if (problems.length) {
  rmSync(staging, { recursive: true, force: true });
  console.log(`capture failed with ${problems.length} problem(s); the existing screens and index.html are untouched`);
  process.exit(1);
}
// The new index.html is written beside the old one first, the screens being replaced are backed
// up, and the backup lives until the staged index.html has taken the old one's place, so a
// failure at any point puts the old screens back and leaves the old index.html, and the screens
// and their metadata never disagree.
const json = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
html = html.replace(block[0], `<script type="application/json" id="flows">\n${json}\n</script>`);
const stagedHtml = join(here, ".index.html.staged");
writeFileSync(stagedHtml, html);
const backup = mkdtempSync(join(out, ".previous-"));
const names = readdirSync(staging);
try {
  for (const name of names) if (existsSync(join(out, name))) copyFileSync(join(out, name), join(backup, name));
  for (const name of names) renameSync(join(staging, name), join(out, name));
  renameSync(stagedHtml, htmlPath);
} catch (error) {
  // A screen captured for the first time has no backup, so every promoted name goes first, or a
  // new screen could outlive the rollback beside the old index.html.
  for (const name of names) rmSync(join(out, name), { force: true });
  for (const name of readdirSync(backup)) copyFileSync(join(backup, name), join(out, name));
  for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
  rmSync(stagedHtml, { force: true });
  throw new Error(`${error.message}; the previous screens were put back and index.html is untouched`);
}
for (const dir of [staging, backup]) rmSync(dir, { recursive: true, force: true });
console.log(`captured ${results.size} screens into ${out}; 0 problems`);
