# Oracle Eval: Contradictory Evidence Investigation

## Bug Report

**Title**: Duplicate work submissions visible in admin dashboard, but on-chain attestation count is correct

**Reporter**: Garden operator via admin dashboard feedback form

**Symptoms**:

Several garden operators have reported seeing duplicate work submissions in the admin dashboard's work approval queue. For example, a gardener submits one work entry, but the operator sees it listed twice in the pending approvals table. However, when checking the on-chain EAS attestation count for the same garden and action, the count is correct (only one attestation exists).

This makes the bug confusing to diagnose because the data source of truth (on-chain attestations) appears correct, yet the UI shows duplicates.

**Specific observations**:

1. The duplicate entries in the admin dashboard have the same attestation UID, same gardener address, same timestamp, and identical content
2. The duplicates appear immediately — not after a delay. They show up as soon as the admin refreshes the pending works list after the submission
3. The on-chain attestation count (queried via EAS GraphQL on easscan.org) always shows the correct number — no duplicates there
4. The indexer's `Work` entity count in the database matches the on-chain count — also no duplicates in the raw indexed data
5. BUT the indexer's `Work` entity for the affected submissions has a `lastUpdatedBlock` that is the same as the `createdBlock`, which is unusual — normally `lastUpdatedBlock` is higher if the work was later approved
6. The admin dashboard's TanStack Query devtools show the cache contains two entries for the same work — they have identical data but different internal React keys

**What we've tried**:

- Verified on-chain attestation count matches expected (correct)
- Verified indexer entity count matches on-chain (correct)
- Verified EAS GraphQL query returns correct results (correct)
- Checked the admin's TanStack Query cache — two entries exist with identical attestation UIDs
- Manually clearing the React Query cache resolves the duplicates until the next submission

**Environment**: Sepolia testnet, admin dashboard, happens across all browsers

**Question for oracle**: What is the root cause of the duplicate display in the admin dashboard when the on-chain and indexer data are correct? Why do we see two entries in the UI for a single attestation?

## Expected Root Cause

The duplicate display is caused by **two independent factors** that compound:

### Factor 1: Indexer Race Condition (Entity Creation)

When a work submission is created, two events fire in the same block:
1. The EAS `Attested` event (from the EAS contract)
2. The custom `WorkApproved` event (from the Green Goods resolver's `onAttest` callback)

The indexer has handlers for both events. The `Attested` handler creates the initial `Work` entity. The `WorkApproved` handler is supposed to UPDATE the existing entity with approval status. However, when both events are processed in the same block, there is a race condition in the Envio runtime:

- If `Attested` is processed first (normal case): `Work` entity is created, then `WorkApproved` updates it. Result: one entity. Correct.
- If `WorkApproved` is processed first (race case): The handler checks for the existing `Work` entity via `context.Work.get(uid)`, doesn't find it (not yet created), and creates a new entity with both creation and approval data. Then `Attested` fires and creates ANOTHER entity with the same UID but only creation data. The Envio runtime uses a composite ID, so if the handler constructs the entity ID differently (e.g., `uid` vs `uid-approved`), two entities with overlapping data can coexist momentarily.

However — and this is what makes the evidence contradictory — the indexer entity count checks out as correct. This is because the Envio runtime's entity deduplication eventually resolves the race, collapsing the two writes into one entity. The `lastUpdatedBlock === createdBlock` observation is the telltale: it means the entity was written twice in the same block and the second write's `lastUpdatedBlock` overwrote the first.

### Factor 2: TanStack Query Cache Deduplication

The admin dashboard fetches works via a query that returns an array. TanStack Query caches query results by query key, not by individual entity. When the indexer briefly returns data during the race window (or when the response includes the same entity under different query key variants), the cache stores both.

Specifically, the admin's work approval view makes TWO queries:
1. `queryKeys.works.byGarden(gardenAddress, chainId)` — all works for the garden
2. `queryKeys.works.pending(gardenAddress, chainId)` — pending works only

Both queries return the same work entry. TanStack Query stores each result set independently. When the React component renders, it merges results from both queries (or iterates over one that contains a duplicate from the indexer race window). The component uses **array index as the React key** (or a non-UID key), so React renders both entries as separate items.

The root fix is:
1. **Indexer**: Ensure the `WorkApproved` handler always checks for an existing entity and updates rather than creates, using a `getOrCreate` pattern with the attestation UID as the canonical ID
2. **Admin dashboard**: Deduplicate the works array by attestation UID before rendering, and use the attestation UID as the React key (not array index)

### Key insight:

Neither factor alone fully explains the bug. The indexer race condition creates the momentary data inconsistency, but the cache/rendering layer amplifies it into a visible duplicate. Fixing either one independently would reduce the symptoms but not eliminate them entirely — both need to be addressed.

### Files likely involved:
- `packages/indexer/src/EventHandlers/WorkApproved.ts` — race condition in entity creation
- `packages/indexer/src/EventHandlers/Attested.ts` — competing entity creation
- `packages/admin/src/views/Works/WorkApprovalQueue.tsx` — rendering with array index keys
- `packages/shared/src/hooks/work/useWorks.ts` — query key structure and cache behavior

### Confidence:
**Medium** — The evidence initially appears contradictory (correct on-chain count but UI duplicates). The two-factor explanation synthesizes all observations, but confirming the exact indexer race condition requires inspecting the Envio runtime's same-block event ordering behavior, which may vary by chain.
