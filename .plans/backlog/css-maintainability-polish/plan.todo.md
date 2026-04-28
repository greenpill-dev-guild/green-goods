# CSS Maintainability Polish Plan

**Feature Slug**: `css-maintainability-polish`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-28`
**Last Updated**: `2026-04-28`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Create a new backlog hub instead of expanding the PWA transition | The PWA hub owns installed-client migration; this hub owns the final cross-frontend CSS maintainability polish after active plans land. |
| 2 | Sequence after current UI/design work | Avoid moving CSS foundations underneath active editorial/PWA/admin work. |
| 3 | Treat tooling as targeted guardrails, not a new CSS framework | The discovered drift is undefined variables, raw values, and global ownership; a framework migration would be disproportionate. |
| 4 | Keep dialect visuals stable | This pass should improve maintainability without redesigning public browser, PWA, or admin surfaces. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`.
- [x] Identify existing plan dependencies and related hubs.
- [x] Define out-of-scope framework/design rewrites.
- [ ] Before implementation, refresh the CSS inventory after active UI plans are complete.
- [ ] Confirm whether `client-pwa-design-system-transition` Stage 0 is complete.
- [ ] Confirm whether `design-system-alignment-review` has current drift findings to consume.

## Sequencing Gate

Do not start broad source cleanup until these are true, unless the user explicitly reorders the work:

- [ ] `public-read-side-journal` is archived or no longer moving public browser CSS.
- [ ] `client-pwa-design-system-transition` Stage 0 typography scope is complete.
- [ ] Active admin/client visual plans that touch shared CSS surfaces have landed or paused.
- [ ] A fresh `node scripts/harness/plan-hub.mjs validate` pass records the current plan board.

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Inventory CSS ownership and globals | `ui` | Phase 1 | Planned |
| Add undefined CSS variable guard | `state_api` | Phase 2 | Planned |
| Clean global selector and raw-value drift | `ui` | Phase 3 | Planned |
| Document durable CSS ownership rules | `ui` / `state_api` | Phase 4 | Planned |
| Run public/PWA/admin regression proof | `qa_pass_1` / `qa_pass_2` | Phase 5 | Blocked on implementation |

## Future Phase Checklists

### Phase 1 - CSS Ownership Inventory

- [ ] List all package entry CSS files and shared CSS sources.
- [ ] Classify every bare element selector as approved base/reset, shell-scoped, or drift.
- [ ] Classify all package global typography rules.
- [ ] Compare `var(--*)` references against shared token definitions and documented local variables.
- [ ] Compare raw colors, primitive palette classes, durations, easing, radii, shadows, and overlays
  against existing generated/token baselines.
- [ ] Record rejected false positives so future passes do not churn valid exceptions.

### Phase 2 - CSS Drift Guardrails

- [ ] Add or design a repo-local check for undefined CSS custom properties.
- [ ] Add an allowlist format for component-local variables with a short rationale.
- [ ] Decide whether global selector ownership should be checked by script, lint rule, or review
  checklist.
- [ ] Wire any durable script through `package.json` and document it in `scripts/README.md` if it lands
  under `scripts/`.
- [ ] Start new checks as reporting-only if the first run exposes legacy debt that needs staged cleanup.

### Phase 3 - Cleanup Pass

- [ ] Consume the completed PWA Stage 0 output rather than duplicating it.
- [ ] Remove or scope remaining legacy typography aliases and broad selectors not already fixed.
- [ ] Replace undefined custom-property references with current shared token utilities or local
  variables.
- [ ] Replace raw style values with Warm Earth semantic tokens where the mapping is clear.
- [ ] Remove baseline/audit rows only after source usages are fixed.
- [ ] Keep compatibility aliases only with a documented owner and removal path.

### Phase 4 - Durable Guidance

- [ ] Document CSS ownership in the smallest existing agent/developer surface that already governs
  frontend work.
- [ ] Link to root `DESIGN.md`, package design overlays, and the design alignment protocol instead of
  copying the Warm Earth spec.
- [ ] Clarify when component-local CSS variables are preferred over new tokens.
- [ ] Clarify when inline CSS variables are acceptable for layout or Tailwind scan boundaries.

### Phase 5 - Regression Proof

- [ ] Public browser: verify `/`, `/gardens`, `/gardens/:id`, `/impact`, `/fund`, `/actions`,
  `SiteHeader`, and public dialogs.
- [ ] Installed PWA: verify `/home`, `/garden`, `/profile`, AppBar, loading/splash, drawers, media, and
  offline/sync surfaces with installed-mode evidence.
- [ ] Admin: verify `/hub` and any admin primitive/shell surfaces touched by shared CSS changes.
- [ ] Run design gates and targeted package tests.
- [ ] Record proof limits if screenshots use built bundle, mocks, or sparse seeded data.

## Lane Checklists

### UI (`claude/ui/css-maintainability-polish`)

- [ ] Refresh CSS ownership inventory.
- [ ] Implement tightly scoped CSS source cleanup after sequencing gate passes.
- [ ] Preserve public browser, PWA, and admin visual dialects.
- [ ] Add i18n only if user-facing text changes.
- [ ] Write `handoffs/claude-ui.md`.

### State / API (`codex/state-api/css-maintainability-polish`)

- [ ] Own scripts/checks for undefined CSS variables or global selector drift.
- [ ] Keep scripts durable: package.json caller or documented validation path required.
- [ ] Do not touch runtime API/data behavior.
- [ ] Write `handoffs/codex-state-api.md`.

### Contracts (`codex/contracts/css-maintainability-polish`)

- [x] Mark this lane `n/a`.
- [ ] Reopen only if a future CSS artifact unexpectedly depends on contract-generated assets, which is
  not expected.

### QA Pass 1 (`claude/qa-pass-1/css-maintainability-polish`)

- [ ] Review visual regressions and UX drift across public browser, PWA, and admin surfaces.
- [ ] Confirm broad selector cleanup did not change editorial/PWA typography unintentionally.
- [ ] Verify acceptance criteria from `eval.md`.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/css-maintainability-polish`)

- [ ] Re-run CSS guardrails and design gates.
- [ ] Run targeted client/admin/shared tests for touched surfaces.
- [ ] Confirm generated audit/baseline files are current or intentionally unchanged.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- [ ] `node scripts/harness/plan-hub.mjs validate`
- [ ] `bun run check:design-generated`
- [ ] `bun run check:design-tokens`
- [ ] `bun run check:design-md`
- [ ] `bun run lint:vocab`
- [ ] Future implementation: targeted package tests for touched surfaces
- [ ] Future implementation: `VITE_CHAIN_ID=11155111 bun run build:client` if client CSS changes
- [ ] Future implementation: admin build/smoke if shared/admin CSS changes
