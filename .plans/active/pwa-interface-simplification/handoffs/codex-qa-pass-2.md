# PWA Interface Simplification - QA Pass 2 Handoff

## Lane

- Owner: Codex
- Branch: none (read-only review in a clean worktree on `research/pwa-home-qa-pass-2`)
- Status: completed on 2026-10-26 as a static review; no browser evidence

## Scope

- Review regressions, implementation edges, and validation evidence after QA Pass 1.

## Validation

- Codex reviewed the 22 first-parent merge diffs of the plan's PRs (#1274 to #1327, plus the
  voucher console #1320) and their merged owners at `1931f0acb`, weighting the job queue and
  take-up chain, the one submission flow, membership resolution, the bell and the join record.
- Findings: a duplicate-submission path when Start auto-skips and autosave keeps no draft
  (fixed in #1332); a failed open-ask read presented as an empty list (fixed in #1334); a
  repeated-action requirement identity in `StartPromise.tsx` (tracked on PRD-1345). It
  confirmed that resubmitting the same persisted draft reuses its queued job.
- Found sound in source: A1, A2 and A5 scoping and capability checks; A7 to A9 chain
  dependencies, link identity, holds and admission dedupe; A2 and A10 bell scope and copy; A4,
  A11 and A12 focus and routes; every added catalog key has ES and PT counterparts.

## Validation Receipt

- Tested implementation commit SHA: `1931f0acbfca046cdbe993c9c74b9da06d1f0ac9`
- Run at (UTC): `2026-10-26T08:45:15Z`
- Exact command(s): read-only review of `git diff <merge>^1 <merge>` for the 22 merges; `bun run
  test src/__tests__/modules/work-admission.test.ts src/__tests__/modules/draft-lifecycle.test.ts`
  in `packages/shared` was attempted and exited before running (`spawnSync vitest ENOENT`: no
  `node_modules` in that worktree)
- Result: partial (static); three findings as above, two fixed before the closeout
- Validated paths: the merged owners of the 22 diffs under `packages/shared/src` and
  `packages/client/src`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/shared/src packages/client/src` → empty on `research/pwa-home-qa-pass-2` at `1931f0acbfca046cdbe993c9c74b9da06d1f0ac9` (whole tree clean)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable
- Browser evidence: none; this is not a runtime acceptance certification.

## Risks / Blockers

- Runtime reproduction, rendered focus return, contrast and long translations were not
  verified here; QA pass 1 and the UX audit that follows cover the rendered surface.
