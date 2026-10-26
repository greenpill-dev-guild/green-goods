# Clickable demo · SustainableFinance.Live 2026

The demonstrator for the submission: one page a judge clicks through. It follows one season at
Tech and Sun's hub in Awka, Nigeria, through the loop on slide 5 of the deck. Each of the four
flows starts where that person starts in the current app and shows every step:

1. **Needs** (7 screens). Obinna, the hub's steward, opens the dashboard and writes the season's
   assessment, step by step: the need, two targets (24 members certified, 5 bootcamp sessions), the
   work that counts toward them and the period. Members then see it in the app.
2. **Promise** (12). Chiamaka opens the season from Home, finds the hub's request "Complete the UN
   CC:Learn climate course" (one of 24), takes one up, adds her proof and sends it. Obinna confirms
   it on the hub's record, and the promise is kept.
3. **Work** (12). Ifeoma logs the hub's bootcamp from Home: Garden, Education, Workshop Delivered,
   three photos, the details form, review. Obinna finds it on his Home and approves it with a note,
   and it shows on the hub's public record.
4. **Funding** (6). Funmi backs the hub from its public page: Fund, Endow, $500, her wallet, the
   confirmation, and back to the record the money follows.

Every screen has one caption, who you are, and one hotspot on the control to tap; a tap anywhere
else does not advance. "All flows" stays at the top left of every screen, and each flow's last
screen continues to the next flow, so "Start from the beginning" plays the whole season.

- Drive: `Shared drives/Greenpill Dev Guild/Product/Green Goods/Growth/SF.Live 2026/Green Goods SF.Live 2026 clickable demo.html`
- Artifact (shared by link): <https://claude.ai/artifact/9ThhqDPZTEggFZuKnvS2wa>
- UI review of every screen: [`ui-review-2026-10-26.md`](ui-review-2026-10-26.md)

## Where the screens come from

- **App** (24 screens): the develop app and dashboard, run locally against the hub's record (the
  hosted indexer and the hub's pinned photos and documents), signed in with the dev-only mock
  account that is one of the hub's stewards. `capture.mjs` clicks, types, chooses and attaches
  photos as a person would. Nothing is uploaded, signed or sent: each flow stops on the button that
  would ask for a signature, and the hotspot sits on it.
- **Storybook** (9): the deployed Storybook at design.greengoods.app, built from develop, for the
  states the app reaches only after a signature (taken up, proof sent, approved, kept) and for
  Chiamaka's own view of her promise. Fixture copy is swapped for the hub's (Demo copy, below).
- **Composite** (4): the dashboard's "assessment saved" dialog and the Endow dialog's two connected
  states are Storybook dialogs drawn over the App screen they follow, in the real dialog's place,
  and the members' Insights sheet is the Storybook sheet, with its own scrim, drawn over the hub's
  Home, so the page behind stays the hub's (`over` in `capture.mjs`).

## What is here

| Path | What it is |
|---|---|
| [`index.html`](index.html) | The page: landing, flow view and the `#flows` block with every caption, who you are, source and hotspot. It shows the screens from `assets/screens/` when they are present |
| [`photos.mjs`](photos.mjs) | Saves the hub's public submission photos as `assets/photos/record-NN.jpg`, and the course proof as `proof-course.jpg`, cropped to the result. It replaces the set whole: one failed download, or a body that is not an image, leaves the old set untouched and exits 1 |
| [`capture.mjs`](capture.mjs) | Walks each flow's session in the app and Storybook, captures the 37 screens, swaps in names and the hub's content, and writes each screen's source, size and measured hotspot into `#flows` |
| [`build.mjs`](build.mjs) | Inlines the screens and the corner symbol into `output/green-goods-sf-live-demo.html` (the Drive copy) and `output/artifact.html` (the same page without its document wrapper). A missing screen or a page over 15 MB fails the build before it writes, so the last good build survives |
| [`check.mjs`](check.mjs) | Checks the build and walks every flow headless; screenshots each step and a contact sheet into `output/` |
| `assets/screens/`, `assets/photos/`, `output/` | Local files, not committed: the photos, the screens and the built page show identifiable people |

## Capture, build and check

Capture needs the develop app on port 3122 and the dashboard on 3102, both from a develop checkout
with dependencies installed, on the hub's chain and the hosted indexer (no new dependency):

```bash
cd packages/client && SKIP_MKCERT=true APP_ENV=development VITE_CHAIN_ID=42161 VITE_ENVIO_INDEXER_URL=https://indexer.hyperindex.xyz/de3e5df/v1/graphql node ../../scripts/dev/node-cli.js vite --port 3122 --strictPort
cd packages/admin && APP_ENV=development VITE_CHAIN_ID=42161 node ../../scripts/dev/node-cli.js vite --port 3102 --strictPort
```

Then, from the repository root (Playwright and network access), place the approved Awka photo, save
the record's photos, and capture, build and check. A missing photo fails the capture:

```bash
cp /Users/afo/Code/greenpill/artifacts/octant-e12-deck/assets/photos/awka-hub.jpg .plans/backlog/cosmo-local-credit-interop/artifacts/demo/assets/photos/
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/photos.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/build.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/check.mjs
```

`capture.mjs --only=work-app,promise-4` re-runs single sessions (session ids are in `SESSIONS`); an
unknown id stops the run before anything is captured, and swap rules shared with sessions outside
`--only` are reported as not validated rather than passed. `--debug` prints each screen's text. A
composite needs the App screen under it captured first. Screens are staged and replace the current
set only when the run has no problem, so a failed capture leaves the existing screens and
`index.html` untouched. A capture fails when a step fails; when any swap rule, shared ones
included, matches nothing on a full capture; when a fixture name survives, or a name ending in
`.eth` that is not one of the demo's appears; when the Awka banner or a listed photo is missing or
does not decode; when a record photo's title in `record-photos.tsv` no longer matches the
submission `RECORDS` binds it to (the hub's page lists newest first, so a new approved submission
renumbers the files); when Storybook shows its not-found view; when a screen without a hotspot
shows neither its `expect` copy nor any of its own swaps; or when a hotspot target is missing, off
screen, or the size of the screen (a scrim, not the control the caption names); or when a visible
image did not load or decode, the live pages' own photos and banners included. The check then taps
beside the hotspot on every screen and expects not to advance.

Check fails on an em dash in the demo's HTML or Markdown; a caption over eight words; a caption,
tile line or "who you are" line using "commitment", "chain", "blockchain", "Arbitrum", "Celo",
"Gnosis" or "live"; a tile line that is not five words; a missing or extra hotspot; a stale build; a
file over 15 MB; an image that does not load; a caption that does not change; a tap beside the
hotspot that advances; a missing "All flows" button; a flow's end that does not continue to the
next flow; broken keys (Right, Left, Escape), Back, Restart or deep links (`#work-3`); keyboard
focus left on a hidden or disabled control (Enter through a flow, Left from its last screen, Back
or Restart by keyboard); any request beyond Google Fonts; console errors; sideways scroll at 390
wide; or a light background in dark mode.

To change a caption, a "who you are" line or a tile line, edit `#flows` in `index.html`, then build
and check. To present, open the built file; `#promise` opens a flow and `#promise-3` its third
screen.

## The flows

| Screen | Source | What the screen shows | Caption |
|---|---|---|---|
| needs-1 | App: dashboard, Hub, Assessments, TAS HUB chosen | No assessments yet | Start the season's assessment |
| needs-2 | App: Create Assessment, step 1 | Education chosen; title, location and description typed | Name the need: climate and tech skills |
| needs-3 | App: step 2 | The challenge typed; "Members earn the UN CC:Learn climate certificate", Participants, 24; "The hub runs hands-on bootcamp sessions", Sessions delivered, 5; Complicated chosen | Set the targets the season should reach |
| needs-4 | App: step 3 | Workshop Delivered chosen as the work that counts | Choose the work that counts toward them |
| needs-5 | App: step 4, review | Everything entered, before Submit Assessment | Check everything, then submit |
| needs-6 | Composite: `admin-workflows-assessment-reviewstep--in-flow-sent` over needs-5 | Assessment submitted | Close the saved assessment |
| needs-7 | Composite: `client-home-gardensheets--insights-with-banner-at-390` over promise-1 (the hub's Home) | The hub's Insights sheet with its description and the assessment | Members see what the hub needs |
| promise-1 | App: `/home`, TAS HUB chosen in the garden picker | Home: the season, recent activity, Continue | Open this season at the hub |
| promise-2 | App: the season card's sheet | The season's dates and counts | See what the season asks members |
| promise-3 | App: "Show Its Promises" | The season's open course requests | Open the climate course request |
| promise-4 | Storybook: `client-commitments-promisegrouppage--open` | What each request asks; 24 available | Read what it asks, then take one |
| promise-5 | Storybook: `client-commitments-takeuponesheet--ready` | The take-up sheet | Promise to finish the course |
| promise-6 | Storybook: `client-commitments-gardencommitment--in-progress` | Her promise, in progress | Finished? Add your proof |
| promise-7 | Storybook: `client-commitments-proofcomposer--media-added` | The course result photo added | Add a photo of your result |
| promise-8 | Storybook: `client-commitments-proofcomposer--details` | Credited to her; the record's note | Say what you did |
| promise-9 | Storybook: `client-commitments-proofcomposer--review-send` | The proof to send | Check it, then send it to the hub |
| promise-10 | App: `/home/<TAS HUB>/commitments/19`, as the steward who asked | The record's waiting promise, its note and photo | As steward, open the finished promise |
| promise-11 | App: the same page's "Confirm It Was Kept" | The confirm sheet with the proof | Confirm she finished the course |
| promise-12 | Storybook: `client-commitments-gardencommitment--kept` | Kept, as she sees it | The promise is kept |
| work-1 | App: `/home`, TAS HUB chosen | Home | Tap Garden to log the bootcamp |
| work-2 | App: the Garden tab's Start step | The Solar actions | Switch to Education |
| work-3 | App: Education | The Education actions, Workshop Delivered in view | Pick Workshop Delivered |
| work-4 | App: Workshop Delivered chosen | The Promise section and Start Gardening | Start logging the workshop |
| work-5 | App: Media step | Capture Workshop Photo, nothing added yet | Add photos from the bootcamp |
| work-6 | App: three photos attached through the file picker (record-06, -07, -04) | 3 photos added | Three photos in, now the details |
| work-7 | App: Details step | 20 hours, 1200 minutes, 2 facilitators, Impact measurement and Other, the record's description | Add hours, facilitators and topics |
| work-8 | App: Review step | Review Workshop with the hub and the three photos | Check it all, then upload |
| work-9 | App: `/home` as the steward | Ifeoma's bootcamp pending at the top of Recent Activity | Open the new workshop to review it |
| work-10 | Storybook: `client-work-reviewwork--evaluate-example` | Evaluate Work | Approve what the photos show |
| work-11 | Storybook: `client-work-reviewwork--feedback-example` | Add Feedback | Add a note and submit |
| work-12 | App: `/gardens/tas-hub`, approved submissions | The bootcamp's record entry | The bootcamp joins the hub's public record |
| funding-1 | App: `/gardens/tas-hub`, the end of the page | Support This Garden | Back the hub from its own page |
| funding-2 | App: `/fund`, opened from "Support This Garden" | TAS HUB first, with Donate and Endow | Endow the hub for the long run |
| funding-3 | App: Endow, 500 typed | Amount and payment currency, Connect Wallet | Enter an amount and connect |
| funding-4 | Composite: `public-documentation-funding--endow` over funding-3 | Endow $500.00 in DAI, wallet connected | Confirm the endowment in DAI |
| funding-5 | Composite: `public-documentation-funding--endowed` over funding-3 | Endowed $500.00 to TAS HUB | Close and see where it goes |
| funding-6 | App: `/gardens/tas-hub`, Recent approved submissions | The hub's record | Follow the work it supports |

"Who you are" is Obinna for Needs and for promise-10 and promise-11, and for work-9 to work-11;
Chiamaka for needs-7 and the rest of Promise; Ifeoma for work-1 to work-8; "Anyone can open the
hub's page" for work-12; Funmi for Funding.

Desktop screens are 1440 by 900 at 1.5x and phone screens 390 by 844 at 2x, saved as JPEG.

### Where the app stops and what stands in

- **Needs.** "Submit Assessment" asks for a signature, so the saved dialog (needs-6) is the
  Storybook dialog, drawn over the review it replaces. The hub has no assessment on record, so the
  member's view of it (needs-7) is the Storybook Insights sheet with the demo's assessment, drawn
  over the hub's Home.
- **Promise.** Taking a promise up and sending proof both ask for signatures, and the mock account
  is the steward who asked for the course, so Chiamaka's screens (promise-4 to promise-9 and
  promise-12) are Storybook. The steward's screens (promise-10, promise-11) are the hub's real
  waiting promise, opened in the app. The Storybook promise asks for linked garden work; for a
  course promise the app shows the proof line ("Add proof as you go…") and a single Add Proof
  button (`statusBand.ts`, `GardenCommitment.tsx`), and promise-6 shows those.
- **Work.** "Upload Work" asks for a signature. The steward's Home (work-9) is the app as it stands,
  with the steward's own pending entry relabeled as Ifeoma's bootcamp, three photos and "4 min.
  ago"; the review and approval (work-10, work-11) are Storybook.
- **Funding.** The Endow dialog stops at "Connect Wallet". Its connected and endowed states
  (funding-4, funding-5) are the Storybook dialogs drawn over the real Fund page.

## What is real and what is sample

Read from Tech and Sun's record on 26 October 2026 (the garden, its season pool, its promises, its
actions and its public page):

- The hub: TAS HUB in Awka, Nigeria, 14 members, its description, its banner photo and its record
  of 16 approved submissions.
- The season "Climate and Tech Education", 10 October 2026 to 31 January 2027, and its 24 requests
  "Complete the UN CC:Learn climate course": one certificate each, the request's note, due 31
  January 2027. The request also carries a $20 reward, which no screen shows (see the UI review).
- The one promise taken up so far: taken up and proved on 21 October 2026, with the member's note
  "I completed the course, I attached my Proof too." and a photo of their course result (9.5 out of
  10), now waiting for the steward. The photo is cropped to the result, because the original also
  shows the member's name and email.
- The Workshop Delivered and Hub Service Session forms, their labels, the dashboard's assessment
  wizard and its metrics, and every App screen's layout, counts and state.
- The bootcamp: its record entry "A one week content creation bootcamp with AI" and its photos. The
  Work flow replays how that entry reached the record.
- Every photo: the approved Awka group photo as the hub's banner, and the hub's public submission
  photos. `record-15`, a letter that names a person, is never used.
- The Funding flow's public pages, with their counts.

Sample: every person's name (below), the assessment and its targets, the bootcamp's hours and
facilitator count, Chiamaka's take-up as shown in Storybook (its dates are the record's), the
approval note, the endowment of $500 and its confirmation, and the date the promise is confirmed.

## Names

Every person is invented. The mock account (a steward of the hub) is Obinna; the member whose
promise is on the record is Chiamaka; the hub's two other stewards are adaeze.eth and ikenna.eth;
Ifeoma ran the bootcamp; Funmi is the supporter. Any other shortened address on screen becomes one
of eight invented handles (tobenna.eth, kelechi.eth, nneka.eth, ada.eth, uche.eth, ngozi.eth,
chidi.eth, amaka.eth), the same one for the same address. Names are swapped on every screen,
including the public pages; nothing else on those pages changes.

| On the record or in the fixture | In the demo |
|---|---|
| The mock account's handle; the fixture steward `tomas` | obinna |
| The member who took the course up (a shortened address); the fixture member `amara` | chiamaka |
| The two named confirmers and stewards (their ENS names) | adaeze.eth; ikenna.eth |
| The fixture team member `dele` | removed (the promise is kept alone) |
| The fixture wallet `0x5eed...00a1` | funmi.eth |

## Demo copy

Swapped into each screen's text, `alt`, `aria-label`, `title`, placeholders and field values after
it renders, together with the photos named in the flows table. Components, layout and controls stay
as rendered.

| Fixture or record text | Demo copy | Screens |
|---|---|---|
| Riverside Commons Garden | TAS HUB | needs-7, promise-6, promise-12, work-10, work-11, funding-4, funding-5 |
| Riverside District; 3 members | Awka, Nigeria; 14 members | work-10, work-11 |
| Autumn Planting 2026 | Climate and Tech Education | promise-6, promise-12 |
| The steward's own pending Node Operation Log | Energy & Uptime Check (promise-1, work-1); Workshop Delivered by ifeoma, 4 min. ago, 3 photos (work-9) | promise-1, work-1, work-9 |
| The node log's black photo | record-03 (promise-1, work-1); record-06 (work-9) | promise-1, work-1, work-9 |
| Survey household water use on Mill Lane; Repair the north fence panel by the compost bays before the first frost | Complete the UN CC:Learn climate course | promise-4 to promise-9, promise-12 |
| The two fixture notes | Complete the agreed UN CC:Learn course and submit your certificate so the hub can verify your learning. | promise-4, promise-6, promise-12 |
| 4 available · 3 in progress · 3 kept | 24 available · 0 in progress · 0 kept | promise-4 |
| 2 hours; 1 repair; Oct 30, 2026; Oct 20, 2026 | 1 certificate; Jan 31, 2027 | promise-4 to promise-6, promise-12 |
| Link the required work below. Garden stewards approve it; no separate send is needed.; Link Work | Add proof as you go. When it's complete, send it to be confirmed.; Add Proof | promise-6 |
| Proof added: 2 photos, 1 voice note; Optional: you already added 2 photos and 1 voice note. | Proof added: 1 photo; Optional: you already added 1 photo. | promise-7, promise-8 |
| Replaced two split slats and secured the panel. Dele helped with measuring and fastening. | I completed the course, I attached my Proof too. | promise-8, promise-9 |
| The proof photos; the record's proof photo | proof-course.jpg | promise-7, promise-9, promise-10, promise-11 |
| Asked Oct 2, taken up Oct 3, proof Oct 12, sent Oct 12, confirmed Oct 14 | Asked Oct 13, 2:55 PM; taken up Oct 21, 2:53 PM; proof and sent Oct 21, 2:57 PM (the record's times); confirmed Oct 26, 9:05 AM | promise-6, promise-12 |
| No approved work yet · no proof yet | No approved work yet · 1 proof | promise-12 |
| Seedling Transplant; Plants Moved 36; 1h 30m | Workshop Delivered; Facilitators 2; 20h | work-10, work-11 |
| Moved 36 lettuce seedlings into the east bed and watered them after transplanting. | A one week content creation bootcamp with AI | work-10, work-11 |
| The count and note match the evidence checked at the garden. | The photos match the session I saw at the hub. | work-11 |
| The garden card's no-banner pattern; the work photo | awka-hub.jpg; record-06 | work-10, work-11 |
| The fixture assessment: East plot, Rio Rainforest Lab; Agroforestry; Rio canopy baseline, wet season; its description, challenge, outcomes, action and dates | TAS HUB; Awka, Nigeria; Education; the title, description, challenge, outcomes, action and period typed in needs-2 to needs-4 | needs-6 |
| Riverside Commons grows food along the river and shares the harvest with its block.; Native canopy returns along the riverbank; Oct 18, 2025 – Jan 16, 2026; Agroforestry; the banner | The hub's description; Climate and tech skills for members; Oct 10, 2026 – Jan 31, 2027; Education; awka-hub.jpg | needs-7 |
| $50.00 | $500.00 | funding-4, funding-5 |

Typed into the app rather than swapped: the assessment (needs-2 to needs-4), the work's details
(work-7) and the 500 in the Endow amount (funding-3).

Removed from screens, because the hub's record does not have them: the Solar actions' first card,
Node Operation Log, which the pitch leaves out (work-2); the promise that was already waiting, from
the list as it stood before Chiamaka took hers up (promise-3); the fixture's second photo, voice
note, link and second team member (promise-6 to promise-9, promise-12); the fixture's Link Work
button, since a course promise shows Add Proof alone (promise-6); and the fixture's second, older
assessment (needs-7).

## Claims

- Captions, "who you are" lines and the page's own words say nothing about chains, "live" or
  vouchers, and use "promise", never "commitment".
- App text inside the screens still says "Live" (the Promises tabs and the season sheet), "sign
  twice" (promise-9), and WETH, DAI and "Connect Wallet" (funding-3, funding-4); none of them names
  a chain.
- Vouchers appear nowhere, so no "in pilot" label was needed.
- The landing says "Real app screens and hub photos; names are changed."

## Task record · clickable demo

Task record: SF.Live clickable demo | Type: feature | Outcome: complete; delivery links above
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `26f5fee4c`

| Phase | Start → end (UTC, 26 October 2026, to the minute from command output) | Result / evidence |
|---|---|---|
| investigate | 03:01 → 03:47 | Storybook index listed; candidate stories and the live TAS Hub, Fund and Endow pages captured and compared |
| implement | 03:47 → 04:05 | Capture, page, build and check scripts; 22 screens captured, three re-captured after fixes |
| verify | 03:58 → 04:10 | `check.mjs` exit 0; every step screenshot and the phone and dark views inspected |
| publish | 04:10 → 04:17 | Artifact published; commit `7efe3d790` pushed; Drive copy synced |

Human corrections: 0 observed in this segment; attention unknown.

## Task record · grounding in Tech and Sun's season

Task record: SF.Live clickable demo, Tech and Sun revision | Type: feature | Outcome: superseded by the full-flow rebuild below
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `7efe3d790`

| Phase | Start → end (UTC, 26 October 2026, approximate) | Result / evidence |
|---|---|---|
| investigate | 04:20 → 05:05 | Review of every screen against the hub's record; four questions answered by Afo; season, request, action forms and photos read from the public record |
| implement | 05:05 → 05:50 | Story rewrite across four flows; photo, banner and form swaps; Work flow shown to Afo and approved, then the rest |
| verify | 05:40 → 06:00 | `check.mjs` exit 0; every step screenshot inspected |

Human corrections: 1 observed in this segment (the demo should follow one Tech and Sun story with real uploads, invented names and real public photos); attention unknown.

## Task record · full flows on the current app

Task record: SF.Live clickable demo, full-flow rebuild | Type: feature | Outcome: complete; delivery links above
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `c0fc53dc5`

| Phase | Start → end (UTC, 26 October 2026, approximate) | Result / evidence |
|---|---|---|
| investigate | 06:40 → 07:20 | A develop worktree served locally on the hub's chain and indexer; Home, the garden picker, the submission flow, the season, the Promises sheet, the waiting promise and the dashboard's assessment wizard walked headless; Storybook stories for each signature boundary chosen |
| implement | 07:20 → 08:08 | Session-based `capture.mjs` (clicks, typing, date picks, file uploads, name guard, dialog compositing); the page's "All flows" bar, "who you are" line, screen count and next-flow ending; 37 screens across four flows, each re-captured until its screen matched the record |
| verify | 08:08 → 08:13 | `check.mjs` exit 0; every step screenshot, the phone and dark views and the contact sheet inspected |
| publish | 08:13 → 08:20 | Commits `d6f949ced` and `198243995` pushed (gate passed); the live artifact's newer focus fix merged first; Drive copy and artifact replaced |
| harden | 08:20 → 08:29 | The PR branch's review fixes ported (staged captures, title-bound photos, decode and content checks, atomic photo refresh, keyboard walk, its `build.mjs`); one full staged capture with 0 problems; `check.mjs` exit 0, and exit 1 with the focus handling removed |

Human corrections: 1 observed in this segment (the demo should start each flow at its beginning, use the current app, show every step and always offer a way back); attention unknown.
