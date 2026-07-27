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
| Correct PR #649 scope and base | Phase 1 | Pending |
| Migrate to Envio 3.2.1 | Phase 2 | Pending |
| Prove behavior and replay preservation | Phase 3 | Pending |
| Land foundation before Commitment Pooling | Phase 4 | Pending |
| Defer hosted deployment honestly | Phase 4 | Pending |

## Phase 0: Tracker Convergence

- [x] Promote this hub to `.plans/active/`.
- [x] Refresh the plan from the current `develop` baseline.
- [x] Make PRD-557 the visible Envio 3.2.1 foundation issue.
- [x] Link PR #649 and record PRD-557 as blocking PRD-721 and PRD-722.

## Phase 1: Correct PR #649

- [ ] Retarget PR #649 from `main` to `develop`.
- [ ] Remove nested package-level Envio skill copies.
- [ ] Remove unrelated shared changes.
- [ ] Keep only migration-required indexer, workflow, CI, docs, and canonical-guidance changes.
- [ ] Keep root workflows Bun-first; allow pnpm only inside generated Envio internals.
- [ ] Keep Commitment Pooling entities and handlers out of this PR.

## Phase 2: Complete the 3.2.1 Migration

- [ ] Move config, handlers, dynamic registration, tests, runtime, Docker, CI, and doctor checks
  from v2 to supported Envio 3.2.1 patterns.
- [ ] Remove obsolete generated ReScript setup only where v3 replacement proof exists.
- [ ] Preserve GardenAccount and OctantVault dynamic discovery.
- [ ] Preserve all existing entity IDs, relationships, chain IDs, event behavior, and GraphQL shape.
- [ ] Record any unavoidable schema/nullability delta before merge.

## Phase 3: Prove the Foundation

- [ ] Obtain explicit dependency-install authorization before installing or regenerating.
- [ ] Run codegen from the checked-in lockfile.
- [ ] Run the indexer boundary, build, and test commands.
- [ ] Prove migration/replay idempotence and configured block-boundary preservation.
- [ ] Start the local runtime and verify GraphQL reachability plus one representative query.
- [ ] Run migration-required docs and guidance checks.
- [ ] Record reindex, DB compatibility, hosted configuration, rollback, and approval ownership.

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
