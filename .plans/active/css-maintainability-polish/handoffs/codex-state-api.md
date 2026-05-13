# CSS Maintainability Polish - State/API Handoff

**Lane**: `state_api`  
**Branch used**: `main` (ported from a prior `release/1.1.0` worktree pass; see Provenance below)  
**Scope**: tooling and inventory only; no runtime data/API behavior and no UI cleanup.

## Provenance

The undefined CSS custom property guard, baseline, focused tests, and `check:design-tokens` wiring were prototyped on `release/1.1.0` in `/private/tmp/green-goods-css-maintainability-release` and reconciled onto `main` in a follow-up pass:

- `scripts/design/check-css-custom-properties.mjs` (guard implementation, unchanged)
- `scripts/design/check-css-custom-properties.test.mjs` (focused fixture tests, unchanged)
- `scripts/data/css-custom-property-baseline.tsv` (audited unresolved entries, unchanged)
- `scripts/design/check-tokens.sh` (one-line wiring after the existing admin Controlled Chrome guard)
- `scripts/README.md` (one design entry per script + one data entry for the baseline)

`main` had already grown an admin M3 variable-definition guard and an admin Controlled Chrome guard since the prototype branched, so the wiring was added without disturbing those checks. No source CSS was changed.

## Summary

- Existing `bun run check:design-tokens` did not broadly catch undefined CSS custom properties. It passed before this lane even though a source scan found unresolved hard `var(--*)` references outside the old admin-M3-only coverage.
- Added `scripts/design/check-css-custom-properties.mjs`, a focused guardrail for `var(--*)` references without fallbacks and without a matching custom-property definition.
- Wired the guardrail into `scripts/design/check-tokens.sh`, so `bun run check:design-tokens` now catches new undefined CSS custom properties.
- Added `scripts/data/css-custom-property-baseline.tsv` for current audited migration debt and `scripts/design/check-css-custom-properties.test.mjs` for the checker.
- Updated `scripts/README.md` with the new durable script and baseline data file.

## 2026-05-12 Status Note

This handoff remains the source of truth for the completed state/API guardrail lane, but its follow-up counts are historical. The current reassessment on `main` `430fb41a` leaves the guard passing with 3065 `var()` references, 1005 definitions, and 60 audited unresolved entries after the first UI alias pass. The hub remains active because later CSS/admin/client/shared churn needs a second maintainability review and browser/Storybook proof before closure.

## Existing Coverage Decision

Existing checks covered:

- Expected Warm Earth runtime tokens in `packages/shared/src/styles/theme.css`.
- Generated DesignMD radius tokens in `packages/shared/src/styles/design-md.generated.css`.
- Raw cubic-bezier, duration, color, radius, and primitive Tailwind palette usage against `scripts/data/design-token-usage-baseline.tsv`.
- Token version coupling.

Existing checks did not cover:

- General undefined CSS custom properties across admin, client, shared, and shared Storybook sources.
- Non-`--m3-*` missing variables such as legacy client typography names and stale toast/admin aliases.

Proof: `bun run check:design-tokens` passed before the new guardrail while `node scripts/design/check-css-custom-properties.mjs` reported unresolved hard references.

## Guardrail Behavior

The checker scans:

- `packages/admin/src`
- `packages/client/src`
- `packages/shared/src`
- `packages/shared/.storybook`

It flags `var(--token)` references when:

- the reference has no fallback,
- the token is not defined in the scanned CSS/TS/TSX source,
- the token is not a known runtime-provided external prefix (`--radix-*`, `--breakpoint-*`, `--tw-*`),
- and the token/path pair is not in `scripts/data/css-custom-property-baseline.tsv`.

The baseline is path + variable based, so future cleanup also fails if an audited entry becomes stale.

Proof limit: this guard confirms that every hard `var(--*)` reference has either a matching definition somewhere in the scanned repo CSS/TS/TSX surface, an accepted runtime-provider prefix, or a baseline entry. It does not prove cascade reachability for every component at runtime; UI/QA should still verify affected browser, PWA, admin, and Storybook surfaces after source cleanup.

## CSS Ownership Inventory

Global imports:

- `packages/admin/src/index.css` imports Tailwind, shared theme, admin M3 tokens, admin M3 overrides, and shared utilities.
- `packages/client/src/index.css` imports Tailwind, shared theme, shared utilities, client typography, client utilities, animation, view transitions, and editorial CSS.
- `packages/shared/.storybook/storybook.css` imports Tailwind, shared theme, admin M3 tokens, and admin M3 overrides for parity.

CSS ownership by surface:

- Shared foundation: `packages/shared/src/styles/theme.css` and `packages/shared/src/styles/utilities.css` own runtime token projection, shared glass/surface utilities, workspace canvas grid, and generated DesignMD imports.
- Admin dialect: `packages/admin/src/index.css`, `packages/admin/src/styles/admin-m3-tokens.css`, and `packages/admin/src/styles/admin-m3-overrides.css` own cockpit-specific M3 roles, `.admin-m3`, `.workspace-canvas`, surface wrappers, and shared canvas override policy.
- Client shell/PWA: `packages/client/src/index.css`, `packages/client/src/styles/typography.css`, `utilities.css`, `animation.css`, and `view-transitions.css` own client runtime CSS imported only through the client entrypoint.
- Public browser/editorial: `packages/client/src/styles/editorial.css` owns public browser editorial tokens, section reveal animations, public dialog animation, and install-sheet CSS. It is imported client-side only and should remain out of admin/shared cleanup.
- Storybook parity: `packages/shared/.storybook/storybook.css` owns Storybook-only browser/PWA/admin preview frames and imports the same shared/admin token surfaces for parity.

Current unresolved baseline (on `main`, after reconciliation):

- 64 audited unresolved token/path entries (down from the 68 captured on the `release/1.1.0` prototype).
- 59 entries in `packages/client/src/styles/typography.css`: legacy expanded text token names such as `--text-title-screen-font-size`.
- 2 entries in `packages/admin/src/components/Hypercerts/DistributionChart.tsx`: stale `--color-info-*` aliases; live aliases appear to use `information`.
- 2 entries in `packages/shared/src/components/Toast/toast.service.tsx`: stale primary/text token aliases.
- 1 entry in `packages/shared/.storybook/storybook.css`: old `--font-family-sans` alias.

Reconciliation note: four admin M3 error/tertiary container roles previously baselined under `packages/admin/src/components/Action/ActionTranslationEditor.tsx` are now defined on `main`, so those entries were pruned from the baseline before completing the lane.

Known external runtime variables intentionally not baselined:

- `--radix-*` supplied by Radix components.
- `--breakpoint-*` supplied by Tailwind.
- `--tw-*` supplied by Tailwind internals.

## RED

Command:

```bash
node --test scripts/design/check-css-custom-properties.test.mjs
```

Evidence:

- Failed before implementation because the test fixture referenced the not-yet-existing checker.
- Output included `MODULE_NOT_FOUND` for `scripts/design/check-css-custom-properties.mjs`.

## GREEN

Command:

```bash
node --test scripts/design/check-css-custom-properties.test.mjs
```

Evidence:

- Passed 3/3 tests.
- Tests cover undefined hard references, fallback/external/baselined references, and stale baseline detection.

## Validation

- `node --test scripts/design/check-css-custom-properties.test.mjs` - passed.
- `bun run check:design-tokens` - passed and now includes the CSS custom property guard.
- `node scripts/harness/plan-hub.mjs validate` - passed after TDD proof was recorded.
- `bun run check:design-generated` - passed after installing dependencies in the isolated release worktree.
- `bun run lint:vocab` - passed.

## Follow-Up For UI Lane

- Do not do broad CSS cleanup in this state/API lane.
- Historical UI cleanup started from the 64-entry baseline on `main`; the current post-churn reassessment starts from 60 audited unresolved entries after the first UI alias pass.
- Keep public browser/editorial CSS local to `packages/client/src/styles/editorial.css`.
- Keep admin cockpit CSS in the admin M3 and override surfaces; avoid moving admin-only rules into shared unless shared primitives truly own the behavior.
- The overall feature is still active: `state_api` and the first low-friction `ui` pass are complete; the revamped `ui` lane now owns full maintainability audit/scope-lock work before `qa_pass_1` starts.
