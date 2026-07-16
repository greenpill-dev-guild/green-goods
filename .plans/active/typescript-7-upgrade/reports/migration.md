# TypeScript 7-only upgrade migration

## Summary

Upgrade every workspace compiler declaration to TypeScript 7.0.2 without retaining TypeScript 6.
Replace the shared locale coverage test's compiler API use with Babel AST parsing, remove
TS 7-incompatible `baseUrl` configuration, and refresh only packages whose current TypeScript
peer ranges excluded TS 7.

## Blast Radius

| Area | Impact | Notes |
|---|---|---|
| Root tooling | behavioral | Compiler binary and Knip update |
| Shared | behavioral | Locale AST parser and `gql.tada` refresh |
| Client / Admin | compatible | Compiler, React Intl, and `baseUrl` migration |
| Agent / Indexer / Docs | compatible | Compiler and docs config migration |
| Contracts | none | No source, tests, deployments, or configuration touched |

## Execution Order

1. Update manifests, compiler configuration, and the API-dependent test.
2. Regenerate `bun.lock` from the declared dependency graph.
3. Run the focused locale test and package-local compiler/build checks.
4. Run the repo quick gate and frozen-lockfile verification.

## Validation Results

- `bun install --frozen-lockfile --no-progress` passed.
- Every first-party workspace compiler resolves to `Version 7.0.2`; no TypeScript 6 package was added or resolved.
- `bun run typecheck` and the focused locale coverage test passed in `packages/shared`.
- Typecheck/build proof passed for agent, indexer, docs, client, and admin. The client production build also completed its PWA precache-budget check.
- `bun run format:check`, `bun lint`, and `git diff --check` passed.
- The complete docs test suite passed (28 tests). The confidence-band label test recorded a RED/GREEN cycle and now prevents numeric `year` values from overwriting the `Y1`, `Y2`, … chart labels.
- Fresh shared-suite evidence: 3,084 assertions passed (one skipped), while 25 suites failed only at import time because the root-wide `uint8arrays@5` resolution rewrites `@walletconnect/utils@2.23.1`'s pinned `uint8arrays@3.1.1`. The lockfile-backed resolution repair could not be regenerated in the current execution environment.

## Risks / Rollback

- A declared TS 7-compatible tool could still embed the former compiler API. Package typechecks,
  GraphQL typing, docs typecheck, and builds are the detection gates.
- React Intl is a major refresh. Its existing tests and client/admin builds are the rollback trigger.
- The latest `@hypercerts-org/marketplace-sdk` still nests `gql.tada@1.9.0` with stale TypeScript
  peer metadata. It resolves the workspace's TypeScript 7.0.2 at runtime and shared typecheck
  passes; no newer SDK release exists to refresh this transitive declaration.
- Rollback is manifest and lockfile restoration only; this work has no data, deployment, or runtime
  migration.

## Completion Checklist

- [x] Every workspace resolves TypeScript 7.0.2.
- [x] No TypeScript 6 package is added or resolved.
- [x] The locale coverage test passes.
- [x] Package checks pass.
- [ ] Repo Quick Gate: blocked only by the existing WalletConnect/`uint8arrays` package-export test setup failure.
