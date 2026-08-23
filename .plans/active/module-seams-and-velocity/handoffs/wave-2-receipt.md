# Wave 2 Consolidated Receipt

Wave 2 closes the approved client-controller, Community composition, Hasura permission-planner,
and commitment-pooling public-boundary batch on `develop`. The implementation is complete; the
boundary gate remains `BLOCKED`, not passing, on known sandbox capabilities recorded below.

## TDD Proof

- RED: Garden Commitment, Proof Composer, and Commitment Composer direct suites failed before their
  controller/model seams existed. The Community workspace direct suite failed before the former
  830-line `CommunityTab.tsx` was split into mode-specific surfaces.
- RED: the Hasura planner suite initially failed because the pure planner module did not exist. The
  validation-system regression reproduced `spawnSync git ENOBUFS` with a committed patch larger
  than Node's default buffer. The Wave 2 Shared batch then reproduced two cold-composition import
  timeouts at 30 seconds and 10 seconds.
- GREEN: the controller suites, Community workspace suite, 14-test Hasura boundary suite, and
  132-test validation-system suite passed. The cold-composition pair now passes 31/31 with 115 ms
  of test time while retaining direct singleton and lifecycle assertions.

## Validation Receipt

- Tested implementation commit SHA: `a5338a807836f7fb4f4be7d88c1215acfbbbe0a4`
- Run at (UTC): `2026-08-23T19:13:07Z`
- Exact command(s):
  - `bun run validation:plan -- --intent qa --base 43e414307 --head HEAD`
  - `bun run --filter @green-goods/shared typecheck`
  - `bun run --filter @green-goods/shared typecheck:tests`
  - `bun run --filter @green-goods/shared test -- src/__tests__/modules/job-queue.imports.test.ts src/__tests__/modules/submit-work-command.test.ts`
  - `bun run --filter @green-goods/indexer check:indexing-boundary`
  - `bun run --filter @green-goods/shared check:stories`
  - `bun run --filter @green-goods/shared check:story-quality`
  - `bun run check:source-structure`
  - `bun run check:design-md && bun run check:design-generated && bun run check:design-tokens && bun run lint:vocab`
  - `bun run test:validation-system`
  - `node scripts/dev/ci-local.js --quick`
- Result: format, lint, validation-system 132/132, Shared source/test typechecks, Shared 448/448,
  Client 195/195, Admin 72/72, Agent 270/270, source structure, all four design/vocabulary guards,
  and Storybook metadata/quality checks passed. The Hasura planner and boundary suite passed 14/14.
  The Quick Gate stopped after 277 Indexer tests passed because nine metadata tests could not bind
  `127.0.0.1` (`EPERM`).
- Validated paths: Wave 2 changes under Shared client-controller hooks, the pooling export surface,
  Client Garden Commitment and composer views, Admin Community workspace components/stories,
  the Indexer Hasura planner/fixtures/shell, and validation-system input handling.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all` returned
  no output at the tested implementation SHA.
- Evidence-only diff command and result: not applicable; this receipt and snapshot are the
  evidence-only follow-up.

## Module Health Snapshot

- `@green-goods/shared/commitment-pooling` is declared and consumed across Client and Admin; no
  consumer deep-imports Shared `src`. The Shared root hook barrel is 604 lines.
- Garden Commitment, Proof Composer, and Commitment Composer are controller-driven with direct
  Shared suites and pure readiness/beat models.
- `CommunityTab.tsx` is deleted. `CommunityWorkspaceContent` is directly covered, and the split
  visual components stay below 280 lines with colocated stories.
- The Hasura shell is 91 lines and applies request objects emitted by the 260-line pure planner.
  Restricted or malformed policies are preserved rather than widened.
- Default Job Queue singleton composition is isolated behind `default-instance.ts`, retaining the
  public export while keeping direct lifecycle proof fast under a multi-file batch.

## Velocity Snapshot

- The selector now fingerprints committed diffs above 1 MiB with an explicit 16 MiB Git output
  buffer; its full regression suite passes 132/132.
- The selected Shared batch completes in 45.25 seconds, below the 60-second program target for this
  changed-path set. Client completes in 51.30 seconds and Admin in 40.79 seconds; these are scoped
  batch observations, not quiet-machine full-suite target claims.
- Browser QA is blocked because this sandbox cannot bind the local app server on `0.0.0.0:3001`.
  Storybook browser serving is independently blocked on `::1:63315`; static story coverage and
  quality passed. The Docker-backed Hasura exercise is blocked because `docker` is unavailable.

## Blocker Accounting

The unchanged Indexer localhost restriction, unavailable Docker executable, local server bind
restriction, and unavailable authenticated Brave path are environment capability blockers. They
are not reported as passing and were not retried after their required capability stayed unchanged.
