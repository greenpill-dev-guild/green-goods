# CSS Maintainability Polish — UI Lane Handoff

**Lane**: `ui`
**Branch used**: `main` (low-friction polish; per repo policy this lane lands directly on `main`)
**Scope**: source-grounded CSS ownership inventory + small mechanical alias renames for verified token drift. No redesign, no new tokens, no broad cleanup.

## Provenance

- State/API lane completed in `handoffs/codex-state-api.md` (guard + 64-entry audited baseline on `main`).
- This pass picks up after that, refreshes the inventory against current source, and applies only the 4 mechanical alias renames that are clearly low-risk.
- Re-validated against current `main` HEAD `05abc7b3` plus the working-tree changes other agents have staged (admin chrome / sheet positioning work — see Parallel agent activity below). My fixes are intact, the guard is still GREEN, and the deferred items remain deferred.

## CSS Ownership Inventory (refreshed)

### Global CSS entrypoints

| Surface | Entrypoint | Imports |
|---|---|---|
| Admin | `packages/admin/src/index.css` | Tailwind, shared `theme.css`, admin `admin-m3-tokens.css`, admin `admin-m3-overrides.css`, shared `utilities.css` |
| Client | `packages/client/src/index.css` | Tailwind, shared `theme.css`, shared `utilities.css`, client `typography.css`, client `utilities.css`, client `animation.css`, client `view-transitions.css`, client `editorial.css` |
| Storybook | `packages/shared/.storybook/storybook.css` | Tailwind, shared `theme.css`, admin `admin-m3-tokens.css`, admin `admin-m3-overrides.css` (admin parity only) |
| Docs | docs theme is a separate Docusaurus surface — not in scope for this lane. |

### Shared foundation (`packages/shared/src/styles/`)

- `theme.css` — Warm Earth runtime token projection (`--color-*`, `--primary-*`, `--text-*`, `--bg-*`, `--stroke-*`, `--m3-*`, `--spring-*`, `--shadow-*`), Tailwind `@theme` exposure, dark mode rules. Authoritative.
- `utilities.css` — shared glass/surface utilities, workspace canvas grid, generated DesignMD imports.
- `design-md.generated.css` / `design-md.generated.json` — generated DesignMD output. Source of truth in `DESIGN.md` front matter.

### Admin dialect (`packages/admin/src/styles/`, `packages/admin/src/index.css`)

- `admin-m3-tokens.css` — M3 strict anatomy roles, container/surface tones.
- `admin-m3-overrides.css` — workspace canvas tone, restated `width: max-content` and other overrides for the Tailwind v4 known gotcha (shared utilities not in admin's content scan).
- `index.css` — admin entrypoint. Defines `--font-sans: var(--font-heading)` (Plus Jakarta Sans) at admin root only (currently around line 1690 after a parallel agent's chrome edits). This is the only place `--font-sans` is repo-defined.
- **Parallel agent activity (uncommitted, in working tree)**: admin `index.css` and `admin-m3-overrides.css` plus `storybook.css` are mid-flight introducing a new `--admin-sheet-*` / `--admin-nav-*` token family for sheet positioning (top/bottom/side insets, mobile breakpoint variants). Shared `Canvas/{LeftSheet,RightSheet,BottomSheet}.tsx` now consume these with explicit fallbacks (e.g. `var(--admin-sheet-side-inset, 1rem)`). Tokens are well-formed; the guard accepts every reference. Admin `AppBar` glass has been neutralized in `admin-m3-overrides.css` so canvas tone reads continuously behind the bar. Not in this lane's scope; do not touch.

### Client shell / PWA (`packages/client/src/styles/`)

- `index.css` — client entrypoint. Sets `font-family: Inter, system-ui, …` on `:root`.
- `typography.css` — typography utility classes (`.title-screen`, `.body-md-regular`, `.doc-heading`, …) and `<h1>`/`<p>`/`<code>`/`<table>`/`<blockquote>`/`<a>` resets. **Major drift here — see Deferred Cleanup below.**
- `utilities.css`, `animation.css`, `view-transitions.css` — shell utilities and motion.
- `editorial.css` — public-browser editorial tokens + section reveal animations. Imported only client-side; correctly isolated.
- `pwaDrawerStyles.ts` / `pwaStatusStyles.ts` — installed-PWA chrome inline style modules. Consume the same typography utility classes from `typography.css`.

### Surface boundaries

- Public browser ↔ installed PWA boundary held: browser-only editorial CSS in `packages/client/src/styles/editorial.css`; bottom-app-bar/PWA-only chrome lives in `pwaDrawerStyles.ts` / `pwaStatusStyles.ts`. No editorial CSS leaks into admin or shared.
- Admin ↔ client boundary held: admin M3 token/override CSS imported only from `packages/admin/src/index.css` and (for parity) `packages/shared/.storybook/storybook.css`. Client never imports admin M3.
- Shared ↔ Storybook parity intentional: storybook imports admin's M3 token+override CSS so admin/* stories exercise the same color contract as runtime. This duplication is intentional and documented inline in `storybook.css`.

### Known external runtime variables (intentionally not flagged by the guard)

- `--radix-*` — Radix UI runtime.
- `--breakpoint-*` — Tailwind v4 runtime.
- `--tw-*` — Tailwind v4 internals.

### Known repo gotcha (do not chase)

Tailwind v4 does not scan `packages/shared/src/` from admin/client builds. Utility classes authored in shared JSX silently fail in consumers. Documented in repo `AGENTS.md` → "Known Gotchas". This lane did not introduce any new shared-authored utility classes.

## Fixes applied this pass

All four were 1:1 alias renames against tokens already defined in `packages/shared/src/styles/theme.css`. No semantic change, no new tokens, no broad sweep.

### 1. `packages/admin/src/components/Hypercerts/DistributionChart.tsx`

Donut chart palette referenced stale `--color-info-*` aliases. The live aliases are `--color-information-*` (defined `theme.css:1453-1454`).

- Line 19: `var(--color-info-base)` → `var(--color-information-base)`
- Line 23: `var(--color-info-dark)` → `var(--color-information-dark)`

`--color-primary-dark` (also used in this file) is already correctly named.

### 2. `packages/shared/src/components/Toast/toast.service.tsx`

- Line 113 (`ACTION_BUTTON_BASE`): hover state used stale `--color-primary-strong`. Repo convention is `base → dark` for one-step "stronger" hover (DistributionChart already uses `--color-primary-dark` as the deeper green; `--color-primary-darker` is the hover-of-hover for action surfaces). Mapped to `--color-primary-dark` (`theme.css:1386`).
- Lines 444, 492 (description text in toast variants): stale `--color-text-subtle-600` → live `--color-text-sub-600` (`theme.css:1424`). Confirmed intent: the same component already uses `--color-text-sub-600` six lines later for `debugDescription` (lines 451, 499). `subtle` was a token-name typo.

### 3. `scripts/data/css-custom-property-baseline.tsv`

Pruned the four audited entries that the source edits resolved. Baseline now 60 audited unresolved entries (down from 64).

## Deferred — design judgment required before touching

Baseline arithmetic after this pass: **60 audited unresolved entries** = 57 `--text-*` legacy + 2 `--font-family-*` in [packages/client/src/styles/typography.css](packages/client/src/styles/typography.css) + 1 `--font-family-sans` in [packages/shared/.storybook/storybook.css](packages/shared/.storybook/storybook.css). The codex state-api handoff lumped the 57+2 together as "59 entries in typography.css"; both phrasings count the same lines.

### A. `packages/client/src/styles/typography.css` — 57 stale `--text-*` legacy token refs

Authored in commit `d591c285` (2026-03-07) using long token names (`--text-title-screen-font-size`, `--text-body-md-regular-line-height`, `--text-doc-heading-font-weight`, …). None of these have ever resolved — `theme.css` defines the shorter set: `--text-title-h1` through `--text-title-h6`, `--text-label-xl/lg/md/sm/xs`, `--text-paragraph-xl/lg/md/sm/xs`, `--text-doc-label`, `--text-doc-paragraph`.

Effect: classes `.title-screen`, `.title-section`, `.title-subsection`, `.title-body`, `.label-lg/md/sm/xs`, `.body-{lg,md,sm,xs}-{regular,medium}`, `.doc-heading`, `.doc-subheading`, `.doc-paragraph` have all had `font-size`/`line-height`/`font-weight` resolve to nothing for ~2 months. Affected classes inherit Inter at the surrounding font-size/weight.

These classes are in active use across ~20 client files: `components/Cards/Form/FormCard.tsx`, `components/Cards/Action/ActionCard.tsx`, `components/Cards/Work/DraftCard.tsx`, `components/Features/Garden/Assessments.tsx`, `components/Features/Profile/Profile.tsx`, `components/Navigation/Tabs/StandardTabs.tsx`, `components/Dialogs/DraftDialog.tsx`, `components/Dialogs/ModalDrawer.tsx`, `views/Home/WorkDashboard/index.tsx`, `views/Home/Garden/index.tsx`, `views/Home/Garden/Assessment.tsx`, `views/Profile/{Help,AccountInfo,Badges,GardensList,InstallCta,AppSettings}.tsx`, plus `pwaDrawerStyles.ts` and 2 test files.

Why deferred:
- Mapping is a **semantic decision**, not mechanical. E.g. should `.title-screen` (currently a no-op falling back to inherited size) become `--text-title-h2`? `--text-title-h3`? `--text-label-xl`? Each choice is a visible PWA typography change.
- Repairing 57 broken refs in one pass would land a redesign-shaped visual diff across ~20 client surfaces — explicitly out of scope per `spec.md` Risks.
- Routing through `client-pwa-design-system-transition` would let the PWA-owning lane decide the semantic mapping with proper protected-baseline regression evidence.

Recommended next action (for QA pass 1 or a follow-up planning pass): pick the semantic map for these classes (decide once: should `.title-section` be `h2` or `h3`?), then land the map in one diff with before/after PWA screenshots.

### B. `var(--font-family-sans)` / `var(--font-family-mono)` (5 source-line references, 3 audited baseline entries)

Neither token is defined anywhere in repo source. `--font-sans` is defined only in `packages/admin/src/index.css` (admin-only, currently around line 1690 after a parallel agent's chrome edits). `--font-mono` is not repo-defined; `AdminRevampTokens.stories.tsx` consumes it via `var(--font-mono, ui-monospace, monospace)` (fallback satisfies the guard).

Current source-line references (refreshed against current working tree — storybook.css line numbers shifted from 629/634 → 651/656 due to the parallel admin chrome work):

- [packages/client/src/styles/typography.css:18](packages/client/src/styles/typography.css:18) — `h1-h6 { font-family: var(--font-family-sans); }`. No-op; client `<body>` already inherits Inter from [packages/client/src/index.css:22](packages/client/src/index.css:22) `:root`.
- [packages/client/src/styles/typography.css:23](packages/client/src/styles/typography.css:23) — `* { font-family: var(--font-family-sans); }`. No-op; same reason.
- [packages/client/src/styles/typography.css:204](packages/client/src/styles/typography.css:204) — `code { font-family: var(--font-family-mono); }`. **Small visible regression**: `<code>` silently falls through to Inter (sans) instead of monospace. Resolving requires either a local mono stack literal, a repo-wide `--font-mono` definition, or a fallback inside the `var()`. Each option is a design decision.
- [packages/shared/.storybook/storybook.css:651](packages/shared/.storybook/storybook.css:651) — Storybook `h1-h6 { font-family: var(--font-family-sans); }`. No-op; storybook `:root` already sets `font-family: Inter, system-ui, …` on line 300.
- [packages/shared/.storybook/storybook.css:656](packages/shared/.storybook/storybook.css:656) — Storybook `* { font-family: var(--font-family-sans); }`. No-op; same reason.

Why deferred: the cleanest cleanup is "remove the no-op rules; add an explicit mono stack to the one rule that needs it." That removes broken refs without inventing new tokens. But removing live CSS rules — even no-op ones — is a cascade change that QA should look at on real installed-PWA + Storybook surfaces before landing.

## Parallel agent activity observed during this lane (not touched)

Recorded so QA pass 1 doesn't mistake it for in-lane scope creep:

- Three commits landed on `main` since I started this lane (most recent first): `05abc7b3 feat(admin): gate hypercert marketplace readiness`, `af7f40cd fix(shared,agent): complete translation coverage`, `6cfa6fb3 feat(contracts,shared): add hypercert marketplace readiness guards`. The hypercert-marketplace-arbitrum-readiness hub was archived as part of `05abc7b3`, dropping `plan-hub validate` from 20 hubs → 19 hubs.
- Uncommitted in working tree: admin chrome / sheet positioning work in [packages/admin/src/index.css](packages/admin/src/index.css), [packages/admin/src/styles/admin-m3-overrides.css](packages/admin/src/styles/admin-m3-overrides.css), [packages/shared/.storybook/storybook.css](packages/shared/.storybook/storybook.css), [packages/admin/src/components/Layout/CanvasLayout.tsx](packages/admin/src/components/Layout/CanvasLayout.tsx), [packages/admin/src/components/Layout/ControlledChromeContract.stories.tsx](packages/admin/src/components/Layout/ControlledChromeContract.stories.tsx), [packages/admin/src/views/Actions/ActionsSheetDescriptor.{tsx,stories.tsx}](packages/admin/src/views/Actions/), and [packages/shared/src/components/Canvas/{LeftSheet,RightSheet,BottomSheet}.tsx](packages/shared/src/components/Canvas/). Introduces a new `--admin-sheet-*` / `--admin-nav-*` token family with explicit fallbacks throughout consumer JSX. Also widens `[data-theme="dark"][…]` selectors to `:is([data-theme="dark"][…], [data-theme="dark"] […])` for tone-strength and tone-canvas (real fix: descendant + same-element both match now). Also neutralizes glass on admin `AppBar` root so canvas tone reads continuously behind it. Not in this lane's scope; not touched.
- Also dirty in working tree: [.agents/skills/design/prompt-contract.md](.agents/skills/design/prompt-contract.md), [DESIGN.md](DESIGN.md), [packages/admin/DESIGN.md](packages/admin/DESIGN.md), [docs/docs/builders/packages/admin.mdx](docs/docs/builders/packages/admin.mdx), and the related test files. Same parallel design-system work; out of scope.
- Toast.service.tsx received a small linter formatter pass after my edit (no token regression — confirmed by `git diff` review and re-running the targeted toast tests).

## Validation

**Plan-hub gate (required, re-run after parallel agent activity landed):**

- `node scripts/harness/plan-hub.mjs validate` → `Validated 19 feature hubs.` ✅ (was 20 before commit `05abc7b3` archived `hypercert-marketplace-arbitrum-readiness`)
- `node scripts/design/check-css-custom-properties.mjs` → `CSS custom property guard passed: 2986 var() references, 1003 definitions, 60 audited unresolved entries.` ✅ (was 2939/993/60 before parallel admin chrome work added new `--admin-sheet-*`/`--admin-nav-*` tokens with fallbacks; audited-unresolved count unchanged at 60 — drop from original 64 is still attributable to this lane's 4 fixes)
- `bun run lint:vocab` → `✅ check-vocab: no banned vocabulary found in 3 i18n file(s).` ✅

**Targeted shared tests for impacted toast surface:**

- `bunx vitest run src/__tests__/components/toast-registry.test.ts src/__tests__/hooks/useToastAction.test.ts` (from `packages/shared`) → `2 test files, 13 tests, all pass`. ✅
- Full `bun run --filter @green-goods/shared test` → 241/242 test files pass, 2933 tests pass, 1 skipped, 1 failed. The single failure is `src/__tests__/i18n/locale-coverage.test.ts > Source usage coverage` timing out at 10s — unrelated to this lane (locale-coverage is in other agents' WIP diff at session start, modified for marketplace i18n expansion). My changes touched only `toast.service.tsx`; no toast-related tests failed.

**Pre-existing blockers (NOT caused by this lane) — surfaced for the team:**

- `bun run check:design-generated` → fails because `docs/docs/builders/packages/client-pwa-token-audit.generated.md` is stale. Last touched in `eb41bc8d` (PWA token audit refresh by another agent). Not in this lane's diff; needs a separate `bun run design:generate` from whoever owns the docs lane.
- `bun run check:design-tokens` → fails on raw color/shadow literals in `packages/client/vite/social-preview.ts` introduced by commits `802bda74` (`feat(client): add static social preview shells`) and `236aa367` (`fix(client): make social preview cards deterministic`). Eight raw values flagged: `#000000` flood/stop colors, `#167947`, `#f7f0e4`, `#514a3d`, `#221f18`. Not in this lane's diff; the social-preview owner needs to either token-replace or add audited baseline entries to `scripts/data/design-token-usage-baseline.tsv`.

Per `brief.md`: "If full `format:check` is blocked by unrelated dirty files, record the exact blocker and do not format unrelated work." Same policy applied to the two design checks above.

## TDD posture

This lane is mostly mechanical CSS alias renames (no behavior change). Recording as `proof_limit`:

- **RED for the guard**: pre-existing — 64 audited unresolved entries in baseline before this pass.
- **GREEN for the guard**: `node scripts/design/check-css-custom-properties.mjs` reports 60 audited unresolved entries after the 4 source fixes + matching baseline prune. Re-confirmed on current working tree after parallel agent activity landed. Stale-baseline detection in the script (line 274) would have failed if the source edits and baseline prune drifted; the passing run confirms they match.
- **Proof limit**: no behavior tests added because the renamed tokens drive computed-style only. Visual proof on real installed-PWA / admin Hypercerts / Storybook surfaces is left for QA pass 1.

## Files touched this pass

- `packages/admin/src/components/Hypercerts/DistributionChart.tsx` (2 token aliases)
- `packages/shared/src/components/Toast/toast.service.tsx` (1 hover token + 2 description text tokens, replace_all on the latter)
- `scripts/data/css-custom-property-baseline.tsv` (removed 4 entries)
- `.plans/active/css-maintainability-polish/handoffs/claude-ui.md` (this file)
- `.plans/active/css-maintainability-polish/plan.todo.md` (lane checklist tick)
- `.plans/active/css-maintainability-polish/status.json` (lane status + proof)

Unrelated dirty work left untouched: marketplace/agent/i18n WIP across `packages/agent/**`, `packages/shared/src/modules/marketplace/**`, `packages/shared/src/hooks/hypercerts/**`, `packages/contracts/**`, `packages/shared/src/i18n/*.json`, `packages/client/src/views/Profile/Badges.tsx`, and the `.plans/active/hypercert-marketplace-arbitrum-readiness/**` and `.plans/active/css-maintainability-polish/{plan.todo.md,status.json}` other-agent edits already on disk. None of these were reverted, restaged, or committed by this lane.

## Follow-up for QA Pass 1

1. Verify `<DistributionChart>` (admin Hypercerts) renders the info-color segments — these segments have been falling back to no fill / inherited fill for the duration the alias was stale; after this pass they should render the information role color.
2. Verify toast action button hover (any error toast with an action callback, or a `loading → success` flow) renders the darker green on hover; description text in dismissible toasts renders the sub-600 ink, not falling back to inherited.
3. Decide whether to schedule typography.css 59-token semantic mapping into this hub or push to `client-pwa-design-system-transition`.
4. Decide whether to clean up the 3 redundant `var(--font-family-sans)` / `var(--font-family-mono)` references (remove no-op rules; replace the `code` rule with an explicit mono stack).
5. Confirm pre-existing blockers (docs freshness + social-preview raw colors) are owned and routed.
