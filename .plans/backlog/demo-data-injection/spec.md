# Demo Data Injection Seams Spec

## Summary

Five places already exist where fabricated data can enter a Green Goods surface, at very different
depths, with very different reach and very different blast radius. This spec maps them with real
entry points, records the constraints that bound each one, and is the reference any of the four
rungs in `plan.todo.md` should be built against. Everything below was read in the repository on
2026-08-22, not inferred.

## Users

- Primary: whoever is reviewing a UI change and needs the screen to be full rather than empty.
- Secondary: anyone capturing screenshots for a walk, a demo, a grant application, or a partner
  conversation; and anyone onboarding who wants to see what the product does before it has data.

## The seam map

| # | Layer | Entry point | Reaches | Cost |
|---|---|---|---|---|
| 1 | Storybook query cache | `withSeededQueryClient(seeds)` — `packages/shared/.storybook/decorators.tsx:396` | Stories only | Already built |
| 2 | URL flags in the running app | `?mockAuth=`, `?mockPooling=1`, `?presentation=` | Client PWA member screens | Already built, narrow |
| 3 | Module read gate | `demoAware()` — `packages/shared/src/modules/commitment-pooling/data.ts`, `demo/demo-gate.ts` | Whatever is wrapped: 8 of ~15 pooling readers | One line per reader, plus fixtures |
| 4 | Indexer database | Postgres `:3008`, Hasura `:3006` | **All three UIs at once**, through the real query path | One script, no product-code change |
| 5 | The chain | Anvil fork `:3009`, `bun run seed:test` → `tests/fixtures/contract-helpers.ts` | Everything, end to end, including writes | Highest |

### 1. Storybook query cache

`withSeededQueryClient` builds a fresh `QueryClient`, calls `setQueryData` for each seed, and sets
`staleTime: Infinity`. `POOL_STORY_SEEDS` in
`packages/admin/src/views/Garden/Pool/poolStoryFixtures.ts` seeds the real
`queryKeys.commitmentPooling.*` keys, so the real route components render over fixtures with no
indexer, and `poolStoryControllers.ts` supplies acts that resolve without sending.

Known limit, found while capturing the walk: the three `Admin/Workspaces/*` route stories seed the
shell but not the pooling content. `Admin/Workspaces/Garden · Pool` passes `POOL_STORY_SEEDS` and
still stops at the chain-availability gate; `Workspaces/Hub · ConfirmQueue` renders an empty stage.
Several `PoolStatusCasts` stories also fall through to the steward-permission cast because their
identity is not a steward.

### 2. URL flags

- `?mockAuth=deployer|operator|user|disconnected` — `providers/AuthGate.tsx` swaps in
  `DevAuthProvider` under `import.meta.env.DEV`, persisted in `sessionStorage`. **It fakes the
  address, never the role.** `canManage` comes from `useGardenPermissions` reading the indexer's
  garden record, and `isPoolSteward` from per-role `readContract` calls against `GardenAccountABI`.
- `?mockPooling=1` — `modules/commitment-pooling/demo/demo-mode.ts`. Persists for the tab, evicts
  every pooling query on each flip in either direction, and short-circuits
  `selectCommitmentPoolingAvailability` so the chain reads as supported.
- `?presentation=pwa|website` — `utils/app/pwa.ts:17`, selects the installed-app or website shell.

### 3. Module read gate

`demoAware(name, realReader)` returns the real reader unless `import.meta.env.DEV` and the flag is
on, in which case it dynamic-imports `demo/demo-reads.ts`. Production builds fold the guard to
`false` and drop the import.

Wrapped today: `getCommitments`, `getCommitmentDetail`, `getCommitmentClaimRequests`,
`getCommitmentWorkAttributionsByWork`, `getCommitmentPools`, `getCommitmentPoolDetail`,
`getCommitmentCycles`, `getCommitmentCycleDetail`.

Not wrapped, with the reason in a comment in `data.ts`: `getCommitmentActivity`,
`getPoolMemberHistory`, `getPoolClaimRequests`, `getFallbackConfirmationCandidates` — "the steward
console reads have no fixtures; the demo world simply has none. The console is an operator surface,
not one of the member screens `?mockPooling=1` stands in for." Also unwrapped: the editorial
readers `getPublicGardenPool` (`data-public-pools.ts`) and `getPublicCommitmentImpact`
(`data-public-impact.ts`), and everything in `data-settlement.ts`, which is re-exported with
`export *`.

The demo world is `demo/demo-world.ts` plus `demo-builders.ts` and `demo-commitments.ts`: 3 pools,
2 cycles, 21 commitments across every on-chain state, 4 claim requests, 17 contributor rows, ~28
documents. It models the viewer as a **member** — creator, lead, contributor, confirmer — never as
a steward.

### 4. Indexer database

The local Envio stack runs Postgres on `:3008` and Hasura on `:3006`, both writable. Every entity
table exists: `Commitment`, `CommitmentCycle`, `CommitmentPool`, `CommitmentClaimRequest`,
`CommitmentEvent`, `Garden`, and the rest.

Current contents, measured: 22 `Garden`, 18 `CommitmentPool`, **0** `Commitment`, **0**
`CommitmentCycle`. Every pool is `NOT_READY` with zero offered, accepted or fulfilled.

This is the only seam that reaches all three UIs at once without any product-code branch, because
it feeds the real GraphQL through the real readers, selectors and formatters. It is also the seam
where today's gap actually is.

### 5. The chain

`bun run seed:test` / `bun run seed:anvil` runs `scripts/dev/seed-test-data.ts` against the Anvil
Arbitrum fork on `:3009`, using `tests/fixtures/contract-helpers.ts`: `createGarden`, `joinGarden`,
`isGardener`, `isOperator`, `registerAction`, `submitWork`, `approveWork`, `deployMockERC20`,
`createActionTimestamps`. There is no pooling equivalent — nothing creates a pool, seeds a cycle,
or offers a commitment.

`.plans/active/commitment-pooling/backfill-pools.ts` is a release-gated on-chain backfill operation,
not a dev seeder; do not repurpose it.

## Research Evidence

- Existing pattern references: `withSeededQueryClient` and `withAdminIdentity`
  (`packages/shared/.storybook/decorators.tsx`); `demoAware` (`demo/demo-gate.ts`);
  `scripts/dev/seed-test-data.ts` over `tests/fixtures/contract-helpers.ts`.
- Source files reviewed: `modules/commitment-pooling/{data.ts,data-public-pools.ts,data-public-impact.ts,data-settlement.ts}`,
  `demo/{demo-mode.ts,demo-gate.ts,demo-reads.ts,demo-world.ts}`, `providers/AuthGate.tsx`,
  `providers/DevAuthProvider.tsx`, `hooks/gardener/useRole.ts`, `hooks/admin-ui/useAdminAccessState.ts`,
  `packages/admin/src/main.tsx`, `packages/client/src/App.tsx`, `config/query-persistence.ts`,
  `packages/shared/src/__mocks__/server/server.ts`, `packages/indexer/package.json`.
- Evidence confirmed: table row counts read directly from the local Postgres; the unwrapped-reader
  list read from `data.ts`; msw resolved from the root lockfile at 2.14.6.
- Open inferences: whether a live `envio dev` process overwrites hand-inserted rows for entities it
  is actively indexing has **not** been tested. Assume it can.

## Human Judgment Points

- **Rung 3 changes what a review proves.** A browser-side MSW worker shadows the real network, so a
  screen reviewed through it is no longer evidence that the query layer works. That is a real
  tradeoff, not a detail; decide it deliberately rather than by drifting into it.
- **How faithful does seeded data need to be?** Rung 1 writes rows that no contract ever emitted.
  They will look right and be historically impossible. Acceptable for visual review, not for
  anything claiming to be evidence.
- **Protected surfaces**: anything under the Criticality Matrix's `critical` band — the JobQueue,
  Work and Auth providers, and the mutation hooks. No rung should need to touch them; if one seems
  to, stop.

## Non-Functional Constraints

- **Package boundaries**: hooks stay in `@green-goods/shared`; a seeding script belongs in
  `scripts/` with a durable caller, or in this hub if it is genuinely one-shot.
- **Dev-only, provably**: every seam must fold away in production builds the way `demoAware` does,
  behind `import.meta.env.DEV` with a dynamic import.
- **Writes must stay blocked.** Demo mode throws before sending in three places —
  `useCommitmentMutations.ts`, `useCommitmentPoolMutations.ts` (shared with
  `useCommitmentPoolSetupSequence`), and `job-executors.ts` which returns
  `{status: "waiting", reason: "demo-mode"}`. Any new seam inherits that requirement.
- **Persistence**: injected reads must not outlive their flag. See Risks.
- **Durability**: `envio dev --restart` and `bun run reset` delete the local database. Any rung-1
  seeding must be re-runnable and idempotent.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Rung 3 only, if a dev-mode worker registration is needed in the client and admin entry points |
| State / API | `state_api` | Rungs 1 and 2: the seeding script, and wrapping the editorial and console readers with their fixtures |
| Contracts | `contracts` | Rung 4 only: pooling helpers in `tests/fixtures/contract-helpers.ts`. Mark `n/a` if rung 4 is not taken |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential |

## Risks

- **Risk**: injected fixture data outlives the flag and is later read as real. Admin persists
  pooling reads to IndexedDB — `packages/admin/src/main.tsx` calls
  `createShouldDehydrateQuery({ excludedGroups: ["queue", "role"] })` and that helper
  (`config/query-persistence.ts`) has no demo awareness, unlike the client's inline guard in
  `App.tsx` plus its `dropPersistedPoolingReads` mirror.
  **Mitigation**: fix the admin dehydration guard before, not after, any rung ships. It is small and
  it is the difference between a review tool and a source of false confidence.

- **Risk**: a rung-1 seeder races the live indexer and its rows are overwritten or, worse,
  half-overwritten.
  **Mitigation**: seed with the indexer stopped, or into entities it is not actively writing, and
  make the script idempotent so a re-run is always safe.

- **Risk**: the seam count grows and each one drifts from the others, so "demo mode" means three
  different things depending on the surface. This has already started: `?mockPooling=1` means
  something on the phone and nothing on the editorial pages.
  **Mitigation**: prefer rung 1, which needs no per-surface concept at all, and treat rungs 2 and 3
  as additions to one story rather than parallel ones.

- **Risk**: seeded data quietly becomes the thing people demo to partners.
  **Mitigation**: whatever a rung produces should be visibly synthetic on inspection — recognisable
  names, obviously local addresses — so nobody mistakes it for pilot evidence.
