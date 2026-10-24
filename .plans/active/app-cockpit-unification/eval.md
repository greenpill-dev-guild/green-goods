# One Look for the App and the Cockpit — Evaluation

**Status:** acceptance criteria follow the locked picks; the design gate for the token slices ran on 2026-10-20 ([below](#design-gate-for-the-token-slices)); step 2's proof ran on 2026-10-23 ([below](#step-2-proof-ground-and-dark-ladder)); the design gate for the count badge (step 4) ran and was approved on 2026-10-23 ([below](#design-gate-for-the-count-badge)); acceptance pass 1 ran on 2026-10-24 ([below](#acceptance-pass-1)); the product validation round is pending.

## Product validation

Compare the released surfaces with the accepted design using the same routes and content. Start with
a small formative round: a steward who also submits work as a gardener, and a gardener who has never
opened the cockpit. This is qualitative design validation, not a measured improvement claim. The
maintainer set the round after slices land: its findings become follow-ups, and no slice waits on
it.

Observe whether participants can:

- Tell which surface they are in within a second of opening it.
- Recognise a tab row, a status badge, a count badge and a work item as the same object on both.
- Find and use the filter on a list in each surface. The two controls differ by choice (the F9 pick),
  so watch whether that costs a steward who uses both.
- Read a card list in the cockpit's dark theme without losing where one card ends.

Visual preference alone is not acceptance. Record wrong turns and hesitation, not opinions.

## Acceptance matrix

| ID | Case | Required proof |
|---|---|---|
| A1 | No layout or flow change | Route structure, element order and every flow's steps match `develop` on both surfaces; only look and shared elements differ. |
| A2 | Typeface (F1) | One family on both surfaces; no clipped, wrapped or truncated label that fitted before, in English, Spanish and Portuguese at 320, 360 and 390px; the static loading screen matches. |
| A3 | Ground (F2) | Canvas and cards match the accepted values in light and dark on both surfaces; green text and marks keep their contrast floor on the new ground. |
| A4 | Control boundary and focus (F3) | Secondary buttons, chips and fields have a 3:1 boundary in both themes; one focus-ring role shows on every control family, in the app's green in the app and the workspace tone in the cockpit. |
| A5 | Chips (F4); filter kept per surface (F9) | One chip shape and selected treatment on both; each surface's filter control works as it does today by pointer and keyboard; Pending and Approved remain inline scopes of one list in the cockpit (DL-082). |
| A6 | Tabs (F8, DL-100) | Equal-width cells on both surfaces, none narrower than its own label, icon and count, so no label clips; the selected tab is exposed to assistive technology as it is today on each surface; from 640px the cockpit's row is at most 180px per tab and aligns left, and a cell wider than 180px holds a label that needs it (one today: Spanish "Configuración de medios", 191px). On phones a cockpit row that cannot hold its cells scrolls, the measured deviation DL-100 records: the Hub, Actions and Submit Work's chooser at 320 and 390px, Community in the protocol garden at 320px and in Portuguese at 390px, and the Create Action instructions at 320px. Every other row fills the width with every Spanish and Portuguese label whole at 320px. |
| A7 | Count badge (F10) | One badge on the app's bar, launchers, filter and tabs and on the cockpit's tabs; 9+, 99+ and single digits fit; the badge keeps the action contrast pair (DL-017). |
| A8 | Cards, rows and lists (F7, F11) | The app's card on both surfaces (24px, a visible edge) and its work row on phones; a visible card edge in both themes; a 12px gap on every list; the status edge on both surfaces. |
| A9 | Desktop work card (F12) | The mosaic renders for no photo, one, two, and three or more photos, with its domain and count chips; phone widths keep the accepted phone layout. |
| A10 | Dark cards (F13) | A card is distinguishable from the canvas in the cockpit's dark theme without a zoomed screenshot; chips and wells on a card remain distinguishable from the card. |
| A11 | Sheets (F5) and the bar's active pill (F6) | The cockpit's phone sheet uses the shared surface and header; open, close, focus return and Back behave as before; both bars show a pill behind the active icon, green in the app and the workspace tone in the cockpit; the app's bar stays solid. |
| A12 | Each surface keeps its own | Density, hit areas, button corners, the filter control, workspace tone, motion and navigation chrome are unchanged on each surface. |
| A13 | The public website | No visual change on public routes unless a fork names one. |
| A14 | Empty, loading and error states | One anatomy on both surfaces in two sizes; each state keeps its copy and its actions; nothing reachable from a state today is lost. |
| A15 | Type role names | Both surfaces name their type roles title, body, label and meta; each role keeps its size on each surface; no Material role name remains in the cockpit's views or guides. |
| A16 | Glass | The design guide describes solid surfaces and the cockpit's one translucent dock; the five-thickness material spec is gone and nothing rendered changes. |
| A17 | Card shapes | Shared holds one card surface and the four shapes, each at two densities; every object card in scope is built from them; no card primitive is left without a consumer. |
| A18 | One home per object | Each object's card code lives in one place; no two card components share a name; every new Shared path is a deliberate export. |
| A19 | Cockpit controls | For each migrated family, the cockpit renders only the shared controls; density, hit areas, pill corners and the tone budget are unchanged; Rules 15 and 18 and the wrapper-adoption sweep describe the new direction. For dialogs and sheets, `AdminDialog`'s Radix shell is DL-117's recorded exception: it renders the shared header and action bar inside its own surface. |
| A20 | Detail lines | Every item row's detail line stays on one line at 320, 360 and 390px in English, Spanish and Portuguese; each card type shows its details in the accepted order, and a detail that does not fit drops whole; an age is always a number. |
| A21 | One height | Every card in a list is the same height on both surfaces, in every state, action and language; the pill under the title never makes a row grow. |
| A22 | One pill per card | A card shows one pill, its status; an error, a retry or a pending state replaces it, feedback is a detail, and the photo count sits on the photo. |
| A23 | Field messages (F3) | Fields reserve two message lines in the app and in the cockpit (DL-105, since 6 of the cockpit's 32 messages under side-by-side fields wrap at 640px); a message that fits the reserve never moves the form, and a longer one grows the slot rather than scrolling; the longest Spanish and Portuguese cockpit messages are measured in two-column forms at 640px. |

## Acceptance pass 1

Run on 2026-10-24 against `develop` `8476dbd80`: steps 1 to 19, 21 and 12, and step 20's phases 3
and 4. Phase 1 (buttons, #1256), phase 2 (fields and chips, #1255) and the rename pass had not
landed, so their families are rechecked when they merge. Every frame is headless Chromium
(Playwright) at device scale 2, measured in the DOM: clipped and truncated text, tab cells, count
badges, card heights, gaps, corners and edges, each card against its ground, pills per card, detail
lines, ages, state blocks, the bars' pills, translucent surfaces and sideways scroll.

- **mock-auth localhost** (Arbitrum One, production indexer, `?mockAuth=deployer`): the app's Home,
  a garden's four tabs and Profile, and the cockpit's Hub, Garden, Community and Actions with every
  tab, at 320, 360, 390, 768 and 1280px, in English, Spanish and Portuguese in light and English in
  dark: 460 measured frames. The cockpit's Cookies route rendered nothing within four minutes in two
  runs and is unverified.
- **Storybook**: 30 catalog stories (the work card's mosaic, the tab rail, the item, person,
  commitment and garden rows, the media and work cards, field messages, sheets and dialogs, count
  badges and the state block) at the same widths in light and dark: 300 frames.
- **localhost, signed out**: five public routes against the tree before step 1 (`870600083`), at
  390 and 1280px in light and dark.
- A read-only code audit covered A15 to A19.
- **Pending:** authenticated Brave for wallet and passkey signing, the queue and offline uploads, and
  installed-PWA behavior (the static loading screen, safe areas, the bar under a sheet). Keyboard
  behavior rests on the stories' plays in CI.

| ID | Pass 1 | Evidence and findings |
|---|---|---|
| A1 | no change found | Routes, element order and flows matched on every walked screen. A full flow comparison with the tree before step 1 ran only for the public website (A13). |
| A2 | fails in es/pt at 320 to 360px | One family on both surfaces. The cockpit's vault row cuts its status pill in Spanish and Portuguese ("Depósitos desha…"). Titles truncate by design. The static loading screen is pending. |
| A3 | passes | Canvas 250 248 245 in light and 17 12 8 in dark on both surfaces, under white cards and the lifted dark card (DL-097). |
| A4 | carried | Not re-measured; DL-098's proof stands. |
| A5 | passes by pointer | One chip shape and selected fill. The Hub's Pending and Approved stay inline, and the app's filter keeps its launcher and count. |
| A6 | passes | From 640px no cockpit cell is wider than 180px and every row starts at the left. No label clips, and a cell grows past its share only when its label needs it. Hub, Community and Actions scroll at 320 and 360px, as DL-100 records. |
| A7 | passes | Every badge is 16px tall and at least 16px wide, with 11px numerals and at least 4.5:1. |
| A8 | passes | 24px cards with a 1px edge on both surfaces, 16px rows, and 12px between items of one kind. |
| A9 | passes | The mosaic renders none to four photos with its domain and count, wide and stacked; phones keep the row. |
| A10 | passes | Card against canvas: 1.26:1 in dark, and 1.06:1 plus the hairline in light, on both surfaces. Chips and wells read on cards. |
| A11 | passes as rendered | The app's bar is solid under the green pill and the cockpit's dock is translucent under the tone pill; sheets render the shared header. Focus return and Back rest on CI plays; installed-PWA behavior is pending. |
| A12 | passes, one note | Density, corners, filters, tone and chrome stay each surface's own. The confirm and reason dialogs' 40px buttons differ from the cockpit's 32px default until phase 3's call-site pass. |
| A13 | passes | Public routes match the tree before step 1 in type, buttons, color and layout. Only copy merged meanwhile differs (garden casing, "vault"). |
| A14 | failed on `develop`, fixed | Four rules in the cockpit's `index.css`, older than the block, drew every cockpit state at a 72px tile, a 22px title and a 16px line. They are removed in pass 1's pull request: 56px, 16px and 14px, as DL-106 sets. |
| A15 | partial | No Material class remains in the cockpit's views. Material type tokens still set sizes in CSS, their names remain in comments, the DesignMD keys still read `body-md` and `label-md`, and the app uses raw sizes, as the client prompt contract defers. |
| A16 | passes, with residue | The guides describe solid surfaces and the one dock, and no route renders glass besides the dock. Unused translucent CSS and Storybook-only `glass-surface` remain. |
| A17 | partial | Cockpit sections and rows in hypercert detail, the signal pool, campaign settings, vault history, garden metadata and the confirm queue draw raised 16px or 12px cards off `.gg-card`. `WorkbenchCard` is not built from a shape, and a few primitives have no consumer. |
| A18 | partial | Assessment rows are built in four places and hypercert rows in three, and each app builds its own garden jar row. |
| A19 | partial | Dialogs render the shared header and actions, with the Radix shell as DL-117's exception. Buttons and fields await phases 1 and 2, whose guides already read in the present tense. |
| A20 | passes | No item row shows a detail in part, in any language at 320 to 390px, and no age is written in words. Older than the unification: the pool's Review Promises row cuts its age to "1 w…" at 360 and 390px. |
| A21 | fails in Actions | At 320px an action card whose capitals chip wraps is 224px beside 194px. Home's off-screen garden cards held the old 182px placeholder against 174px drawn; fixed in pass 1's pull request. |
| A22 | partial | The pool's season, status and funding cards each carry two pills, and action cards set two detail chips beside their status. |
| A23 | carried | The field stories hold the two-line reserve. The two-column measures wait for phase 2. |

## Guards the work trips

These checks will fail or need an explicit update. Each failure is intended; none is worked around.

- [check-tokens.sh](../../../scripts/design/check-tokens.sh): token presence, the cockpit's raw-token
  sweep and the token version coupling. Its wrapper-adoption sweep fails shared fields, raw buttons
  and legacy cards in the cockpit, with a burn-down baseline in
  [design-token-usage-baseline.tsv](../../../scripts/data/design-token-usage-baseline.tsv); step 20
  turns it around one control family at a time.
- [Rules 15 and 18](../../../.claude/rules/frontend-design.md): the cockpit's field family and its
  "AdminButton only" invariant. Step 20 rewrites the parts it reverses; step 13 the rest of Rule 18.
- [md-generate.mjs](../../../scripts/design/md-generate.mjs): the generated design files and the
  app's token audit go stale when a token or a line number moves.
- [AdminDensityScale.guard.test.tsx](../../../packages/admin/src/__tests__/components/AdminDensityScale.guard.test.tsx):
  pins the cockpit's shared-family token block and its Storybook mirror.
- [typographyLayer.guard.test.ts](../../../packages/client/src/__tests__/styles/typographyLayer.guard.test.ts)
  and [bootFallbackGeometry.test.ts](../../../packages/client/src/__tests__/bootFallbackGeometry.test.ts):
  the app's type layer and its static loading screen.
- The Storybook design-system pages grade every specimen against
  [rules.ts](../../../packages/shared/.storybook/design-system/rules.ts); new faces and corners show
  there as failures until the expectations move.
- [banned-vocabulary.json](../../../scripts/data/banned-vocabulary.json): the client prompt list names
  the cockpit's face as a term to avoid; F1 changes that list and the glossary generated from it.
- The decision log needs a row for every accepted fork, naming the decision it supersedes, and one
  for the retired Material 3 rule. The cockpit's guide and prompt contract cite that rule today and
  are rewritten with it.

## Verification posture for future implementation

Select proof with `bun run check --plan -- --intent qa` against the changed surfaces. Token and style
steps prove themselves with rendered pairs and the guards above. Steps that change a component's
structure (tabs, the work card, the cockpit's phone sheet, empty states) also need focused behaviour
proof at the owning component. Do not add tests that only mirror markup.

A pick locks on a pair of the lab's ten screens, rendered from the real components at 390, 768 and
1280px, in light and dark, with Spanish and Portuguese wherever text must fit. Every other route
gets its own pair before a rule rolls out to it. The screens are listed in
[spec.md](spec.md#direction-accepted-in-principle).

Rendered results name their evidence class: authenticated Brave, mock-auth localhost, Storybook, or
CI Playwright. The design lab is a mock and belongs to none of those classes. Installed-PWA
behaviour (the static loading screen, safe areas, the bar under a sheet) needs the repository's
authenticated-session path; note anything unreachable as unverified.

## Hub creation check

Checked on 2026-10-10 against the files in this hub:

- `node scripts/harness/plan-hub.mjs validate` reported `Validated 27 feature hubs.` and exited 0.
- A focused read-only check resolved all 90 local Markdown links, images and anchors in this hub.
- `status.json` passed the Biome formatter check with no fixes. Markdown is outside Biome's
  formatter coverage, so the documents rely on the link check and `git diff --check`, which was
  clean.
- `node scripts/quality/check-guidance-links.mjs` passed, and
  `node scripts/quality/check-immutable-plan-reports.mjs` passed against `origin/develop`. This hub
  adds no dated report.
- The design lab was opened from the file in headless Chromium (Playwright, 1680×900) in sixteen
  control states covering every screen, both themes, all three stages and an open sheet. It raised
  no script error and no horizontal overflow, and the card surface, border and shadow changed with
  F7 and F13 as intended. That is a check of the mock, not rendered proof of either application.

## Lab layout check

Checked on 2026-10-10 after the lab's layout changed to three frames above a controls dock. Each
run opened the file in headless Chromium (Playwright):

- Twelve window sizes from 390×844 to 2560×1300, in both arrangements and all three stages, 26
  cases in all. In every case wider than a phone the frames shared one scale, stayed clear of each
  other and of the controls, and every control sat inside the window without scrolling the dock. The
  rail scrolls only in a window shorter than 800px. At 1440×900 all three frames draw at 66%; the
  layout this replaces drew the phones at 62% and the desktop at 45%, with 21 of its 51 controls
  below the fold of the rail.
- The sixteen control states again, at 1680×900: no script error, no horizontal overflow, and the
  card surface, border and shadow still answer F7 and F13. The cockpit's dark card computed to
  `#201913` with a 6% ring today and to `#2A231C` with an 8% ring one step up, as the specification
  states.
- The dock stayed inside the window at seven scroll positions. Fit to window, the option hints, the
  presets, both arrangements, a reload, keyboard use and a phone-width window behaved as described
  in the [artifacts README](artifacts/README.md).
- Copy picks produced the same line by each of its three routes: the clipboard, the older copy
  command when the clipboard refuses, and the selected text field when both refuse.

## Card census check

Checked on 2026-10-17 when the card census was added:

- All 45 stories it shows rendered from the deployed Storybook (built 18 October) without a page
  error, and each capture was checked for an error or empty state in its rendered text.
- In headless Chromium (Playwright) at 1440×900 and 390×844, in light and dark: no console error and
  no horizontal overflow. A shape dial, an object option, Copy picks (clipboard route) and the full
  size view all worked.
- The card tweaker's live preview, added after the first review found no visible preview while
  turning a dial: at 1440×900, 1180×820 and 390×844 the preview stayed in the window, followed the
  section in view, changed with a dial and with the density switch, and Reset and Copy picks
  worked from the visible buttons.
- In the published artifact, opened in the in-app browser: the main page's link opens the census,
  the captures load, the dials change the proposed cards and the tweaker's preview, and the census
  links back.

## Card census, second round

Checked on 2026-10-17 after the maintainer asked for status and title-line layouts and for the
census to follow the lab's design system:

- In headless Chromium (Playwright) at 1440×900, 1180×820 and 390×844: no console error and no
  horizontal overflow. With nothing saved, the census used the recorded picks. With a different lab
  state saved, it followed that state, listed the differences and restored the recorded picks from
  its button. Writing a fork kept the lab's own settings, and choosing a dark-card option switched
  both the lab and the census to dark, as the lab does.
- The five status layouts rendered side by side. Every layout but the corner gave the title the
  full width of the row's text column; the corner left it 48 to 70 percent, least on the commitment
  that needs you. A title-lines switch applied everywhere
  the type appears, the clicked control stayed in place, keyboard focus stayed on it, and the
  tweaker's preview followed the section in view.
- Titles cut off, of five, at the app's density in a 390px column:

  | Layout | English | Long English | Spanish | Portuguese |
  |---|---|---|---|---|
  | In the corner (today) | 1 | 5 | 3 | 3 |
  | Under the title, on the photo, with the details, above the title | 0 | 5 | 1 | 1 |

  At 356px, the column width on a 390px phone, the corner layout cut 3 English titles and the
  others none. The single Spanish and Portuguese cut in the other layouts is the jar name on its
  one line. Every layout cuts the long English titles at two lines.
- The published artifact, version 12: the served `census.html` matched the build byte for byte, and
  the main page's link opened it in the in-app browser with the lab's saved state applied.

## Card census, detail-line rules

Checked on 2026-10-18 after the maintainer asked for the agreed detail-line rules in the census
(version 14, built on version 13):

- In headless Chromium (Playwright) at 1440×900, 1180×820 and 390×844: no console error and no
  horizontal overflow, and under the rules no row carries more than two details. Each type showed
  its details in the spec's order, ages read "2 hr. ago", "hace 2 h" and "há 2 h", the app's
  promise rows had no button, the cockpit's row that needs the reader showed Confirm below the text
  while a confirming row showed no action, and Before reproduced version 13's line.
- Details dropped or shortened on the row cards, at the app's density in a 390px tile:

  | Detail line | English | Long English | Spanish | Portuguese |
  |---|---|---|---|---|
  | Before the rules | 6 of 24 | 6 of 24 | 9 of 24 | 11 of 24 |
  | With the rules | 2 of 18 | 2 of 18 | 4 of 18 | 5 of 18 |

  What remains is mostly the jar rows: the amount on the right leaves their detail line 150 to
  200px, so they drop their second detail in every language and shorten their first in Spanish and
  Portuguese. In Portuguese the "Precisa de você" pill also pushes out a promise's second detail,
  the least important one, as rule 1 intends.
- The published artifact, version 14: the served `census.html` matched the build byte for byte, and
  the main page's link opened it in the in-app browser with the rules and the table in place.

Version 15, checked the same day in headless Chromium at 1440×900, 1180×820 and 390×844: every row
card in the card-type tiles, the object sheets and the design-system preview measured 72px, with the
rules and before them, including the cockpit's row with Confirm in its right slot and the jar with
Claim in its amount's place. Commitments, records and jars rendered no media card and no shape
control. The 15 / 13 title size was the default and the dot, with 15px app and 13px cockpit titles.
At 390px the folded tweaker bar showed Copy picks, and it copied the line. No console error and no
horizontal overflow; the served `census.html` matched the build byte for byte.

## Locked picks check

Checked on 2026-10-18 after the maintainer locked the card picks (census version 16), in headless
Chromium (Playwright) at 1440×900, 1180×820 and 390×844, in a fresh browser:

- The census opened on the locked picks, with the dots on them: the pill under the title, the
  agreed rules, 88px rows and photo, 15 / 13 titles, 11px details.
- Every row card in the card-type tiles, the object sheets and the design-system preview measured
  88px, in English, Spanish and Portuguese, with no row clipping its content and the titles of each
  list at one offset.
- No detail dropped or shortened in any of the four text sets at any of the three widths, against
  up to 6 of 24 before the rules; jar rows carried one detail.
- No console error and no horizontal overflow; the served `census.html` matched the build byte for
  byte.

The checks above are document and mock checks. No application code changed for them.

## Design gate for the token slices

Run on 2026-10-20 against `develop` `678a672dd`, with steps 1 to 3 drafted on a local branch that
was not pushed. The pairs and numbers went to the maintainer as one review set for approval of the
three token slices; nothing merged.

**Start gate.** `node scripts/harness/plan-hub.mjs linear-sync --feature app-cockpit-unification --json`
returned no create or update actions: the parent PRD-1266 is a `preserve` entry (`parent_only`,
`preserve_existing`) and no lane is mirrored. PRD-1266 was read from live Linear and matched
(Backlog, the 2.1.0 release project, 21 sub-issues, PRD-1278 in progress under the PWA Home work);
nothing was written to Linear. `record-linear --parent PRD-1266 --lane-sync-mode parent_only`
then recorded it, and `node scripts/harness/plan-hub.mjs validate` passed.

**Pairs.** The ten screens the lab draws, in four code states (develop, then each slice added in
order), at 390, 768 and 1280px in light and dark, and at 390px in light in Spanish and Portuguese:
80 frames a state, 320 in all, headless Chromium (Playwright) at device scale 1.

- Cockpit, **Storybook**: the route stories of the Hub (Approved scope, the seeded garden), Garden
  (Overview), Community (Members), Create Assessment and Profile, through a capture-only story
  file that renders them without their play functions (several turn the document dark while they
  assert) and in each language from the product catalogs. The file was never committed.
- App, **mock-auth localhost**: the client dev server from the worktree with
  `?mockAuth=deployer&presentation=pwa` on Arbitrum and the production indexer, Alchemy's demo key
  answered from Arbitrum's public RPC: Home, the TAS HUB garden on its Promises tab, Your Work,
  Submit Work at its Details step, and Profile. Storybook has no story for the shipped Home, garden
  page or Profile, and its app preview stood on linen before step 2, so it could not show the app's
  white ground truthfully. The app frames read live data and stay out of the repository.
- Changed pixels per pair (a channel sum above 12): step 1 changed every app frame (1.4 to 24%) and
  no cockpit frame (under 0.5%, capture noise); step 2 changed every app frame in both themes
  (13 to 83%) and the cockpit's dark frames only (7 to 62%); step 3 changed the app's controls
  (under 4.5% of a frame) and none of the five cockpit screens, which open none of the shared pieces
  it reaches.

**Typeface (step 1).** On the five app screens and the Submit Work start and media steps, at 320,
360 and 390px in English, Spanish and Portuguese (72 screen pairs, develop against step 1), the face
sets the same strings within 1% of Inter at the median (+0.6% English, +0.3% Spanish, -0.2%
Portuguese; 90th percentile +3.4 to +4.1%, largest +7.4%). Three texts newly end in an ellipsis,
all at 320px: a work card's meta line on the garden's Work tab in English and Spanish, and the
Spanish title of one action card on Submit Work's first step. No control label runs to a second
line and no screen scrolls sideways. Every status line of the logo screen and of sign-in (36 lines) keeps one line at
320px: the longest is 274.5px of 288px (Spanish "Green Goods necesita actualizarse."). At the
status voice the face sets these lines between 1.4% narrower and 4.6% wider than Inter.

**Type roles, cockpit (step 1, #1175).** Storybook, before (#1172's branch) and after (#1175), at
1280 and 390px. Of the 1,174 admin stories, 1,165 rendered in both runs and were compared element
by element: 32,509 text elements. Within those, the only size or weight changes were the decided
ones: checkbox and choice labels from 16 to 14px from 640px, two titles with no weight of their own
from 400 to 600, the cookie jar payout amount from 24 to 22px, and one empty-state line from 16 to
14px. Line height and tracking changed as the roles define. Not compared:

- Nine stories that navigate away while rendering, six in both runs and three in the before run
  only. Other stories of each one's component were compared, one to eight per component:
  `admin-boot-bootsurface--loading`, `admin-pool-poolclaimscard--paused`,
  `admin-pool-setupstepopen--confirming`, `admin-shell-adminloadingscreen--default`,
  `admin-shell-adminloadingscreen--spanish`, `admin-shell-routeerrorboundary--chunk-load-error`,
  `admin-workflows-community-payouts-campaigncookiejar-createsteps--eligible-gardens`,
  `admin-workflows-hub-hubworkcard--long-title` and `admin-workflows-hub-hubworkcard--no-images`.
- 125 elements in nine renders that loaded a different async state in each run, 123 seen only
  before and 2 only after. These were the Garden workspace's activity list (desktop) and pool
  (phone), the Actions workspace's create inspector (phone), the pool tab (desktop), the governance
  panel (desktop), the route error boundary's generic story (desktop) and three hypercert preview
  stories' chart labels (phone). Each story was compared at its other width; the create inspector's
  steps were also compared in their own action workflow stories.

**Contrast.** `contrast-audit.mjs` computed 127 token pairs from the resolved RGB values,
before and after:

- Ground: tertiary text (neutral-500) on linen measures 4.53:1 and green text 5.40:1; both pass. A
  white card on linen is a 1.06:1 fill step, so the app's card hairline moves to neutral-200
  (1.18:1 on linen).
- Dark ladder: the app's dark card had no step (1.00:1, the card was the canvas); the lifted card
  measures 1.26:1 against the canvas on both surfaces, and the cockpit's ring 1.59:1 (1.32 before).
  Ink, secondary and tertiary text keep 14.8, 10.4 and 6.1:1 on the lifted card.
- The lift costs coloured text about a fifth of its contrast. Three roles fell below AA on the
  lifted card (error red-600 3.73:1, feature purple-400 4.28:1, information blue-500 3.04:1, the
  last already failing at 3.87:1) and the cockpit's error red-500 fell to 4.24:1. Step 2 lifts each
  one step in dark: red-400 5.52:1, purple-300 6.30:1, blue-400 5.41:1. The cockpit's error-screen
  Retry, white on the error red (4.15:1, 2.8:1 after the lift), moves to the error action fill
  (5.26:1, DL-053).
- Control boundary: the app's secondary boundary was 1.49:1 (light) and 1.92:1 (dark), the
  cockpit's shared fields 1.34:1 and 1.69:1; the shared outline measures 4.80:1 on white, 4.53:1 on
  linen and 6.14:1 on the dark card.
- Focus: the solid ring passes in every theme (green 5.72:1 on white, mint 12.81:1 on the dark
  card). The 3px halo that buttons, chips and the switch draw measures about 1.3:1 in light, as it
  did in blue, and 1.58:1 in dark: below 3:1 before and after.

**Rendered contrast.** A sweep of every visible text on the ten screens at 390px in light and dark
(462 texts, each against the fills behind it) found one text below its floor in develop and in the
end state alike: the red required-field asterisk on Submit Work, 3.66:1 on white and 3.45:1 on
linen. It predates these slices.

**Step 13 draft.** The cockpit guide (`packages/admin/DESIGN.md`) and prompt contract
(`.claude/skills/design/prompt-contract.md`) were rewritten for the end state as a diff against
`develop`, with four proposed decision-log rows (the retired Material 3 rule and the F1, F2 with
F13, and F3 picks). The draft lands in parts with the slices that make each line true.

**Approval.** On 2026-10-21 the maintainer approved the three token slices as drafted, with the
four planned items, and added the solid 2px focus ring to step 3 and the type role rename as a
second pull request under PRD-1267.

**Installs.** The worktree linked the main checkout's installs, which predate `develop`'s lockfile
(Vite 8.2.1 where `develop` pins 8.2.4); nothing was installed.

## Step 2 proof: ground and dark ladder

Run on 2026-10-23 against `develop` `65df3ad13`, with step 2 as committed in `c9b1fd66a` on
`feature/app-cockpit-ground-ladder`. The rig is the design gate's ([above](#design-gate-for-the-token-slices)),
rebuilt for this run; the frames show live gardens and stay out of the repository.

**Contrast.** The resolved custom properties under each surface and theme, read from this branch's
Storybook (which loads shared `theme.css` and the cockpit's `admin-m3-tokens.css`), before and after:

| Surface, theme | Pair | develop | step 2 |
|---|---|---|---|
| App, light | Card against the canvas | 1.00:1 | 1.06:1 |
| App, light | Card hairline against the canvas | 1.09:1 | 1.18:1 |
| App, light | Tertiary text on the canvas | 4.80:1 | 4.53:1 |
| App, light | Green text on the canvas | 5.72:1 | 5.40:1 |
| App, dark | Card against the canvas | 1.00:1 | 1.26:1 |
| App, dark | Ink, secondary and tertiary text on the card | 18.92, 13.26 and 7.83:1 | 14.83, 10.40 and 6.14:1 |
| App, dark | Error, feature and information text on the card | 4.76, 5.46 and 3.87:1 | 5.52, 6.30 and 5.41:1 |
| Cockpit, dark | Card against the canvas | 1.12:1 | 1.26:1 |
| Cockpit, dark | Card ring against the canvas | 1.32:1 | 1.59:1 |
| Cockpit, dark | Error, feature and information text on the card | 4.18, 4.80 and 3.40:1 | 5.52, 6.30 and 5.41:1 |
| Cockpit, dark | The error role as text on the card; ink on its fill | 4.75 and 5.40:1 | 5.52 and 7.05:1 |
| Both, both | White on the error action fill | 5.26:1 | 5.26:1 |

The cockpit's light theme reads the same in every pair. The light error red (3.66:1 on white) is
unchanged; it is the required-field asterisk the design gate's sweep found.

**Pairs.** The lab's ten screens at 390, 768 and 1280px in light and dark (60 pairs), and four
website routes (`/`, `/gardens`, `/actions`, `/fund`) at 390 and 1280px in light and dark (16 pairs),
headless Chromium (Playwright) at device scale 1. Cockpit: **Storybook**, the Hub's approved work,
Garden overview, Community members, Create Assessment and Profile route stories. App: **mock-auth
localhost**, `?mockAuth=deployer&presentation=pwa` on Arbitrum and the production indexer: Home, the
TAS HUB garden on its Promises tab, Your Work, Submit Work at Details, and Profile. Changed pixels
per pair (a channel sum above 12):

- Cockpit, light: 0% on all five screens at every width. Cockpit, dark: 6.8 to 63.2%.
- App, light: 9.6 to 65.2%. App, dark: 17.6 to 88.6%.
- Website: 0% on 15 of 16 pairs. The 16th, `/gardens` at 390px in light (14.9%), differs only in
  the first garden's photo, which loaded from IPFS in one run and not the other. Its `theme-color`
  reads `#ffffff` in light and `#0c0a09` in dark on every route before and after.

**Status bar.** In the installed presentation the `theme-color` meta reads `#FAF8F5` in light and
`#110C08` in dark (mock-auth localhost), with the page's own ground behind it; the unit cases in
`theme.test.ts`, `bootFallback.test.tsx` and `pwa-manifest.test.ts` pin both presentations, and the
website keeps white. Not checked on a device: whether iOS's solid status bar follows `theme-color`.

## Design gate for the count badge

Run on 2026-10-23 against `develop` `45cd6706e`, with step 4 drafted on the local branch
`feature/app-cockpit-count-badge`; the maintainer approved the pairs the same day
([spec.md](spec.md#count-badge-approved-23-october)). The rig is the token slices' gate's
([above](#design-gate-for-the-token-slices)); the frames show live gardens and stay out of the
repository.

**Pairs.** Every component that draws a count, before and after, at 390, 768 and 1280px in light
and dark, in English, Spanish and Portuguese, at counts of 1, 9, 10, 99 and 100: 18 combinations
per surface per state, headless Chromium (Playwright) at device scale 2.

- App, **mock-auth localhost**: `?mockAuth=deployer&presentation=pwa` on Arbitrum One and the
  production indexer: the bottom bar, Home's launchers and filter, the tabs of the Your Work and
  Promises sheets, and the TAS HUB garden's notification bell. A capture-only wrapper around the
  four hooks that feed the counts (`useYourWorkCount`, `useCommitmentsInbox`,
  `useCommitmentsToConfirm`, `useWorks`) set the numbers, so the components ran unmodified.
- Cockpit, **Storybook**: the real `AdminTabRail` with the Hub, Garden and Community labels from
  the product catalogs at every count, and the four workspaces' route stories without their play
  functions.

**Measured** at 10 on a 390px screen (computed styles):

| Consumer | `develop` | Step 4 |
|---|---|---|
| App bottom bar | 20.6×16px, 10px at 700, no ring | 21.7×16px, 11px at 600, a 2px white ring |
| Your Work and Promises launchers, a garden's bell | 25.3×18px, 12px at 600, a 2px border inside the box and a small shadow | 21.2×16px, 11px at 600, a 2px ring of the canvas |
| Home filter | 16×10px, 10px at 600 | 16×16px, 11px at 600, a 2px ring of the canvas |
| App tabs | 21.3×16px, 12px at 500 | 21.2×16px, 11px at 600 |
| Cockpit tabs | 30.4×18px, 12px at 600, the tone container when active and gray otherwise | 21.2×16px, 11px at 600, the tone's accent on every tab |

One digit is a 16px circle, two digits 21.2px and 99+ 28.3px; the bar's 9+ is 21.7px.

**Contrast** of the numerals on their fill: the app 5.72:1 in light and 16.34:1 in dark. On the
tone's action fill the cockpit measured 7.26 (Hub), 5.72 (Garden), 4.01 (Community), 7.93
(Actions) and 10.27:1 (Home) in light, and 4.58 to 11.74:1 in dark; on the tone's accent,
Community measures 4.93:1, which step 4 takes. Against the app's tinted active tab the badge
measures 5.24:1 in light and 10.90:1 in dark.

**Found on the way.** Portuguese "Em andamento" ends in an ellipsis at 390px at every count before
and after, and "A confirmar" at 99+; the badge is never wider than before, so step 4 neither causes
nor fixes it. `TabBadge` in the cockpit's Garden helpers had no consumer and goes with the step.
White text on Community's action fill (orange-700) measures 4.0:1, though its token comment says
5.0:1. The Wallet's Cookies tab, which uses the same sheet tabs as Promises, had no count to show.

## Step 5 proof: tabs

Run on 2026-10-23 against `develop` `d84d48398`, with step 5 on `feature/app-cockpit-tabs`. The
maintainer reviews these pairs after the slice merges (his 23 October ruling). The frames show
live gardens and stay out of the repository; they are in a private artifact.

**Pairs.** Every cockpit tab row, before and after, at 320, 390, 768 and 1280px, in light and
dark, in English, Spanish and Portuguese; headless Chromium (Playwright) at device scale 2.

- Cockpit, **Storybook**: the real `AdminTabRail` for all eight rows (Hub stages, Garden views,
  Community views with Coordination, Actions domains, the phone account route, the pool switch,
  the Create Action instructions and the Submit Work chooser), each with its catalog labels,
  realistic counts and its tone, and the five workspaces' route stories without their plays.
- App, **mock-auth localhost**: `?mockAuth=deployer&presentation=pwa` on Arbitrum One and the
  production indexer: a garden page, Your Work and Promises. The step leaves them alone.

**Option 1.** F8 had phones keep full-width tabs. Rows whose cells cannot fit a phone scroll
instead, as they did before; the orchestrator took that rule on 23 October for the maintainer's
review after merge, and DL-100 records it as a measured deviation.

**Measured** after the change (light; cells' widths in px):

| Row | 320px | 390px | From 640px |
|---|---|---|---|
| Hub (4, icon and count) | scrolls in all three languages, 88 to 128 | scrolls in all three | four 180px cells, a 720px row |
| Garden (4) | fits: 74 each in English, 70 to 81 in Spanish and Portuguese | fits, 91.5 each | four 180px cells |
| Community, protocol garden (4) | scrolls in all three | fits in English and Spanish, scrolls in Portuguese | four 180px cells |
| Actions (5, all counted) | scrolls in all three | scrolls in all three | 144px at 768, 180px at 1280 |
| Account, pool switch (2) | fits, 148 each | fits, 183 each | two 180px cells, a 360px row |
| Create Action instructions (3) | scrolls in all three | fits | 180px; Spanish 191, 174 and 174 |

Before, every row at 320 and 390px scrolled except Account and the pool switch, which scrolled
only in Spanish at 320px. The tab is 36px tall in every row and width. The active label on its cell measures 5.84
(Hub), 4.70 (Garden), 6.30 (Actions) and 8.22:1 (Home) in light, and 8.97 to 12.32:1 in dark.
Community read 4.06:1 in these Storybook frames, captured before #1206 gave Storybook and the
cockpit's portals the canvas's amber ramp; on that ramp the same label computes to 5.75:1.

**Found on the way.** The app's Promises sheet clips Portuguese "Em andamento" at 390 and 320px
and Spanish "Por confirmar" at 320px, before and after; the step does not touch the app's tabs.
The app's rows span the width at 1280px; the 180px cap is the cockpit's.

## Step 6 proof: capsule chips

Run on 2026-10-23 against `develop` `d84d48398` (after #1204 and #1205), with step 6 on
`feature/app-cockpit-chips`. The pick was locked on 18 October, so the pairs are acceptance
evidence, not a gate. The rig is the token slices' gate's
([above](#design-gate-for-the-token-slices)); the frames show live gardens and stay out of the
repository.

**Pairs.** Cockpit, **Storybook**, before and after at 390, 768 and 1280px in light and dark: the
Hub's Pending and Approved, Community's member filter, the Garden pool console, the offers and
requests card, the seeding flow's confirmers and amounts, Manage Members, the translation editor
and the hypercert metadata editor, with the Hub, Community, the offers and requests card and Manage
Members also in Spanish and Portuguese, and every chip in each workspace tone on the canvas and on a
card. App, **mock-auth localhost**: Home's filter sheet and the Promises sheet, unchanged by the
step, as the look the cockpit now matches. Headless Chromium (Playwright) at device scale 2.

**Measured** (computed styles):

| | `develop` | Step 6 |
|---|---|---|
| Corner | 8px | capsule (9999px) |
| Selected fill and label | a gray container (neutral-200 in light, neutral-700 in dark) with neutral-900 or neutral-100 text, in every workspace | the tone's `--tone-action` with `--tone-on-action` |
| Box | 32px tall, 44px hit area | unchanged: across 727 chips measured in both states, at every width, theme and language, none changed its width or label |
| Focus | a 2px ring in the tone, flush with the chip | a 2px outline in the tone, 2px off the chip |

**Contrast** of a selected label on its fill: white on Hub blue-700 7.26, Garden green-800 5.72 and
Actions purple-700 7.93:1; Community orange-700 carries white at 5.02:1 on the cockpit's amber ramp
and drew 4.01:1 on the shared ramp that Storybook and the portals used before #1206, which these
frames predate. `WorkspaceToneContrast.guard` now holds the selected chip to AA in every tone and
theme, at rest and under its state layers. In dark the tonal fills carry their ink at 4.58
(Community) to 7.81:1 (Hub).

**Behavior.** Selection still flips `aria-pressed`, the label stays the accessible name, and no
chip changes width when chosen. Community's member filter is a select below 640px, as before, so
its 390px frames have no chips.

**Found on the way.** The shared `Chip` the cockpit renders (`ConfidenceSelector` in the Hub's
review form, `AssetSelector` in Community's vault dialogs) is already a capsule but selects in the
app's green. Tailwind's ring offset paints its gap white, so a focused `AdminButton` wears a white
halo on the dark ground; the chip now draws its ring as the shared chip does. In Storybook only, a
dark story wrapper takes shared `theme.css`'s `--m3-state-*` color aliases, so a focused or hovered
filled control paints its whole layer over its label; #1206 removes them.

## Step 9 proof: phone sheets

Run on 2026-10-23 against `develop` `d84d48398`, with step 9 on `feature/app-cockpit-phone-sheets`.
F5 was locked on 18 October, so these pairs are the step's acceptance evidence rather than a gate.
The frames show live gardens and stay out of the repository; the review page is a private artifact.

**Pairs.** Headless Chromium (Playwright) at device scale 2 with reduced motion, `develop` and step 9
served side by side from two worktrees.

- Cockpit, **Storybook**: a capture-only story rendered the real dialogs open: the past-due expire
  confirmation (`CommitmentExpireDialog` with its `PoolTarget`), the cancel-a-promise reason dialog
  (`AdminReasonDialog` with its suggestions and target), a form dialog, the discard confirmation
  and the Notifications side sheet, beside `AdminDialog`'s flow and palette stories. 66 frames per
  state: every scene at 390, 768 and 1280px in light and dark, and the three scenes with the most
  header text in Spanish and Portuguese at 390 and 1280px.
- App, **mock-auth localhost**: `?mockAuth=deployer&presentation=pwa` on Arbitrum One and the
  production indexer, the Your Work and Promises sheets (`AppSheet` through `PwaSheet`) at 390, 768
  and 1280px in light and dark, to show the shared changes leave the installed app as it was. The
  sheets' computed fill, hairline, corners, shadow, grip (its 40×6 pill, the grab cursor and the
  locked touch) and 18px title match `develop` in all 12 frames; 9 frames match pixel for pixel,
  and the other 3 differ only where live content loaded at a different moment (the garden
  banner's photo behind the scrim and two work-card thumbnails).

**Measured** (computed styles at 390px; light, then dark):

| | `develop` | Step 9 |
|---|---|---|
| Surface | warm gray `236 233 226`, dark `52 44 36`; no edge; elevation 2 | white, dark `42 35 28` (the lifted card); a 1px hairline, `231 229 228` and dark `67 61 55`; the float shadow |
| Grip | none | 40×6px, the dialog's tone at 32% (stone for an untoned dialog) |
| Header | an icon on danger and warning confirmations, a rule under the header, the close absolute top-right | the shared `SheetHeader`: no icon, the target line before the description, the close on the title's line, a hairline only while the body scrolls |
| Title | 22px on a 28px line | 22px on a 28px line |
| Close | 40px with a 44px finger box | 40px with a 44px finger box |

From 640px nothing changes: all 40 frames at 768 and 1280px match `develop` pixel for pixel
(channel-sum threshold 12), and the 26 that differ are the 390px frames. The flows and the command
palette keep their own header under the grip; the flow's close sits below the grip on the flow's
title row. In Spanish and Portuguese every phone title fits as it did, wrapping where it wrapped on
`develop`.

**Behavior.** Radix still opens, closes and dismisses the sheet. The focused tests run the same
cases on the phone and the desktop presentation: focus lands on Close when the dialog opens,
returns to the opener through `finalFocusRef` after Close and after Escape, and `preventClose`
disables Close and holds Escape. The phone cases add the material attribute, a grip without a drag
region, the shared header's order (title, target, description) and accessible description, and the
side sheet's phone form. Backdrop dismissal is Radix's in both presentations; jsdom cannot press
outside a dialog, so it rests on the rendered check below.

**Back** (mock-auth localhost, 390px, light, the real cockpit served from both worktrees): after an
in-app step (Garden to Hub, or Garden to Profile) the Notifications side sheet and the Edit Profile
Photo dialog each open with focus on Close, and Back returns to `/garden/health`, closes the sheet
and clears the body's pointer lock, so the page answers taps again: the same on `develop` and on
step 9, where both now open as the phone sheet. A tap on the dimmed page above the photo dialog
closes it on both too, and focus then rests on the page body on both, since that dialog names no
`finalFocusRef`.

**Found on the way.** The centered dialog's header keeps 24px of right padding from 640px (its
`pr-14` loses to `sm:px-6`; the side sheet adds `sm:pr-14` and keeps 56px), so a long title can run
under the close button on desktop; desktop is out of the step. The cockpit sheet's enter keyframe
keeps the 2% overshoot DL-033 removed from the app's sheet. Storybook mirrored the cockpit's dark
`--surface-raised` as neutral-900 where the cockpit uses the card step, which drew a darker footer
band in dark stories only; step 9 corrects the mirror.

## Step 21 proof: the bottom bar's pill

Run on 2026-10-23 against `develop` `d84d48398` (step 4 merged), with step 21 on
`feature/app-cockpit-bar-pill`. Under the maintainer's merge rule of 23 October the pairs are
reviewed after the merge. The frames show live gardens and stay out of the repository; the
private review page is linked from the pull request.

**Pairs.** Both bars before and after at 390, 768 and 1280px, in light and dark, in English,
Spanish and Portuguese: 18 combinations per surface, headless Chromium (Playwright) at device
scale 2.

- App, **mock-auth localhost**: `?mockAuth=deployer&presentation=pwa` on Arbitrum One and the
  production indexer. The bar with Home active at no count, 3 and the bar's 9+ (a capture-only
  wrapper around `useYourWorkCount` set the count, so the bar ran unmodified), keyboard focus on the
  active tab and on an inactive one, the bar with Profile active, and both whole screens.
- Cockpit, **Storybook**: the real `NavigationBar` in a canvas carrying the Garden and the Hub
  tones, as `CanvasLayout` renders it, in each language: the phone bar at 390px and the dock at
  768 and 1280px.

**Measured** (computed styles, light / dark):

| | `develop` | Step 21 |
|---|---|---|
| Active tab | Filled icon and label in `--primary-on-surface` (green-800 / mint), label 14px at 400: 5.72:1 / 12.81:1 | Line icon in green-900 / green-100 on a 56 × 32 pill of green-100 / green-900 (6.39:1 in both), label 14px at 600 in ink: 19.76:1 / 14.83:1 |
| Pill against the bar | None | 1.13:1 / 2.15:1 |
| Inactive tabs | Line icon and label in `--text-soft-400` at 400 | Unchanged |
| Bar | 69px, white, 16px top corners, a hairline, no blur | Unchanged; 8px padding around the 32px pill row, where it was 12px around the 24px icon |

The pill is the cockpit's Garden pill as Storybook measures it: green-100 behind a green-900 icon
with a weight 600 ink label, and green-900 behind green-100 in dark.

- Every tab holds the pill's 56px, so no tab moves when the active one changes. Against `develop`
  the outer tabs moved by up to 2px in English and 5px in Spanish and Portuguese, since their places
  no longer follow the labels' widths. The icons keep their height; the labels sit 4px lower.
- The count badge keeps its place on the icon's corner and its white ring, which now cuts into the
  pill's edge; 3 and 9+ fit.
- Focus is unchanged. An inactive tab draws the browser's default ring, now around the pill and
  the label; the active tab hides its ring, as it does on `develop`.
- Forced colors (Chromium emulation): the pill's fill drops and it draws a 1px outline, so the
  active tab keeps a shape cue, as the filled icon gave it on `develop`.
- The cockpit: 0 of 36 frames changed between `develop` and step 21.
- Above the bar no screen moved. The only differences between runs were live data: a banner image
  still loading, the offline download card's state, and the Promises launcher's count.

**Checks.** `display-mode.test.tsx` passed (8): the active tab is exposed as `aria-current="page"`,
now asserted directly. The AppBar story's `HomeActive` and `ProfileActive` plays (`storybook-ci`)
check that only the active tab's icon slot paints `--primary-container` and that the bar stays
69px, the height `#app-scroll` and `AppScreenError` reserve for it: restoring the 12px padding
fails them (77 against 69), and so does removing the fill. `check-tokens.sh` passed.

**Found, not fixed.** The active tab hides its keyboard focus ring (`focus:outline-hidden`, there
since the first bar), and the inactive tabs draw the browser's blue default ring instead of the
app's focus role (DL-098). Step 21 keeps focus as it was; giving the bar the app's focus role is a
follow-up.

**Focus follow-up (23 October).** `fix/app-bar-focus-ring` gives every bar tab the app's focus
role on keyboard focus, the active tab included: one solid 2px ring with a 2px offset in
`--focus-ring` (green-800 in light, mint in dark), around the pill and the label with 16px corners,
and none on a pointer press. Before it, the active tab drew no ring and the others drew the
browser's blue `auto` ring. The AppBar story's `KeyboardFocus` play tabs onto every tab and checks
the ring; develop's bar fails it (`none` where `solid` is expected), and so does a ring in the wrong
color role. Rendered on mock-auth localhost at 390, 768 and 1280px in light and dark.

## Step 7 build: cards, rows and list gap

Run on 2026-10-23 against `develop` `ce0d71953`, with step 7 on `feature/app-cockpit-cards-rows`:
the app's frames at `5a38c5634` and the cockpit's at `686de5dfc` (the commits between change only
the app's rows and a story). The rig is the token slices' gate's
([above](#design-gate-for-the-token-slices)). For the before frames, `develop`'s versions of the 37
runtime files the step changes were written into the worktree and restored from the index after.
The frames show live gardens and went to the maintainer as a private artifact, outside the
repository.

**Pairs.** 106 pairs, headless Chromium (Playwright) at device scale 2:

- Cockpit, **Storybook**: the Hub (Approved scope), Garden (Overview), Community (Members), Create
  Assessment and Profile route stories at 390, 768 and 1280px in light and dark in English, and the
  Hub at 390px in Spanish and Portuguese: 34 pairs.
- App, **mock-auth localhost**: `?mockAuth=deployer&presentation=pwa` on Arbitrum One with the
  production indexer: Home, the TAS HUB garden's Work tab, Your Work's Pending and Completed tabs,
  Profile and Submit Work at 390, 768 and 1280px in English and at 390px in Spanish and Portuguese,
  in light and dark, and the Work tab and Completed at 320 and 360px in all three, in light: 72 pairs.

**Fit after** (each row's height from its box; a detail counts as dropped when it sits below its
line's clip):

| List | Where | Rows | Height | Dropped whole | Ellipsis | Cut or wrapped |
|---|---|---|---|---|---|---|
| Garden › Work, TAS HUB's live work | mock-auth localhost, 320 to 1280px | 19 | 88px | none | none | 0 |
| Your Work › Pending, the live reviews to do | mock-auth localhost, 320 to 390px | 8 | 88px | none | none | 0 |
| Your Work › Completed, live | mock-auth localhost, 320 to 1280px | 3 | 88px | "Feedback" on all three at 320px in each language | none | 0 |
| Pending, every kind, the product's catalogs | Storybook, 288 to 358px columns | 6 | 88px | the saved time, carried by four kinds: all four at 320 and 360px, and at 390px four in English and three in Spanish and Portuguese; the draft's age at 320px, and at 360px in English | the "when you're connected" reasons: three, one and none in English at 320, 360 and 390px, three, three and one in Spanish, three at every width in Portuguese | 0 |
| The work row, the app's density | Storybook, 288 to 358px columns | 3 | 88px | "2 hr. ago" on one English row at 320px | none | 0 |
| The work row, the cockpit's density | Storybook, 296 to 366px columns | 2 | 88px | none | none | 0 |
| The cockpit's Hub queue on a phone | Storybook, 390px, light and dark | 2 | 88px | none | none | 0 |

**Before.** The app's lists were already one height (88px, DL-034) at every width and language
measured; the cockpit's phone queue drew the desktop card, 274px tall at 390px. In the app, step 7
changes the row's anatomy: the pill moves under the title, the photo count and the second pill
leave the third line, and ages take their short form ("há 3 sem." where it read "há 3 semanas").

**Step 1's handover.** The work card's meta line, which newly ended in an ellipsis at 320px in
English and Spanish, now fits: every Work-tab row at 320px shows both details whole. The Spanish
action card title on Submit Work's first step is a card title outside the item row and was not
measured again.

**Found on the way.**

- The first build gave feedback on Your Work's Completed rows only, so the garden's Work tab lost
  the cue that `develop` drew as a second pill. Feedback now takes the age's place on every work row
  (`5a38c5634`).
- The pending row's fit story set its Spanish and Portuguese columns with an English clock and an
  English long-form age; it now uses the rows' own formatters (`aa3a43ad6`).
- The capture-only client dev server, restarted by Vite when `design-md.generated.json` changed
  under it, came back serving 404 for every page until the process was restarted. This is rig
  behaviour, not the product's.

## Step 10 proof: outlined fields

Run on 2026-10-23 against `develop` `5c76ca2b6`, with step 10 on `feature/app-cockpit-outlined-fields`.
The frames show live gardens and stay out of the repository.

**The message reserve (A23).** The locked rule reserves two lines in the cockpit if several of its
longest Spanish and Portuguese messages wrap in two-column forms at 640px. A read-only inventory of
the 62 admin files that render the field family found 99 messages under fields that share a row at
some width; 32 of them share a row at 640px. Each was measured in Plus Jakarta Sans 12/16 in the
cockpit's Storybook at its real width there: the flow dialog fills a 640px viewport and its body is
592px, so a field in a two-column row is 290px wide (the specification estimated 205px). Six of the
32 wrap, in English, Spanish and Portuguese alike:

| Field and message | Width | Lines (en / es / pt) |
|---|---|---|
| Seed promises › Due in, the due-date hint with its longest date | 290px | 2 / 2 / 2 |
| Pool setup › the gardeners' share hint | 290px | 2 / 2 / 2 |
| Assessment › Metric, the duplicate-metric error | 224px | 2 / 2 / 2 |
| Seed promises › the 96px requirement count, three errors | 96px | 2 / 2 to 3 / 2 to 3 |

So the cockpit reserves two lines, as the app does. The setting stays per surface
(`--gg-field-message-lines`, set in the cockpit's `index.css`), so either surface can change it
alone. Also measured: the Seed step's Amount and Due errors fall back to Zod's English
("Invalid input: expected number, received NaN"), one line at 290px.

**TDD.** `required` for the lane; this step's behaviour is the anatomy contract and the reserved
line. RED on `develop`'s field family with the new tests (the five admin field test files): 11 of
29 cases failed, the 18 passing being the unchanged counter and ARIA cases; GREEN 29 of 29. The
shared guard's new message-line assertions: RED on `develop`'s `theme.css` (1 failed, 30 passed),
GREEN after. Browser mode (Storybook, `storybook-ci`): `AdminTextField` `LabelAboveGeometry` and
`MessageHoldsTheLine` (a long error grows the line and never scrolls), `AdminFieldGroup`
`MessageHoldsTheLine`, `AdminInlineField` `ErrorHoldsTheLine`, and the three design-system pages
that grade fields.

**Contrast.** The date picker's error moves from red-500 to the family's red-700: 4.39:1 to 6.47:1 on
white in the cockpit, which since #1206 draws its dialogs on the canvas's amber ramp (3.66 to 5.26:1
on the shared ramp Storybook draws). Dark is unchanged at 7.03:1.

**Pairs.** A private artifact (its link is in the pull request; the frames show live gardens),
captured in headless Chromium (Playwright) at 2x.
**Storybook** for the cockpit: the Create Assessment route, the Create Garden details with every
error showing, the assessment's first step, Garden settings, the Hypercert metadata step, the Seed
step, five rows with an action beside a field, and the field family's own stories. **mock-auth
localhost** for the app: Submit Work at Details. Each at 390, 768 and 1280px in light and dark, the
forms in English, Spanish and Portuguese, the rows at 768 and 1280px (where they are one line) in
English and Portuguese. Changed pixels per pair (a channel sum above 12): the app 0% on all 36
pairs; the cockpit's forms 7.5 to 52.8%, the family's stories 0.6 to 40.8%.

**Rows with an action beside a field.** Every action laid out against a field keeps the relation it
had on `develop`. A sweep of the 52 admin files that render the field family found fourteen
components with such rows, in three layouts. Rows aligned to the field's top move the action down by
the 24px label block: Create Garden's team step, Add members, the vault Deposit and Withdraw dialogs,
the cookie jar withdraw dialog, Strategies and the assessment outcome's remove button. Rows aligned
to its bottom lift the action by 36px instead of 20 (the two-line message line and its gap): the
Seed confirmers and amounts, the garden picker and the created jar address. Centred rows (the action
editors' option and shot rows, the payout unit) take a 12px bottom margin for 20, because the box's
middle now sits 6px above the field's. Measured in Storybook at 390, 768 and 1280px: the team step,
the outcome's remove button, the payout unit and the garden picker's buttons centred; Deposit and
Withdraw 2px below centre, Add members 8px, the action editors 3px (their buttons' own top margin,
as on `develop`); the Seed rows and the created jar address on the box's bottom edge. The cookie jar
withdraw dialog (its story is a harness built from shared controls) and Strategies (no story) rest
on arithmetic, not a picture. The sign-in field shows its hints and errors in the form's feedback
zone, so it reserves no message line: its slot grows from 64 to 72px, and the field fits it at every
width. The first pass found seven of the fourteen; Codex's review of `770812271` found the rest of
the bottom-aligned and top-aligned rows and the sign-in slot, and the sweep found the centred ones.

## Step 14 build: fact rows

Run on 2026-10-24 against `develop` `3c4fd4b62`, with step 14 on `feature/app-cockpit-fact-rows` at
`5f7dd0e04`. Each checkout ran its own Storybook, and two capture-only client dev servers served the
app; the before frames came from a detached worktree at `develop`. The frames went to the maintainer
as a private artifact, outside the repository.

**Pairs.** 142, headless Chromium (Playwright) at device scale 2:

- Cockpit, **Storybook**: 36 screens at 390px in light and dark and at 1280px in light, with Add to
  This Group in Spanish and the Group inspector in Portuguese at 390px.
- App, **Storybook**: 12 screens at 390px in light and dark, and at 768px in light where the screen
  has room. Four are capture-only stories kept out of Git: the G$ fee summary, pool readiness, and a
  garden's claim pending and declined.
- App, **mock-auth localhost**: the Profile's settings on `?mockAuth=deployer&presentation=pwa`,
  Arbitrum One with the production indexer, at 390px in English in light and dark, at 768px in
  English, at 320px in Spanish and Portuguese, and at 390px in Portuguese.

**Measured.**

- Type: a label at 14px in the app and 12px in the cockpit, a value at 16px and 14px at weight 500
  (the `Shared/Cards/FactRow` Densities play); a setting's title at 14px and 500 in the cockpit's
  Garden settings, the field title's size (DL-105).
- The Profile's settings: every row 74px (75 with its rule) at 320 and 390px in English, Spanish and
  Portuguese, no title cut, and the list 48px shorter. Before, five 72px cards stood 16px apart, and
  two titles were cut at 320px in Spanish and Portuguese.
- Taller: divided rows with 10px of padding replace rows 4px apart, so the Seed review grew 286px
  at 390px, the pool funding sections 263px at 1280px, the compose review 163px at 390px and
  Create Assessment's review 48px.

**Found on the way.**

- The census mock split every row 0.9 to 1.4. In the 390px cockpit dialog that wrapped short values
  ("Household water survey", a due date) that fitted on one line before, so the rows share one label
  column through subgrid, as wide as the longest label up to 40%, and keep the split only where a
  browser lacks subgrid. DL-109 records it.
- Five test files and the campaign review story's play read a value through its label's parent or
  sibling; they read the fact row now. The settings test counted cards and the pool readiness test
  found its list by role; they count fact rows and find the list by its label, since a description
  list has no list role.
- The Storybook runner caught a row the search had missed: the campaign jar review's `ReviewLine`,
  whose story play still read the old markup. It is a fact row now, with its two screens in the pairs.
- CI's full Storybook run caught two more: the Design System's cockpit Components and Shared pieces
  pages still imported `AdminSettingRow` for their switch specimens. Shared's typecheck covers only
  `src/`, so nothing local flagged them. Both specimens are setting rows on the fact row now, and the
  page links to its Settings story.
- Rig: a story added while Storybook runs reloads its page once (Vite optimizes the new imports), so
  those frames were taken by direct URL. This is rig behaviour, not the product's.

**Checks.** The focused Vitest files for every changed screen (63 admin and 47 client files at
first, then the files each later change touched), the three typechecks, oxlint, the react-patterns,
design-token, story, source-structure and seam checks, and the `storybook-ci` plays of the 102 story
files that render a changed screen (`vitest --project=storybook`): 153 tests, all passing after the
`ReviewLine` change, with two load timeouts that passed on a rerun.

## Step 18 build: jar and vault cards

Run on 2026-10-24 against `develop` `3c4fd4b62`, with step 18 at `c7b90c2dc` on
`feature/app-cockpit-jar-vault-cards` (the review fixes after it change none of these frames).
The before frames came from a detached capture worktree at `develop`, the after frames from the
branch, each served by its own capture-only Storybook from the same untracked capture stories,
which reuse each real story with its own mocks and add Spanish and Portuguese. The pairs went to
the maintainer as a private artifact, outside the repository.

**Pairs.** 83 pairs and 2 after-only frames, headless Chromium (Playwright) at device scale 2:
71 **Storybook** pairs and 12 **mock-auth localhost** pairs.

- App, **mock-auth localhost**: `?mockAuth=deployer&presentation=pwa` on Arbitrum One with the
  production indexer, at TAS HUB, the one garden of the first fourteen where the deployer sees
  Open Endowment: its Endowment tab (the vault summary and the reader's DAI deposit), its Cookie
  jar tab, and the WETH jar's page opened, at 390px in light and dark and in Spanish and
  Portuguese, each code state served by its own capture-only client dev server.

The Storybook pairs, full page:

- Cockpit: Community › Payouts' jars (closed, one opened, one paused), Community › Endowment's
  positions (closed and opened), the real `PositionCard`, and the campaign cookie jars, at 390, 768
  and 1280px in light and dark in English and at 390px in Spanish and Portuguese; the no-vault,
  no-campaign, no-event and no-allocation states.
- App: the endowment sheet's Endowment tab with a deposit (closed and opened) and with none, its
  Cookie jar tab (closed and opened), and the wallet's Cookies tab (closed and opened), at 390px
  in light and dark and in Spanish and Portuguese.
- After only: the row's `Amounts` story, both densities at their phone list widths in three
  languages.

The wallet's Cookies tab has no jar for the mock users, so its pairs come from its real story.

**Fit after** (each visible row's height from its box; an amount counts as cut when its value
overflows its slot or the row):

| Set | Where | Rows | Height | Amounts cut | Detail lines | First detail in an ellipsis |
|---|---|---|---|---|---|---|
| Every captured list | 73 frames, 390 to 1280px, light and dark, three languages | 163 | 88px | 0 | 0 wrapped, cut or dropped | 2: the Portuguese per-claim detail at 390px inside the cockpit's Payouts card |
| TAS HUB's endowment sheet, live | 12 frames at 390px, light and dark, three languages; the garden's work rows behind the sheet included | 256 | 88px | 0 | 0 wrapped, cut or dropped | none |
| The row's `Amounts` story | app columns of 288, 328 and 358px; cockpit 296 and 366px | 45 | 88px | 0 | 0 wrapped, cut or dropped | 9 per theme: the per-claim detail at 288px in all three languages, at 328px in Portuguese, at 296px in Spanish and Portuguese; none at 358 or 366px |

**Before.** The app's jar cards were compact cards of their own height (a claim form opening
inside the card), the endowment sheet's deposits showed an open withdraw form, and the vault
summary was a two-line card without the asset on its net deposits. The cockpit drew a grid of
tall cards: a garden jar's at least 256px with its editors and acts, a position's with four facts
and every act; the campaign list was a divided list of content-height rows.

**Found on the way.**

- Codex's review of #1234 caught a paused jar's row still claiming an amount was available now,
  the deposits' empty state showing before the read finished, a campaign jar showing a fallback
  "0 a claim" after a failed read, and dust amounts that would overflow the slot; all fixed in
  `ed8b05724`, with focused tests. It also asked for the open row to take `selected`; kept as a
  disclosure (`aria-expanded`), since several pages can be open and `aria-current` marks one item.
- The design-token baseline still listed the campaign row's raw `<button>`, which the item row
  replaced, so CI's token check failed until the line was removed (`d9e2485a6`).
- Capture rig: a new story's first render made Vite re-optimize and reload the Storybook iframe,
  so the capture waits for the preview channel to return before each render.

## Step 16 build: pickers and record cards

Run on 2026-10-24 against `develop` `3c4fd4b62`, with step 16 on
`feature/app-cockpit-pickers-records`.

**Picking an action works the same by pointer and keyboard on both surfaces.** Both surfaces render
one component, so one behaviour is proved once at its owner and again at each mount:

- `ActionPicker.test.tsx` (Shared, happy-dom): one named listbox; each card named by its domain,
  title and what it asks for; one tab stop on the chosen card, else the first; the arrow keys, Home
  and End move and wrap without choosing; a press chooses; nothing is chosen while turned off; a
  card that cannot be chosen is passed over, and the tab stop returns to the chosen card when focus
  leaves; loading holds four empty cards.
- Story play functions in a real browser: `Shared/Cards/ActionPicker` (the app's row: the arrow
  key moves, Space chooses; the cockpit's grid: Tab reaches the first card, End, Enter, a press),
  `Shared/Cards/MediaCardPicker` (the arrow key skips a card that cannot be chosen) and
  `Shared/Cards/GardenCard` (the garden picker), plus the cockpit's
  `Admin/Workflows/Garden/ActionChooserGrid` (a press checks a card).
- At the mounts: the app's `Intro.test.tsx` (the action and garden pickers choose by UID and by
  garden, the chosen card checked) and the cockpit's `ActionChooserGrid.test.tsx` (canonical titles
  in Portuguese, an empty selection is nothing chosen).

**Records and states.** `GardenAssessments.test.tsx` (each assessment a row that opens its page,
the reporting period read for a reader west of UTC, an unknown domain unlabelled),
`ImpactTab.test.tsx` (domains named, failed reads announced and not counted), the garden card's
tests (members counted as people, the place, content when it opens nothing) and the hypercert,
listing, approval, preview, GreenWill and details-editor suites (72 cases) pass with the states on
the block.

**Pairs.** 60 pairs, headless Chromium (Playwright) at device scale 2, before at `develop`
`3c4fd4b62` and after on the branch, sent to the maintainer as a private artifact because the app's
frames show live gardens:

- **Storybook**, 52 pairs: the cockpit's Submit Work chooser (390 and 768px), the shared picker in
  the cockpit, the Hub's two record tabs, the Impact tab (with data, loading, none yet), the
  assessments and hypercerts panels, five states (listings, trades, the approval check, the
  assessments panel loading and failed), and the app's action cards, garden cards, garden picker and
  assessments, in light and dark.
- **mock-auth localhost**, 8 pairs: `?mockAuth=deployer&presentation=pwa` on Arbitrum One with the
  production indexer, Home's garden list and Submit Work at 390px in English (light and dark),
  Spanish and Portuguese. The garden's Insights tab timed out under load at a 30 to 32 load average,
  so the app's assessments pair is the Storybook story alone.

## Step 17 build: people rows

Run on 2026-10-24 against `develop` `a3645441c`, with step 17 on `feature/app-cockpit-people-rows`
at `f6d3d8165`. The before frames came from the same worktree before the change, the after frames
from that commit, through the rig the earlier steps used. The app's frames show live gardens and
people and went to the maintainer as a private artifact, outside the repository.

**Pairs.** 104 pairs, headless Chromium (Playwright) at device scale 2:

- Cockpit, **Storybook**: the member directory with a fuller roster (a Green Goods name, ENS
  names, bare addresses, two photos and people who hold several roles) at 390, 768 and 1280px in
  light and dark and at 390px in Spanish and Portuguese; a steward with several roles and the
  read-only directory; a garden's supporters and the protocol's funders, loading included, and the
  funder row; the Add Members queue empty and filled; the steward access chooser loading, failed and
  with no gardens; and, with their markup unchanged, `PersonName`, `ClaimantName` and the group
  inspector's people. The app's Gardeners stories are in the same Storybook. 84 pairs.
- App, **mock-auth localhost**: `?mockAuth=deployer&presentation=pwa` on Arbitrum One with the
  production indexer: a garden's Gardeners tab and the wallet's send recipients at 320, 360, 390
  and 768px in English, light, and at 390 and 768px in dark, and at 390px in Spanish and Portuguese
  in both themes: 20 pairs.

**Fit after** (each row's height from its box; a detail counts as dropped when it sits below its
line's clip; a title or chip counts as cut when its text overflows its box):

| List | Where | Rows | Height | Dropped whole | Ellipsis | Cut or wrapped |
|---|---|---|---|---|---|---|
| The person row, every kind of name and the longest chips | Storybook, 288, 328 and 358px columns in English, Spanish and Portuguese | 45 | 88px | none | none | 0 |
| The person row at both densities | Storybook, 358 and 366px | 10 | 88px | none | none | 0 |
| Community › Members, the roster | Storybook, 390px in each language, and 1280px | 6 each | 88px | none | none | 0 |
| A garden's supporters, the protocol's funders | Storybook, 390px | 3 each | 88px | none | none | 0 |
| A garden's Gardeners tab, live | mock-auth localhost, 320, 360 and 390px in each language | 4 | 88px | none | none | 0 |
| Send recipients, live | mock-auth localhost, 320, 360 and 390px in each language | 79 | 88px | none | none | 0 |

No title or role chip was cut on any row measured, Spanish "Miembro de la comunidad" included. The
send rows measured sit in their garden's section, which names the garden, so they carry no detail;
a search that mixes gardens gives each row its garden.

**Before.** The app's member cards put a Steward badge in the corner and a "Gardener since" line
that wrapped onto two lines at 320px, and its send rows cut most names to a few letters beside up to
two role chips. The cockpit's directory listed every role as a chip and read names from ENS alone,
so the roster's owner, who has only a Green Goods name, showed as a short address; the funder rows
did the same beside an initial in a circle and a yield bar.

**Found on the way.**

- A count for the app's members would have to come from the garden's work list, which is paged, so
  it would undercount active gardeners; the member rows keep since when a person has been a gardener,
  the indexer's one date per gardener, set at their first gardener role in any garden (a call in the
  [UI handoff](handoffs/claude-ui.md#step-17-people-rows-prd-1284)).
- `GardenCommunityCard` is mounted nowhere and draws its pools state only with governance on
  (PRD-917), so its state block has a unit test and no rendered pair.
- The app capture's first run clicked a role named "tab" for the garden's sections; the garden page
  draws them as buttons (`data-testid="tab-gardeners"`), and the wallet's send picker sits behind
  its Send mode. Rig behaviour, not the product's.

## Step 15 build: commitment cards

Run on 2026-10-24 against `develop` `3c4fd4b62`, with step 15 on
`feature/app-cockpit-commitment-cards` (`bec8aa00c`, the glyph fix `cb32a9374` and the queued
units `e1dd6c661`). The picks were locked on 18 October, so the pairs are acceptance evidence. The
before frames come from a detached `develop` worktree served beside the branch. Frames that show
live gardens stay out of the repository; the pairs went to the maintainer as a private artifact.

**Pairs.** Headless Chromium (Playwright) at device scale 2 with reduced motion.

- **Storybook**, both surfaces: every commitment list's component stories before and after, in
  light and dark. The app's promise row in every seat and state (needs you, named, a long title,
  a request, a confirmer waiting, on the team, didn't send, settled, record only, quantities),
  the group row (available, none, unknown, in a list, four counts in English, Spanish and
  Portuguese), the pinned promise (proof and work), the promise page's queue notice in all eleven
  queue states, the garden's Promises tab (live, three queued creations, settled, visitor,
  protocol pool, loading, empty, failed, offline) and a group's page; the cockpit's Offers and
  Requests (open, a group, a group whose copy didn't send, past due, needs recovery, queued,
  queued while sending, queued needing attention, empty, a deferred reward, partial
  documentation), the group row (five days in, one didn't send, finishing) and the Promises tab.
  129 before frames and 139 after frames at 390, 768 and 1280px, the after set adding the shared
  row's stories and the app's To confirm row.

**Fit after** (Storybook, each row's box measured in Chromium; a detail counts as dropped when it
sits below its line's clip):

| List | Columns | Rows | Height | Dropped whole | Ellipsis | Cut or wrapped |
|---|---|---|---|---|---|---|
| App promise rows, four seats and states | 288, 328, 358px in en, es, pt | 36 | 88px | none | none | 0 |
| Shared row, every queue and act state | 288, 328, 358px in en, es, pt | 54 | 88px | the due date after a queued promise's reason, at every width | the queued reason, at every width | 0 |
| App group row, four counts | 384px in en, es, pt | 3 | 88px | the remaining counts in es and pt | none | 0 |

Titles keep one line and end in an ellipsis with the full title on hover, as the picks set.

**Behavior.** The promise rows open their promise as before; the group row opens its group; a
queued row's Discard and send keep their guards (Discard only where the queue allows it, the send
disabled while offline, busy, deferred or past the group's deadline); the cockpit's Expire Now…
and Finish Creating keep theirs. The focused tests check the shared row's rules (the direction
named, the pill precedence and its edge, the other person from each seat, a state's words leading
the line), the app's rows in the Promises sheet and the garden's tab, and the cockpit's queued
row, whose act phase line still announces each phase.

**Found on the way.** The first live pair named the reader on their own requests nobody had
taken up: the confirmer seat fell back to the person who asked, who was the reader. A confirmer or
a helper now reads only whoever does the promise (`ed5d6fdd9`); the row test reproduces it, failing
without the fix and passing with it. Plus Jakarta Sans's contextual alternates drew the x of a
short address ("0x2") as a times sign on the detail line; the line now turns them off
(`cb32a9374`). The read model's direction can be `UNKNOWN`, which the client typecheck caught in
the push gate; the row names only an offer or a request (`0f09678aa`). The app's
queued creation led every request with the offer's seedling. Every `StatusBadge` pill is a polite
live region, so a pill that changes is announced.

**Found in review.** Codex found that a titled promise still on the device showed its units
nowhere, since it has no page yet; they now lead its line, so in the app its reason drops whole
where the fit table above shows an ellipsis, with its full words on hover and for screen readers
(`86682e319`; the shared row's own stories pass no units, so the table stands for them). The same
commit reads the zero address as nobody and starts no name lookups for a person the line cannot
show. Two stories still looked for what the rows replaced (`2e961e4b2`, `8120d6e81`, the second
caught by Storybook CI). Submit Work's pinned promise drew every promise with an unnamed seedling;
the live work-link choice is built from the full commitment, so it now carries the direction and a
request's pin leads with the helping hand, named (`e80272b9d`).

## Step 19 proof: unused card code and solid surfaces

Run on 2026-10-24 for step 19's first pass, `feature/app-cockpit-unused-card-code` (`84cf1a9d0` and
`31df7a87b`), against `develop` `a3645441c`. Capture-only servers ran from the step's worktree:
Storybook, the app and the cockpit, the last two on Arbitrum One with the production indexer. The
Storybook and app before frames were taken before the change; the cockpit's before frames from
`develop`'s versions of the seven files its frames depend on, written into the worktree and restored
after. Frames that show live gardens went to the maintainer as a private artifact.

**Pairs.** 77 pairs, headless Chromium (Playwright) at device scale 2:

- **mock-auth localhost**, cockpit (`?mockAuth=deployer`, Green Goods Community Garden): the Hub's
  Assessments stage, which has no assessments, at 390, 768 and 1280px, and its garden menu and
  Settings tooltip at 1280px, in light and dark: 10 pairs.
- **mock-auth localhost**, app (`?mockAuth=deployer&presentation=pwa` in an iPhone 13 browser
  context): Home with the install strip, offline, and back online, in light and dark: 6 pairs.
- **Storybook**: the AppBar, GardenChip and FabButton stories with the menu open or a tooltip shown;
  the Hub's work, confirm and record queues when empty and when a read fails, at 390, 768 and
  1280px; the strip component's four states; `Surface`'s levels; `FormFlow`; and the Foundation
  token story, in light and dark: 61 pairs.

**Computed after** (`getComputedStyle`; every surface reports `backdrop-filter: none`):

| Surface | Light | Dark |
|---|---|---|
| Garden menu, cockpit | 255 255 255 | 42 35 28 |
| Hub frame, cockpit | 255 255 255 to 251 249 244 | 28 25 23 to 12 10 9 |
| Hub frame, Storybook fallback | 250 250 249 | 22 20 18 |
| AppBar tooltip, cockpit | 28 25 23 | 245 245 244 |
| Surface ground; raised, floating and overlay | 250 250 249; 255 255 255 | 24 19 13; 42 35 28 |
| Install strip; offline strip, app | 255 255 255; 12 10 9 | not measured |

Before, measured in the cockpit the same way: the garden menu `rgba(255, 255, 255, 0.55)` in light and
`rgba(28, 25, 23, 0.45)` in dark, both under `blur(20px) saturate(1.5)` (in light the Hub's heading
shows through it, and in dark it nearly disappears into the canvas); the Hub frame a gradient at 62
and 82% in light and 72 and 86% in dark under `blur(8px) saturate(1.1)`; the AppBar tooltip at 0.9
alpha. The strips were 95% fills with a blur. `FormFlow`'s four pairs are pixel-identical: it moves
from `solid-raised` to `raised`, which draws the same card.

**Found on the way.**

- The garden menu's divider took the stroke token, which equals the cockpit's dark card (41 37 36 on
  42 35 28), so the solid menu hid it. It now takes the raised surface's hairline: 58 52 45 on the
  dark card, and 238 on white in light, where it was 245.
- Storybook does not declare the cockpit's `--admin-empty-state-bg`, so the Hub stories have always
  drawn `EmptyStateShell`'s fallback, not the cockpit's gradient; the cockpit's own frames carry it.
- Offline in a phone browser, the 16px offline strip covers only the top of the 24px install strip.
  Before, the install strip's text showed through the offline strip.
- The Foundation token story drew `CardBase` without padding, its header beside its controls. It now
  draws its panels on `.gg-card` with padding; the docs page's capture of it
  (`shared-tokens-foundation-controls.webp`) still shows the old layout in the previous typeface.

## Step 12 build: the garden chip at the app's density

Run on 2026-10-24 against `develop` `796e9e1bb`, with step 12 at `b47e23936` on
`feature/app-cockpit-app-garden-chip`. Two capture-only Storybooks, a detached `develop` worktree
for the before frames and the branch for the after frames, rendered the same untracked capture
story: the chip under the installed app's scope beside the cockpit's, in English, Spanish and
Portuguese, with a long garden name in a 288px column. The pairs went to the maintainer as a
private artifact.

**Pairs.** 6 pairs, headless Chromium (Playwright) at device scale 2, all **Storybook**: the whole
story at 1280 and 390px in light and dark, and the app column with keyboard focus on its first
switcher in light and dark.

**Measured**, every chip in each frame (12 per scope):

| Scope | Height | Avatar | Label | Edge | Focus ring |
|---|---|---|---|---|---|
| App, before | 36px | 22px | 16px | the hairline, `stroke-sub-300` | `green-800`, in dark too |
| App, after | 44px | 28px | 16px | the control outline, `neutral-500` (`neutral-400` in dark) | the app's focus role: its green, mint in dark |
| Cockpit, before and after | 36px | 22px | 14px | the hairline | its token unset, so the fallback as before |

The long name ends in an ellipsis inside its column in every frame, and no chip runs past its
column.

**The cockpit is unchanged.** With the app column hidden, so both states draw the cockpit column at
the same page offset, its before and after crops are pixel-identical at 1280 and 390px in light and
dark: 0 differing pixels at any threshold. Taken in place under the taller app column, 50 to 213
pixels differ, all on the capsules' anti-aliased edges, from the column's new offset on the page.

**Story test.** `AppDensity`'s play checks both densities (height, avatar, label size), the long
name and the app's focus color. The chip's seven stories passed in the Storybook browser runner,
run locally with a temporary `server.fs.allow`, reverted before the commit.

**Not in the step.** Nothing mounts the chip in the app, and its menu is unchanged: it opens only
from a switcher, which the app does not mount yet.

## Step 20 phase 3 proof: dialogs on the shared header

Run on 2026-10-24 for `feature/app-cockpit-shared-dialogs` (`0c69a097c` and `73f6e563f`) against
`develop` `796e9e1bb`. Two capture-only Storybooks, one per tree, rendered a parked capture story
(four dialogs, each open) that was copied into both and deleted before any gate.

**Pairs.** 24 pairs, **Storybook**, headless Chromium (Playwright) at device scale 2: a standard
dialog with its own actions, a form dialog, a danger confirm with a pool target, and a confirm
nested in a dialog, at 390, 768 and 1280px in light and dark. Four are pixel-identical: the
standard and form dialogs at 390px, which have shown the shared header since step 9. Private page:
https://claude.ai/artifact/7dC3c4kyd6po22ef6iyYnc.

**Measured** on the topmost dialog (`getComputedStyle`):

| | Before | After |
|---|---|---|
| Header from 640px | the cockpit's own: an icon on a destructive confirm, a rule under it, Close absolute 12px from the edge | `SheetHeader`: no icon, no rule, Close on the title's line 16px from the edge |
| Title | 22px on 28px | 22px on 28px |
| Desktop confirm height | 220px | 225px |
| Confirm family's buttons | `AdminButton` at 32px, Cancel a text button, the dark danger fill `rgb(255, 104, 117)` | `SheetActions` at 40px, Cancel outlined, the danger fill `rgb(208, 37, 51)` in both themes (DL-053) |
| Surface fill from 640px | 236 233 226 in light, 52 44 36 in dark | unchanged |

**Behavior.** Play functions in Chromium, 15 of 15 in the AdminDialog and AdminSideSheet stories:
`Default`, `FormDialog`, `ConfirmFocusReturn` and `NestedDialogs` close with Escape and with
Cancel and check that the scroll and pointer locks are released and focus is back on the opener;
in the nested pair Escape closes only the confirm and focus steps back one level. They failed
before the focus fix: Radix returns focus only to a `Dialog.Trigger`, which the cockpit's
controlled dialogs lack. Unit tests: the full admin suite, 151 files and 1,379 tests passing.

**Found on the way.** The first after frames showed the confirm family's footer padded twice:
`SheetActions` pads and fills itself, and the dialog's footer bar pads too. The dialog now hosts
the bar from its own selector, as DialogShell and ConfirmDialog do (`73f6e563f`).

## Step 20 phase 4 proof: cards and tabs

Run on 2026-10-24 against `develop` `796e9e1bb`, with phase 4 on `feature/app-cockpit-shared-cards`,
in **Storybook** (headless Chromium at device scale 2, the admin primitive frame).

- Stories: `AdminCard`'s `StateCatalog` (filled, elevated, outlined) and `CardTitle`, `AdminListRow`'s
  `RecentAssessments` (a current row among others), and `AdminSelectableCard`'s `ToggleGroup` and
  `RadioCards`, each at 390, 768 and 1280px in light and dark: 30 frames a state.
- Measured on every `AdminCard`, `AdminListRow` and `AdminSelectableCard` (corner, edge, fill,
  shadow, padding and box): 66 boxes, with no difference between `develop` and the branch. Pixels:
  none of the 30 pairs differs (ImageMagick AE at 2% fuzz).
- What the boxes are: the card has a 24px corner and a 1px edge, neutral-200 on white in light and
  earth-700 on the lifted card in dark, with the faint shadow in light only; filled takes the same
  corner with no edge; the list row is 16px and 56px tall here, on the weak fill; the selectable
  card is 12px and 66px tall, its selected state the tone's accent edge and a 10% tint.

## Step 19 proof: second pass

Run on 2026-10-24 for step 19's second pass, `feature/app-cockpit-unused-card-code-pass-2`, against
`develop` `796e9e1bb`. Capture-only servers ran from the step's worktree: Storybook, and the cockpit
on Arbitrum One with the production indexer. Every before frame was taken from the untouched
`develop` tree, before the first edit. Frames that show a live garden went to the maintainer as a
private artifact.

**Pairs.** 34 pairs and 10 before-only frames, headless Chromium (Playwright) at device scale 2:

- **mock-auth localhost**, cockpit (`/actions?mockAuth=deployer`, Green Goods Community Garden, with
  Arbitrum reads answered by its public RPC in place of the rate-limited demo key): the Actions
  workspace at 390, 768 and 1280px, in light and dark: 6 pairs.
- **Storybook**: the Actions workspace story at the same widths, `WorkbenchCard`'s default,
  upcoming, record, selected and grid stories, and the Hub's work and confirm queue placeholders,
  in light and dark: 28 pairs. The 8 placeholder pairs are pixel-identical.
- **Storybook, before only**: the stories of what the pass removes (`WorkbenchRow`, `WorkbenchList`,
  the skeleton's row variant, `VaultPositionCard`, `GardenYieldCard`), in light and dark.

**Computed** (`getComputedStyle` on the first `WorkbenchCard`, 1280px):

| Where | Before | After |
|---|---|---|
| Cockpit, light | fill 255 255 255, no edge, 16px, glass inset ring | fill 255 255 255, 1px 231 229 228, 24px |
| Cockpit, dark | fill 42 35 28, no edge, 16px | fill 42 35 28, 1px 67 61 55, 24px |
| Storybook, light | 70% white under `blur(16px) saturate(1.3)`, 16px | the cockpit's after values |
| Storybook, dark | 60% of 28 25 23 under the same blur, 16px | the cockpit's after values |

After, every frame reports `backdrop-filter: none`. In the cockpit the fill is unchanged, since its
override for `glass-raised` already painted `--admin-surface-0`, the fill `.gg-card` reads there.

**Found on the way.**

- The confirm queue waits on a grid of card placeholders but loads a list of decision rows, so it
  changes shape when it loads.
- `SkeletonGrid`'s cell, the cockpit's route fallback, draws its own card (`rounded-xl`,
  `shadow-sm`, outside the elevation ladder) instead of `.gg-card`.
- Storybook does not declare the cockpit's `--edge-focus`, so `WorkbenchCard`'s Selected story shows
  no selected edge, before and after.
- The app's own `Card` has five parts nothing renders: `CardHeader`, `CardTitle`,
  `CardDescription`, `CardContent` and `CardFooter`.
