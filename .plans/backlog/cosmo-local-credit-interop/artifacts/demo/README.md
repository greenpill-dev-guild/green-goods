# Clickable demo · SustainableFinance.Live 2026

The demonstrator for the submission: one page a judge clicks through. It opens on a story of one
promise at Tech and Sun's hub in Awka, Nigeria, in twelve screens and about two minutes, and keeps
the whole season behind "See every step". Obinna is the hub's steward, Ifeoma a member, and Funmi a
supporter; a Green Goods steward, unnamed, accepts Ifeoma's booking.

## The story

Four chapters. The first two ground Green Goods: a hub's need, and a promise kept and approved. The
third is what was built for SF.Live, and every screen in it is marked "In pilot": the kept promise
pays Tech and Sun vouchers and G$, Ifeoma swaps the vouchers in the shared pool for Green Goods
vouchers, and books an AI tool seat with them, which Green Goods accepts in its own pool. The fourth
shows the public record and a donation.

| # | Chapter | Screen | Caption | Who you are |
|---|---|---|---|---|
| 1 | The hub | promise-1 | Take Part lists what the hub needs | Ifeoma |
| 2 | The hub | promise-2 | This season asks for an AI bootcamp | Ifeoma |
| 3 | A promise kept | promise-5 | Taken up: 2 vouchers and $20 in G$ | Ifeoma |
| 4 | A promise kept | work-3 | After the bootcamp, she logs the work | Ifeoma |
| 5 | A promise kept | approval-3 | The hub's steward checks it and approves | Obinna |
| 6 | Built for SF.Live | vouchers-1 | Kept: her vouchers and G$ arrive | Ifeoma |
| 7 | Built for SF.Live | swap-1 | An AI tool seat takes Green Goods vouchers | Ifeoma |
| 8 | Built for SF.Live | swap-2 | She swaps 8 of her 9 earned vouchers | Ifeoma |
| 9 | Built for SF.Live | swap-6 | Swapped, she books the seat | Ifeoma |
| 10 | Built for SF.Live | swap-7 | Green Goods accepts once four checks pass | A Green Goods steward |
| 11 | For supporters | impact-2 | Anyone can find the bootcamp on the record | Funmi |
| 12 | For supporters | funding-5 | Funmi backs the hub with a donation | Funmi |

Each story screen is an appendix screen with its own caption. Its image, hotspot and back regions
come from the appendix, except two whose hotspot leads somewhere the story skips: vouchers-1's opens
her wallet, and impact-2's opens the record, where the story goes on to the donation.

The captions carry what a judge needs to follow the numbers: the reward is $20 in G$ (155,460 G$ on
screen), and the 8 vouchers she swaps come from the 9 she holds, more than this one promise paid.

## Every step

Nine chapters, 50 screens, one season:

1. **Needs** (7 screens, dashboard). Obinna signs in, looks over the hub's earlier assessment and
   writes this season's: the need, two targets (24 members certified, 5 bootcamp sessions), the work
   that counts toward them and the period.
2. **Season** (7, dashboard). He starts the season "Climate and Tech Education" in the hub's
   Promises tab, then seeds the promise members can take up: "Run a one-week AI content bootcamp",
   garden work kept by one approved Workshop Delivered, 20 hours, $20.
3. **Promise** (5, app). Ifeoma finds the bootcamp in Take Part on the hub's Home and takes it up;
   her promise shows the rewards the hub agreed, 2 Tech and Sun vouchers and G$ (in pilot).
4. **Work** (3, app). After the bootcamp she logs it for her promise: Start ("Which promise is this
   work for?"), the bootcamp's photo, review.
5. **Approval** (4, dashboard). Obinna opens it from the Hub's Work queue and approves it. In the
   app's words, "A promise kept through garden work is confirmed when that work is approved."
6. **Vouchers** (8, app and dashboard; every screen in pilot). The kept promise pays her 2 Tech and
   Sun vouchers and G$, each on its own row. She spends a voucher on a hub day, and Obinna accepts
   the booking once its four checks pass.
7. **Swap** (8, app and dashboard; every screen in pilot). Instead of a hub day, she swaps 8.01
   Tech and Sun vouchers for 8 Green Goods vouchers in the shared pool and books an AI tool seat
   from Green Goods. A Green Goods steward accepts it in Green Goods' own pool once its four checks
   pass, and the chapter ends on her booking with every step done.
8. **Impact** (3, website). Funmi finds Green Goods on the web, opens its evidence ledger filtered
   to Education, and opens the bootcamp's public record.
9. **Funding** (5, website). She backs the hub from its own page with a $500 donation to its shared
   fund.

The Vouchers and Swap chapters are two ways to spend the same reward, so their voucher counts do
not add up across them.

## The page

- **Intro.** What Green Goods is and what was built for SF.Live, "12 screens, about 2 minutes",
  Start the demo and See every step, the swap's quote on a phone, and the story's four chapters
  (each opens the story there).
- **One screen at a time on a fixed stage.** The bar (the way back, a strip with one bar per screen
  grouped by chapter, the theme switch), the device, the who-you-are row, a two-line caption
  and the controls (Back, "5 of 12", Next) each keep one place and one height, so nothing moves from
  screen to screen. Phone and desktop screens share the stage: a phone screen stands in the middle
  at the same height as a desktop one.
- **Moving on.** Next, the Right arrow, or the pulsing hotspot on the control a person would tap,
  which does what Next does. A tap elsewhere on the screen only points at the hotspot again. Back,
  the Left arrow, the browser's back and the app's own back arrows, close buttons and Cancel go
  back a screen; Escape and the top-left button go up to the intro or the chapter list.
- **Endings.** The story's Finish opens a close: a recap, a pointer back to the deck, See every
  step, Start over, a link to TAS HUB's live page on greengoods.app, and the story's four chapters
  as cards, each with one of its screens, that open the story there. Every step ends back at its
  chapter list, whose tiles name each chapter's surfaces from its screens (Vouchers and Swap end
  in the dashboard).
- **Links.** Plain anchors, the only kind an artifact link carries: `#story-5` opens the story's
  fifth screen, `#work-3` an appendix screen, `#end` the close and `#steps` the chapter list. v4's
  `#/work/3` links still open.
- **Theme.** The page follows the viewer's light or dark setting, with a switch; the screens stay as
  captured, and in dark the devices keep a lighter edge so they stand off the page.

- Drive: `Shared drives/Greenpill Dev Guild/Product/Green Goods/Growth/SF Live 2026/Green Goods SF Live 2026 Demo.html`
- Artifact (shared by link): <https://claude.ai/artifact/9ThhqDPZTEggFZuKnvS2wa>
- UI review of every screen: [`ui-review-2026-10-27.md`](ui-review-2026-10-27.md)

## Where the screens come from

**50 screens**: 17 App, 19 Storybook and 14 Composite.

- **App**: the develop app, dashboard and public site, run locally against the hub's record (the
  hosted indexer and the hub's pinned photos), signed in with the dev-only mock account, which is
  one of the hub's stewards. `capture.mjs` clicks, types and chooses as a person would. Nothing is
  uploaded, signed or sent: a chapter stops on the button that would ask for a signature.
- **Storybook**: Storybook built from develop, for the states the app reaches only after a
  signature, the states the hub's record does not have, and every voucher screen. Fixture copy is
  swapped for the hub's (Demo copy, below). The voucher journeys are walked by their own buttons,
  which stand in for the other people's acts; nothing in a story signs or sends.
- **Composite**: a Storybook panel, sheet or dialog drawn into the real page it belongs to, in the
  real one's place (`over` in `capture.mjs`), so the page around it stays the hub's.

Phone screens are 390x844 and desktop screens 1440x900, except Green Goods' Accept (swap-7), which
is 1152x720 in the same 16:10 frame so the dialog a judge reads in the story shows about a quarter
larger. The steward's review (approval-3) stays at 1440x900: its form needs more height than a
720-high screen gives the dialog, where the real one would scroll Approve out of view. A phone story
takes Storybook's 16px frame out, so its page fills the screen as the app's does, except the
wallet's Vouchers tab (vouchers-2, vouchers-8), a panel shown alone, which keeps it as a card.

## What is here

| Path | What it is |
|---|---|
| [`index.html`](index.html) | The page: intro, player, close and chapter list, and the `#flows` block: the story (its chapters, lines, captions and who you are) and every step (each screen's caption, step, who you are, source, hotspot, back regions and alt text). It shows the screens from `assets/screens/` when they are present |
| [`photos.mjs`](photos.mjs) | Saves the hub's public submission photos as `assets/photos/record-NN.jpg`. It replaces the set whole: one failed download, or a body that is not an image, leaves the old set untouched and exits 1 |
| [`capture.mjs`](capture.mjs) | Walks each chapter's sessions in the app and Storybook, captures the 50 screens, swaps in names and the hub's content, and writes each screen's source, size, hotspot and back regions into `#flows` |
| [`build.mjs`](build.mjs) | Inlines the screens and the corner symbol into `output/green-goods-sf-live-demo.html` (the Drive copy) and `output/artifact.html` (the same page without its document wrapper). A missing screen or a page over 15 MB fails the build before it writes |
| [`check.mjs`](check.mjs) | Checks the build, walks the story and every step headless, and holds the player's parts to one place on every screen; screenshots each screen and a contact sheet into `output/` |
| `assets/screens/`, `assets/photos/`, `output/` | Local files, not committed: the photos, the screens and the built page show identifiable people |

## Capture, build and check

Capture needs the develop app on port 3122 and the dashboard on 3102, both from a develop checkout
with dependencies installed, on the hub's chain and the hosted indexer, and a Storybook built from
the same checkout. The checkout needs its own install: one whose package `node_modules` link into
another checkout loads React Query twice, and every page or story with a wallet hook then fails with
"No QueryClient set". The dashboard's first load on a cold dev server takes a few minutes. The
deployed Storybook (design.greengoods.app) cannot render a story since develop stopped falling back
to a default indexer; until its build sets the indexer, build it locally and serve the folder (any
static server that copes with a few hundred parallel requests):

```bash
cd packages/client && SKIP_MKCERT=true APP_ENV=development VITE_CHAIN_ID=42161 VITE_ENVIO_INDEXER_URL=https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql node ../../scripts/dev/node-cli.js vite --port 3122 --strictPort
```

```bash
cd packages/admin && APP_ENV=development VITE_CHAIN_ID=42161 VITE_ENVIO_INDEXER_URL=https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql node ../../scripts/dev/node-cli.js vite --port 3102 --strictPort
```

```bash
cd packages/shared && VITE_ENVIO_INDEXER_URL=https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql bun run build-storybook
```

Then, from the repository root, place the approved Awka photo, save the record's photos, and
capture, build and check:

```bash
cp /Users/afo/Code/greenpill/artifacts/octant-e12-deck/assets/photos/awka-hub.jpg .plans/backlog/cosmo-local-credit-interop/artifacts/demo/assets/photos/
```

```bash
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/photos.mjs
```

```bash
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/capture.mjs --storybook=http://127.0.0.1:4621
```

```bash
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/build.mjs
```

```bash
node .plans/backlog/cosmo-local-credit-interop/artifacts/demo/check.mjs
```

`capture.mjs --only=swap,promise-5` re-runs single sessions (session ids are in `SESSIONS`); an
unknown id stops the run before anything is captured, and swap rules shared with sessions outside
`--only` are reported as not validated rather than passed. `--debug` prints each screen's text,
`--html=<file>` writes another page's `#flows` block, and `--accept` keeps a run's screens despite
its problems while iterating; a capture for the page runs without it. A composite needs the App
screen under it captured first. Screens are staged and replace the current set only when the run
has no problem. A capture fails when a step fails; when any swap rule, shared ones included,
matches nothing on a full capture; when a fixture name survives on screen, or a name ending in
`.eth` that is not one of the demo's appears; when a listed photo is missing or does not decode;
when a record photo's title in `record-photos.tsv` no longer matches the submission `RECORDS`
binds it to; when Storybook shows its not-found view; when a screen without a hotspot shows
neither its `expect` copy nor any of its own swaps; or when a hotspot or back target is missing or
off screen.

`check.mjs` lists what it checks at its top: the copy rules, the story's length, a hotspot on every
appendix screen but a chapter's last, the intro, the story and every chapter walked by hotspot or
Next, the player's parts held in place on every screen at four sizes, in-screen and browser back,
keys, focus, links, the theme switch, requests, console errors, and the phone width and dark mode.

To change a caption, a "who you are" line or a chapter's line in the story, edit `story` in the
`#flows` block of `index.html`; for every step, edit `flows`. Then build and check.

## The flows

| Screen | Source | What the screen shows | Caption |
|---|---|---|---|
| needs-1 | App: `dashboard /` | The dashboard's sign-in: Connect Wallet or Sign in with Passkey | Sign in to the hub's dashboard |
| needs-2 | Storybook: `admin-workspaces-hub--assessments-tab` | The Hub's Assessments tab with one earlier assessment (demo data) | The hub's earlier assessment, then a new one |
| needs-3 | App: `dashboard /hub/assess` | Create Assessment, step 1: Education; title, location and description typed | Name the need: climate and tech skills |
| needs-4 | App: `dashboard /hub/assess` | Step 2: the challenge typed; 24 participants and 5 sessions as targets; Complicated | Set the targets the season should reach |
| needs-5 | App: `dashboard /hub/assess` | Step 3: Workshop Delivered as the work that counts; 10 Oct 2026 to 31 Jan 2027 | Choose the work that counts toward them |
| needs-6 | App: `dashboard /hub/assess` | Step 4: the review, before Submit Assessment | Check everything, then submit |
| needs-7 | Composite: `admin-workflows-assessment-reviewstep--in-flow-sent` over needs-6 | The assessment saved | The need is on the record |
| season-1 | Composite: `admin-pool-poolcyclescard--no-season` over the real `dashboard /garden/pool` | The hub's Promises tab before the season: No season running, Start Season | Start the season in Promises |
| season-2 | Composite: `admin-pool-poolsetupflow--new-season` over season-1 | Start a Season: the name and dates typed | Name the season and its dates |
| season-3 | App: `dashboard /garden/pool` | The Promises tab with the season open and its course requests | The season is open; add a promise |
| season-4 | App: `dashboard /garden/pool` | Seed Promises, What: the season, Garden work, The pool requests, title and note typed | Ask for a one-week AI bootcamp |
| season-5 | App: `dashboard /garden/pool` | How Much: one promise, 20 hours, due in 30 days, lead-managed, Workshop Delivered × 1 | Twenty hours of Workshop Delivered |
| season-6 | App: `dashboard /garden/pool` | Proof & Confirmation: the hub's stewards, open to anyone in the garden | Who confirms it and who can take it |
| season-7 | App: `dashboard /garden/pool` | Review: the promise as it will be created, $20 reward, before Create Promise | Check it, then create the promise |
| promise-1 | Composite: `client-home-takepart--default` over the real `/home` | The hub's Home with Take Part listing the bootcamp | Open Take Part on the hub's Home |
| promise-2 | Composite: `client-home-takepartsheet--at-the-season` over promise-1 | Take Part at the season: the course and the bootcamp | Find the bootcamp in the season |
| promise-3 | Storybook: `client-commitments-promisegrouppage--open` | The bootcamp's page: what it asks, 20 hours, due 25 Nov | Read what it asks, then take it |
| promise-4 | Composite: `client-commitments-takeuponesheet--ready` over promise-3 | The take-up sheet | Promise to run the bootcamp |
| promise-5 | Storybook: `client-commitments-voucher-journeys--earn-vouchers` | Her promise in progress, with its rewards: 2 Tech and Sun vouchers and G$ after the work | Hers now: vouchers and G$ once it's kept |
| work-1 | Storybook: `client-work-submitwork--start-on-promises` | Submit Work, Start: Keep a Promise, the bootcamp | Pick the promise this work keeps |
| work-2 | Storybook: `client-work-submitwork--media-for-a-promise` | Media for the promise: the bootcamp's photo | Add a photo from the bootcamp |
| work-3 | Storybook: `client-work-submitwork--review-for-a-promise` | Review for the promise: the garden as facts, the photo and the details | Check the details, then upload |
| approval-1 | App: `dashboard /hub/work` | The Hub's Work queue: the bootcamp pending | The bootcamp waits in the Hub |
| approval-2 | Composite: `admin-workflows-hub-reviewform--actionable` over the real `dashboard /hub/work` | The work's dialog: the bootcamp's photo, the details, the review form | Check the photo and details |
| approval-3 | Composite: `admin-workflows-hub-reviewform--actionable` over the real `dashboard /hub/work` | High confidence and a note, before Approve | Approve it with a note |
| approval-4 | Composite: `admin-workflows-hub-reviewform--already-reviewed` over the real `dashboard /hub/work` | Approved | Approved: her promise is kept |
| vouchers-1 | Storybook: `client-commitments-voucher-journeys--earn-vouchers` | Her promise kept: 2 Tech and Sun vouchers and the G$ received, each on its own row | Her rewards arrive, each on its own |
| vouchers-2 | Storybook: `client-wallet-voucherstab--voucher-open` | The wallet's Vouchers tab: Tech and Sun vouchers, 9 available, Book a Service | Her vouchers wait in her wallet |
| vouchers-3 | Storybook: `client-commitments-voucher-journeys--redeem-hub-day` | A hub day: what she gets, gives (1 voucher) and who holds it | A hub day takes one voucher |
| vouchers-4 | Storybook: `client-commitments-voucher-journeys--redeem-hub-day` | Review and Redeem: the exact terms, before Agree to These Terms | Agree to the exact terms |
| vouchers-5 | Storybook: `client-commitments-voucher-journeys--hub-day-agree-and-deposit` | Her voucher in escrow; Green Goods confirms the deposit | Her voucher waits in escrow |
| vouchers-6 | Composite: `admin-pool-poolclaimscard--voucher-accept` over the real `dashboard /garden/pool` | The steward's Review Promises: her booking, Accept | The booking waits for the steward |
| vouchers-7 | Composite: `admin-pool-poolclaimscard--voucher-accept` over vouchers-6 | Accept: the four checks the contract enforces | Accept once the four checks pass |
| vouchers-8 | Storybook: `client-wallet-voucherstab--booked` | The wallet: the hub day booked, 1 voucher in a booking | Booked: her hub day is set |
| swap-1 | Storybook: `client-commitments-voucher-journeys--exchange-then-redeem` | Green Goods' AI tool seat, 30 days: she holds 2 Green Goods vouchers and it takes 10; Exchange Vouchers | The seat takes 10 Green Goods vouchers |
| swap-2 | Storybook: `client-commitments-voucher-journeys--exchange-then-redeem` | Exchange Vouchers in the shared pool: 8.01 Tech and Sun vouchers for 8 Green Goods vouchers, fees included | The shared pool quotes the swap |
| swap-3 | Storybook: `client-commitments-voucher-journeys--exchange-then-redeem` | Review the Exchange: what she spends, at least what she receives, and the fees | Check the swap, then approve it |
| swap-4 | Storybook: `client-commitments-voucher-journeys--exchange-then-redeem` | Exchanged: the receipt for 8.01 Tech and Sun vouchers to 8 Green Goods vouchers | Swapped. Nothing is booked yet |
| swap-5 | Storybook: `client-commitments-voucher-journeys--exchange-then-redeem` | The seat's page: she holds 10 Green Goods vouchers; Review and Redeem | She holds 10 now, enough to book |
| swap-6 | Storybook: `client-commitments-voucher-journeys--exchange-then-redeem` | Review and Redeem: 30 days of a named AI tool seat for 10 Green Goods vouchers, held in escrow | Agree to the seat's exact terms |
| swap-7 | Composite: `admin-pool-voucheraskdialogs--accept-green-goods-access` over the real `dashboard /garden/pool` | Accept Ifeoma? in Green Goods’ own pool, the protocol pool: all four checks hold for her 10 vouchers, before Accept Ifeoma | Green Goods accepts once four checks pass |
| swap-8 | Storybook: `client-commitments-voucher-journeys--exchange-then-redeem` | Her booking steps, all done through Green Goods accepting her; access has started | Accepted, her seat is active |
| impact-1 | App: `/` | greengoods.app's home page | Green Goods on the web |
| impact-2 | App: `/` | Impact's evidence ledger, filtered to Education, at the bootcamp | Approved work, filtered to Education |
| impact-3 | App: `/` | The bootcamp's approved submission, opened from the ledger | The bootcamp, on the public record |
| funding-1 | App: `/gardens/tas-hub` | The end of the hub's page: Support This Garden | Back the hub from its own page |
| funding-2 | App: `/gardens/tas-hub` | Fund: the hub with Donate and Endow | Choose Donate for the hub |
| funding-3 | App: `/gardens/tas-hub` | Donate: 500 typed, Connect Wallet | Enter an amount and connect |
| funding-4 | Composite: `public-documentation-funding--donate` over funding-3 | Donate $500.00 in DAI, wallet connected | Confirm the donation |
| funding-5 | Composite: `public-documentation-funding--donated` over funding-3 | Donated $500.00 to the hub | Donated to the hub's shared fund |

"Who you are" is Obinna for Needs, Season, Approval and the hub day's acceptance (vouchers-6 and
vouchers-7); a Green Goods steward for the seat's acceptance (swap-7); Ifeoma for Promise, Work and
the rest of Vouchers and Swap; Funmi for Impact and Funding.

Desktop screens are 1440 by 900 at 1.5x (swap-7 1152 by 720 at 1.875x, the same pixels) and phone
screens 390 by 844 at 2x, saved as JPEG. The app's own back arrow, close button or Cancel on a screen
is a back region, measured by `capture.mjs` like the hotspot.

### Where the app stops and what stands in

- **Needs.** The sign-in is the dashboard signed out. The hub has no assessment on record, so the
  earlier one (needs-2) is the Hub's Storybook tab with one assessment, as demo data. "Submit
  Assessment" asks for a signature, so the saved dialog (needs-7) is Storybook, drawn over the
  review it replaces.
- **Season.** The hub already runs this season and the app opens one at a time, so the Promises tab
  before it (season-1) is the real tab with Storybook's "No season running" card in the season's
  place and the season's course requests hidden, and "Start a Season" (season-2) is the Storybook
  dialog over it. The seed flow (season-3 to season-7) is the real dashboard; "Create Promise" asks
  for a signature. Its review's reward reads "$20.00, paid in G$ once it's kept": develop shows
  "None" there while settlement is switched off (`SETTLEMENT_ENABLED`), and the pitch shows payouts
  on. The Pool Funding card, which reads that switch, is hidden, and so is the warning develop added
  to the tab (#1363) when its voucher reads fail, as they do on the hosted indexer: the pilot's
  bookings are not these screens' subject, and on a desktop the warning takes the tab's first grid
  cell and pushes its columns out of place.
- **Promise.** The bootcamp promise was never created (no signature), and develop's Home lists no
  open promise for the hub today, so Take Part on Home (promise-1) is the Storybook section drawn
  where the real one sits, and the Take Part sheet, the promise's page and the take-up sheet are
  Storybook, with the sheets drawn over the screen they open from. The sheet's season fixture lists
  offers, so its rows read "Asked for" and take the request row's icon, as Home's row draws a
  request. Her promise in progress (promise-5) is the earn journey's request page once her take-up
  is recorded, unscrolled: its title and status, then both rewards running under the action bar.
- **Work.** Submit Work's Start, Media and Review for a promise are Storybook (the mock account
  holds no promise). The hub's record has one photo of the bootcamp, so her upload has one, and the
  review shows the garden as facts (#1335).
- **Approval.** The Hub's queue and the work's dialog are the real dashboard, with the steward's own
  pending node log relabeled as Ifeoma's bootcamp (title, action, gardener, time, photo). The app
  asks another steward to review the viewer's own work, so the review panel is the Storybook review
  form, drawn in the real panel, which is as tall as the form makes it. Approving asks for a
  signature; approval-4 is the Storybook summary in the same panel.
- **Vouchers.** Every screen is Storybook: the pilot's reads are not live. The booking's card and
  its Accept dialog are drawn into the hub's real Promises tab.
- **Swap.** Her screens are the exchange journey's Storybook story (#1356), walked by its own
  buttons. The service the fixtures call "Claude access" is shown as the deck names it, an AI tool
  seat. Green Goods accepts bookings in its own pool, the protocol pool (the root garden's), so its
  Accept (swap-7) is the `AcceptGreenGoodsAccess` story of `VoucherAskDialogs` (#1371), which sets
  that pool apart with its warning, drawn with its scrim over that pool's real Promises tab. The
  journey's deadline to accept, a week after she agrees, reads 8 November, the day the pilot's
  Claude seats start.
- **Impact.** The public site as it stands: the home page, the Impact page's evidence ledger
  filtered to Education, and the bootcamp's approved submission. The ledger and Fund date the
  bootcamp's real submission 26 August; the demo tells it as this season's work, submitted and
  approved on 26 October (approval-1 to approval-4), so those two screens read 26 October.
- **Funding.** The hub's page, Fund and the Donate dialog are real up to Connect Wallet; the
  connected and donated states are the Storybook dialogs drawn over the real Fund page.

## What is real and what is sample

Read from Tech and Sun's record on 26 and 27 October 2026 (the garden, its pool and season, its
actions and its public pages):

- The hub: TAS HUB in Awka, Nigeria, 14 members, its description, its banner photo and its record
  of approved submissions.
- The season "Climate and Tech Education", 10 October 2026 to 31 January 2027, and its 24 course
  requests ("Complete the UN CC:Learn climate course", $20 each, due 31 January 2027).
- The Workshop Delivered action, the dashboard's assessment wizard, seed flow and work queue, and
  every App screen's layout, counts and state.
- The bootcamp's record entry, "A one week content creation bootcamp with AI", and its photo. The
  Work and Approval chapters replay how that entry reached the record.
- The public pages and their counts.

Sample: every person's name (below); the earlier assessment; the new assessment and its targets;
the bootcamp promise (its title, 20 hours, 25 November 2026 and $20); Ifeoma's take-up, her
submission's time and the approval note, and the bootcamp's date on the ledger and Fund (26
October; the record says 26 August); the vouchers (2 earned, 9 held, the hub day booked for
January); the swap (2 Green Goods vouchers held, 10 for the seat, 8.01 Tech and Sun vouchers for 8,
a 0.01 fee, the pilot's 1:1 rate, an 8 November deadline); the G$ amount (155,460, at the rate the
Storybook fixtures fix); and the $500 donation.

## Names

Every person is invented. The mock account (a steward of the hub) is Obinna; Ifeoma is the member
who runs the bootcamp; Funmi is the supporter; the hub's two other stewards are adaeze.eth and
ikenna.eth; Nneka is the other member booking a hub day in the voucher fixtures. Any other
shortened address on screen becomes one of eight invented handles (tobenna.eth, kelechi.eth,
nneka.eth, ada.eth, uche.eth, ngozi.eth, chidi.eth, amaka.eth), the same one for the same address.
The confirmer field's hint keeps the app's own example, lina.eth.

| On the record or in the fixture | In the demo |
|---|---|
| The mock account's handle; the pool's requester `0x5e...0b2` | obinna |
| The fixture member `amara`, `lina` and `Kwesi`; the earn and swap journeys' reader `Lina`; `Mara` in Green Goods' Accept; the steward's own node log's submitter | ifeoma / Ifeoma |
| The fixture member `Lina` who books first in the hub-day fixtures | Nneka |
| The hub's two other stewards (their ENS names) | adaeze.eth; ikenna.eth |
| The fixture wallet `0x5eed...00a1` | funmi.eth |

## Demo copy

Swapped into each screen's text, `alt`, `aria-label`, `title`, placeholders and field values after
it renders, with the photos named in the flows table. Components, layout and controls stay as
rendered. The tables in `capture.mjs` (`HUB_LIST`, `SEASON_SETUP`, `TAKE_PART`, `GROUP`,
`START`, `FOR_PROMISE`, `QUEUE`, `REVIEW_FORM`, `EARN`, `READER`, `SEAT`, `SEAT_DEADLINE`,
`SEAT_ACCEPT`, `HUB_DAY`, `RECORD_DAY`, `DONATE`, `ASSESSMENT`) hold every rule; in short:

| Fixture or record text | Demo copy | Screens |
|---|---|---|
| Rio Rainforest Lab; Rainforest canopy strategy; Jan 3, 2026; Agroforestry | TAS HUB; Reliable power and internet at the hub; Apr 6, 2026; Solar | needs-2 |
| Rocinha's pool; Season of First Rains | TAS HUB's pool; Climate and Tech Education | season-2 |
| Reward: None | $20.00, paid in G$ once it's kept | season-7 |
| Riverside Commons Garden; Autumn Planting 2026; Sep 1 – Nov 30 · 3 of 7 kept | TAS HUB; Climate and Tech Education; Oct 10 – Jan 31 · 1 of 2 kept | promise-2, promise-5 |
| The fixture requests and offers (household survey, compost workshops, fence repair, composting workshop, seed library, watering) | Run a one-week AI content bootcamp; the season's course | promise-1 to promise-5, work-1 to work-3, vouchers-1 |
| Offered, and the offer's icon (Take Part rows) | Asked for, and the request's icon | promise-2 |
| 2 hours, 1 repair, 2 workshops; Oct 20, Oct 30, Dec 14; $5.00 | 20 hours; Nov 25, 2026; $20.00 | promise-3 to promise-5, vouchers-1 |
| 4 available · 3 in progress · 3 kept | 1 available · 0 in progress · 0 kept | promise-3 |
| Workshop photos; 3 of 12 approved; Seedling Transplant; Plants moved 36; Members 3 | the bootcamp; 0 of 1 approved; Workshop Delivered; Facilitators 2; Members 14 | work-1 to work-3 |
| The steward's own pending Node Operation Log, by afo, 3 weeks ago, Oct 1 | Workshop Delivered, by ifeoma, 12 minutes ago, Oct 26, 2026, 4:48 PM | approval-1 to approval-4 |
| 120 G$ | 155,460 G$ | promise-5, vouchers-1 |
| Claude access; Claude seat; Claude Team seat | AI tool seat | swap-1 to swap-8 |
| Mara; Jan 14; Jan 21 (the Accept dialog's member, its Safe's approval and its deadline) | Ifeoma; Oct 26; Nov 8 | swap-7 |
| Nov 2 (the seat's deadline to accept) | Nov 8 | swap-6, swap-8 |
| Aug 26, 2026 (the bootcamp on the ledger; TAS HUB's latest on Fund) | Oct 26, 2026 | impact-2, funding-2 to funding-5 |
| Nov 2; Oct 26 (the hub day's deadline and agreement) | Jan 20; Jan 13 | vouchers-4, vouchers-5 |
| $50.00 | $500.00 | funding-4, funding-5 |
| The fixture photos; the node log's photo | record-06 (the bootcamp's record photo) | promise-1, work-2, work-3, approval-1 to approval-4 |

Typed into the app rather than swapped: the assessment (needs-3 to needs-5), the seeded promise
(season-4 and season-5) and the 500 in the Donate amount (funding-3).

Hidden on screens, because the story does not have them: the steward's "Needs Your Attention" row
on Home (promise-1, when present); the season's course requests on the Promises tab before the
season (season-1); the Pool Funding card (season-1, season-3 to season-7); the fixture's campaign
and its rows in Take Part; the node log in Start's promises (work-1); the fixture's second review
photo (work-3); "waiting over a week" (approval-1); the Promises tab's voucher warning, which says
it could not load the pilot's bookings from the hosted indexer (season-1, season-3 to season-7, and
under vouchers-6 and swap-7); and the voucher stories' narration.

## Claims

- Captions, steps, intros and the page's own words say nothing about chains, use "promise", never
  "commitment", and mark every voucher screen "In pilot". The intro says "Real app screens with demo
  data" and that vouchers are in pilot.
- App text inside the screens still says "Connect Wallet", WETH and DAI (funding-3, funding-4),
  "Your wallet will ask you once" (season-7), "Starting follows on the voucher network" (vouchers-7)
  and "Deposit confirmed on Green Goods" (swap-7, swap-8); none of them names a chain.
- Payouts are shown on (season-7, promise-3, promise-5, vouchers-1) while develop's settlement
  switch is off.
- The swap's rate and fees are the pilot fixture's. The brief says no member has used a voucher yet,
  which the "In pilot" marks keep true.
- Both Accept dialogs (vouchers-7, swap-7) end on the app's note "It doesn't mean the service was
  delivered", worded for any service since #1372.

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

## Task record · one season in eight chapters

Task record: SF.Live clickable demo, v4 | Type: feature | Outcome: complete; delivery links above
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `b9d3ba279` (develop merged at `3d1327dc1` and `0e769d374`)

| Phase | Start → end (UTC, 26 and 27 October 2026, approximate) | Result / evidence |
|---|---|---|
| align | 22:20 → 23:10 (26th) | Afo's review of v3; develop's new surfaces mapped (season setup, seed flow, Hub work queue, public Impact and Fund, the merged voucher stories); seven decisions in two rounds of questions |
| sync | 00:08 → 00:20 (27th) | Signed merge of develop into this branch; the capture checkout moved to develop's tip, to `a4e083adc` once #1335 merged (01:27), and to `731ddba12` once the voucher fixes #1349 and #1351 merged (02:45) |
| implement | 00:20 → 02:30 | The page's new shell by a parallel agent (two-column landing, chapter strip and panel, in-screen and browser back, theme switch, check rework); `capture.mjs` v4 sessions for 42 screens; a local Storybook build, since the deployed one cannot render a story |
| verify | 02:30 → 03:05 | Clean full captures at `a4e083adc` and again at `731ddba12`: 42 screens, 0 problems each; `build.mjs` 7.4 MB; `check.mjs` exit 0 (42 steps, 25 back regions walked); every screen and the contact sheet inspected, and the approval form re-fitted to its dialog |
| publish | 03:05 → 03:10 | Commits `a415f8521`, `e61bd3807` and `237347b0f` pushed (gate passed; the first try stopped on the uncommitted launch config's format); artifact version 11 at the same link, carrying the alt text another session had added to the live v3; Drive copy replaced |

Human corrections: 1 observed in this segment (Afo's review: the flows felt disconnected, the app's own back controls did nothing, "names are changed" should read as demo data, the dashboard's approvals and the merged voucher work were missing, and garden cards should be text); attention unknown.

## Task record · a 12-screen story

Task record: SF.Live clickable demo, v5 | Type: feature | Outcome: complete; delivery links above
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `89b7fb45e`

| Phase | Start → end (UTC, 27 October 2026, approximate) | Result / evidence |
|---|---|---|
| research | 03:42 → 04:52 | Afo's review of v4: the frame moved as captions wrapped, and eight chapters felt like too much clicking. The shift measured on every v4 screen and fixed on a scratch copy; interactive-demo and hackathon-judging practice read (10 to 12 steps, about two minutes); the submission brief and the deck pinned what was built for SF.Live; four decisions locked with Afo (12-screen story with the appendix, earn then swap then book, both steward screens, Next beside the hotspot) |
| sync | 04:52 → 05:01 | The capture checkout moved to develop's `19d8ebf8e` (the swap, #1356; a member's own lesson, #1359; the steward's voucher outcomes, #1360); Storybook rebuilt from it |
| implement | 05:01 → 05:51 | The swap chapter's seven screens from the exchange journey story; her promise in progress with both rewards; the page's new shell (intro, fixed-stage player with Next, close, chapter list); `check.mjs` rewritten around the fixed layout |
| verify | 05:51 → 06:32 | A clean full capture on `19d8ebf8e`: 49 screens, 0 problems (the first full run failed only on a rename rule no screen needed any more, now removed); `build.mjs` 8.38 MB; `check.mjs` exit 0: the story and all 49 appendix screens walked, 33 back regions, and the bar, stage, who-you-are row, caption, controls and device held in place on every screen at 1440x900, 1280x720, 768x1024 and 390x844; every new screen and the story's contact sheet inspected |
| publish | 06:32 → 06:34 | Commit `066f23775` pushed (gate passed: format and lint); artifact version 12 at the same link; Drive copy replaced (8.8 MB) |

One locked decision changed in the build and was restored the same morning: develop had no story of
Green Goods accepting the seat (its pool is the protocol pool, whose Accept dialog differs from the
hub's), so v5 first ended the story's voucher chapter on her booking. The next segment adds that
story and ends the chapter on Green Goods accepting.

Human corrections: 1 observed in this segment (Afo's v4 review: no layout shift, far fewer clicks, ground in the core loop and focus on what was built for the hackathon); attention unknown.

## Task record · Green Goods accepts the seat

Task record: SF.Live clickable demo, Green Goods' Accept | Type: feature | Outcome: complete; the story's PR #1371 merged on green as `1675ce406`
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `1e346217c`, and the story in #1371 (`4971dbd74`, on develop `ab8e34dd9`)

| Phase | Start → end (UTC, 27 October 2026, approximate) | Result / evidence |
|---|---|---|
| story | 06:40 → 06:58 | `AcceptGreenGoodsAccess` in `VoucherAskDialogs.stories.tsx`, with `STORY_MARA_ACCESS_ASK` in `poolStoryVouchers.ts`: Green Goods accepts 30 days of Claude access in the protocol pool. Biome format and oxlint clean; the admin typecheck reports nothing in the two files; in a local Storybook build the story renders and its play test finishes, with four checks holding and Accept enabled |
| demo | 06:58 → 07:05 | The swap chapter recaptured with the Accept as swap-7, drawn over the root garden's real Promises tab (its voucher panel, which cannot read the pilot's bookings from the hosted indexer, hidden), and her active booking as swap-8; the story's voucher chapter ends on Green Goods accepting. `check.mjs` exit 0: 50 screens, 35 back regions |
| publish | 07:05 → 07:21 | Afo chose own PR merged on green, republish now, the note's wording in a later PR and no Linear record. #1371 opened after the push gate passed (format, lint, docs-authority, source-structure, story-quality, react-patterns and the focused `VoucherMemberBooking` test); demo commit `760a00414` pushed; artifact version 13; Drive copy replaced. #1371 merged at 07:21 once a re-run of its Playwright job (whose browser setup had timed out before any test) and of CI Gate passed |

Human corrections: 0 observed in this segment; attention unknown.

## Task record · polish from the 27 October review

Task record: SF.Live clickable demo, review polish (P1 and P2) | Type: feature | Outcome: complete
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: this folder, from `d335b0a4d`, captured on develop `1675ce406`

| Phase | Start → end (UTC, 27 October 2026, approximate) | Result / evidence |
|---|---|---|
| setup | 08:05 → 08:24 | The develop worktree's package `node_modules` still held 51 links into another checkout, so React Query loaded twice and every dashboard page and wallet-hook story failed with "No QueryClient set"; the links were removed and the frozen-lockfile install restored them locally. Storybook rebuilt; the app, dashboard and Storybook served from that worktree |
| implement | 08:24 → 08:50 | Phone stories without Storybook's 16px frame (the wallet's lone panel keeps it); the season sheet's rows as requests with the request icon; story 1's Home scrolled so no card is cut under its top bar; story 3 unscrolled, with its title; story 11 is the ledger (impact-2); the record and Fund dated 26 October, the seat's deadline 8 November; develop's voucher warning hidden on the pools' Promises tabs; Green Goods' Accept at 1152x720; captions that carry the numbers; the intro's chapters top-aligned; every-step tiles that name each chapter's surfaces and both people; the close's chapter cards and its link to TAS HUB's live page; a lighter device edge in dark |
| verify | 08:32 → 08:57 | The first full capture stopped on one problem: Green Goods' pool now lists its live offer, "30 days of Claude Team access", which `SEAT_OFFER` names as the journey does. The second: 50 screens, 0 problems. `build.mjs` 8.73 MB; `check.mjs` exit 0: 62 screens, 35 back regions, every part held at 1440x900, 1280x720, 768x1024 and 390x844; the story, close, chapter list, phone and dark views inspected |
| publish | 08:57 → 09:02 | Commit `983ab2674` pushed (gate passed: format and lint); artifact version 14 at the same link, its signed-out view checked at the close and story 10; Drive copy replaced (9.2 MB). Story 10's note still read "doesn't mean the visit happened" until #1372 merged |
| note | 09:05 → 09:15 | #1372 merged (`b10f2706f`); Storybook rebuilt on develop's tip `2d58fe43b`; swap-7 and vouchers-7 re-captured, both ending "It doesn't mean the service was delivered". The other 14 voucher and swap screens, re-captured on the tip in a scratch copy, came out byte-identical, so #1373 changes no demo screen. `check.mjs` exit 0 (62 screens, 35 back regions); committed and pushed with this record; artifact republished; Drive copy replaced |

Two review items changed on inspection. The steward's review stays at 1440x900: its form needs more height than a 720-high screen gives the dialog. The ring on the Take Part sheet's close button (story 2) was the page's keyboard focus on a back region, which the checker's keyboard walk had left there; a pointer never shows it.

Human corrections: 0 observed in this segment; attention unknown.
