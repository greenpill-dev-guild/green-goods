# UI Handoff - Stage 0 Through Stage 4

Date: 2026-04-29
Actor: Codex
Scope completed: Stage 0 readiness, Stage 1-4 source implementation, and completion fixes

## Summary

- Stage 0 readiness was recorded in `handoffs/qa-evidence/stage-0-readiness.md`.
- Stage 1 replaced global heading color backing, added `pwaStatusStyles`, applied it to the named
  Stage 1 PWA status surfaces, removed only fixed baseline rows, and regenerated the generated PWA
  token audit only after the check gate reported staleness.
- Stage 2 added `pwaDrawerStyles`, tokenized the shared bottom-sheet pattern, `DraftDialog`, work
  approval drawer chrome, and `Gardeners` dialog chrome, preserved `ModalDrawer.maxHeight`, and
  removed only fixed Stage 2 baseline rows.
- Stage 3 tokenized loading/splash motion, media requirement/status surfaces, compression progress,
  media overlays, and `/garden` media action-bar icons while preserving media behavior.
- Stage 4 removed the remaining protected-PWA baseline rows from cards, member/profile controls,
  filters, assessment links, error boundary actions, clipboard copy, and pull-to-refresh motion.
- Completion pass fixed the remaining `animation.css` raw primary alpha review finding, repaired
  invalid nested interactive markup in `DraftCard`, refreshed the generated audit, and restored
  the full client test suite.
- Source implementation and local/Storybook visual evidence are complete for the available
  automated surfaces. On 2026-04-29, the human owner waived final installed-phone PWA signoff and
  real media thumbnail/video overlay proof as archive blockers.

## Key Changed Files

- `packages/client/src/styles/typography.css`
- `packages/client/src/styles/animation.css`
- `packages/client/src/styles/pwaStatusStyles.ts`
- `packages/client/src/__tests__/styles/pwaStatusStyles.test.ts`
- `packages/client/src/styles/pwaDrawerStyles.ts`
- `packages/client/src/__tests__/styles/pwaDrawerStyles.test.ts`
- `packages/client/src/components/Dialogs/ModalDrawer.tsx`
- `packages/client/src/components/Dialogs/DraftDialog.tsx`
- `packages/client/src/views/Home/WorkDashboard/index.tsx`
- `packages/client/src/views/Home/Garden/Work.tsx`
- `packages/client/src/components/Features/Garden/Gardeners.tsx`
- `packages/client/src/components/Layout/Splash.tsx`
- `packages/client/src/views/Login/components/LoadingSplash.tsx`
- `packages/client/src/views/Garden/Media.tsx`
- `packages/client/src/views/Garden/index.tsx`
- `packages/client/src/components/Cards/Base/Card.tsx`
- `packages/client/src/components/Cards/Work/DraftCard.tsx`
- `packages/client/src/components/Cards/Work/DraftCard.stories.tsx`
- `packages/client/src/components/Errors/AppErrorBoundary.tsx`
- `packages/client/src/components/Inputs/Clipboard/AddressCopy.tsx`
- `packages/client/src/components/Inputs/PullToRefresh.tsx`
- `packages/client/src/views/Home/Garden/Assessment.tsx`
- `packages/client/src/views/Home/GardenFilters/index.tsx`
- `packages/client/src/views/Profile/ENSSection.tsx`
- `packages/client/src/views/Profile/GardensList.tsx`
- Stage 1 client surfaces listed in `handoffs/qa-evidence/stage-1-color-foundation.md`
- `scripts/data/design-token-usage-baseline.tsv`
- `docs/docs/builders/packages/client-pwa-token-audit.generated.md`
- `spec.md`, `plan.todo.md`, `status.json`, and Stage 0-4 evidence files in this hub
- `handoffs/claude-qa-pass-1.md`, `handoffs/codex-qa-pass-2.md`, and
  `handoffs/qa-evidence/final-phone-signoff.md`

## Validation

- Passed: `node scripts/harness/plan-hub.mjs validate`
- Passed: `bun run check:design-tokens`
- Passed: `bun run lint:vocab`
- Passed after gated regeneration: `bun run check:design-generated`
- Passed: path-scoped `oxlint` for Stage 3/4 touched files
- Passed: `bun run --cwd packages/shared check:stories`
- Passed: `bun run --cwd packages/shared check:story-quality`
- Passed: targeted Stage 1 `pwaStatusStyles` and `DraftsTab` tests
- Passed: targeted Stage 2 `pwaDrawerStyles`, `DraftDialog`, and `WorkDashboard` tests
- Passed: targeted Stage 3/4 client tests via bundled Node:
  `pwaStatusStyles`, `pwaDrawerStyles`, `Media`, `Garden`, `GardensList`, `ENSSection`
  (6 files, 34 tests)
- Passed: client TypeScript check via bundled Node (`tsc --noEmit`)
- Passed: Stage 2 path-scoped `git diff --check`
- Passed in Stage 1: `bun run --filter @green-goods/client build`
- Passed in completion pass: `bun run --filter @green-goods/client test` with approved escalation
  for the package's Node 20 test shim.
- Passed in completion pass: `bun run --filter @green-goods/client build` with approved root
  `.env` read and safe ephemeral dummy values for `VITE_PINATA_JWT`, `PINATA_JWT`,
  `TELEGRAM_BOT_TOKEN`, `ENCRYPTION_SECRET`, and `AGENT_PUBLIC_ALLOWED_ORIGINS`.

## Visual Evidence

- Stage 1 implementation evidence: `handoffs/qa-evidence/stage-1-color-foundation.md`
- Browser/PWA smoke: `handoffs/qa-evidence/stage-1-browser-smoke.md`
- Stage 2 drawer evidence and proof limits: `handoffs/qa-evidence/stage-2-drawers.md`
- Stage 3 loading evidence and proof limits: `handoffs/qa-evidence/stage-3-loading.md`
- Stage 3 media evidence and proof limits: `handoffs/qa-evidence/stage-3-media.md`
- Stage 4 controls evidence and proof limits: `handoffs/qa-evidence/stage-4-controls.md`
- Screenshot artifacts are under ignored `output/playwright/client-pwa-design-system-transition/`.
- QA Pass 1 summary: `handoffs/claude-qa-pass-1.md`
- QA Pass 2 blocker summary: `handoffs/codex-qa-pass-2.md`
- Final phone blocker: `handoffs/qa-evidence/final-phone-signoff.md`

## Remaining Work

- Commit/PR packaging: not performed in this shared dirty tree; if requested later, stage paths
  explicitly and avoid unrelated dirty files.
- Optional future device QA: final installed-phone PWA signoff and real thumbnail/video overlay
  proof remain uncaptured but were waived by the human owner for this hub on 2026-04-29.
- Public browser `Hero.tsx` raw-token rows remain intentionally deferred to a separate browser
  plan; they are not protected-PWA closeout blockers.
