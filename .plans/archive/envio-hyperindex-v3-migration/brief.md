# Envio HyperIndex 3.2.1 Migration

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

**Slug**: `envio-hyperindex-v3-migration`  
**Stage**: `active`  
**Priority**: `p1`  
**Created**: `2026-05-24`  
**Refreshed**: `2026-07-27`  
**Linear Issue**: [PRD-557](https://linear.app/greenpill-dev-guild/issue/PRD-557/envio-321-foundation-correct-and-land-pr-649)  
**Linear Project**: `Green Goods v1.3.0 QA & Release`  
**Implementation PR**: [#649](https://github.com/greenpill-dev-guild/green-goods/pull/649)  
**Linear Source**: `source:plans`

## Problem

The original May plan assumed an Envio `2.32.3 -> 2.32.6 -> v3` migration. `develop` now
uses Envio `2.32.12`, and open PR #649 targets Envio `3.2.1`. The old plan and Linear body no
longer describe the real work, while Commitment Pooling depends on the corrected v3 foundation
before adding more indexer entities, events, and handlers.

## Desired Outcome

- Correct PR #649 to contain only migration-required indexer, workflow, and guidance changes.
- Land Envio `3.2.1` on `develop` with codegen, build, test, migration/replay, block-preservation,
  runtime, and GraphQL-equivalence proof.
- Keep root workflows Bun-first. Generated Envio internals may remain pnpm-based where the tool
  requires them.
- Remove nested package-level Envio skill copies and unrelated shared changes.
- Leave hosted indexer deployment/reindex for the later authorized Commitment Pooling release-ops
  step.

## Scope

In scope:

- `packages/indexer`
- Migration-required root scripts and CI workflows
- Migration-required indexer documentation and canonical agent guidance
- PR #649 correction, review proof, and merge into `develop`

Out of scope:

- Commitment Pooling entities and handlers tracked by PRD-722
- Contract, client, admin, or unrelated shared changes
- Production deployment, reindex, or broadcast
- Dependency installation in this planning pass

## Dependency Position

PRD-557 is the Envio foundation issue. It blocks PRD-721 and PRD-722. PRD-722 remains the
subsequent Commitment Pooling indexer implementation lane rather than the migration tracker.
