# Workflow Scorecard

Use this to measure whether AI-native workflow changes reduce cognitive debt instead of adding ceremony.

## Baseline Template

| Metric | Value |
|---|---|
| Date | YYYY-MM-DD |
| Repo | Green Goods |
| Feature or lane |  |
| Cycle time |  |
| Agent runs |  |
| Human review findings |  |
| Tests added or updated |  |
| Validation commands |  |
| Regressions caught before merge |  |
| Rework caused by unclear intent |  |
| Rework caused by tool/model failure |  |
| Rule updates created |  |
| Net judgment | unknown |

## Scoring Guide

- Green: less review confusion, fewer repeated failures, validation evidence is easy to find.
- Yellow: useful evidence exists but process added noticeable overhead.
- Red: process obscured the work, duplicated truth, or failed to catch regressions.

## Baseline Entries

### 2026-05-24 - Scaffold Hardening

| Metric | Value |
|---|---|
| Date | 2026-05-24 |
| Repo | Green Goods |
| Feature or lane | `ai-native-dev-workflow` / state_api lane |
| Cycle time | One focused hardening pass after the initial scaffold review. |
| Agent runs | 1 Codex implementation pass plus 1 Codex review pass. |
| Human review findings | Template-only evidence, premature ready lanes, prose-form commands, and Green Goods Linear visibility warnings. |
| Tests added or updated | No runtime tests; plan evidence and TDD proof-limit metadata updated. |
| Validation commands | `node scripts/harness/plan-hub.mjs validate` |
| Regressions caught before merge | Queue-visible ready state for a lane whose handoff still said not started. |
| Rework caused by unclear intent | Medium: the first scaffold did not distinguish scaffold completion from six-week adoption completion. |
| Rework caused by tool/model failure | None observed. |
| Rule updates created | `None` for repeated agent failures; local eval command format tightened. |
| Net judgment | Green: the hub is now measurable without creating a second truth surface. |

### 2026-05-24 - CSS Maintainability Scope Lock

| Metric | Value |
|---|---|
| Date | 2026-05-24 |
| Repo | Green Goods |
| Feature or lane | `css-maintainability-polish` / revamped UI scope-lock audit |
| Cycle time | One read-only audit pass before runtime CSS edits. |
| Agent runs | 1 Codex scope-lock audit pass. |
| Human review findings | Human required scope lock before runtime CSS edits, preservation of unrelated dirty work, no redesign, no 60-entry typography/font remap, and no reliance on `check:design-generated` as a clean gate. |
| Tests added or updated | None. Targeted existing tests/gates were run for evidence. |
| Validation commands | `node scripts/harness/plan-hub.mjs validate`; `node scripts/design/check-css-custom-properties.mjs`; `bun run check:design-tokens`; `bun run --filter @green-goods/shared check:stories`; `bun run --filter @green-goods/shared check:story-quality`; targeted package-wrapper Vitest for PWA drawer styles, shared Canvas sheets, admin CanvasLayout/AdminDialog. |
| Regressions caught before merge | Plan evidence drift caught: CSS hub still referenced 19 feature hubs and 3065 var refs while the current checkout validates 21 hubs and 3094 var refs. |
| Rework caused by unclear intent | Low: the scope-lock contract was explicit; the main decision still needed is whether to approve the installed-PWA overlay token micro-batch. |
| Rework caused by tool/model failure | Low: a direct root Vitest invocation produced setup/module-loader failures, then package-wrapper commands passed. |
| Rule updates created | `None` for repeated agent failures; record package-wrapper Vitest as the reliable validation path for package-local UI suites. |
| Net judgment | Green pending human scope lock: the workflow separated source evidence, static guards, Storybook parity, visual-proof requirements, and deferred design decisions without touching runtime CSS. |

### 2026-05-24 - CSS Maintainability Approved Micro-Batch

| Metric | Value |
|---|---|
| Date | 2026-05-24 |
| Repo | Green Goods |
| Feature or lane | `css-maintainability-polish` / revamped UI implementation |
| Cycle time | One implementation/proof pass after human approval of the scope-lock micro-batch. |
| Agent runs | 1 Codex scope-lock audit pass plus 1 Codex implementation/proof pass. |
| Human review findings | Human asked for PWA regression-risk and surface-area explanation before approving; approval was limited to the installed-PWA scrim-token cleanup. |
| Tests added or updated | Added one focused `pwaDrawerStyles` assertion covering `--color-scrim` ownership for `overlay` and `dialogOverlay`. |
| Validation commands | `node scripts/harness/plan-hub.mjs validate`; `node scripts/design/check-css-custom-properties.mjs`; `bun run check:design-tokens`; `bun run lint:vocab`; `bun run --filter @green-goods/shared check:stories`; `bun run --filter @green-goods/shared check:story-quality`; client package-wrapper Vitest for `pwaDrawerStyles`; `bun run build:client`; Playwright Storybook visual/computed-style proof. |
| Regressions caught before merge | None in source behavior. The proof confirmed Tailwind emitted `background-color:var(--color-scrim)` and ModalDrawer/PwaSheet backdrops both compute to `rgba(12, 10, 9, 0.22)` at mobile viewport size. |
| Rework caused by unclear intent | Low: the approval boundary was clear after the PWA regression-risk explanation. |
| Rework caused by tool/model failure | Medium-low: Modern Web Guidance retrieval failed, sandboxed Vite temp writes failed until approved reruns, and the unseeded client PWA route stayed on a loading spinner. |
| Rule updates created | `None` for repeated agent failures; keep route-level visual proof separate from component Storybook proof when seeded runtime state is unavailable. |
| Net judgment | Green: the workflow kept the runtime diff to the approved two-slot token change, added regression coverage, preserved unrelated dirty work, and recorded proof limits for QA. |

### 2026-05-26 - Agent-Max Readiness Pilot

| Metric | Value |
|---|---|
| Date | 2026-05-26 |
| Repo | Green Goods |
| Feature or lane | `agent-max-readiness` / AI-native workflow hardening pilot |
| Cycle time | One scoped implementation pass after plan-mode approval. |
| Agent runs | 1 Codex implementation/proof pass. |
| Human review findings | Human selected workflow-plus-pilot depth, upload signing as the public API validation pilot, and `.plans` as the first guidance home. |
| Tests added or updated | Shared upload-signing contract unit tests and agent upload-signing invalid-field coverage. |
| Validation commands | `node scripts/harness/plan-hub.mjs validate`; `bun run check:skills`; `bun run docs:audit:ci`; `bun run lint:rules`; `bun run test:shared`; `bun run test:agent`; `bun run build:agent`; `bun run drift:check -- --scope all --json`. |
| Regressions caught before merge | Starting drift check caught skill mirror drift, docs source/frontmatter drift, README command drift, and inline alert-style blocks before broad agent dispatch. |
| Rework caused by unclear intent | Low: implementation boundaries were decision-complete before edits. |
| Rework caused by tool/model failure | Medium: sandbox blocked Git ref and generated mirror writes until approved reruns; source-structure guard cannot pass on uncommitted edits to existing oversized files without broad extraction. |
| Rule updates created | None in global guidance; local readiness artifacts added for retrospective. |
| Net judgment | Yellow: the readiness gate caught and cleared guidance/docs/design drift and proved upload-signing validation, but the source-structure guard exposes an unresolved structural debt in already-oversized touched files. |
