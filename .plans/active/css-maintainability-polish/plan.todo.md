# CSS Maintainability Polish Plan

**Feature Slug**: `css-maintainability-polish`
**Stage**: `active`
**Status**: `ACTIVE — state_api completed; ui reopened as a full CSS maintainability lane; qa blocked until revamped ui completes`
**Created**: `2026-04-28`
**Last Updated**: `2026-05-12`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep this as a standalone hub instead of expanding `client-pwa-design-system-transition` | The PWA hub owns installed-client migration; this hub owns cross-frontend CSS architecture polish. |
| 2 | Run this before the broader design-system alignment review | The alignment review should evaluate the cleaner post-release CSS surface rather than known stale drift. |
| 3 | Allow read-only inventory and guardrail design before broad cleanup | Inventory can reduce risk without forcing source edits too early. |
| 4 | Mark contracts `n/a` | This is frontend CSS/tooling work, not Solidity or deployment-adjacent behavior. |
| 5 | Use `state_api` only for tooling/quality checks | The plan hub has a fixed lane shape; guardrail scripts fit best in Codex's non-UI lane, but no runtime API work is intended. |
| 6 | Reopen a second maintainability review pass after admin chrome/sheet and PWA dialog churn | The first guardrail and alias pass reduced known undefined-token debt, but later styling work changed global entrypoints, sheet geometry, Storybook parity, and PWA dialog ownership. This hub remains the owner for plan truth until QA proves the new surface. |
| 7 | Revamp the UI lane into the full CSS maintainability lane | The first UI pass was intentionally narrow. The active UI lane now owns full source-grounded audit, scope-lock recommendations, approved targeted cleanup, and visual-proof requirements across admin, client, shared, and Storybook CSS surfaces before QA starts. |

## Research / Plan Gate

- [x] Confirm no existing hub cleanly owns cross-frontend CSS maintainability polish.
- [x] Keep `client-pwa-design-system-transition` as the PWA-specific migration source.
- [x] Keep `design-system-alignment-review` as the read-only design review source.
- [x] Define out-of-scope redesign/framework work.
- [x] Choose validation commands future implementation must run.
- [x] Confirm prerequisite PWA QA is complete (`client-pwa-gardener-audit` archived)
- [x] Refresh CSS inventory now that this hub is active (first UI inventory plus 2026-05-12 post-churn reassessment).
- [x] Reconfirm current active UI/design plan state before source cleanup.
- [ ] Refresh the CSS inventory against `430fb41a` plus any current dirty generated/docs changes before implementation.
- [ ] Separate guardrail-pass proof from visual/browser proof; do not close on static gates alone.

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Inventory CSS ownership | `ui` | Phases 1 and 6 | Reopened for full coverage |
| Define global selector boundaries | `ui` | Phases 1, 4, and 6 | Reopened for full coverage |
| Detect undefined custom properties | `state_api` | Phase 2 | Done |
| Clean verified token/raw-value drift | `ui` | Phases 3 and 6 | Partial - first low-friction pass done; expanded cleanup pending scope lock |
| Preserve browser/PWA/admin dialects | `ui`, `qa_pass_1` | Phases 3, 5, and 6 | UI proof plan required before QA |
| Validate guardrails and regression risk | `qa_pass_1`, `qa_pass_2` | Phases 5 and 6 | QA blocked until revamped UI lane completes |

## Phase 0 - Preconditions

- [x] Confirm `public-read-side-journal` is archived (`.plans/archive/public-read-side-journal/`).
- [x] Confirm `client-pwa-gardener-audit` has completed QA and moved to archive.
- [x] Confirm `design-system-alignment-review` remains downstream of this cleanup.
- [x] State/API lane: re-run `node scripts/harness/plan-hub.mjs validate` (passed when lane completed).
- [x] UI lane: re-run `node scripts/harness/plan-hub.mjs validate` before starting source changes (low-friction pass completed).
- [x] Post-churn reassessment: re-run `node scripts/harness/plan-hub.mjs validate` (`Validated 19 feature hubs.`).

## Phase 1 - CSS ownership inventory

- [ ] Inventory global CSS imports and the surfaces that consume them.
- [ ] Inventory shared component CSS, CSS modules, component-level custom properties, and Tailwind v4 shared-source scan risks.
- [ ] Inventory client browser/editorial CSS versus installed PWA CSS, including PWA drawer/dialog style modules and `typography.css`.
- [ ] Inventory admin CSS overrides, M3 token files, CanvasLayout, AppBar/canvas layering, Navigation/FAB/sheet glass boundaries, and shared primitive dependencies.
- [ ] Inventory Storybook parity CSS and stale story coverage risk, including any `PwaSheet` story drift after shared primitive removal.
- [ ] Identify selector groups that are global by design, global by accident, and legacy by migration backlog.
- [ ] Identify token families that are canonical, package-local, bridge aliases, stale aliases, or baselined debt.
- [ ] Capture the inventory under `handoffs/` or a durable docs page referenced by this plan.

## Phase 2 - Guardrail design

- [x] Review existing design validators and generated-token checks before adding anything new (admin M3 variable guard, admin Controlled Chrome guard, raw-value baseline already in `check-tokens.sh`).
- [x] Design the smallest undefined custom property check that fits the repo validation ladder (`scripts/design/check-css-custom-properties.mjs`, wired into `check-tokens.sh` after the admin Controlled Chrome guard).
- [x] Decide whether raw color/radius/motion enforcement belongs in existing scripts, Biome/oxlint, or a focused repo script — extended the existing `check-tokens.sh` rather than creating a new entry point.
- [x] Capture false-positive handling and any allowlist policy before implementation: external runtime prefixes (`--radix-*`, `--breakpoint-*`, `--tw-*`) bypass the check; legacy/migration debt routes through `scripts/data/css-custom-property-baseline.tsv` with required category, owner, expiry, and note fields.

## Phase 3 - Cleanup implementation

- [ ] Produce numbered UI findings and get human scope lock before runtime CSS edits.
- [ ] Replace verified stale or undefined CSS variables with live runtime aliases.
- [ ] Collapse repeated raw values into existing tokens or local component variables where intent is clear.
- [ ] Move accidental globals into component/package ownership where safe.
- [ ] Remove legacy PWA typography/style leftovers only after the PWA transition plan owns the screen-level migration.
- [ ] Resolve stale Storybook coverage only after confirming the primitive/component was actually removed or moved.
- [ ] Standardize overlay/scrim naming only after deciding whether the owner is shared dialog utilities or client-local PWA drawer styles.
- [ ] Preserve shared Canvas/admin sheet behavior unless a scope-locked bridge or rename has browser/Storybook proof.
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
- [x] `node scripts/harness/plan-hub.mjs validate` (passed when lane completed; current reassessment validates 19 hubs).
- [x] `bun run check:design-generated` (historical state_api pass; current reassessment exits 0 but mutates generated/guidance files in this checkout).
- [x] `bun run check:design-tokens` (now includes the CSS custom property guard; current reassessment passes with 60 audited unresolved custom-property entries).
- [x] `bun run lint:vocab`.

Current static gates (2026-05-12 reassessment):

- [x] `node scripts/harness/plan-hub.mjs validate` -> `Validated 19 feature hubs.`
- [x] `node scripts/design/check-css-custom-properties.mjs` -> `CSS custom property guard passed: 3065 var() references, 1005 definitions, 60 audited unresolved entries.`
- [x] `bun run check:design-tokens` -> passes, including the custom-property guard, admin Controlled Chrome guard, raw-token baseline, and token version coupling.
- [x] `bun run check:design-generated` -> exits 0, but mutates generated/guidance files in this checkout; treat that dirty-tree side effect as a blocker to resolve before implementation.

Still required after revamped UI lane scope lock:

- [ ] Targeted tests for touched shared/client/admin surfaces.
- [ ] Build or smoke-test client/admin where CSS changes affect runtime surfaces.
- [ ] Capture before/after visual evidence for representative browser, installed PWA, admin, and Storybook surfaces.

## Phase 6 - Revamped UI Lane: Full CSS Maintainability

- [ ] Start from `handoffs/claude-ui-revamp.md`.
- [ ] Reconcile plan/status/handoffs to current validation: 19 hubs, 3065 var refs / 1005 definitions / 60 audited unresolved, `check:design-tokens` passing, and `check:design-generated` mutating generated/guidance files despite exit 0 in this checkout.
- [ ] Classify recent admin chrome/sheet changes as accepted local fixes, token-source debt, token naming drift, or visual-QA blockers.
- [ ] Classify global CSS entrypoints, broad selectors, and package import boundaries for maintainability risk.
- [ ] Classify client PWA dialog inlining against the shared scrim/dialog-motion contract; decide whether `--color-overlay` vs `--color-scrim` is intentional.
- [ ] Decide ownership for the 60 audited unresolved typography/font entries before source changes.
- [ ] Review Storybook parity CSS against admin runtime tokens and resolve any stale/untracked `PwaSheet` story drift before relying on Storybook gates.
- [ ] Review raw-token and custom-property baselines for owner/category/expiry quality and stale entries.
- [ ] Check shared Canvas component CSS variable fallbacks against admin runtime behavior and Tailwind v4 shared-source constraints.
- [ ] Produce a scope-lock report with numbered findings before any runtime CSS edits.
- [ ] Implement only approved targeted cleanup, or explicitly defer cleanup with evidence.
- [ ] Capture browser/Storybook proof for admin shell, sheets, client drawers, representative typography, chart/toast token fixes, and Storybook parity before handing to QA.

## Phase 7 - Modern Web UI Primitive Follow-Up

- [ ] Start from `reports/modern-web-ui-follow-up-2026-05-24.md`.
- [ ] Add a feature-readiness ladder to the UI lane scope-lock report: production-ready primitives, progressive pilots, and research-only APIs.
- [ ] Audit text-scale readiness before adding `<meta name="text-scale" content="scale">` to client or admin HTML.
- [ ] Identify one isolated admin candidate for an element-scoped View Transition pilot; defer if browser support or proof cost is not acceptable.
- [ ] Identify long-form public/admin surfaces where CSS scroll spy could improve guided navigation without app-state coupling.
- [ ] Identify dense admin table/grid surfaces where gap decorations could be a progressive enhancement under `@supports`.
- [ ] Inventory native dialog/popover opportunities, including `closedby="any"` only where fallback behavior, focus, escape, and reduced motion remain proven.
- [ ] Keep overscroll gestures, HTML-in-Canvas, CSS `@function`, CSS `if()`, broad style-query architecture, `corner-shape`, `shape()`, `border-shape`, and `fit-text` out of production scope.
- [ ] Do not run `bun run check:design-generated` during this plan-only follow-up until its dirty-tree side effect is resolved.

## Lane Checklists

### UI (`claude/ui/css-maintainability-polish`)

First low-friction pass completed:

- [x] Refresh source-grounded CSS ownership inventory (`handoffs/claude-ui.md` § CSS Ownership Inventory).
- [x] Implement only source-grounded CSS cleanup (4 mechanical alias renames: admin DistributionChart `info → information`; shared toast `primary-strong → primary-dark`, `text-subtle-600 → text-sub-600`; baseline pruned 64 → 60).
- [x] Preserve public browser, installed PWA, and admin dialect boundaries (no shell or entrypoint CSS touched; admin/client/shared/Storybook surfaces stayed in their own dialects).
- [x] Add i18n for any new user-facing strings (no new strings introduced).
- [x] Write `handoffs/claude-ui.md`.

Revamped full maintainability pass:

- [ ] Start from `handoffs/claude-ui-revamp.md`.
- [ ] Audit all CSS maintainability surfaces: entrypoints, shared utilities, admin M3 overrides, Canvas/sheets/navigation, client typography/PWA drawers, Storybook parity, baselines, raw tokens, and Tailwind v4 shared-source risks.
- [ ] Fold the modern Web UI follow-up report into the scope-lock recommendations without turning the pass into redesign.
- [ ] Classify findings into real regression, acceptable local fix, global styling drift, token naming drift, documented technical debt, or visual proof required.
- [ ] Present a numbered scope-lock report before runtime CSS edits.
- [ ] Implement only approved targeted cleanup, preserving dialect boundaries and avoiding redesign.
- [ ] Update plan/status/handoffs with evidence, blockers, and validation.

### State / API (`codex/state-api/css-maintainability-polish`)

- [x] Review existing validators before adding scripts (existing `check-tokens.sh` covered admin M3 vars and admin Controlled Chrome but not general undefined `var(--*)`).
- [x] Add or refine the undefined custom property guard only if existing checks do not cover it (`scripts/design/check-css-custom-properties.mjs` + `scripts/data/css-custom-property-baseline.tsv`, wired into `bun run check:design-tokens`).
- [x] Keep work limited to tooling/quality checks; do not change runtime data/API behavior.
- [x] Write `handoffs/codex-state-api.md` (records provenance, scope, RED/GREEN proof, and ported-from-`release/1.1.0` reconciliation).

### Contracts (`codex/contracts/css-maintainability-polish`)

- [x] Marked `n/a` in `status.json`.
- [ ] Reopen only if scope changes unexpectedly.

### QA Pass 1 (`claude/qa-pass-1/css-maintainability-polish`)

- [ ] Start only after the revamped UI lane is completed or explicitly deferred with evidence.
- [ ] Start from `handoffs/claude-qa-pass-1.md`.
- [ ] Review the UI lane's cleanup and proof against CSS maintainability risk and dialect boundaries.
- [ ] Confirm source cleanup did not reopen active plan product decisions or broaden into redesign.
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
- [x] `bun run check:design-generated` (historical pass; current reassessment exits 0 but leaves generated/guidance dirt)
- [x] `bun run check:design-tokens`
- [x] `bun run lint:vocab`

Current reassessment completed:

- [x] `node scripts/harness/plan-hub.mjs validate`
- [x] `node scripts/design/check-css-custom-properties.mjs`
- [x] `bun run check:design-tokens`

Still required after revamped UI lane and QA scope lock:

- [ ] Targeted tests for touched shared/client/admin surfaces
- [ ] Client/admin build or smoke test when runtime CSS changes
- [ ] Before/after visual evidence for representative browser, installed PWA, admin, and Storybook surfaces
