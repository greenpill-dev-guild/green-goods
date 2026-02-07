# Client State, Sync, Cache, and Offline Optimization Plan

**Created**: 2026-02-07  
**Status**: Draft plan from architecture review  
**Scope**: `packages/client`, `packages/admin`, `packages/shared`

---

## Objectives

1. Improve reliability and clarity of state transitions across offline, queued, on-chain, and indexed states.
2. Reduce duplicated data-assembly logic and query invalidation drift.
3. Improve perceived and actual UI responsiveness under blockchain and indexer latency.
4. Move architecture closer to local-first behavior while keeping current stack and constraints.

---

## Current State Summary

- Strong foundations: React Query with offline-first defaults, IndexedDB-backed queue/drafts, optimistic UI.
- Key gaps:
  - Wallet offline queue path is not safely replayable.
  - Unbounded approval fetching and serialized dashboard data loading.
  - Query key inconsistencies and cache persistence concerns on sign-out.
  - Mixed lag-handling patterns and partial SW/background sync wiring.
- Local-first alignment estimate: **6.5 / 10**.

---

## Priority Findings To Address

## P0 (Reliability / Correctness)

1. Fix wallet offline queue replay path.
2. Clear persisted query cache on sign-out (not just in-memory query cache).
3. Unify query keys for `myWorks`, approvals-all, and garden invites.

## P1 (Scalability / Performance)

1. Replace unbounded approvals fetch patterns with targeted fetch strategy.
2. Refactor `WorkDashboard` data assembly into shared hook and batch fetches.
3. Standardize indexer-lag handling into one strategy.

## P2 (Architecture / Local-First)

1. Resolve SW registration ownership and background sync intent.
2. Add explicit lifecycle states: `queued -> submitted -> confirmed_on_chain -> indexed`.
3. Improve offline/online status fidelity beyond raw `navigator.onLine`.

---

## Implementation Plan

## Phase 1: Correctness Hardening (P0)

1. Queue replay compatibility
- Introduce explicit queue processing branch for wallet-originated jobs.
- If wallet job cannot be auto-processed, mark and surface actionable state (requires wallet confirmation).
- Add tests for wallet offline enqueue -> replay behavior.

2. Auth sign-out cache hygiene
- On sign-out, clear persisted query data (`IDB` + `localStorage` persister keys).
- Add user-session cache buster key to prevent stale rehydrate across sessions.
- Add tests around logout/login data isolation.

3. Query key normalization
- Add missing keys to `queryKeys` (`myWorks`, approvals-all, garden-invites).
- Replace ad-hoc array keys in hooks and client views.
- Add guardrail lint/check to discourage raw query key arrays.

## Phase 2: Throughput + UX Under Latency (P1)

1. WorkDashboard data refactor
- Move dashboard query/merge logic into shared hook (`@green-goods/shared`).
- Batch works fetch by garden list in one call where supported.
- Read offline queue once per cycle and group in memory.

2. Approval fetch strategy
- Stop broad all-approvals fetches in hot paths.
- Use targeted APIs by UIDs/gardens and add pagination-friendly shape.
- Add error states that preserve stale data instead of hard-empty fallback.

3. Lag handling standardization
- Replace scattered fixed delay invalidation with progressive invalidation policy.
- Keep optimistic row states until indexed confirmation or timeout window.
- Add visible “awaiting indexer sync” state in relevant cards/views.

## Phase 3: Local-First Maturity (P2)

1. Service worker alignment
- Choose one SW registration owner path (Vite PWA or shared service-worker manager).
- Remove dead/placeholder message flows or complete them end-to-end.

2. State lifecycle model
- Persist txHash and state transitions per submission.
- Reconcile with indexer update, with fallback presentation if lagging.

3. Connectivity quality
- Add lightweight reachability checks (indexer/RPC health ping) for better sync status.
- Differentiate `offline`, `degraded`, and `healthy` connectivity in UI state.

---

## Code Reduction Opportunities

1. Consolidate duplicate dashboard merge/dedupe/filter logic into shared hook utilities.
2. Centralize delayed/progressive invalidation usage.
3. Remove redundant SW management path.
4. Reduce duplicated approval parsing/fetching paths by reusing shared data-layer APIs.

---

## Candidate Library Consolidation

1. `@tanstack/query-async-storage-persister`
- Replace custom client persister plumbing with standard adapter behavior.

2. Typed query-key factory (for example `@lukemorales/query-key-factory`)
- Reduce key drift and invalidation mismatch risk.

3. Dexie (+ dexie-react-hooks) (optional)
- Replace large portions of custom IndexedDB boilerplate in queue/draft stores.

4. Replicache or RxDB (long-term optional)
- If full local-first replication/conflict-resolve becomes product requirement.

---

## Success Metrics

1. Zero stuck wallet-offline submissions in regression suite.
2. 50%+ reduction in approvals payload fetched for dashboard flows.
3. 30%+ reduction in WorkDashboard load time (cold and warm paths).
4. No user-scoped stale data after sign-out/sign-in switch.
5. Unified query key coverage with no ad-hoc key arrays in target areas.

---

## Risks and Mitigations

1. Risk: Behavior change in submission flows.
- Mitigation: add focused integration tests and staged rollout behind feature flags.

2. Risk: Refactor touches shared hooks used by both apps.
- Mitigation: keep API-compatible wrappers and migrate callers incrementally.

3. Risk: Indexer constraints block full targeted fetch strategy.
- Mitigation: use interim server-side aggregation endpoint or UID-batched fetching.

---

## Execution Order

1. Phase 1 (P0) end-to-end first.
2. Phase 2 dashboard + approvals throughput next.
3. Phase 3 local-first maturity and SW cleanup last.

