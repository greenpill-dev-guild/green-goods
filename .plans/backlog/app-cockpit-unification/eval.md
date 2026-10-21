# One Look for the App and the Cockpit — Evaluation

**Status:** acceptance criteria follow the locked picks; the design gate for the token slices ran on 2026-10-20 ([below](#design-gate-for-the-token-slices)); implementation and review results pending.

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
| A6 | Tabs (F8) | Equal-width cells on both surfaces; the longest Spanish and Portuguese labels fit at 320px; the selected tab is exposed to assistive technology as it is today on each surface; on desktop each cell is at most 180px wide and the row aligns left. |
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
| A23 | Field messages (F3) | Fields reserve two message lines in the app and one in the cockpit; a message that fits the reserve never moves the form, and a longer one grows the slot rather than scrolling; the longest Spanish and Portuguese cockpit messages are measured in two-column forms at 640px. |

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

**Installs.** The worktree linked the main checkout's installs, which predate `develop`'s lockfile
(Vite 8.2.1 where `develop` pins 8.2.4); nothing was installed.
