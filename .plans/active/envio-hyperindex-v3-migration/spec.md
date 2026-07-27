# Envio HyperIndex 3.2.1 Migration Spec

## Current State

- `develop` pins `envio@2.32.12`.
- The package still uses v2 config, generated ReScript bindings, registration APIs, test helpers,
  and setup-generated workflows.
- GitHub PR #649 is open, non-draft, and targets `envio@3.2.1`, but its correction pass is not
  complete.
- PRD-557 is the owning migration issue. PRD-722 begins only after this foundation lands and owns
  Commitment Pooling-specific indexer work.

## Target State

- `envio@3.2.1` is installed and locked.
- Config, handlers, dynamic registration, tests, runtime, Docker, CI, and doctor checks use the
  supported v3 shapes.
- Existing Green Goods entities, composite IDs, chain IDs, dynamic contracts, GraphQL behavior,
  indexed block boundaries, and replay behavior are preserved.
- Root commands and workflows remain Bun-first.
- pnpm is confined to generated Envio internals where the tool requires it.
- No package-local Envio skill copy or unrelated shared change remains in the PR.

## PR #649 Correction Contract

1. Retarget the PR to `develop`.
2. Remove nested package-level Envio skill copies and unrelated shared changes.
3. Retain only migration-required indexer, root workflow, CI, documentation, and canonical
   guidance changes.
4. Replace root-level pnpm-first commands with the repository's Bun wrappers.
5. Preserve Envio-generated pnpm internals only where generation requires them.
6. Do not add Commitment Pooling entities or handlers in this PR.

## Required Behavior

- Every persisted entity retains its current `chainId` and composite-ID semantics.
- GardenAccount and OctantVault dynamic discovery still register and index later events.
- GreenWill, Hypercert, Campaign/Cookie Jar, and existing Garden event behavior remains equivalent.
- EAS attestations remain outside this indexer.
- The v3 migration preserves the configured canonical start/end block boundaries.
- Replay is idempotent across the current entity set.
- Public GraphQL names, relationships, and nullability remain equivalent or any unavoidable
  migration delta is explicitly recorded before merge.

## Proof Ladder

Required before merge:

```bash
bun run indexer:check-boundary
bun run --cwd packages/indexer codegen
bun run build:indexer
bun run test:indexer
node scripts/quality/check-codex-docs.js
bun run build:docs
bun run docs:audit:ci
```

Also require:

- Clean generation from the checked-in lockfile after explicit install authorization.
- Focused dynamic-contract and representative existing-handler tests.
- Migration/replay and start-block preservation evidence.
- Local runtime startup with GraphQL reachability and a representative Green Goods query, or an
  exact proof limit that prevents merge-readiness claims.
- A production-readiness note covering reindex strategy, DB/schema compatibility, hosted secrets
  and configuration, rollback, and the later deployment approval owner.

## Rollout Boundary

Landing PR #649 completes the repository migration foundation. It does not authorize hosted Envio
deployment or reindex. Those operations occur after Commitment Pooling contracts and indexer work,
through the separately authorized release-ops sequence.
