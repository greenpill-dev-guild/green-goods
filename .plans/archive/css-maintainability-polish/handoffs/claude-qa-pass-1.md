# CSS Maintainability Polish - QA Pass 1 Handoff

**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: blocked until the revamped UI lane completes or explicitly defers with evidence
**Branch target**: `claude/qa-pass-1/css-maintainability-polish`
**Do not**: redesign public browser, installed PWA, or admin surfaces; do not start QA until `handoffs/claude-ui-revamp.md` has produced a scope-locked UI result.

## Current Truth

The hub is still active. `state_api` completed the custom-property guardrail, and the first `ui` pass completed only the low-friction alias cleanup. The active UI lane has been reopened and revamped in `handoffs/claude-ui-revamp.md` to cover the full CSS maintainability surface before QA starts.

Current static proof from the 2026-05-12 reassessment:

- `node scripts/harness/plan-hub.mjs validate` -> `Validated 19 feature hubs.`
- `node scripts/design/check-css-custom-properties.mjs` -> `CSS custom property guard passed: 3065 var() references, 1005 definitions, 60 audited unresolved entries.`
- `bun run check:design-tokens` -> passes, including custom-property, raw-token, admin Controlled Chrome, and token-version guards.
- `bun run check:design-generated` -> exits 0 but mutates generated/guidance files in this checkout. Treat that dirty-tree side effect as a blocker before implementation.

## First-Pass Work That Remains Valid

- `scripts/design/check-css-custom-properties.mjs` and its baseline remain the active undefined custom-property guard.
- The first UI pass resolved four mechanical alias drifts and reduced audited unresolved entries from 64 to 60.
- The remaining 60 audited unresolved entries are documented debt, not a current gate failure.
- The admin transparent AppBar and bounded sheet direction matches the admin UI contract, but still needs browser proof.
- Storybook importing shared utilities is a reasonable parity fix, but parity CSS now needs drift review against runtime CSS.

## QA Review Priorities

Review the completed or deferred UI lane result against these categories. Do not perform the UI lane's source audit here unless the UI handoff is missing or explicitly blocked.

1. Admin CSS source-of-truth pressure: `packages/admin/src/index.css` now carries many token families and broad globals while raw literals are allowlisted in token checks.
2. Shared Canvas ownership: `LeftSheet`, `RightSheet`, and `BottomSheet` consume `--admin-sheet-*` tokens with fallbacks; decide whether admin-scoped names are acceptable in shared Canvas primitives.
3. Storybook parity drift: `packages/shared/.storybook/storybook.css` duplicates admin tone/chrome/sheet roles and may drift from runtime imports.
4. PWA dialog ownership: local PWA drawer/dialog styles now coexist with shared dialog/scrim motion tokens; decide whether `--color-overlay` vs `--color-scrim` is intentional.
5. Typography debt: `packages/client/src/styles/typography.css` still owns the audited unresolved text/font entries; do not map these without semantic design approval and screenshots.
6. Story coverage drift: a `PwaSheet` story may be stale after shared `PwaSheet` removal; resolve before relying on Storybook as proof.
7. Raw-token baseline drift: social-preview raw colors are no longer a gate blocker, but remain audited generated-media debt.

## Required Visual Proof Before Closure

- Admin `/hub` and canvas routes: AppBar stays transparent over the canvas, tone layering is coherent in light/dark, and no glass appears outside Navigation/FAB/sheet shells.
- Admin sheets: left, right, and bottom sheets avoid AppBar/NavigationBar overlap across desktop and mobile widths; verify scroll, focus, close, and route-backed Actions create/edit/detail states.
- Client PWA drawers/dialogs: DraftDialog, ModalDrawer, Gardeners detail, and WorkDashboard modal preserve scrim, safe area, close animation, focus trap, and scroll lock at a narrow mobile viewport.
- Storybook parity: `ControlledChromeContract`, `CanvasLayout`, and Actions sheet stories match runtime assumptions before using them as closure evidence.
- Typography: capture before/after screenshots before resolving the 60 audited typography/font entries.
- Token alias fixes: verify the admin Hypercerts distribution chart and shared toast action hover/description styles if those surfaces have not already been visually proven.

## Human Judgment Points

Escalate back to the human or UI lane if the revamped UI result does not resolve these judgment points:

- Keep the second pass in this hub, or split into a larger follow-up hub if it expands into typography or admin-token-source extraction.
- Defer `typography.css` semantic token mapping to `client-pwa-design-system-transition`, unless the change is only removing no-op font-family rules.
- Accept `--admin-sheet-*` in shared Canvas primitives, or bridge to neutral `--canvas-sheet-*` names.
- Standardize PWA local drawers on `--color-scrim`, or keep `--color-overlay` as the client-local overlay token.
- Treat the generated/guidance dirt from `check:design-generated` as a separate docs/guidance cleanup before CSS code changes.

## Expected Output

After the revamped UI lane completes, write a QA pass report under this hub with:

- Numbered findings ordered by severity and proof confidence.
- Which issues are ready for targeted cleanup and which require more browser proof.
- Exact validation commands and browser/Storybook surfaces checked.
- A recommendation to continue in this hub or split a new follow-up hub.

Do not mark `qa_pass_1` passed until the report includes browser/Storybook evidence or explicitly records why a visual proof path is blocked.
