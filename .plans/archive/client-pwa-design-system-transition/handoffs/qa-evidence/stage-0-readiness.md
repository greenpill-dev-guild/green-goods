# Stage 0 Readiness Evidence

Date: 2026-04-28
Actor: Codex
Scope: Stage 0 readiness only, before Stage 1 source edits

## Read-Only Context

- Read root `AGENTS.md` from the dispatched prompt, plus `packages/client/AGENTS.md` and
  `packages/shared/AGENTS.md`.
- Read this hub's `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, and `status.json`.
- Confirmed `packages/client/src/styles/typography.css` is the only intentional cross-shell file
  in this hub.
- Confirmed `package.json` defines `check:design-generated` as
  `node scripts/design/md-generate.mjs --check`; `bun run design:generate` was not run until that
  gate later reported a stale generated artifact during Stage 1 validation.

## Dirty-Tree Snapshot

`git status --short` was captured before source edits. The tree was not clean, and the following
buckets were treated as prior or other-agent work:

- Existing plan hub edits under `.plans/backlog/client-pwa-design-system-transition/`.
- Active plan churn under `.plans/active/fix-garden-domain-ui/`.
- Manual-ops delete/archive churn under `.plans/active/manual-ops-closeout/` and
  `.plans/archive/manual-ops-closeout/`.
- Unrelated agent/doc edits in `.claude/**`, `AGENTS.md`, `CLAUDE.md`, and `env.d.ts`.
- Unrelated admin cockpit/domain UI edits under `packages/admin/src/views/Garden/**`.
- Unrelated client presentation-mode edits in `packages/client/src/config.ts`,
  `packages/client/src/main.tsx`, `packages/client/src/routes/presentation-mode.ts`,
  `packages/client/vite.config.ts`, and its test.
- Unrelated contracts deploy/migration edits and untracked
  `packages/contracts/config/action-translations.json`.
- Unrelated shared i18n, hook, module, and test edits under `packages/shared/src/**`.

No unrelated dirty files were stashed, reverted, reformatted, or absorbed into this pass.

## Baseline Census

- Refreshed the census from
  `rg -n "packages/client/src" scripts/data/design-token-usage-baseline.tsv`.
- The previous Stage 1 row references in `spec.md` were stale. `spec.md` now records the current
  post-Stage-1 TSV rows and marks Stage 1 fixed or semantic targets with no current TSV row.
- Stage 1 baseline rows were removed only after the corresponding raw usage was actually replaced.

## Validation

- `node scripts/harness/plan-hub.mjs validate` passed before source edits with:
  `Validated 19 feature hubs`.

## Outcome

Stage 0 was ready for a path-scoped Stage 1 pass. The readiness caveat was the dirty worktree:
implementation proceeded with explicit path-scoped edits only, leaving unrelated dirty files in
place.
