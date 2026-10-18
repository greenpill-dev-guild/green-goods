# One Look for the App and the Cockpit — Evaluation

**Status:** acceptance criteria follow the picks accepted in principle; implementation and review results pending.

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
| A6 | Tabs (F8) | Equal-width cells on both surfaces; the longest Spanish and Portuguese labels fit at 320px; the selected tab is exposed to assistive technology as it is today on each surface. |
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

These are document and mock checks. No application code changed, so no implementation, usability or
release evidence exists yet.
