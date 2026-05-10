# CSS Maintainability Polish Plan

**Feature Slug**: `css-maintainability-polish`
**Stage**: `active`
**Status**: `ACTIVE — state_api COMPLETED on main, ui READY, qa BLOCKED`
**Created**: `2026-04-28`
**Last Updated**: `2026-05-10`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Create a new backlog hub instead of expanding `client-pwa-design-system-transition` | The PWA hub owns installed-client migration; this hub owns later cross-frontend CSS architecture polish. |
| 2 | Run this before the broader design-system alignment review | The alignment review should evaluate the cleaner post-release CSS surface rather than known stale drift. |
| 3 | Allow read-only inventory and guardrail design before broad cleanup | Inventory can reduce risk without forcing source edits too early. |
| 4 | Mark contracts `n/a` | This is frontend CSS/tooling work, not Solidity or deployment-adjacent behavior. |
| 5 | Use `state_api` only for tooling/quality checks | The plan hub has a fixed lane shape; guardrail scripts fit best in Codex's non-UI lane, but no runtime API work is intended. |

## Research / Plan Gate

- [x] Confirm no existing hub cleanly owns cross-frontend CSS maintainability polish.
- [x] Keep `client-pwa-design-system-transition` as the PWA-specific migration source.
- [x] Keep `design-system-alignment-review` as the read-only design review source.
- [x] Define out-of-scope redesign/framework work.
- [x] Choose validation commands future implementation must run.
- [x] Confirm prerequisite PWA QA is complete (`client-pwa-gardener-audit` archived)
- [ ] Refresh CSS inventory now that this hub is active.
- [ ] Reconfirm current active UI/design plan state before source cleanup.

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Inventory CSS ownership | `ui` | Phase 1 | Planned |
| Define global selector boundaries | `ui` | Phases 1 and 4 | Planned |
| Detect undefined custom properties | `state_api` | Phase 2 | Planned |
| Clean verified token/raw-value drift | `ui` | Phase 3 | Planned |
| Preserve browser/PWA/admin dialects | `ui`, `qa_pass_1` | Phases 3 and 5 | Planned |
| Validate guardrails and regression risk | `qa_pass_2` | Phase 5 | Blocked on QA pass 1 |

## Phase 0 - Preconditions

- [x] Confirm `public-read-side-journal` is archived (`.plans/archive/public-read-side-journal/`).
- [x] Confirm `client-pwa-gardener-audit` has completed QA and moved to archive.
- [x] Confirm `design-system-alignment-review` remains downstream of this cleanup.
- [x] State/API lane: re-run `node scripts/harness/plan-hub.mjs validate` (passes; 22 hubs).
- [ ] UI lane: re-run `node scripts/harness/plan-hub.mjs validate` before starting source changes.

## Phase 1 - CSS ownership inventory

- [ ] Inventory global CSS imports and the surfaces that consume them.
- [ ] Inventory shared component CSS, CSS modules, and component-level custom properties.
- [ ] Inventory client browser/editorial CSS versus installed PWA CSS.
- [ ] Inventory admin CSS overrides and shared primitive dependencies.
- [ ] Identify selector groups that are global by design, global by accident, and legacy by migration backlog.
- [ ] Capture the inventory under `handoffs/` or a durable docs page referenced by this plan.

## Phase 2 - Guardrail design

- [x] Review existing design validators and generated-token checks before adding anything new (admin M3 variable guard, admin Controlled Chrome guard, raw-value baseline already in `check-tokens.sh`).
- [x] Design the smallest undefined custom property check that fits the repo validation ladder (`scripts/design/check-css-custom-properties.mjs`, wired into `check-tokens.sh` after the admin Controlled Chrome guard).
- [x] Decide whether raw color/radius/motion enforcement belongs in existing scripts, Biome/oxlint, or a focused repo script — extended the existing `check-tokens.sh` rather than creating a new entry point.
- [x] Capture false-positive handling and any allowlist policy before implementation: external runtime prefixes (`--radix-*`, `--breakpoint-*`, `--tw-*`) bypass the check; legacy/migration debt routes through `scripts/data/css-custom-property-baseline.tsv` with required category, owner, expiry, and note fields.

## Phase 3 - Cleanup implementation

- [ ] Replace verified stale or undefined CSS variables with live runtime aliases.
- [ ] Collapse repeated raw values into existing tokens or local component variables where intent is clear.
- [ ] Move accidental globals into component/package ownership where safe.
- [ ] Remove legacy PWA typography/style leftovers only after the PWA transition plan owns the screen-level migration.
- [ ] Keep public browser editorial styling local to browser-facing components.
- [ ] Keep admin cleanup aligned with the admin wrapper and override strategy.

## Phase 4 - Durable guidance

- [ ] Update the smallest relevant guidance surface for CSS ownership rules.
- [ ] Record examples of approved component variable patterns.
- [ ] Record examples of global selector categories and disallowed leakage.
- [ ] Add validation commands to the plan handoff for future implementers.

## Phase 5 - Regression proof

State/API lane (complete on main):

- [x] `node --test scripts/design/check-css-custom-properties.test.mjs` (3/3 pass; RED reproduced by removing the script).
- [x] `node scripts/harness/plan-hub.mjs validate` (22 hubs validated).
- [x] `bun run check:design-generated`.
- [x] `bun run check:design-tokens` (now includes the new CSS custom property guard; 64 audited unresolved entries after pruning four now-defined admin M3 container roles).
- [x] `bun run lint:vocab`.

Still required after UI source cleanup:

- [ ] Targeted tests for touched shared/client/admin surfaces.
- [ ] Build or smoke-test client/admin where CSS changes affect runtime surfaces.
- [ ] Capture before/after visual evidence for representative browser, installed PWA, admin, and Storybook surfaces.

## Lane Checklists

### UI (`claude/ui/css-maintainability-polish`)

- [ ] Refresh source-grounded CSS ownership inventory.
- [ ] Implement only source-grounded CSS cleanup.
- [ ] Preserve public browser, installed PWA, and admin dialect boundaries.
- [ ] Add i18n for any new user-facing strings.
- [ ] Write `handoffs/claude-ui.md`.

### State / API (`codex/state-api/css-maintainability-polish`)

- [x] Review existing validators before adding scripts (existing `check-tokens.sh` covered admin M3 vars and admin Controlled Chrome but not general undefined `var(--*)`).
- [x] Add or refine the undefined custom property guard only if existing checks do not cover it (`scripts/design/check-css-custom-properties.mjs` + `scripts/data/css-custom-property-baseline.tsv`, wired into `bun run check:design-tokens`).
- [x] Keep work limited to tooling/quality checks; do not change runtime data/API behavior.
- [x] Write `handoffs/codex-state-api.md` (records provenance, scope, RED/GREEN proof, and ported-from-`release/1.1.0` reconciliation).

### Contracts (`codex/contracts/css-maintainability-polish`)

- [x] Marked `n/a` in `status.json`.
- [ ] Reopen only if scope changes unexpectedly.

### QA Pass 1 (`claude/qa-pass-1/css-maintainability-polish`)

- [ ] Review visual cohesion and dialect boundaries.
- [ ] Confirm source cleanup did not reopen active plan product decisions.
- [ ] Record visual evidence paths.
- [ ] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/css-maintainability-polish`)

- [ ] Start only after `qa_pass_1` passes.
- [ ] Confirm trigger branch exists: `claude/qa-pass-1/css-maintainability-polish`.
- [ ] Re-run targeted validation.
- [ ] Confirm guardrails and handoff evidence match the actual diff.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

State/API lane completed (this pass, on `main`):

- [x] `node --test scripts/design/check-css-custom-properties.test.mjs`
- [x] `node scripts/harness/plan-hub.mjs validate`
- [x] `bun run check:design-generated`
- [x] `bun run check:design-tokens`
- [x] `bun run lint:vocab`

Still required after UI cleanup:

- [ ] Targeted tests for touched shared/client/admin surfaces
- [ ] Client/admin build or smoke test when runtime CSS changes
- [ ] Before/after visual evidence for representative browser, installed PWA, admin, and Storybook surfaces
