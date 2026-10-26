# Clickable demo · SustainableFinance.Live 2026

The demonstrator for the submission: one page a judge clicks through in under three minutes. It
follows one season at Tech and Sun's hub in Awka through the loop on slide 5 of the deck, as four
short flows that lead into each other:

1. **Needs.** The steward records what members need: climate and tech skills that lead to paid work.
2. **Promise.** The season's real request, "Complete the UN CC:Learn climate course", is taken up by
   a member, who adds her certificate as proof; the hub confirms it and the promise is kept.
3. **Work.** The hub's facilitator logs the one-week bootcamp where members did the course, with the
   hub's own photos; the steward approves it.
4. **Funding.** A supporter finds the hub's record, endows it, and the record shows what the money
   follows.

Every screen is the real app: components from the deployed Storybook at design.greengoods.app with
Tech and Sun's content swapped in, and, in the Funding flow, the public pages at greengoods.app as
they stand. Each screen has one caption and one hotspot on the control to tap; a tap anywhere else
does not advance.

- Drive: `Shared drives/Greenpill Dev Guild/Product/Green Goods/Growth/Green Goods SF.Live 2026 clickable demo.html`
- Private artifact: <https://claude.ai/artifact/9ThhqDPZTEggFZuKnvS2wa>
- UI review of every screen: [`ui-review-2026-10-26.md`](ui-review-2026-10-26.md)

## What is here

| Path | What it is |
|---|---|
| [`index.html`](index.html) | The page: landing, flow view and the `#flows` block with every caption, source and hotspot. It shows the screens from `assets/screens/` when they are present |
| [`photos.mjs`](photos.mjs) | Saves the hub's public submission photos as `assets/photos/record-NN.jpg` |
| [`capture.mjs`](capture.mjs) | Captures the 22 screens, swaps in the hub's content and writes each screen's source, size and measured hotspot into `#flows` |
| [`build.mjs`](build.mjs) | Inlines the screens and the corner symbol into `output/green-goods-sf-live-demo.html` (the Drive copy) and `output/artifact.html` (the same page without its document wrapper) |
| [`check.mjs`](check.mjs) | Checks the build and walks every flow headless; screenshots each step and a contact sheet into `output/` |
| `assets/screens/`, `assets/photos/`, `output/` | Local files, not committed: the photos, the screens and the built page show identifiable people |

## Capture, build and check

From the repository root of an installed checkout (Playwright and network access; no new
dependency). Place the approved Awka photo and save the record's photos first; a missing photo
fails the capture:

```bash
cp /Users/afo/Code/greenpill/artifacts/octant-e12-deck/assets/photos/awka-hub.jpg .plans/backlog/cosmo-local-credit-interop/artifacts/demo/assets/photos/
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/photos.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/build.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/check.mjs
```

`capture.mjs --only=work-3,promise-1` re-captures single screens. Capture fails when a swap rule
matches nothing, a fixture name survives, a listed photo is missing or a hotspot target is missing
or off screen. Check fails on an em dash in the demo's HTML or Markdown, a caption over eight words
or using "commitment", "chain", "blockchain", "Arbitrum", "Celo", "Gnosis" or "live", a tile line that
is not five words, a missing or extra hotspot, a stale build, a file over 15 MB, an image that does
not load, a caption that does not change, a tap beside the hotspot that advances, broken keys
(Right, Left, Escape), Back, Restart or deep links (`#work-3`), any request beyond Google Fonts,
console errors, sideways scroll at 390 wide, or a light background in dark mode.

To change a caption or a tile line, edit `#flows` in `index.html`, then build and check. To present,
open the built file; `#promise` opens a flow and `#promise-3` its third screen.

## The flows

| Screen | Source | Caption |
|---|---|---|
| needs-1 | `admin-workspaces-hub--assessments-tab` | Start the season's assessment |
| needs-2 | `admin-workspaces-hub--create-assessment-route`, Education chosen and the fields typed in | Name the need: climate and tech skills |
| needs-3 | `admin-workflows-assessment-reviewstep--in-flow-ready` | Check the targets, then submit |
| needs-4 | `admin-workflows-assessment-reviewstep--in-flow-sent` | Close the finished assessment |
| needs-5 | `client-garden-assessments--education` | Members see what the hub needs |
| promise-1 | `client-commitments-gardenpool--live`, hub banner, list scrolled to the request | Open the climate course request |
| promise-2 | `client-commitments-promisegrouppage--open` | Read what it asks, then take one |
| promise-3 | `client-commitments-takeuponesheet--ready` | Promise to finish the course |
| promise-4 | `client-commitments-proofcomposer--details` | Add your certificate as proof |
| promise-5 | `client-commitments-confirmsheet--ask-garden-work` | As the hub, confirm the certificate |
| promise-6 | `client-commitments-gardencommitment--kept` | The promise is kept and recorded |
| work-1 | `client-work-submitwork--media-with-example-photo`, bootcamp photo | Add a photo of the bootcamp |
| work-2 | `client-work-submitwork--review-with-example-photo` | Check the details, then upload |
| work-3 | `client-garden-gardenwork--all-work`, six record photos | As steward, open the new workshop |
| work-4 | `client-work-reviewwork--evaluate-example` | Approve what the photos show |
| work-5 | `client-work-reviewwork--feedback-example` | Add a note and submit |
| work-6 | `client-work-workdashboard--completed-with-example-photo` | The facilitator sees it approved |
| funding-1 | `https://greengoods.app/gardens/tas-hub`, top | Open Fund to back the next cohort |
| funding-2 | `https://greengoods.app/fund`, scrolled to TAS HUB | Choose an endowment for TAS Hub |
| funding-3 | the same page's Endow dialog for TAS HUB, 500 typed, no wallet connected | Enter an amount and continue |
| funding-4 | `client-public-vault-vaultmanagepositionspanel--positions` | Check your endowment any time |
| funding-5 | `https://greengoods.app/gardens/tas-hub`, the bootcamp's row of approved submissions | Follow the work it supports |

Desktop screens are 1440 by 900 at 1.5x and phone screens 390 by 844 at 2x, saved as JPEG; the
built page is about 3.6 MB.

### Where the brief's screens did not render a usable state

- **Needs.** `admin-workflows-assessment-domaincontextstep--prefilled`, `-outcomefields--editable`
  and `-reviewstep--ready` / `--sent` render only a step's fields on an empty canvas, with no
  wizard or dashboard. The flow uses the Hub's Assessments tab, the Hub's own Create Assessment
  route (a domain chosen and three fields typed in, as a steward would), and the review step's "in
  flow" variants, which draw the wizard. The wizard's middle two steps are not shown.
- **Promise.** Every `client-commitments-gardencommitment--*` variant shows a promise already taken
  up, so the request before acceptance is `client-commitments-promisegrouppage--open`.
- **Work.** The dashboard's `admin-workspaces-hub--work-queue` and `--work-detail` render "All caught
  up" and "Work not found" in the deployed Storybook (the queue story notes that it needs live
  indexer data). Opening the seeded work through the approved scope works, but the viewing steward
  submitted it, so the dialog says "Independent review required" instead of offering Approve, and
  `admin-workflows-hub-reviewform--actionable` is a bare form. The steward therefore reviews in the
  installed app (`client-work-reviewwork--*`). SubmitWork has no details-step story, so the flow
  shows media and review.
- **Funding.** `client-public-vault-staged-card-endow-flow--staged` and `-staged-card-payment-panel--staged`
  render "Card checkout is not available here yet" and "We couldn't open card checkout". The fund
  step is the live Endow dialog instead, opened from the live Fund page with no wallet connected and
  nothing sent. The voucher stories are not used.
- **Name.** The fourth flow is called Funding, as on slide 5; the first brief called it Support.

## What is real and what is sample

Read from Tech and Sun's public record on 26 October 2026 (the garden page, its season and its
action definitions):

- The hub: TAS Hub in Awka, Nigeria, on the record since 27 February 2026, 14 members.
- The season "Climate and Tech Education", 10 October 2026 to 31 January 2027, and its request
  "Complete the UN CC:Learn climate course": one certificate each, the note shown on promise-2, due
  31 January 2027, 23 available and 1 in progress. The request also carries a $20 reward, which no
  screen shows (see the UI review).
- The Workshop Delivered form's labels ("Capture Workshop Photo", its instruction, "Facilitators"),
  and the action names in the Work list.
- Every photo: the approved Awka group photo as the hub's banner, and the hub's public submission
  photos (the bootcamp, hub sessions, the container build). `record-15`, a letter that names a
  person, is never used.
- The Funding flow's public pages, with their live counts.

Sample: every person's name (Obinna the steward, Chiamaka the learner, Uche, Ifeoma the
facilitator, Tobenna, and Funmi the supporter), the assessment and its targets, the bootcamp's notes
and figures, the other tasks on the Promises tab, the season's campaign and earlier season cards,
the endowment amount, and every date and count not named above.

## Demo copy

Swapped into each Storybook screen's text, `alt`, `aria-label`, `title`, placeholders and field values
after it renders, together with the photos named above; components, layout, controls and state
stay as rendered. The Funding flow's live pages are unchanged apart from the 500 typed into the
Endow amount.

| Fixture text | Demo copy | Screens |
|---|---|---|
| Riverside Commons Garden; Rio Rainforest Lab; Botanic Commons | TAS Hub | every Storybook screen that names the garden |
| Riverside District; 3 members | Awka, Nigeria; 14 members | promise-1, work-2, work-4, work-5 |
| Founded Mar 14, 2024 | Founded Feb 27, 2026 | promise-1 |
| Autumn Planting 2026 (and its dates and count) | Climate and Tech Education, Oct 10 – Jan 31, 0 of 1 kept | promise-1, promise-6 |
| Seed Swap Weekend; Summer 2026 (and their dates and counts) | Bootcamp week; Hub opening | promise-1 (scrolled out of view) |
| tomas; amara; dele | obinna; chiamaka; uche | promise-4, promise-6 |
| 0x5e...0b2; 0x22...222; 0x5eed...00b2; 0x5eed...00a1; vault-owner.eth | obinna.eth; chiamaka.eth; ifeoma.eth; tobenna.eth; funmi.eth | promise-1, promise-5, work-3, funding-4 |
| riverside-commons.example; receipts/fence-posts | tas-hub.example; certificates/chiamaka | promise-4 |
| The fixture banner photo; the no-banner pattern on the garden card | `awka-hub.jpg` | promise-1; work-2, work-4, work-5 |
| Rainforest canopy strategy; Jan 3, 2026; Agroforestry | Solar and internet baseline; Mar 14, 2026; Solar | needs-1 |
| Typed into the empty form | Education; Climate and tech skills for members; Awka, Nigeria; Members have steady power and internet at the hub. Few have climate or digital training, and most want paid work. | needs-2 |
| East plot, Rio Rainforest Lab (dialog header; location row) | TAS Hub; Awka, Nigeria | needs-3, needs-4 |
| Agroforestry; Rio canopy baseline, wet season; the description | Education; Climate and tech skills for members; the description typed in needs-2 | needs-3, needs-4 |
| Cattle grazing thinned the canopy along the east boundary, and the seedlings planted last season have no shade. | Members want paid work, but few have the climate or digital skills that clients ask for. | needs-3, needs-4 |
| The east plot regains its canopy; Trees planted · 200 trees | Members earn the UN CC:Learn climate certificate; Participants · 24 people | needs-3, needs-4 |
| Seedlings survive their first dry season; Area covered · 5 ha | Members make paid-quality content with AI; Sessions delivered · 5 sessions | needs-3, needs-4 |
| Canopy baseline; Jul 1 – Sep 30, 2026 | Workshop Delivered; Oct 10, 2026 – Jan 31, 2027 | needs-3, needs-4 |
| Gardeners learn to restore and care for their soil; Oct 18, 2025 – Jan 16, 2026 | Climate and tech skills for members; Oct 10, 2026 – Jan 31, 2027 | needs-5 |
| The Promises tab's tasks | Fix the hub's router before Friday's class; Complete the UN CC:Learn climate course (in progress, and the open request); Host the weekly climate discussion; Lend my spare laptop to a new builder; Set up the solar classroom lights; Teach a prompt-writing session for new members | promise-1 |
| Survey household water use on Mill Lane; Repair the north fence panel by the compost bays before the first frost | Complete the UN CC:Learn climate course | promise-2 to promise-6 |
| The two fixture notes | Complete the agreed UN CC:Learn course and submit your certificate so the hub can verify your learning. | promise-2, promise-6 |
| 2 hours; 1 repair; Oct 30, 2026; Oct 20, 2026; 4 available · 3 in progress · 3 kept | 1 certificate; Jan 31, 2027; 23 available · 1 in progress · 0 kept | promise-2, promise-3, promise-6 |
| Replaced two split slats and secured the panel. Dele helped with measuring and fastening.; Repair notes | Finished the course during the hub's bootcamp week. My certificate is attached.; Course notes | promise-4, promise-6 |
| Upload Media; Take a clear photo of the moved seedlings, or choose one from your photos. | Capture Workshop Photo; Take a photo of the room, materials, or session in progress. | work-1 |
| Seedling Transplant; Plants moved 36; 1h 30m | Workshop Delivered; Facilitators 2; 5h | work-2, work-4, work-5, work-6 |
| Moved 36 lettuce seedlings into the east bed and watered them after transplanting. | One-week bootcamp at the hub. Members worked through the UN CC:Learn climate course and made short videos about it with AI tools. | work-2, work-4, work-5 |
| The count and note match the evidence checked at the garden. | The photos and attendance match the session I saw at the hub. | work-5 |
| Compost Turn; Seed Library Count; Path Edging; Mulch Delivery Log; Herb Spiral Weeding | Workshop Delivered (first row), Hub Service Session; Hub Service Session; Infrastructure Milestone; Energy & Uptime Check; Site & Readiness Setup | work-3, work-6 |
| Work photos, in list order | record-06, -01, -04, -09, -03, -14 (work-3); record-06, -04, -03 (work-6); record-06 (work-1, -2, -4, -5) | work-1 to work-6 |
| Greenpill NYC; 1.2 WETH | TAS Hub; 500 DAI | funding-4 |

## Claims

- Captions and the page's own words say nothing about chains, "live" or vouchers, and use
  "promise", never "commitment".
- App text inside the screens still says "on-chain" and "Your wallet will ask you once" (needs-3),
  and the live Fund page and Endow dialog show the hub's endowment in ETH and DAI and offer "WETH,
  Wrapped Ether" (funding-2, funding-3); none of them names a chain.
- Vouchers appear nowhere, so no "in pilot" label was needed.
- The landing says "Real app screens, real hub photos, sample data."

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

Task record: SF.Live clickable demo, Tech and Sun revision | Type: feature | Outcome: complete; delivery links above
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `7efe3d790`

| Phase | Start → end (UTC, 26 October 2026, approximate) | Result / evidence |
|---|---|---|
| investigate | 04:20 → 05:05 | Review of every screen against the hub's record; four questions answered by Afo; season, request, action forms and photos read from the public record |
| implement | 05:05 → 05:50 | Story rewrite across four flows; photo, banner and form swaps; Work flow shown to Afo and approved, then the rest |
| verify | 05:40 → 06:00 | `check.mjs` exit 0; every step screenshot inspected |

Human corrections: 1 observed in this segment (the demo should follow one Tech and Sun story with real uploads, invented names and real public photos); attention unknown.
