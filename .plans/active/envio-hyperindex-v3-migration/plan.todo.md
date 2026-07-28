# Envio HyperIndex 3.2.1 Migration Todo

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | PRD-557 is the migration tracker | PRD-722 owns later Commitment Pooling indexer behavior. |
| 2 | Target Envio `3.2.1` directly from `2.32.12` | The old `2.32.3 -> 2.32.6` prep step is obsolete. |
| 3 | Correct PR #649 before landing | Its migration must be narrow, reviewable, and aligned with repo workflows. |
| 4 | Keep root workflows Bun-first | This is a repository invariant; only generated Envio internals may require pnpm. |
| 5 | Preserve behavior before adding Commitment Pooling | A stable v3 foundation lowers replay and handler risk. |
| 6 | Defer hosted deployment and reindex | Those belong to the later authorized release-ops step. |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Refresh plan and Linear tracking | Phase 0 | Complete |
| Correct PR #649 scope and base | Phase 1 | Complete: base retargeted to `develop`, corrected branch published to the fork head |
| Migrate to Envio 3.2.1 | Phase 2 | Complete |
| Prove behavior and replay preservation | Phase 3 | Complete: token-backed runtime, catch-up, and non-empty GraphQL proof captured |
| Pass the review/ship gate | Phase 3 | Partial: full tests, lint, and pinned build pass; `bun format:check` remains blocked by two develop-baseline plan files |
| Land foundation before Commitment Pooling | Phase 4 | Pending |
| Defer hosted deployment honestly | Phase 4 | Complete |

## Phase 0: Tracker Convergence

- [x] Promote this hub to `.plans/active/`.
- [x] Refresh the plan from the current `develop` baseline.
- [x] Make PRD-557 the visible Envio 3.2.1 foundation issue.
- [x] Link PR #649 and record PRD-557 as blocking PRD-721 and PRD-722.

## Phase 1: Correct PR #649

- [x] Retarget PR #649 from `main` to `develop`. Afo retargeted the base on 2026-07-27. The head
      is the fork branch `moose-code:chore/upgrade-envio-3.2.1`; the direct fork repo grants
      `push: false`, but the PR has `maintainer_can_modify: true`, so a base-repo maintainer
      published the corrected branch as a fast-forward (`0fb3f72d..ec1cb087`). No force push, and
      no superseding `origin` branch was created. PR #649 is now `MERGEABLE` with 58 changed files.
- [x] Remove nested package-level Envio skill copies.
- [x] Remove unrelated shared changes.
- [x] Keep only migration-required indexer, workflow, CI, docs, and canonical-guidance changes.
- [x] Keep root workflows Bun-first; Envio v3 requires no generated nested pnpm install.
- [x] Keep Commitment Pooling entities and handlers out of this PR.

## Phase 2: Complete the 3.2.1 Migration

- [x] Move config, handlers, dynamic registration, tests, runtime, Docker, CI, and doctor checks
  from v2 to supported Envio 3.2.1 patterns.
- [x] Remove obsolete generated ReScript setup only where v3 replacement proof exists.
- [x] Preserve GardenAccount and OctantVault dynamic discovery.
- [x] Preserve all existing entity IDs, relationships, chain IDs, event behavior, and GraphQL shape.
- [x] Record that there is no intentional schema/nullability delta; `schema.graphql` is unchanged.

## Phase 3: Prove the Foundation

- [x] Obtain explicit dependency-install authorization before installing or regenerating.
- [x] Run codegen from the checked-in lockfile.
- [x] Run the indexer boundary, build, and test commands.
- [x] Prove configured block-boundary preservation, deterministic clean replay, and the
      same-store repeated-range guard without entity mutation.
- [x] Start the local runtime and verify GraphQL reachability plus one representative query.
      (Token-backed 2026-07-27: healthz 200, Arbitrum caught up to head with `isReady: true`,
      21 GardenAccount + 39 OctantVault dynamic registrations, non-empty `Garden` result.)
- [x] Run migration-required docs and guidance checks.
- [x] Record reindex, DB compatibility, hosted configuration, rollback, and approval ownership.

## Phase 3b: Clear QA pass 1 blockers

- [x] Fix indexer test timeouts under the repo-parallel Ship Gate: batch events per `process()`
      call in `test/v3.ts` (as `replay.test.ts` already does) and/or raise the mocha timeout.
- [x] Stop mapping `clean` (and reconsider `stop`) to the database-deleting `envio stop`.
- [x] Pin a compatible runtime for the bare `envio` scripts so `bun run dev` works when the
      machine's default Node is older than 20.10.
- [x] Update `.claude/context/indexer.md` and `.claude/rules/indexer.md` to the v3 API and remove
      the now-destructive `bun stop` port-conflict advice.
- [x] Drop the false `doctor:fix`/`indexer:fix` surfaces and correct `indexer-deploy.mdx`.
- [ ] Resolve the develop-baseline formatting drift in the two plan `status.json` files separately
      from PRD-557 so `bun format:check` can pass without widening this PR.

## Phase 4: Land and Hand Off

- [ ] Complete human review of the corrected PR.
- [ ] Merge PR #649 into `develop`.
- [ ] Re-read `develop`, PRD-557, PRD-721, and PRD-722.
- [ ] Mark PRD-557 Done only after all repository acceptance evidence is attached.
- [ ] Unblock the Steward/GreenWill/architecture sequence that precedes PRD-721.
- [ ] Keep hosted deployment/reindex blocked until the later Commitment Pooling release-ops step.

## Validation Commands

```bash
bun run indexer:check-boundary
bun run --cwd packages/indexer codegen
bun run build:indexer
bun run test:indexer
node scripts/quality/check-codex-docs.js
bun run build:docs
bun run docs:audit:ci
```

No dependency install, code generation, implementation, merge, deployment, or reindex is
authorized by this tracker refresh.
