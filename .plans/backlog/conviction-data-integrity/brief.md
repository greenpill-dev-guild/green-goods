# Conviction Data Integrity

**Slug**: `conviction-data-integrity`  
**Stage**: `backlog`  
**Priority**: `p2`

## Problem

The conviction read model was split across three May 2026 backlog hubs: pool configuration, distinct supporter count, and threshold derivation. They share the same contract/indexer/shared boundary and must be revalidated together; executing one from a stale snapshot can make the displayed percentage, count, or threshold internally inconsistent.

## Desired outcome

One verified conviction data path supplies real pool configuration, distinct supporter counts, and the contract-equivalent threshold. The UI must never combine live values with hidden `memberCount = 1`, `1-or-0`, or fixed-75% fallbacks.

## Scope

- Re-audit the current pool ABI, emitted allocation events, indexer schema, and shared derivation before implementation.
- Decide one authoritative member-count source.
- Add indexer/shared support only after the event and identifier contract is proven.
- Preserve existing route behavior while replacing placeholders with explicit loading or unavailable states.

Historical source hubs are retained under `artifacts/source-hubs/` as evidence, not dispatchable plans.
