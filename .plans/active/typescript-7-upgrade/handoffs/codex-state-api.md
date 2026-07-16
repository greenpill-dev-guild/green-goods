# TypeScript 7-only upgrade - State/API Handoff

## Lane

- Owner: Codex
- Branch: `develop` (shared worktree; no isolated branch has been created)
- Status: implementation complete; repo-wide Quick Gate has an existing external test bootstrap blocker

## Scope

- Upgrade all first-party workspace compiler declarations and resolved compilers to TypeScript 7.0.2.
- Replace the shared locale coverage test's TypeScript compiler API use with Babel parsing.
- Refresh direct peer-constrained tooling only: Knip 6.26.0, `gql.tada` 1.11.2, and React Intl 10.1.15.
- Remove TS 7-rejected `baseUrl` configuration and preserve existing runtime fallbacks while adapting to TS 7 DOM declarations.

## TDD Proof

- RED: initial shared TypeScript 7 typecheck reported redundant nullish expressions and a duplicate `Window.scheduler` declaration from the updated DOM library.
- GREEN: `bun run typecheck` in `packages/shared` passed after the narrow compatibility fixes.
- RED: `bun run --cwd docs test src/components/docs/RevenueProjectionChart.test.ts` failed with the historic spread order because the numeric source year overwrote `Y1`/`Y2` labels.
- GREEN: the same focused test passed after the formatted year was assigned last.
- Proof limit: dependency/config migration; the focused locale test and package build matrix are the stronger behavior proof.

## Validation

- `bun install --frozen-lockfile --no-progress` passed.
- Focused locale coverage test passed (12 tests).
- Shared typecheck, agent typecheck/build, indexer build, docs typecheck/build, client build, and admin build passed.
- `bun run format:check`, `bun lint`, and `git diff --check` passed.
- The complete docs test suite passed (28 tests), including the confidence-band label regression proof.
- Fresh shared-suite evidence: 3,084 assertions passed (one skipped), while 25 files failed only at import time because the root-wide `uint8arrays@5` resolution rewrites `@walletconnect/utils@2.23.1`'s pinned `uint8arrays@3.1.1`. Removing that resolution requires a regenerated lockfile, which the current execution environment denied.

## Risks / Blockers

- Latest `@hypercerts-org/marketplace-sdk@0.8.0` nests `gql.tada@1.9.0` with a stale TypeScript 5 peer. It resolves TypeScript 7.0.2 and shared typecheck passes; no newer SDK release is available.
- The repo Quick Gate cannot be claimed green until the pre-existing WalletConnect test bootstrap error is repaired separately.
