# CSS Maintainability Polish - Revamped UI Lane Handoff

**Lane**: `ui`
**Owner**: `claude`
**Status**: ready
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
