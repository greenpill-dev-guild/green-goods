# Cosmo-Local hackathon pitch assets

Pitch material for the SustainableFinance.Live 2026 entry (Problem Statement 2). First draft
9 October 2026; full story restored and redesigned 23 October; **rebuilt on 24 October 2026
(Pacific) after Afo's slide review** into a 16-slide deck in five acts, with a six-page companion
brief. The pitch is scheduled for 28 October from 10 AM London; submission is due 27 October.

The [claim ledger](../research/claim-ledger.md), current addendum first, owns wording boundaries.
The [event research](../research/hackathon-pitch-research-2026-10-23.md) explains the strategy and
its limits. Older research and demo scripts in [`../research/`](../research/README.md) are dated.

## What is here

| Path | What it is |
|---|---|
| [`deck/index.html`](deck/index.html) | The 16-slide deck: one HTML file with inline diagrams, the Warm Earth tokens and the speaker notes in its `#speaker-notes` block |
| [`deck/speaker-notes.md`](deck/speaker-notes.md) | Sixteen notes of about 30 seconds each, 8:00 in total, plus cuts for a shorter slot, claims to keep straight and the Q&A business-model and endowment references |
| [`deck/render.mjs`](deck/render.mjs) | Checks the deck, syncs the notes, renders PNGs, a contact sheet and the PDF |
| [`deck/capture-screens.mjs`](deck/capture-screens.mjs) | Captures the three product screens the deck and brief use |
| [`deck/assets/brand/`](deck/assets/brand/) | The official logo and the symbol, cropped to its shapes for the corner mark |
| `deck/assets/screens/`, `deck/assets/photos/` | Local images, not committed; see [Photos and screens](#photos-and-screens) |
| [`brief/index.html`](brief/index.html) | The companion brief: six A4 pages in the same style; page 1 doubles as the one-page mentor brief |
| [`brief/render.mjs`](brief/render.mjs) | Checks the brief and renders its PDF and page PNGs |
| [`review-2026-10-25.md`](review-2026-10-25.md) | Afo's 25 October slide and brief review, with the Tech and Sun research, recorded for the local implementation pass |

Rendered files go to `deck/output/` and `brief/output/`, which the repository ignores: run the
commands below to produce them.

## Present

Open `deck/index.html` in a browser. Keys: `→` `Space` `PgDn` next, `←` `PgUp` previous, `Home`
and `End`, `1` to `0` jump, `N` toggles the notes panel (slide, label, timing, note, next slide),
`F` toggles fullscreen, `P` prints. Click the right four fifths of a slide to go forward and the
left fifth to go back. `#7` deep-links a slide and `?notes=1` opens the notes. The deck scales to
any window. Fonts load from Google Fonts; offline, Georgia and the system sans apply, while the
PDFs embed the fonts. Share `deck/output/deck.pdf` and `brief/output/brief.pdf` as files.

## Render and check

From the repository root of an installed checkout. A checkout without `node_modules` can set
`NODE_PATH` to another checkout's `node_modules`, installed from the same lockfile, instead of
installing anything:

```bash
node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/capture-screens.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs --sync
node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/brief/render.mjs
```

The deck script checks 16 slides, the corner symbol and slide number on each, notes identical in
the HTML and the Markdown, each slide's timing equal to its notes heading, 8:00 in total and no em
dashes. While rendering it reports text outside the 128px side margins or in the corner band,
text or artwork over a headline, artwork over the corner symbol, headlines over two lines (three
on the title) and images that did not load. `--only=3,7` re-renders single slides while editing.
The brief script checks six pages, margins, footers, images and em dashes. Both exit with status 1
after reporting a problem.

## Photos and screens

The pitch uses four approved photographs: the Awka hub from outside (the brief's first page) and
inside (slide 16), and the two Omo Yoruba photos (slide 11). They show identifiable people
and belong to Tech and Sun and Omo Yoruba, so they stay out of git. Authorized copies sit in the
June 2026 Octant demo-day deck's folder; place them with:

```bash
cp /Users/afo/Code/greenpill/artifacts/octant-e12-deck/assets/photos/{awka-hub,tas-hub-build,odunde-masquerade,omo-yoruba-bridge}.jpg .plans/backlog/cosmo-local-credit-interop/artifacts/deck/assets/photos/
```

`capture-screens.mjs` writes three screens, also kept out of git:

- `garden-promises.png` and `confirm.png` come from the deployed Storybook at
  design.greengoods.app: real components with demo data. The deck and brief label them "App
  screens with demo data". Their fixture names and shortened addresses are synthetic.
- `tas-garden.png` is Tech and Sun's live public garden page on greengoods.app. Its counts are
  live at capture time, so re-capture it before presenting.

## The rebuild · 24 October 2026

Applied from Afo's review and two rounds of questions; the round-2 samples (three-line title,
circular loop, converging-inflow rings) were approved and reproduced exactly.

- **Five acts, 16 slides:** title; the problem; commitment pooling with two app screens; the loop;
  five roles; Cosmo-Local service vouchers; Tech and Sun with its live garden page; member
  credibility; four levels of capital; sources of capital; the Nigerian diaspora; three
  mechanisms; the business model; status and places; the technical roadmap; what we need.
- **Style:** the symbol alone in the bottom-left corner of every slide, regular-weight Fraunces
  headlines with the website's green italic accent, Inter text, nothing under 22px, solid lines
  only, no eyebrows or tags, and no chain names on slides.
- **Business model:** pricing logic only on the slide; the illustrative $50,000 program, costs,
  sensitivity and endowment arithmetic live in the notes and the brief.
- **Wording held to sources:** member needs follow claims C02 and C03; the endowment is live with
  its risks stated; exchange-pool funds from supporters and endowment earnings are labeled next
  and never a cash-out; partner stages follow the Q4 plan (Ma Earth first, Bloom after it, Regen
  Network exploratory); the roadmap names regions only; slide 12 draws no link from the endowment
  to commitments, because integrated milestone funding does not exist yet.
- **Roadmap labels:** Afo confirmed on 24 October that South Africa stays "next", with Kenya and
  Brazil "exploring", on slide 14 and in the brief.
- **Companion brief:** one-page summary, how it works, vouchers and the shared pool, architecture
  (chain names appear here only), capital and the business model, then roadmap, partners, terms
  and sources.

## Readiness evidence · 24 October 2026

Rendered proof is **headless Playwright Chromium 148, clean profile, file URLs**. Neither
artifact has an authenticated surface, so authenticated Brave proof does not apply.

- **Deck:** source checks pass (16 slides, 16 notes, 8:00, no em dashes). All 16 slides, the
  contact sheet and the 16-page PDF were rendered and inspected slide by slide; the probe is
  clean. In print mode every slide is one 1920 x 1080 page. In screen mode the arrow keys, the
  notes panel, the progress line and `End` work.
- **Brief:** six A4 pages rendered to PDF and PNG and inspected page by page; the probe is clean.
- **Arithmetic:** 15 recomputed checks pass: contributions and totals, community uses, the fee's
  parts, 120 labor hours and $6,500 cost, $3,500 at 35%, $1,500 at 15%, the $1,000 endowment
  example, the $60,000 + $10,000 + $30,000 split, the 100% yield split and 8:00 of timings.
- **Pacing:** every note runs between 122 and 156 words a minute.
- **Copy:** no em dashes, US spelling, lowercase roles in running text, "promise" in user-facing
  copy, no hand-typed garden counts, every financial example labeled illustrative.

## Unresolved presentation inputs

1. **Claim sources.** The deck follows the claim ledger's 23 October addendum, the event research
   note and the live-pilot handoff. If one of them is missing from `../research/` or `../handoffs/`,
   it has not landed from the Cosmo-Local contracts work yet; read the current copy there.
2. **Status refresh before submission.** Re-check the [live-pilot handoff](../handoffs/codex-live-pilot-deployment.md)
   on 27 October. If vouchers go live, update slides 6, 12 and 14, the notes' claims list and
   brief pages 1, 3, 4 and 6.
3. **Slot length.** The 2026 per-team time is unconfirmed; the notes run 8:00 and include a
   five-minute cut.
4. **Cohort facts.** Participants, services, capacity, prices and rewards; a first sponsor; the
   gift method (the Omo Yoruba donate page has no payment form).
5. **Live counts.** The Tech and Sun page capture shows 16 approved submissions, 14 members and
   zero assessments and certificates as of 24 October. Re-capture before presenting.
6. **Brief contact.** Page 1 lists greengoods.app and docs.greengoods.app only; add a named
   contact if mentors should reply to a person.
7. **Recorded clip.** The stretch-goal clip of the rehearsed voucher flow was not made; the notes
   say where it would go.
8. **Member-proof timestamp.** The claim ledger's C89 cites 01:17:19 UTC on 24 October; the proof
   record says its tests completed at 01:08:44 UTC and it was written at 02:09:22 UTC. The ledger
   line is the ledger owner's to reconcile; the deck states no time of day.
9. **Fonts offline.** Fraunces and Inter load from Google Fonts. Vendoring the OFL files would
   remove that dependency; it needs a download this task did not authorize.

## Task record · 16-slide rebuild and companion brief

Task: rebuild the deck in the approved style and write the companion brief | Type:
documentation/design | Outcome: complete locally; presentation readiness depends on the inputs above
Agent/model: Claude Code / Claude Opus 5.5 | Scope: the pitch artifacts in this folder and local images

| Phase | Start → end (Pacific, 24 October 2026) | Result / evidence |
|---|---|---|
| investigate | unknown → unknown | Review notes decoded; questions answered over two rounds; round-2 samples approved; screens, photos and status gathered |
| implement | unknown → unknown | Deck generated, notes rewritten and synced, render and capture scripts updated, brief written |
| verify/review | unknown → unknown | Every slide and page rendered and inspected; probes, print, navigation, arithmetic and pacing checks pass |

Human corrections: two observed review rounds on the samples; attention unknown. Phase clock times
were not recorded.

## Earlier records

These records are history; the sections above supersede their readiness statements.

### Design pass · 23 October 2026 Pacific (superseded by the rebuild)

A design and production pass on the earlier 13-slide deck with four appendices: one grid per
slide, square editorial surfaces, redrawn voucher, ring and funding diagrams, a dated timeline,
fixed live-window centering and keyboard navigation. Rendered with headless Playwright Chromium
148; probes clean; fifteen arithmetic checks and the 9:10 timing passed. Afo's review on
24 October replaced that structure with the rebuild above.

### Earlier full-story verification and task record

Source checks passed: balanced HTML/SVG, 17 sequential slides, 17 notes matching the Markdown
exactly, 9:10 timing arithmetic, unchanged original CSS and navigation, JavaScript syntax and
local Markdown links. `git diff --check` passed for the four tracked pitch paths. The scoped
`bun --no-env-file run check -- --intent qa --changed <five pitch paths>` selected only format
and passed, but Biome matched zero files. That result provides no formatting or rendered-layout
coverage. The explicit source checks provide the bounded content/structure evidence above.

Task record: Cosmo-Local full-pitch restoration | Type: guidance/investigation | Outcome: partial
Agent/model: Codex / model unknown | Coverage: corrective narrative, research and source revision

| Phase | Start → end (UTC, 24 October 2026) | Result / evidence |
|---|---|---|
| investigate | unknown → 00:58:41 | Original arc recovered; official challenge, three years of winner reporting and current implementation evidence reviewed |
| implement | 00:58:41 → 01:06:35 | Full story revised in its original 17 positions; current claims and research rationale recorded |
| verify/review | 01:06:35 → 01:11 | Source and scoped validation checks passed with limits above; rendered proof remained unavailable |

Human corrections: 1 observed, scope correction after the cohort-only rewrite; attention unknown.
The story and source revision are complete. The partial outcome recorded missing visual proof
and private photo assets, not a blocker on independent contract work or authorized deployment.

### Business-model integration · 23 October Pacific

The existing deck now weaves in the accepted commercial model and optional endowment:

- Slides 3–4 connect the funding gap with continuity and identify the pre-hackathon foundation.
- Slides 6 and 8 explain direct support, retained capital, actual earnings and informed renewal.
  The original four-ring relationship diagram remains intact.
- Slide 10 shows the six-month illustrative funding mix, community allocation, separate Green
  Goods service fee and delivery economics. The notes carry detailed costs and sensitivity.
- Slides 11–13 distinguish future product integration, frame growth around paid delivery and
  repeat support, and retain both diaspora and institutional participation in the ask.

The notes also record grant-term suitability, withdrawal and capital risks, the optional
endowment example without double-counting principal, and the limits of future certificate
purchases. The current claim ledger adds C81–C89. The refreshed technical snapshot used the
member proof recorded on 24 October, labeled as a working-copy local rehearsal. No new
live-service claim follows from it.

Source checks confirmed the original 17-part order, five untouched narrative/appendix slides,
the original four-ring diagram, unchanged shared CSS and navigation, and all 17 synchronized
notes. Funding rows and columns, community uses, hourly delivery costs, both contribution
scenarios and the endowment arithmetic reconcile. Timing targets still total 9:10, with
financial Q&A kept outside the spoken route. `git diff --check` passed. The four-path scoped
`qa` selector chose only `format` and passed; Biome matched zero files, so that result added no
formatting coverage beyond the explicit checks. Local accessibility guidance was retrieved from
the installed Modern Web Guidance tool; no dependency was installed or updated. No browser route
was used to circumvent the local-file rejection recorded at the time.

Task record: Cosmo-Local business model woven into existing pitch | Type: documentation
Agent/model: Codex / model unknown | Scope: four existing pitch and claim-authority files

| Phase | Start → end (UTC, 24 October 2026) | Result / evidence |
|---|---|---|
| investigate | 01:31:28 → 01:38:30 | Existing story, endowment/certificate guides and owning yield code inspected |
| implement | 01:38:30 → 01:47:23 | Business model integrated without changing the slide sequence; member proof labels refreshed |
| verify/review | 01:47:23 → 01:52:37 | Structure, note synchronization, source links, arithmetic and scoped check pass with the coverage limits above; visual proof remained unavailable |

Outcome: source revision complete; the design and production pass above added the visual proof
and restored the two approved photos locally. Human attention and active review time are unknown.
