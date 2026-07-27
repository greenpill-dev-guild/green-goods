# Codex Handoff: Envio 3.2.1 Foundation

**Lane**: `state_api`  
**Linear**: PRD-557  
**Implementation PR**: GitHub #649  
**Status**: in progress  
**Depends on**: none

## Objective

Correct and complete PR #649 so Envio 3.2.1 lands on `develop` as a behavior-preserving
foundation before Commitment Pooling adds indexer events, entities, or handlers.

## Scope Lock

- Begin from the current PR #649 head and re-read its complete diff.
- Retarget the PR to `develop`.
- Remove package-local Envio skill copies and unrelated shared changes.
- Keep migration-required indexer, root workflow, CI, documentation, and canonical-guidance work.
- Keep root workflows Bun-first; generated Envio internals may use pnpm where required.
- Do not implement PRD-721, PRD-722, or any Commitment Pooling behavior in this PR.
- Do not install dependencies until Afo explicitly authorizes the install in the implementation
  session.

## Required Proof

- Envio 3.2.1 codegen from the checked-in lockfile.
- Boundary check, build, and tests.
- Focused GardenAccount and OctantVault dynamic-registration proof.
- Existing-handler regression proof for GreenWill, Hypercert, Campaign/Cookie Jar, and Garden data.
- Migration/replay idempotence and configured block-boundary preservation.
- Local runtime and representative GraphQL query proof.
- Review showing no nested skill copies, unrelated shared changes, or root pnpm-first drift.
- Production-readiness note for reindex, DB compatibility, hosted config, rollback, and approval.

## Commands

```bash
bun run indexer:check-boundary
bun run --cwd packages/indexer codegen
bun run build:indexer
bun run test:indexer
node scripts/quality/check-codex-docs.js
bun run build:docs
bun run docs:audit:ci
```

Record RED/GREEN evidence here and through `plan-hub record-tdd`. Do not mark the lane complete
until the corrected PR is merged into `develop`.
