# Codex Handoff: Envio 2.32.6 + Preload Prep

**Parent lane**: `state_api`  
**Subphase**: `prep_v2_preload`  
**Branch**: `codex/indexer-v2-preload/envio-hyperindex-v3-migration`  
**Subphase depends on**: none

## Objective

Prepare the existing v2 indexer for v3 by upgrading to Envio `2.32.6` and proving preload behavior while preserving the current generated-package workflow.

## Required Work

- Confirm the latest official Envio migration guidance before editing.
- Bump only the indexer Envio dependency and corresponding lockfiles.
- Enable or verify preload behavior using the v2-compatible config path.
- Audit and adapt preload-sensitive behavior, especially Hypercert metadata fetches.
- Do not remove generated ReScript setup in this lane.
- If Docker is available, confirm the current runtime path still starts after preload prep; otherwise record an explicit proof limit.

## Validation

```bash
bun run --cwd packages/indexer check:indexing-boundary
bun run --cwd packages/indexer build
bun run --cwd packages/indexer test
```

Record validation evidence in this handoff and update `../status.json`.
