# Codex Handoff: State/API

**Lane**: `state_api`  
**Branch**: `codex/state-api/envio-hyperindex-v3-migration`  
**Depends on**: none

## Objective

Execute the two-phase Envio migration for `packages/indexer` while preserving current Green Goods indexer behavior.

Use `implementation-prompt.md` if this work is dispatched to a later agent session.

## Phase A: Envio 2.32.6 + Preload Prep

Use `codex-prep-v2-preload.md` as the detailed checklist.

Required outcome:

- Envio is upgraded from `2.32.3` to `2.32.6`.
- Preload behavior is enabled or explicitly verified.
- Handler side effects are audited, especially Hypercert metadata fetches.
- Existing generated ReScript workflow is preserved during this phase.
- Indexer package validation passes.
- Any v2 runtime smoke proof or proof limit is recorded.

## Phase B: Envio v3 Migration

Use `codex-v3-migration.md` as the detailed checklist.

Required outcome:

- Envio is upgraded to the selected v3 patch version.
- Config, handlers, dynamic registration, tests, Docker, CI, and local doctor checks are migrated.
- Obsolete generated ReScript setup is removed only after the v3 runtime/test surface proves it is unnecessary.
- Package validation, local runtime smoke, representative GraphQL query, and production-readiness deferral note are recorded.

Record both phase proofs here and update `../status.json`.
