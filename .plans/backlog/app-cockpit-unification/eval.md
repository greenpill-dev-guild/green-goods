# One Look for the App and the Cockpit — Evaluation

**Status:** acceptance criteria proposed; implementation and review results pending.

## Product validation

Compare the released surfaces with the accepted design using the same routes and content. Start with
a small formative round: a steward who also submits work as a gardener, and a gardener who has never
opened the cockpit. This is qualitative design validation, not a measured improvement claim.

Observe whether participants can:

- Tell which surface they are in within a second of opening it.
- Recognise a tab row, a status badge, a count badge and a work item as the same object on both.
- Find the filter on a list in either surface without hunting for a different control.
- Read a card list in the cockpit's dark theme without losing where one card ends.

Visual preference alone is not acceptance. Record wrong turns and hesitation, not opinions.

## Acceptance matrix

| ID | Case | Required proof |
|---|---|---|
| A1 | No layout or flow change | Route structure, element order and every flow's steps match `develop` on both surfaces; only look and shared elements differ. |
| A2 | Typeface (F1) | One family on both surfaces; no clipped, wrapped or truncated label that fitted before, in English, Spanish and Portuguese at 320, 360 and 390px; the static loading screen matches. |
| A3 | Ground (F2) | Canvas and cards match the accepted values in light and dark on both surfaces; green text and marks keep their contrast floor on the new ground. |
| A4 | Control boundary and focus (F3) | Secondary buttons, chips and fields have a 3:1 boundary in both themes; one focus-ring role shows on every control family. |
| A5 | Chips and filter (F4, F9) | One chip shape and selected treatment; the filter control opens the same choices by pointer and keyboard; Pending and Approved remain scopes of one list (DL-082). |
| A6 | Tabs (F8) | Equal-width cells on both surfaces; the longest Spanish and Portuguese labels fit at 320px; the selected tab is exposed to assistive technology as it is today on each surface. |
| A7 | Count badge (F10) | One badge on the app's bar, launchers, filter and tabs and on the cockpit's tabs; 9+, 99+ and single digits fit; the badge keeps the action contrast pair (DL-017). |
| A8 | Cards, rows and lists (F7, F11) | One card surface; a visible card edge in both themes; the accepted list gap on every list; the app keeps its status edge. |
| A9 | Desktop work card (F12) | The mosaic renders for no photo, one, two, and three or more photos, with its domain and count chips; phone widths keep the accepted phone layout. |
| A10 | Dark cards (F13) | A card is distinguishable from the canvas in the cockpit's dark theme without a zoomed screenshot; chips and wells on a card remain distinguishable from the card. |
| A11 | Sheets and bar (F5, F6) | The cockpit's phone sheet uses the shared surface and header; open, close, focus return and Back behave as before; the app's bar stays solid. |
| A12 | Dialects survive | Density, hit areas, button corners, workspace tone, motion and navigation chrome are unchanged on each surface. |
| A13 | The public website | No visual change on public routes unless a fork names one. |

## Guards the work trips

These checks will fail or need an explicit update. Each failure is intended; none is worked around.

- [check-tokens.sh](../../../scripts/design/check-tokens.sh): token presence, the cockpit's raw-token
  sweep and the token version coupling.
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
- The decision log needs a row for every accepted fork, naming the decision it supersedes.

## Verification posture for future implementation

Select proof with `bun run check --plan -- --intent qa` against the changed surfaces. Token and style
steps prove themselves with rendered pairs and the guards above. Steps that change a component's
structure (tabs, the filter control, the work card) also need focused behaviour proof at the owning
component. Do not add tests that only mirror markup.

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

These are document and mock checks. No application code changed, so no implementation, usability or
release evidence exists yet.
