# Cosmo-Local hackathon pitch assets

Pitch material for the SustainableFinance.Live 2026 entry (Problem Statement 2). First draft
9 October 2026; full story restored and redesigned 23 October; rebuilt on 24 October 2026
(Pacific) after Afo's slide review into a 16-slide deck in five acts, with a six-page companion
brief; **revised after his 25 October review** into 18 slides, with a solution slide, the roles
before the loop, a world map and a closing slide whose QR code opens the beta; then checked
against primary sources in the [RESR-94 evidence pass](../research/diaspora-evidence-pass-2026-10-25.md)
and completed the same day; then **refreshed on 25 October** after the voucher contracts reached
the public networks, so the notes and brief say "deployed", never "live"; see
[the status refresh](#status-refresh--25-october-2026); and **polished after his second review
on 25 October**, which fixed the title slide in print, put the five roles on the solution slide,
the Awka photo on the Tech and Sun slide, four mechanisms, four places and a centered closing
slide in the deck, and renamed, linked and re-fitted the brief; see
[the final polish](#the-final-polish--25-october-2026); and **re-checked on 26 October** for the
brief's links, the architecture page's layout, the season's status and one Drive folder; see
[links, layout and the season](#links-layout-and-the-season--26-october-2026). The pitch is scheduled for 28 October
from 10 AM London; submission is due 27 October.

The [claim ledger](../research/claim-ledger.md), current addendum first, owns wording boundaries.
The [event research](../research/hackathon-pitch-research-2026-10-23.md) explains the strategy and
its limits. Older research and demo scripts in [`../research/`](../research/README.md) are dated.

## What is here

| Path | What it is |
|---|---|
| [`deck/index.html`](deck/index.html) | The 18-slide deck: one HTML file with inline diagrams, map and QR code, the Warm Earth tokens and the speaker notes in its `#speaker-notes` block |
| [`deck/speaker-notes.md`](deck/speaker-notes.md) | Eighteen notes of 10 to 35 seconds each, 8:00 in total, plus cuts for a shorter slot, claims to keep straight and the Q&A business-model and endowment references |
| [`deck/render.mjs`](deck/render.mjs) | Checks the deck, syncs the notes, renders PNGs, a contact sheet and the PDF |
| [`deck/assets/brand/`](deck/assets/brand/) | The official logo and the symbol, cropped to its shapes for the corner mark |
| `deck/assets/screens/`, `deck/assets/photos/` | Local images, not committed; see [Photos and screens](#photos-and-screens) |
| [`brief/index.html`](brief/index.html) | The Green Goods brief: six A4 pages in the same style, made to stand on its own; page 1 doubles as the one-page summary; its links are clickable in the PDF |
| [`brief/render.mjs`](brief/render.mjs) | Checks the brief and renders its PDF and page PNGs |
| [`submission/business-model-canvas.html`](submission/business-model-canvas.html) | The Business Model Canvas the event asks for: one A4 landscape page, the nine standard blocks, figures from the brief and labeled illustrative |
| [`submission/logical-architecture.html`](submission/logical-architecture.html) | The logical architecture the event asks for: one A4 landscape page from the five roles down to the three networks, with data in and out and the rules that hold everywhere |
| [`submission/render.mjs`](submission/render.mjs) | Checks both one-pagers (margins, footers, box and band overflow, images, em dashes, PDF word positions) and renders their PDFs and PNGs |
| `demo/` | The clickable demo the event asks for, with its own README: four full flows (Needs, Promise, Work, Funding), 37 screens captured from the current app and, for the states after a signature, the deployed Storybook, set at Tech and Sun's hub with invented names; the capture, build and check scripts, and a UI review of every screen. The built page is never committed, since it embeds photos of identifiable people; it lives in Drive and as a private artifact |
| [`review-2026-10-25.md`](review-2026-10-25.md) | Afo's 25 October slide and brief review, with the Tech and Sun research; implemented in [the revision](#the-revision--25-october-2026) |
| [`../research/diaspora-evidence-pass-2026-10-25.md`](../research/diaspora-evidence-pass-2026-10-25.md) | The RESR-94 evidence pass: every diaspora, remittance, hub and funding claim checked against primary sources, with proposed ledger rows and open questions; applied in [the evidence pass](#the-evidence-pass--25-october-2026) |

Rendered files go to `deck/output/`, `brief/output/` and `submission/output/`, which the repository ignores: run the
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
node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs --sync
node .plans/backlog/cosmo-local-credit-interop/artifacts/deck/render.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/brief/render.mjs
node .plans/backlog/cosmo-local-credit-interop/artifacts/submission/render.mjs
```

The clickable demo has its own capture, build and check commands in `demo/README.md`.

The deck script checks 18 slides, the corner symbol on each, the slide number on each except the
title and the closing slide, notes identical in the HTML and the Markdown, each slide's timing
equal to its notes heading, 8:00 in total and no em dashes. While rendering it reports text
outside the 128px side margins or in the corner band, text or artwork over a headline, artwork
over the corner symbol, headlines over two lines (three on the title), images that did not
load, and any block whose layout box leaves the slide before transforms are applied, because
print lays blocks out before transforms and fragments what overruns the page (the title slide's
last line once landed below the footer that way). After the PDF it runs `pdftotext -bbox`, where
installed, and reports any word outside its page. `--only=3,7` re-renders single slides while
editing. The brief script checks six pages, margins, footers, images and em dashes. Both exit with
status 1 after reporting a problem.

The closing slide's QR code is inline SVG for `https://beta.greengoods.app`, made with the
repository's installed `qrcode` package (no new dependency). To point it at another link, print
a new code from the repository root, then copy its `viewBox` and the `d` of its second `<path>`
into the `s-thanks` slide's QR `<svg>`:

```bash
NODE_PATH=$(ls -d node_modules/.bun/qrcode@*/node_modules | head -1) node -e 'require("qrcode").toString("https://beta.greengoods.app", { type: "svg", errorCorrectionLevel: "M", margin: 0 }, (e, svg) => console.log(svg))'
```

The roadmap slide's dot map is static SVG, drawn once from hand-simplified outlines in a Natural
Earth projection with the installed `d3-geo`; no map data was downloaded. Its markers are plain
circles in the same SVG, placed at the projected position of each place.

## Photos and screens

The pitch uses four approved photographs: the Awka hub from outside (slide 8 and the brief's
first page) and inside (slide 17), and the two Omo Yoruba photos (slide 12). They show identifiable people
and belong to Tech and Sun and Omo Yoruba, so they stay out of git. Authorized copies sit in the
June 2026 Octant demo-day deck's folder; place them with:

```bash
cp /Users/afo/Code/greenpill/artifacts/octant-e12-deck/assets/photos/{awka-hub,tas-hub-build,odunde-masquerade,omo-yoruba-bridge}.jpg .plans/backlog/cosmo-local-credit-interop/artifacts/deck/assets/photos/
```

Slide 6 and the brief's second page show two screens the deck owns, also kept out of git:
`deck/assets/screens/promises-sheet.jpg`, the hub's Promises sheet in its open season, and
`confirm-sheet.jpg`, the sheet that confirms a kept promise, with a member's course proof. They
are copies of the clickable demo's 26 October capture (its `promise-3.jpg` and `promise-11.jpg`,
780 by 1688): Tech and Sun's real season and course request in the current app, with invented
member names. The demo's later rebuild tells one chain and no longer captures them, so keep
these copies; to replace them, capture the hub's Promises sheet and a course promise's confirm
sheet from the app at 390 px wide and 2x, with both sheets' top edges at y 250. The notes'
claims list tells the presenter what they show. The earlier Storybook pair and its capture
script retired in the [critique pass](#the-critique-pass--26-october-2026).

## The revision · 25 October 2026

Applied from [Afo's 25 October review](review-2026-10-25.md) on 24 October Pacific (25 October
UTC), in the order its follow-up brief set: structure, copy, accepted polish, brief, mechanics.

- **Eighteen slides:** title; the problem; a new solution slide ("Green Goods gives a community
  one record of what it promised, did and proved", with garden, gardeners, stewards and
  supporters); the five roles, moved before the loop so the loop can use their names; the loop;
  commitment pooling; Cosmo-Local vouchers; Tech and Sun; member credibility; four levels of
  capital; sources of capital; the Nigerian diaspora; three mechanisms; the business model; the
  places, now on a world map; the technical roadmap; what we need; and a closing thank-you.
- **Copy:** a fourth commitment-pooling point on members seeing what others can offer and need;
  promises run between members as well as to the garden in the loop; no deployment status on the
  vouchers slide, and "live deployment under way" is gone from the deck, notes and brief; the
  roles slide drops "No one confirms their own work", and the one trust line now closes the member
  slide as "The person who did the work never confirms it"; Tech and Sun is the initiative that
  builds solar-powered hubs, with the Awka hub live first; "Hubs are rich in capital"; the
  community adds material capital; Omo Yoruba of Southern California is the first diaspora
  community, no longer called a fiscal sponsor; "garden" replaces "community" in the business
  model on the slide, in the notes and in the brief; each partner on the technical roadmap gets a
  line of context, and the builder toolkit is gone; the needs no longer include time with
  Grassroots Economics.
- **Accepted polish:** "add funds" on the mechanisms arc, "setup, support and reporting" on the
  business-model arrow, and Tech and Sun's text lifted level with its screenshot. The vouchers
  flow and the needs slide's contact moved to fill the space the removed lines left.
- **Rings:** each band takes its own step of one warm hue, light at the hub and darker outward
  (`#F8EFE2`, `#E4D7C5`, `#CFC0AA`), and each legend glyph fills only its own band in that color.
  The dataviz validator's ordinal check passes on monotone lightness, steps of at least 0.06 and a
  single hue; its light-end contrast floor fails by design, because these are outlined background
  bands under the rays, not standalone marks. "Financial" is no longer green, the legend text is
  larger, and the hub's labels went from 21px to 22px.
- **Map:** the status row went, since the mechanisms slide and the brief carry it. The dot map
  marks Nigeria now, South Africa next, and Kenya and Brazil exploring, in the old roadmap's
  marker styles, with each place named on the map and in the list beside it.
- **Closing slide:** the thank-you, the beta link in words and its QR code. Afo confirmed the beta
  home, `https://beta.greengoods.app`, as the link on 25 October. Core Image decodes the rendered
  slide to exactly that URL. The slide carries no number.
- **Sources checked on 25 October:** techandsun.com describes the initiative building
  solar-powered hubs, the Awka hub near UNIZIK as live, and Enugu and Abuja as next locations
  still being confirmed. It names neither Lagos nor Nsukka, so the review's Lagos line was not
  used. Each partner's context line comes from its own site. The beta home and Tech and Sun's beta
  garden page both load.
- **Timing:** the solution slide takes 0:25 and the closing slide 0:10. The roles, rings and
  technical roadmap notes give back 25 seconds, and the vouchers and needs notes, which each lost
  a sentence, give back 10, so the total stays 8:00. The steward fallback in the commitment
  pooling note now matches the code (`confirmFulfillmentAsFallback` in `ConfirmLib.sol`) and claim
  C06: a steward can confirm only as a recorded fallback, never their own work.

## The evidence pass · 25 October 2026

A research session checked every diaspora, remittance, hub and funding claim against primary
sources for RESR-94 and recorded the results in the
[evidence note](../research/diaspora-evidence-pass-2026-10-25.md). Afo accepted its findings 1 to 7
for the deck, notes and brief and left the ledger rows to their owner. The pitch was then
completed on the same branch.

- **Remittances:** slide 12, its note and brief pages 5 and 6 use the World Bank's personal
  remittances series: $22.1bn reached Nigeria in 2024 (updated 8 October 2026). The African
  Development Bank's $21.3bn is gone, because its source table could not be opened and the bank
  compiles rather than produces the data. Series are never mixed.
- **Rewards:** the app says sending G$ reward promises "is unavailable in this release", so slide
  13's commitment pool earns "agreed recognition" and builds the record. Brief pages 2 to 5 say
  money rewards for new promises are deferred; pages 3 and 4 were aligned at completion.
- **Omo Yoruba:** "a Yoruba community nonprofit in Los Angeles", without "since 1997", which the
  IRS-derived record does not support. Associations in general, not Omo Yoruba, "can pool
  members' gifts behind one program", since it files the smallest return and has agreed to
  nothing.
- **Smaller fixes:** part of the endowment's earnings goes to the garden; public goods funds "have
  backed" Green Goods; the exchange-pool arc says "could add funds"; brief page 5 names the labeled
  steward fallback.
- **Completion:** the notes gain an untimed context reference for Q&A with the evidence pass's
  transfer-cost, diaspora-size and power-and-internet lines (Afo's picks from its optional
  findings; the giving-gap line was left out). The brief names `contact@greengoods.app` on pages
  1 and 6. The screens were re-captured at 09:00 UTC on 25 October; the counts are unchanged.

## Status refresh · 25 October 2026

Run on 25 October, between about 09:15 and 09:40 UTC, ahead of the 27 October submission, to
refresh the status facts the pitch carries. Repeat the check on 27 October (input 5 below).

- **Voucher contracts: deployed and switched on, not yet used.** The
  [live-pilot handoff](../handoffs/codex-live-pilot-deployment.md), read at its latest commit
  (`c2eafb2cc`, 24 October 15:34 Pacific), still ends with the operator prepared and signing
  pending. The deployment came after it. The public artifacts
  `packages/contracts/deployments/42161-pilot-downstream.json` and `100-pilot-downstream.json`
  (untracked in the main checkout, written 22:54 UTC on 24 October, source commit `c2eafb2cc`)
  record seven contracts and eleven receipts on Arbitrum One and sixteen contracts and eighteen
  receipts on Gnosis. Public RPC reads at 09:28 UTC on 25 October confirmed every receipt (status
  1, matching blocks, first mined 22:50 UTC), code at every address, and the deployer's nonces at
  1073 and 18. The three owner packets had executed since: the Green Goods Safe's nonce is 35 on
  Arbitrum One and 3 on Gnosis, the Tech and Sun Safe's is 1, the four voucher endpoints answer
  `paused()` false, and each issuer token has twenty units at six decimals, ten in the shared pool
  and ten in the issuer's own Safe, with a ten-unit allowance to the adapter. Those holders
  account for the whole supply, so no member holds a voucher and the escrow is empty. No tracked
  file on `develop`, `feature/cosmo-local-contracts` or `codex/linked-gnosis-onboarding` binds
  the app or the indexer to the new Gnosis addresses; the two matches on `develop` are ENS
  receivers on Ethereum at the same nonce-derived addresses.
- **Wording.** The slides keep "in pilot" and did not change. The notes' claims list gains
  "Deployed and switched on, not yet used" and tells the presenter to say "deployed", never
  "live", until the handoff records a real member's booking. The brief says "Deployed: the
  voucher contracts, on public networks since 24 October" on page 1, dates the page 3 evidence
  box 25 October and states the deployment and the twenty units there, adds a "Deployed" evidence
  class on page 4, and adds "Contracts deployed 24 October" to page 6. The handoff and the claim
  ledger were not edited; their owners should record the deployment.
- **Remittance Prices Worldwide.** Read in the browser pane on 25 October: the home page says
  "Last update: August 18, 2025" and lists the Q3 2025 report as its latest; the United States to
  Nigeria and United Kingdom to Nigeria corridor pages both offer Third Quarter 2025 as the latest
  period, collected 8 to 20 and 8 to 22 August 2025. No newer quarter exists, so the Q&A
  transfer-cost line is unchanged.
- **Photos and screens.** The four approved photos were placed from the June Octant deck folder.
  The three screens were re-captured at 09:23 UTC; Tech and Sun's live page still reads 16
  approved submissions, 14 members, 0 assessments and 0 certificates.
- **Renders.** The deck's checks and render pass with exit 0 (18 slides, 8:00, no em dashes,
  every image loaded); its source did not change, so no `--sync` was needed. The brief's first
  render failed on page 6, where a longer pilot line pushed the closing paragraph into the
  footer; the line was shortened to "Contracts deployed 24 October" and the second render exits
  0. Brief pages 1, 3, 4 and 6, the deck's contact sheet and the photo slides 8, 12 and 17 were
  inspected.

## The submission items · 25 October 2026

The event's submission brief (read 25 October) asks for four items: a solution presentation, a
Business Model Canvas, a logical architecture and a demonstrator such as a clickable demo, judged
on business idea, technical implementation, use of data sets, presentation, feasibility,
scalability and impact potential. Materials go to the team's Microsoft Teams room by Tuesday
27 October, 2 to 3 PM UK time, and the brief says to plan for eight minutes a team, which the
notes already run. The deck is the presentation; the canvas and the architecture are the two
one-pagers in `submission/`, in the brief's style and checked by `submission/render.mjs`; the
clickable demo was built in a side session as `demo/` (four full flows, Needs, Promise, Work and
Funding: 37 screens captured from the current app in a scratch worktree of `develop`, with the
deployed Storybook for the states after a signature, set at Tech and Sun's hub with invented
names), with its own `demo/README.md` that lists every screen's source, every substitution and
every copy swap. The built page is `Green Goods SF.Live 2026 clickable
demo.html` in Drive, in `Green Goods/Growth/SF.Live 2026` with the other submission files, and a private artifact; the orchestrator walked the Drive
copy headless on 26 October: deep links, keys, the mis-tap guard, images and the Google Fonts-only
requests all held.

- **Canvas.** The nine blocks sit in their standard places, placed by hand in the grid. Partners,
  segments and the value propositions carry what the deck and brief say; the revenue and cost
  blocks carry the brief's illustrative six-month program ($50,000, $40,000 to the garden, a
  $10,000 fee against $6,500 of delivery cost) and nothing new.
- **Architecture.** Five bands, people to networks, with a side column for data in (field
  evidence, confirmations, assessments, and the context data the pitch cites), data out (public
  pages, reports, records published to partners, certificates) and the rules that hold everywhere
  (the person served confirms; signed records; cross-network messages authorize and never carry
  funds). Network names appear here and in the brief's architecture page, never on the slides.
  Media storage is IPFS (`packages/shared/src/modules/job-queue/evidence-publisher.ts`); the
  persona lines follow `packages/shared/src/ontology/green-goods-ontology.json`.
- **Checks.** Both pages render as one A4 landscape page each with a clean probe; the probe also
  reports a block whose content overflows its box, since print clips it silently.
- **Revenue, 26 October.** Afo's review of the canvas asked that the endowment share be shown as
  a revenue stream instead of "never a cut of a garden's funds or endowment capital". Read-only
  research first: `Yield.sol` splits each garden's endowment earnings 48.65% to the cookie jar,
  48.65% to certificate fractions and 2.7% to a Juicebox project by default, settable per garden
  by its steward or the protocol owner; the steward and funder guides already say earnings can go
  to the protocol; the docs' Protocol Economics Explorer models garden, report, cookie jar and
  certificate fees, a 12 to 20% share of vault yield, grants, licensing and protocol-owned
  principal as scenario presets; the Green Goods OS research priced support and onboarding and
  kept protocol fees out of its forecast. One on-chain fact bounded the wording: on the deployed
  Arbitrum splitter `juiceboxProjectId` is 0 and the terminal unset (read 26 October), so the
  2.7% leg falls back to the garden's own treasury today. Afo's decisions: show fees for service,
  the endowment share at the live 2.7% default ("routing to Green Goods is being switched on"),
  planned report and certificate fees, and grants labeled as today's income; replace the
  "never a cut" line with "Never a supporter's deposit, never a garden's shared fund"; and mirror
  it on slide 14 and its note, the claims list, brief pages 1, 5 and 6 and the architecture's
  endowment box. The same pass fixed "the first garden" (the pilot garden), the places' stages,
  the Hypercerts Certified name, the architecture's "four surfaces" and the endowment leg count.

## The final polish · 25 October 2026

Applied from Afo's second review, given in chat on 25 October after the merge, with four
decisions he made when asked: G$ rewards are presented as live, impact certificates become a
fourth mechanism, "cockpit" becomes "steward dashboard" in the brief, and the brief is named
"Green Goods brief · October 2026".

- **Title slide in print.** The PDF cut the subtitle's last line off at the page's foot. Chromium
  lays an absolutely positioned block out before its transform, so the title block's
  untransformed box (top 540px, 564px tall) overran the page and fragmented. Both the title and
  the closing block now use fixed offsets, `render.mjs` checks layout boxes before transforms,
  and a `pdftotext -bbox` pass checks every word of the PDF sits inside its page.
- **Slides.** The solution slide's Record and Supporters captions name evaluators, funders and
  community members, so all five roles appear. The pooling slide's captions sit under the phones
  and the demo-data label is gone. The Tech and Sun slide shows the Awka hub photo instead of the
  garden page, and its needs text adds opportunity (introductions to work and career calls from
  the October survey, and the hub as where members find people to build with). The Omo Yoruba
  caption names the Odunde Festival 2026 in Leimert Park, a procession and a language class. The
  remittance slide drops "not our market size". The mechanisms slide has four circles: the
  endowment loses "which vary", the commitment pool earns "agreed rewards in G$", the exchange
  pool reads "Members swap service vouchers in a shared pool, like an hour of help for a career
  call.", and certificates are "partly built": "A garden turns a season's impact into a
  certificate. Next, supporters can buy a share." Each fits three lines; the arc carries the
  future funding, and the notes and brief carry the caveats. The business
  model headline reads "Our revenue model: funders pay Green Goods to reach more local
  initiatives." The places slide lists Kenya and Brazil separately, both agroforestry, with
  Greenpill Kenya, AgroforestDAO and Growecosystems named in the note and brief as gardens already
  on Green Goods. Ma Earth's stage line names Hypercerts Certified, the Hypercerts Foundation's
  portable account system that lists Ma Earth as a partner (certified.app, read 25 October), and
  Bloom Network and Regen Network are "in conversation". The closing slide is a centered column:
  "Let's Grow Together", "From good intentions to green outcomes.", a smaller QR code (9px a
  module, still decoded by Core Image) and the beta link under it.
- **Notes.** Slide 13 takes 0:40 and slide 11 gives back 5 seconds, so the total stays 8:00. The
  claims list gains the G$ switch, the demo-data reminder, certificates, the Odunde spelling, the
  partner labels and the three gardens.
- **Brief.** Renamed in the title, header line and footers. About twenty links, underlined in a
  light green so a reader sees them: the site addresses, the sources, each partner, and the
  technical names on page 4 (every target returned 200 on 25 October). Captions under the
  screenshots, no demo-data line. "Money stays separate" became "Two kinds of reward" (G$ and
  vouchers, both carried by this season's promises). "Evidence so far" is in plain words with no
  test counts or chain names. Page 5 has four mechanism boxes, the certificate share described in
  words, and a tighter "How Green Goods earns" paragraph; page 6 has four places, Ma Earth "with
  Hypercerts Certified" (linked to certified.app), "in conversation" for Bloom and Regen, and an
  "Impact certificate" term. Pages 5 and 6 sit a little tighter
  (`.p5`, `.p6`) so the additions fit.
- **G$ rewards, the one claim to watch.** The deck and brief now say kept promises earn agreed
  rewards in G$. The G$ path is live and paid its first reward in August (claim C08), but creating
  new G$ reward promises in the app sits behind `SETTLEMENT_ENABLED = false` in
  `packages/shared/src/config/app.ts`, and the app tells members that sending them "is
  unavailable in this release". That switch must be on and deployed before the submission on 27 October; the notes'
  claims list says what to say until it is.
- **Facts checked.** Odunde Festival 2026, Leimert Park, 6 June, with masquerade performances and a
  language tent (LA event listings; the ledger's C50 spells it "Odun De"). Greenpill Kenya,
  AgroforestDAO (Lima Duarte, Minas Gerais) and Growecosystems (Rio Claro, São Paulo) are public
  gardens on greengoods.app; their pages do not show areas of work, so Kenya keeps agroforestry
  per Afo's 24 October call. "Nobody can buy a certificate through Green Goods" comes from the
  steward guide.

## Links, layout and the season · 26 October 2026

Applied from Afo's third review, given in chat on 26 October: a link check on the brief, a layout
fault on the architecture page, minimal links on the one-pagers, one Drive folder for all the
material, and an accuracy pass over the four documents.

- **Links in the brief.** Afo asked for the list before the edit and got it after; the links stay
  unless he strikes one. Tech and Sun was linked only in the Sources list, so its first mention
  on page 1 now links to techandsun.com, and Cosmo-Local Credit's first mention on page 1 links to
  its docs. Omo Yoruba of Southern California links to omoyorubaofsocal.org on page 5 and in the
  Sources; the site's own title and the GuideStar record (EIN 33-0763431) confirm it is the Los
  Angeles nonprofit, while omoyoruba.org is a different organization (Centro Cultural Omo Yoruba).
  The four gardens on page 6 link to their public pages (TAS Hub, Greenpill Kenya, AgroforestDAO,
  Growecosystems), and the Sources cite Tech and Sun's garden page for the season. Not linked, on
  purpose: the three networks on page 4, Sarafu Network, Greenpill Network, the event's site and
  Telegram. Of the 27 external targets across the brief and the one-pagers, 26 returned 200 on
  26 October; octant.app answered a scripted fetch with 403 (it returned 200 on 25 October and
  opens in a browser).
- **Links on the one-pagers.** Kept to the Green Goods site and docs, the pilot partner and the
  footer. The canvas links Tech and Sun, greengoods.app in Channels, docs.greengoods.app in the
  sources line, and the footer's address and site; the architecture links greengoods.app in the
  Public pages box, Tech and Sun and docs.greengoods.app in the status line, and the footer. Links
  are underlined in the brief's light green.
- **Architecture layout.** The services band's content (ten boxes, 178px) sat in a `1fr` grid row
  with `min-height: 0`, which gave it 169px, so the boxes spilled 9px into the Protocols band. The
  row is now `minmax(max-content, 1fr)`, the bands, boxes and row gap each lost a pixel, and the
  Certified chip is shorter so the chips keep to three lines; every band fits its content and the
  stack's foot aligns with the side column again. `submission/render.mjs` treats a band's
  overflow like a box's, so the fault would now fail the check.
- **The season.** Tech and Sun's public garden page (read 26 October) shows its first promise
  season, "Climate and Tech Education", open now and running to 31 January 2027, with one promise
  made and in progress. The brief called the season "planned" on pages 1 and 6 and note 15 said so
  on slide 15; all three now say it is open, with the pilot's first voucher services as what comes
  next. The notes' claims list carries the fact and the date.
- **Accuracy pass.** Page 1 no longer says funders "pay ... plus a share": the fee is theirs to
  pay and the share comes out of endowment earnings, so they are two sentences, in the notes'
  words. Page 3 no longer says this season's promises carry both rewards: they carry G$ rewards
  (Afo's call), and service vouchers join them as the pilot's first services are agreed, since no
  member holds a voucher yet. The canvas and the architecture no longer credit "Hypercerts
  Certified" with the certificates: certificates are Hypercerts, and Certified is the publishing
  path to Ma Earth, as the brief already said. The canvas lede says communities and individual
  supporters "never pay a fee" rather than "never do", since the endowment share is income without
  being a fee. The architecture marks the partner surfaces "next" and opens "Five roles, five
  surfaces, one set of Green Goods services" instead of saying the roles use the partner surfaces.
  A read-through of the deck, the notes, the brief and the one-pagers against the claims list
  found nothing else to change.
- **One Drive folder.** `Green Goods/Growth/SF.Live 2026` (folder id
  `1c3RmsLctTC3NI1G9dB3Ecq0SEtiwHmid`) holds all nine files: the deck, the brief, the canvas and
  the architecture as HTML and PDF, and the clickable demo. The Drive connector's `update_file`
  cannot change a parent inside the shared drive ("The caller does not have permission"), so the
  files were moved through the desktop mount, which keeps their ids and links (checked on the first
  file before the rest moved). The older Google Docs conversion of the deck stays loose in Growth;
  it is not this work's file.
- **Indexer coverage (review, 26 October).** The architecture's indexer box said it reads every
  network and brief page 4 said it reads "the chains", but `packages/indexer/config.yaml` lists
  Arbitrum One, Sepolia and Celo only, and no tracked file binds it to the Gnosis addresses (the
  status refresh above). Both now say Arbitrum One and Celo today, Gnosis next.
- **The demo, rebuilt.** Later on 26 October the side session rebuilt the demo as four full flows
  on the current app (37 screens, an "All flows" button on every screen, each flow ending in the
  next), carried this branch's review hardening into the rebuild and replaced the Drive copy and
  the artifact; merged here as `1ec8dd1af`, taking its side for `demo/**`. Its UI review lists four
  app gaps (the reward never shows at take-up; a course promise is confirmed with "Did the help
  arrive?" and "1 certificates"; "Delivered Duration (min) (min)"; a no-promise message that reads
  like an error), which a separate session on `develop` is taking up.
- **The demo.** The side session's `c0fc53dc5` grounds the four flows in the hub's real season,
  request, form and photos, with invented names; merged here as `b3197abfe`, keeping the
  `--only` validation and the last-screen focus restore, rebuilt from its 22 captures (the check
  exits 0) and copied to the Drive folder. Its UI review's new top finding is for Afo: the real
  request pays $20, and neither the request page nor the take-up sheet shows a reward.

## The critique pass · 26 October 2026

Applied at Afo's request on 26 October from four AI-generated audio critiques, one each for the
deck, the brief, the canvas and the architecture. The points that held went in; the ones built on
misreadings, or that would add errors, did not.

- **Real screens on slide 6.** The deck critic read the Storybook fixture garden as real ("a
  fence repair at Riverside Commons"), and the pair also showed raw addresses and proof that
  "cannot be shown right now". Slide 6 and the brief's second page now show the hub's Promises
  sheet and its confirm sheet with the course proof, copied from the demo's capture into the
  deck's own screens so a demo rebuild cannot change them; `deck/capture-screens.mjs` retired
  with the Storybook pair, so the Storybook outage no longer blocks the deck.
- **The confirmation rule as a headline.** Slide 3 carries it as a second headline under the
  title, "Confirmed by the people it served, never by the people who did the work.", since a
  title with the clause ran past the deck's two-line limit. The brief's opening now says the
  people a promise served confirm it was kept, never the people who did the work, and the same
  sentence left "What we built". The architecture's first rule is set in bold.
- **Behavior before protocol.** Slide 7's title is "Members trade services with vouchers: an hour
  of help for a career call", with Cosmo-Local Credit in its lede, and the brief's vouchers page
  opens the same way. "Escrow" leaves the slide and that page and stays on the architecture page.
- **One ask.** Slide 17 asks only for introductions to funders piloting allocation tools. The
  brief keeps all three needs, introductions first.
- **The architecture's reasons.** Its lede ties the record to Problem Statement 2's own words:
  commitments and histories made visible for fair finance, mutual credit and better
  coordination. Each network's label names why it is there: Celo is the home of G$ (canonical
  G$, per the builders' architecture page), Arbitrum One the home of Green Goods, and Gnosis the
  home of Cosmo-Local (its published deployment table). To fit, Arbitrum's job reads "Record
  and capital", the lede's last sentence went (Data in and Data out say it), and the last rule
  says "their approval".
- **The canvas's bridge and scale.** "Usable offline" now says captured work waits on the phone
  and uploads as a signed record once back online (the gardener sends it with Upload all, per the
  builders' architecture page). The cost block says setup comes once per garden, so later seasons
  cost less, and the endowment share grows with capital, not staff hours.
- **Not applied.** "Tokenomics", "trustless" and a "time bank" analogy, which misdescribe vouchers
  and confirmation; quantified savings, which the pilot has not measured; tier prices, which need
  reviewed inputs; and the critics' generic network reasons. The notes' claims heading moved to 26
  October, closing a review nit on two readings taken that day.

## The rebuild · 24 October 2026

Superseded in part by the revision above. Applied from Afo's review and two rounds of questions;
the round-2 samples (three-line title, circular loop, converging-inflow rings) were approved and
reproduced exactly.

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

## Readiness evidence · 25 October 2026

Rendered proof is **headless Playwright Chromium 148, clean profile, file URLs**. Neither
artifact has an authenticated surface, so authenticated Brave proof does not apply.

- **Deck:** source checks pass (18 slides, 18 notes, 8:00, no em dashes). After the final polish
  all 18 slides, the contact sheet and the 18-page PDF were rendered with a clean probe, now
  including the layout-box check and the `pdftotext` word-position check, and slides 1, 3, 6, 8,
  12, 13, 14, 15 and 18 were inspected, with PDF pages 1 and 6 read as pages. In print mode every
  slide is one 1920 x 1080 page. In screen mode `End`, `Home`, the arrow keys, number keys, `#15`
  deep links, the notes panel and the progress line work.
- **QR code:** Core Image's QR detector decodes the rendered closing slide, at its smaller size, to
  `https://beta.greengoods.app`; the beta home loaded in headless Chromium.
- **Brief:** six A4 pages rendered to PDF and PNG with a clean probe after the final polish, and
  pages 2, 3, 5 and 6 inspected (pages 1 and 4 changed only in the footer line, a link and one
  evidence-table phrase).
- **Links:** the 25 addresses the brief links or cites returned HTTP 200 on 25 October.
- **Screens:** the two Storybook screens were re-captured at 09:23 UTC on 25 October. The live
  garden page is no longer shown.
- **Chain state:** the deployment facts in the notes and brief rest on public RPC reads at 09:28
  UTC on 25 October, recorded in the [status refresh](#status-refresh--25-october-2026).
- **Arithmetic:** the program figures are unchanged, so the rebuild's 15 recomputed checks still
  cover them. The one new headline figure, $22.1bn, matches the World Bank's $22,126,757,545 for
  2024 as read on 25 October.
- **Pacing:** every note runs between 125 and 158 words a minute.
- **Copy:** no em dashes, US spelling, lowercase roles in running text, "promise" in user-facing
  copy, no hand-typed garden counts, every financial example labeled illustrative, no chain names
  on slides.

## Unresolved presentation inputs

0. **The G$ switch.** The deck and brief say kept promises earn agreed rewards in G$. New G$ reward
   promises are gated by `SETTLEMENT_ENABLED = false` in `packages/shared/src/config/app.ts`; it
   must be on and deployed before the materials are submitted on Tuesday 27 October, not only
   before the pitch: a submitted PDF has no presenter to add the fallback. Until then the claims
   list's fallback wording covers anything spoken.
   The ledger's C91 (proposed in the evidence note) should record whichever is true on the day.
1. **Claim sources.** The deck follows the claim ledger's 23 October addendum, the event research
   note and the live-pilot handoff. If one of them is missing from `../research/` or `../handoffs/`,
   it has not landed from the Cosmo-Local contracts work yet; read the current copy on `develop`. On
   25 October the handoff ended before the 24 October deployment; the status refresh above holds
   the chain evidence until the handoff and the ledger record it.
2. **Ledger owner's updates.** C01 should describe Tech and Sun as an initiative building
   solar-powered hubs, with the Awka hub live and Enugu and Abuja as its site's next locations.
   C48 should drop the fiscal-sponsor role and keep Omo Yoruba as the first diaspora community.
   For C05, techandsun.com's founder line reads "Tech and Sun Initiative"; confirm whether that is
   the registered string before using it anywhere. The
   [evidence note](../research/diaspora-evidence-pass-2026-10-25.md#proposed-ledger-row-changes)
   proposes changes to C33, C37 to C40, C47 and C48, retires the African Development Bank figure,
   adds C90 to C94, and asks for the addendum's reused IDs (C68 to C80) to be renumbered. C50
   should spell the festival "Odunde". Kenya's area of work on the roadmap (agroforestry) rests on
   Afo's 24 October call, since Greenpill Kenya's garden page does not show one.
3. **Nsukka.** The Greenpill Nigeria round page names the University of Nigeria, Nsukka, as a
   second university; techandsun.com does not. Nothing mentions it until Afo confirms.
4. **Omo Yoruba facts.** Its founding year, exemption history, California charity registration,
   gift method and board approval for any role are unconfirmed; the slides say only "a Yoruba
   community nonprofit in Los Angeles".
5. **Status refresh before submission.** Done on 25 October: the voucher contracts are deployed
   and switched on, not yet used; the slides keep "in pilot", and since 26 October slide 7 also says
   "deployed on public networks" and "rehearsed end to end with demo accounts". Re-check the
   [live-pilot handoff](../handoffs/codex-live-pilot-deployment.md) on 27 October (in this tree since
   the 26 October merge of `develop`) and the [status refresh](#status-refresh--25-october-2026)
   above, which holds the chain evidence the handoff still lacks. If either records
   a real member's booking through the app, the notes' claims list, which says what to say on
   slide 7, and brief pages 1, 3, 4 and 6 may move from "deployed" to "live"; if not, leave them.
   Remittance Prices Worldwide had no quarter after Q3 2025 on 25 October. On 26 October the hub's
   garden page showed its first promise season, "Climate and Tech Education", open from 10 October
   2026 to 31 January 2027 with one promise in progress; the brief (pages 1 and 6) and note 15 say
   "open", never "planned".
6. **Slot length.** Settled: the submission brief says to plan for eight minutes a team, which
   the notes run; the five-minute cut stays as a fallback.
7. **Cohort facts.** Participants, services, capacity, prices and rewards; a first sponsor; the
   gift method (the Omo Yoruba donate page has no payment form).
8. **Live counts.** No slide shows the live garden page any more, so nothing needs re-capturing
   before presenting; the Storybook screens show demo data.
9. **Recorded clip.** The stretch-goal clip of the rehearsed voucher flow was not made; the notes
   say where it would go. Afo plans a walkthrough video for the submission; the clickable demo
   is its path.
12. **Event data sets.** "Use of data sets" is a judging criterion, and the event's Teams folder
    holds an open public data catalogue and an API dataset ranking that were not available here.
    The canvas and architecture cite the sets the pitch uses (the garden record, World Bank WDI,
    Remittance Prices Worldwide, ACS and ONS); map them to the event's catalogue once it is to hand.
13. **Endowment share routing.** The materials say the protocol's share of endowment earnings is
    "being switched on". The deployed splitter routes that leg to a Juicebox project when one is
    configured and otherwise to the garden's treasury (`_routeToJuicebox` in `Yield.sol`), so
    switching it on means configuring a Juicebox project or changing the fallback. A product
    decision and a contracts change, outside this pitch work.
10. **Member-proof timestamp.** The claim ledger's C89 cites 01:17:19 UTC on 24 October; the proof
    record says its tests completed at 01:08:44 UTC and it was written at 02:09:22 UTC. The ledger
    line is the ledger owner's to reconcile; the deck states no time of day.
11. **Fonts offline.** Fraunces and Inter load from Google Fonts. Vendoring the OFL files would
    remove that dependency; it needs a download this task did not authorize. The PDFs embed both.

## Task record · critique pass

Task record: SF.Live critique pass, six pre-submission updates | Type: documentation/design |
Outcome: complete locally; the six updates Afo approved are in, and the critics' other points are
recorded under "Not applied" | Agent/model: Claude Code / Claude Fable 5.1 and Claude Opus 5.5 |
Coverage: deck, notes, brief, both one-pagers and this README, from `66d96adb3`

| Phase | Start → end (UTC, 26 to 27 October 2026) | Result / evidence |
|---|---|---|
| investigate | ~23:55 → ~00:15 | Four audio critiques transcribed on-device; each claim checked against the four documents, the plan's spec, the brand voice page and the builders' architecture page |
| implement | ~00:15 → ~00:30 | Slide 6 and brief page 2 screens, slide 3 rule line, slide 7 and brief page 3 openings, slide 17's one ask, the architecture's lede and network labels, the canvas's offline and scale lines; the Storybook capture script removed |
| verify | ~00:25 → ~00:40 | Deck, brief and submission renders exit 0 after fixing a three-line headline and two small overflows; changed slides and pages inspected as PNGs |

Human corrections: 0.

## Task record · links and layout

Task record: SF.Live links, architecture layout, season status and one Drive folder | Type:
documentation/design | Outcome: complete locally; the brief's links stay unless Afo strikes one
Agent/model: Claude Code / Claude Fable 5.1 | Coverage: brief, notes, both one-pagers, their render
script, the demo merge and this README, from `dfc40cc56`

| Phase | Start → end (UTC, 26 October 2026) | Result / evidence |
|---|---|---|
| investigate | ~06:30 → ~06:50 | Every link in the four documents listed; the Omo Yoruba site found and told apart from a namesake; the architecture bands measured (services band 9px over); the hub's garden page read for the season |
| implement | ~06:50 → ~07:10 | Links added; band row, padding and chip fixed; season, revenue and reward sentences corrected; Hypercerts naming aligned; `.band` added to the overflow check; demo merge resolved by hand |
| verify | ~07:00 → ~07:15 | Deck, brief and submission renders exit 0; bands re-measured (no overflow, bottoms aligned); 26 of 27 link targets return 200; demo build and check pass |
| deliver | ~07:05 → ~07:20 | Nine Drive files moved into `SF.Live 2026` with their ids kept, then overwritten with the new builds |

Human corrections: 1 (Afo asked for the link list before the edit; it was shown after, with the links left for him to strike).

## Task record · final polish

Task record: SF.Live pitch final polish after Afo's second review | Type: documentation/design |
Outcome: complete locally; the G$ switch and the inputs above wait on Afo
Agent/model: Claude Code / Claude Fable 5.1 | Coverage: deck, notes, brief, render and capture
scripts and this README, from `7ff3e82ed`

| Phase | Start → end (UTC, 25 October 2026) | Result / evidence |
|---|---|---|
| investigate | unknown → unknown | Title-slide PDF cut-off reproduced in both PDFs; gardens listed from greengoods.app; festival name, link targets and the G$ gate checked; outline and four decisions agreed with Afo |
| implement | unknown → unknown | Slides 1, 3, 6, 8, 11 to 16 and 18 edited; notes and claims list rewritten; brief renamed, linked and re-fitted; render checks extended; live-page capture retired |
| verify | unknown → unknown | Deck and brief renders exit 0 with the new checks; slides and pages inspected; QR decoded |
| follow-up | unknown → unknown | "Let's Grow Together" closing, Hypercerts Certified with Ma Earth, three-line exchange pool and certificates text; renders exit 0 |

Human corrections: 0 observed in this segment (the review itself was the request); attention unknown.

## Task record · status refresh

Task record: SF.Live pitch status refresh before submission | Type: documentation |
Outcome: complete locally; the 27 October re-check and the push wait on Afo
Agent/model: Claude Code / Claude Fable 5.1 | Coverage: the notes' claims list, brief pages 1, 3,
4 and 6, this README, local photos and screens, on branch `claude/peaceful-curran-fbf867` from
`e1b65cf1a`

| Phase | Start → end (UTC, 25 October 2026) | Result / evidence |
|---|---|---|
| investigate | unknown → 09:31 | Handoff, deployment artifacts and chain state read; Remittance Prices Worldwide read in the browser pane; photos placed; screens re-captured at 09:23 |
| implement | 09:31 → 09:36 | Claims list, brief status lines and evidence box, page 6 fix, README |
| verify | 09:34 → 09:36 | Deck render exit 0; brief render exit 0 after the page 6 fix; changed pages and photo slides inspected |

Human corrections: 0 observed in this segment; attention unknown.

## Task record · 18-slide revision

Task record: SF.Live pitch revision after the 25 October review | Type: documentation/design |
Outcome: complete locally; the inputs above wait on Afo
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: the pitch artifacts in this folder and
local images, on branch `claude/sf-live-pitch-polish-a689a5`

| Phase | Start → end (UTC, 25 October 2026) | Result / evidence |
|---|---|---|
| investigate | unknown → unknown | Review, deck, notes, brief and scripts read; photos placed; screens re-captured; techandsun.com, partner sites, the beta and `ConfirmLib.sol` checked |
| implement | unknown → unknown | Slides restructured and rewritten, map and QR generated, notes rewritten and synced, brief revised |
| verify/review | unknown → 04:01:57 | Deck and brief renders exit 0; every slide, the new PDF pages and every brief page inspected; QR decoded; navigation probed |

Human corrections: 0 observed in this segment; attention unknown. Phase boundaries before the
final render were not recorded.

## Task record · evidence pass and completion

Task record: SF.Live pitch completion after the RESR-94 evidence pass | Type: documentation |
Outcome: complete locally; the inputs above wait on Afo or the 27 October refresh
Agent/model: Claude Code / Claude Opus 5.5 | Coverage: merging the research session's two commits
(`692f25e9f`, `46da6af29`) and completing the deck, notes, brief and README; the research itself
has its own record in the evidence note

| Phase | Start → end (UTC, 25 October 2026) | Result / evidence |
|---|---|---|
| investigate | unknown → unknown | Research session's report, transcript and diff read; Afo's choices collected (merge and push, Q&A lines 8, 9 and 11, `contact@greengoods.app`) |
| implement | unknown → 09:01:28 | Research commits fast-forwarded; Q&A context added; brief contact and rewards wording aligned; screens re-captured |
| verify | 09:01:28 → unknown | Deck and brief renders exit 0; slides 8, 11, 12 and 13 and every brief page inspected |

Human corrections: 0 observed in this segment; attention unknown.

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
