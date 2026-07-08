# CSS Maintainability Polish - Revamped UI Lane Handoff

**Lane**: `ui`
**Owner**: `claude`
**Status**: completed
**Branch target**: `claude/ui/css-maintainability-polish`
**Previous UI handoff**: `handoffs/claude-ui.md`
**Mode**: audit first, then human scope lock, then targeted cleanup only.

## Current Truth

The first UI pass is valid historical work, but it was intentionally narrow: four mechanical token alias fixes and a custom-property baseline prune from 64 to 60 audited unresolved entries. This revamped lane is the active UI lane for the full CSS maintainability surface.

Do not treat this as a redesign lane. The goal is to prove and improve maintainability while preserving the browser, installed PWA, admin, shared, and Storybook dialect boundaries.

Current static baseline from the post-churn reassessment:

- `node scripts/harness/plan-hub.mjs validate` -> `Validated 19 feature hubs.`
- `node scripts/design/check-css-custom-properties.mjs` -> `CSS custom property guard passed: 3065 var() references, 1005 definitions, 60 audited unresolved entries.`
- `bun run check:design-tokens` -> passes, including custom-property, raw-token, admin Controlled Chrome, and token-version guards.
- `bun run check:design-generated` -> exits 0 but mutates generated/guidance files in this checkout. Resolve ownership before relying on it as a clean gate.

## Required Audit Surface

Cover every category below before proposing source changes:

1. Global CSS entrypoints and import boundaries: `packages/admin/src/index.css`, `packages/client/src/index.css`, `packages/shared/src/styles/theme.css`, `packages/shared/src/styles/utilities.css`, and `packages/shared/.storybook/storybook.css`.
2. Admin dialect: `admin-m3-tokens.css`, `admin-m3-overrides.css`, `CanvasLayout`, AppBar/canvas tone layering, Navigation/FAB/sheet glass boundaries, and `--admin-nav-*` / `--admin-sheet-*` ownership.
3. Shared Canvas primitives: `LeftSheet`, `RightSheet`, `BottomSheet`, CSS variable fallbacks, and whether admin-prefixed tokens are acceptable in shared foundations.
4. Client dialect: `typography.css`, `utilities.css`, `animation.css`, `view-transitions.css`, `editorial.css`, PWA drawer/dialog style modules, and browser-vs-installed-PWA boundaries.
5. PWA dialog and drawer ownership: local inlined drawers/dialogs versus shared dialog/scrim/motion utilities; classify `--color-overlay` versus `--color-scrim`.
6. Storybook parity: admin runtime token parity, stale story coverage, and the untracked/stale `PwaSheet` story risk after shared PwaSheet removal.
7. Token and custom-property health: unresolved baseline entries, stale aliases, fallback reachability, raw color/radius/motion literals, baseline owner/category/expiry quality, and cascade reachability where static guards cannot prove runtime behavior.
8. Tailwind v4 shared-source gotcha: any layout/class fix authored in `packages/shared/src` must be checked against admin/client runtime behavior, not only Storybook.
9. Visual QA requirements: identify which findings need browser or Storybook proof before code changes and which can be handled mechanically.
10. Plan truth: update `status.json`, `plan.todo.md`, handoffs, and validation evidence if the lane scope or result changes.

## Classification Contract

Use these buckets in the UI lane report:

- **Real regression**: proven broken rendered behavior, broken guard, or broken runtime CSS contract.
- **Acceptable local fix**: targeted change aligned with the admin/client/shared contract and low maintainability risk.
- **Global styling drift**: broad selector, import, baseline, or entrypoint pattern that increases future risk.
- **Token naming drift**: stale alias, duplicate semantic token family, or unclear token ownership.
- **Documented technical debt**: known, baselined, and not currently blocking, but still needs owner/expiry.
- **Visual proof required**: cannot be safely changed or closed from static inspection alone.

## Scope Lock Rules

After the audit, present numbered findings and wait for human scope lock before runtime CSS edits.

Allowed after scope lock:

- Mechanical token alias fixes where live token intent is unambiguous.
- Removing stale Storybook coverage that references deleted primitives, if confirmed.
- Narrow baseline updates when source and baseline move together with proof.
- Local CSS ownership cleanups that reduce global reach without changing visual intent.
- Minimal bridge aliases if they clarify ownership and are validated by browser/Storybook proof.

Do not do without explicit approval:

- Semantic remapping of the 60 audited typography/font entries.
- Broad admin `index.css` extraction or token-source refactors.
- Redesigning AppBar, sheets, PWA drawers, public browser editorial surfaces, or Storybook frames.
- New top-level CSS systems, packages, or duplicate design-token sources.
- Formatting unrelated dirty files or resolving generated/design-doc dirt outside this lane's locked scope.

## Required Output

Write or update the UI handoff with:

- A source-grounded inventory of the full audit surface.
- Numbered findings with severity, category, evidence, and recommended disposition.
- A proposed smallest cleanup batch, explicitly separated from deferred design decisions.
- Visual proof checklist for admin shell/sheets, client PWA drawers, Storybook parity, typography, chart/toast aliases, and any touched surface.
- Validation commands run and exact blockers.

The lane is complete only when the scope-locked cleanup is either implemented and validated, or intentionally deferred with enough evidence for `qa_pass_1` to verify. QA pass 1 stays blocked until then.

## 2026-05-24 Codex Scope-Lock Audit

Mode: read-only runtime CSS audit. No runtime CSS was edited.

Current checkout evidence:

- Branch / HEAD: `main` / `06a8108c`.
- Dirty work preserved: `docs/routines/README.md`, `docs/routines/bug-intake.md`, and `docs/routines/health-watch.md`.
- `node scripts/harness/plan-hub.mjs validate` -> `Validated 21 feature hubs.`
- `node scripts/design/check-css-custom-properties.mjs` -> `CSS custom property guard passed: 3094 var() references, 1005 definitions, 60 audited unresolved entries.`
- `bun run check:design-tokens` -> passed, including custom-property, raw-token, admin Controlled Chrome, and token-version guards.
- `bun run --filter @green-goods/shared check:stories` -> `174/174 required Storybook surfaces have stories (100%)`.
- `bun run --filter @green-goods/shared check:story-quality` -> checked 148 story files, pass.
- Targeted tests passed with package Vitest wrappers: client `pwaDrawerStyles` 3/3, shared `RightSheet` + `BottomSheet` 21/21, admin `AdminDialog` + `CanvasLayout` 28/28. A direct root `bunx vitest run ...` attempt is not a clean gate for these suites because it bypassed package setup and hit environment/module-loader errors before the package wrappers passed.

Numbered findings:

1. Severity P1. Category: plan truth consistency. Evidence: the current validator/custom-property counts are 21 hubs and 3094 var refs, while the revamped handoff still records the old 19-hub / 3065-ref baseline. Recommended disposition: update plan evidence before any implementation claim; this is plan truth cleanup, not runtime CSS.
2. Severity P1. Category: PWA dialog/drawer ownership and token naming drift. Evidence: `theme.css` says `--color-scrim` is the standard PWA dialog backdrop token; shared `PwaSheet` uses `--color-scrim`; client `pwaDrawerStyles` still uses `--color-overlay` for `overlay` and `dialogOverlay`; public editorial dialogs also use `--color-overlay`. Recommended disposition: default cleanup batch may align installed-PWA drawer overlays to `--color-scrim` after human approval; do not touch public editorial dialogs in the same batch.
3. Severity P1. Category: typography/custom-property debt. Evidence: the 60 audited unresolved entries are still baselined legacy text/font tokens, mainly `packages/client/src/styles/typography.css`, plus Storybook font-family usage. Recommended disposition: defer semantic remapping; do not include the 60-entry typography/font migration in the default cleanup batch.
4. Severity P2. Category: shared Canvas primitive fallbacks. Evidence: bounded `LeftSheet`, `RightSheet`, and `BottomSheet` consume `--admin-sheet-*` tokens with explicit fallbacks, while `admin/index.css` and Storybook define the family. Targeted shared/admin tests pass. Recommended disposition: accept the bridge as current contract; require admin runtime and Storybook proof only if a later batch changes sheet geometry or token names.
5. Severity P2. Category: Tailwind v4 shared-source risk. Evidence: admin override comments explicitly compensate for shared Tailwind classes not being compiled into admin CSS; Storybook uses `@source` for admin/client. Recommended disposition: no new CSS system or package source; any shared-component class cleanup must be validated in admin and client runtime, not Storybook alone.
6. Severity P2. Category: Storybook parity. Evidence: Storybook imports shared theme/utilities plus admin M3 token/override CSS, and the story coverage/quality gates are green. Recommended disposition: keep Storybook as parity scaffold, but do not treat it as visual proof for runtime browser/PWA/admin surfaces.
7. Severity P2. Category: admin dialect and M3 overrides. Evidence: `check:design-tokens` passed the admin Controlled Chrome guard; `admin-m3-overrides.css` keeps AppBar transparent and reserves glass/backdrop for navigation, FAB, and sheet shells. Recommended disposition: no admin chrome, AppBar, sheet, or M3 runtime cleanup in the default batch.
8. Severity P2. Category: global CSS entrypoints and import boundaries. Evidence: admin and client entrypoints intentionally own document-level shell imports/resets; client keeps browser/PWA/editorial CSS in the client entrypoint; shared theme/utilities remain the only shared CSS package exports. Recommended disposition: no broad extraction, no new top-level CSS source, and no import-boundary rewrite in this lane.
9. Severity P3. Category: validation gate hygiene. Evidence: the plan already warns that `bun run check:design-generated` exits 0 but mutates generated/guidance files in this checkout. Recommended disposition: exclude it as a clean gate for the cleanup batch until that side effect is resolved.
10. Severity P3. Category: worktree hygiene. Evidence: unrelated dirty docs/routines files were present before this audit and remained the only dirty files after validation. Recommended disposition: preserve them and do not stage or format them for this lane.

Proposed smallest cleanup batch after human approval:

1. Plan evidence refresh: update this hub's current validation counts from 19/3065 to 21/3094 and record the scope-lock result. This is already safe plan-work scope.
2. Runtime CSS micro-batch: align installed-PWA drawer/dialog overlay tokens in `packages/client/src/styles/pwaDrawerStyles.ts` from `--color-overlay` to `--color-scrim`, because shared `PwaSheet` and the theme contract already identify scrim as the PWA dialog backdrop token.
3. Keep all admin chrome, shared Canvas geometry, Storybook frame styling, public browser editorial dialogs, AppBar, sheets, drawers, and the 60 audited typography/font entries out of the default batch.

Deferred design decisions:

- Whether to remap or remove the 60 audited typography/font entries.
- Whether public editorial dialogs should eventually move from `--color-overlay` to a browser-specific or scrim token.
- Whether admin-prefixed sheet geometry tokens should eventually become shared neutral sheet tokens.
- Whether `check:design-generated` should be fixed in this lane or a separate generated-artifact hygiene lane.

Validation and visual-proof plan for the proposed runtime micro-batch:

- Static gates: `git status --short`; `node scripts/harness/plan-hub.mjs validate`; `node scripts/design/check-css-custom-properties.mjs`; `bun run check:design-tokens`; `bun run lint:vocab`.
- Targeted tests: package-wrapper Vitest for `packages/client/src/__tests__/styles/pwaDrawerStyles.test.ts`; rerun shared/admin sheet/dialog tests only if shared/admin files are touched.
- Storybook gates: `bun run --filter @green-goods/shared check:stories`; `bun run --filter @green-goods/shared check:story-quality`; targeted Storybook browser proof for `Client/Dialogs/ModalDrawer`, `Shared/Feedback/PwaSheet`, and any touched installed-PWA protected surface.
- Runtime visual proof: capture before/after mobile screenshots for installed PWA drawers (`ModalDrawer`, work dashboard/draft flows, `DraftDialog`) and confirm overlay opacity, safe-area padding, reduced-motion behavior, close animation, no horizontal overflow, and AppBar hiding under drawers.
- Explicit non-gate: do not use `bun run check:design-generated` as clean evidence until its dirty-tree side effect is resolved.

## 2026-05-24 Codex Approved Micro-Batch Completion

Mode: human-approved runtime CSS micro-batch after the scope-lock report above. Runtime CSS edits were limited to installed-PWA drawer/dialog backdrop token ownership.

Files changed for this lane:

- `packages/client/src/styles/pwaDrawerStyles.ts`: `overlay` and `dialogOverlay` now use `bg-[var(--color-scrim)]` instead of `bg-[var(--color-overlay)]`.
- `packages/client/src/__tests__/styles/pwaDrawerStyles.test.ts`: added a focused assertion that both backdrop slots use `--color-scrim` and do not regress to `--color-overlay`.
- Plan/workflow truth surfaces updated: this handoff, `status.json`, `plan.todo.md`, AI-native agent-run ledger, workflow scorecard, and closeout gate notes.

Preserved boundaries:

- Public browser/editorial overlays remain on `--color-overlay`.
- Admin chrome, AppBar, shared Canvas geometry, sheets, drawers, Storybook frames, and the 60 audited typography/font entries were not remapped.
- No new CSS entrypoint, token source, package, or top-level CSS system was added.
- `bun run check:design-generated` remains excluded as a clean gate because of the known dirty-tree side effect.

Validation evidence after implementation:

- `git status --short` was refreshed after interruption; unrelated dirty docs/routines and `packages/agent` files were preserved outside this lane.
- `node scripts/harness/plan-hub.mjs validate` -> `Validated 21 feature hubs.`
- `node scripts/design/check-css-custom-properties.mjs` -> `CSS custom property guard passed: 3096 var() references, 1005 definitions, 60 audited unresolved entries.`
- `bun run check:design-tokens` -> passed, including custom-property, raw-token, admin Controlled Chrome, and token-version guards.
- `bun run lint:vocab` -> passed.
- `bun run --filter @green-goods/shared check:stories` -> `174/174 required Storybook surfaces have stories (100%)`.
- `bun run --filter @green-goods/shared check:story-quality` -> checked 148 story files, pass.
- Client package-wrapper Vitest: `APP_ENV=test node ../../scripts/dev/node-cli.js vitest run src/__tests__/styles/pwaDrawerStyles.test.ts` -> 4/4 tests passed. The first sandboxed attempt hit Vite temp-config `EPERM`; the approved rerun outside the sandbox passed.
- `bun run build:client` -> passed. The first sandboxed attempt hit Vite temp-config `EPERM`; the approved rerun outside the sandbox passed. Built CSS contains `background-color:var(--color-scrim)`.

Browser/visual evidence:

- `output/playwright/css-maintainability-pwa-modaldrawer-scrim.png`: Storybook `Client/Dialogs/ModalDrawer` mobile geometry proof. Computed evidence: overlay class `fixed inset-0 z-modal flex items-end justify-center bg-[var(--color-scrim)] modal-backdrop-enter`; backdrop `rgba(12, 10, 9, 0.22)`; z-index `50`; overlay rect `390x844`; drawer rect width `390`, bottom aligned to viewport; animation `modalSlideIn`; close target `44x44`; document scroll width `390`.
- `output/playwright/css-maintainability-shared-pwasheet-scrim.png`: Storybook `Shared/Feedback/PwaSheet` parity proof. Computed evidence: scrim style `background-color: var(--color-scrim)`; backdrop `rgba(12, 10, 9, 0.22)`; overlay rect `390x844`; sheet open and bottom aligned; document scroll width `390`.
- `output/playwright/pwa-home-smoke.png`: client PWA dev URL smoke. The unseeded local runtime stayed on the loading spinner, so this pass does not claim full seeded installed-PWA route proof. QA pass 1 should run route-level proof if it has the seeded/runtime context needed.

Modern Web Guidance note:

- Attempted `npx modern-web-guidance@latest search "modal dialog backdrop css accessibility"` as required by the local web-guidance skill. Running inside the repo failed on the npm `react` override conflict; running from `/private/tmp` failed inside the package with `ERR_INVALID_ARG_TYPE`. This implementation therefore proceeded from repo-local guidance, semantic dialog/sheet contracts already in Storybook, and browser-computed visual proof.

Outcome:

- Revamped UI lane is complete for the approved cleanup batch.
- QA pass 1 is ready to review the recorded source diff and proof.
- Deferred decisions remain unchanged: the 60 typography/font entries, public editorial overlay semantics, shared neutral sheet-token naming, and `check:design-generated` dirty-tree side effect.
