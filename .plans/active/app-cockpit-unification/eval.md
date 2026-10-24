# One Look for the App and the Cockpit — Evaluation

**Status:** acceptance criteria follow the locked picks; the design gate for the token slices ran on 2026-10-20 ([below](#design-gate-for-the-token-slices)); step 2's proof ran on 2026-10-23 ([below](#step-2-proof-ground-and-dark-ladder)); the design gate for the count badge (step 4) ran and was approved on 2026-10-23 ([below](#design-gate-for-the-count-badge)); review results pending.

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
| A19 | Cockpit controls | For each migrated family, the cockpit renders only the shared controls; density, hit areas, pill corners and the tone budget are unchanged; Rules 15 and 18 and the wrapper-adoption sweep describe the new direction. |
| A20 | Detail lines | Every item row's detail line stays on one line at 320, 360 and 390px in English, Spanish and Portuguese; each card type shows its details in the accepted order, and a detail that does not fit drops whole; an age is always a number. |
| A21 | One height | Every card in a list is the same height on both surfaces, in every state, action and language; the pill under the title never makes a row grow. |
| A22 | One pill per card | A card shows one pill, its status; an error, a retry or a pending state replaces it, feedback is a detail, and the photo count sits on the photo. |
| A23 | Field messages (F3) | Fields reserve two message lines in the app and in the cockpit (DL-105, since 6 of the cockpit's 32 messages under side-by-side fields wrap at 640px); a message that fits the reserve never moves the form, and a longer one grows the slot rather than scrolling; the longest Spanish and Portuguese cockpit messages are measured in two-column forms at 640px. |

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
