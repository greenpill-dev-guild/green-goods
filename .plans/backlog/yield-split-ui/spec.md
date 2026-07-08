# Yield Split Visibility and Operator Presets Spec

## Summary

This hub exposes the safe parts of the yield-split contract surface through shared hooks and admin/client UI, and includes the protocol hardening needed before preset editing is safe. It replaces hardcoded split defaults with on-chain reads, surfaces pending and escrowed yield, exposes `splitYield()` in the admin vault flow, hardens `setGardenTreasury()` governance, then adds guarded operator presets for the direct-funding vs hypercert remainder. The client ConvictionDrawer moves onto the same live split config as a read-only surface.

The Protocol Treasury share is fixed and Green Goods governed. The UI must preserve the live Protocol Treasury bps when it calls the broader `setSplitRatio()` contract method.

## Users

- Primary: garden operators managing yield and treasury behavior in admin
- Secondary: client users viewing community split configuration

## Functional Requirements

1. Use the existing shared `useSplitConfig`, `usePendingYield`, and `useAllocateYield` hooks where they already fit.
2. Add shared support for single-vault yield status where existing hooks do not cover the UI need.
3. `GardenYieldCard` must read live split config in Phase 1, but preset mutation controls remain unavailable until Phase 3.
4. `PositionCard` must expose operator-only `splitYield()` plus pending/escrowed yield and disabled/no-op states in Phase 1.
5. Harden `setGardenTreasury()` in Phase 2 so garden operators cannot change the Protocol Treasury destination.
6. Add shared support for guarded preset mutation in Phase 3. The mutation accepts only a preset/direct-funding-vs-hypercert choice, preserves the live Protocol Treasury bps, and internally calls `setSplitRatio()`.
7. Preset saves must show a confirmation dialog with before/after percentages and the fixed Protocol Treasury share.
8. `ConvictionDrawer` must read the real split config instead of using `DEFAULT_SPLIT_CONFIG`.
9. All new UI strings must ship in `en`, `es`, and `pt`.

## Phase Model

| Phase | Scope | Release Gate |
|---|---|---|
| Phase 1 | Live read-only split visibility, pending/escrowed yield, and operator-only `splitYield` | Can ship before treasury hardening |
| Phase 2 | Contract/protocol hardening for `setGardenTreasury` | Required before any preset editing UI ships |
| Phase 3 | Guarded operator presets for direct-funding vs hypercert split | Blocked until Phase 2 passes |

## Preset Math

The live Protocol Treasury bps is fixed at `270` for the current accepted defaults. The adjustable remainder is `9730`, and all final bps must sum to `10000`.

| Preset | Direct funding bps | Hypercert bps | Protocol Treasury bps |
|---|---:|---:|---:|
| Balanced | `4865` | `4865` | `270` |
| Direct funding | `7298` | `2432` | `270` |
| Hypercerts | `2433` | `7297` | `270` |

## Non-Functional Constraints

- Package boundaries: hooks live in `packages/shared`; UI changes stay in `packages/admin` and `packages/client`; treasury permission hardening stays in `packages/contracts`
- Contracts: limited to `setGardenTreasury` protocol/governance hardening and any ABI/type refresh required by that change; no yield-protocol redesign
- Data access: read split config directly from chain rather than adding indexer schema
- UX: preset chips only for v1; no freeform three-way editor
- Governance: do not expose `setGardenTreasury`, treasury destination editing, or raw Protocol Treasury bps editing
- Copy: use "Protocol Treasury" in product UI, not Juicebox-facing labels

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Shared yield hooks and invalidation | `state_api` | Primary hook/data lane |
| Admin + client UI surfaces | `ui` | Operator and viewer surfaces |
| Contracts | `contracts` | Codex-owned Phase 2 hardening for `setGardenTreasury`, TDD required |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential UX + regression validation |

## Risks

- `setSplitRatio()` is broader than the product UI should expose; the shared mutation must preserve the live Protocol Treasury bps and never expose raw three-way editing.
- `setGardenTreasury()` is operator-accessible in the current contract but product intent is Green Goods protocol control. This is an in-plan Phase 2 blocker for preset editing, not a separate plan.
- Pending-yield display can overfit to current vault assets; start with the assets already represented in admin vault cards.
- Hardcoded fallbacks can linger in secondary surfaces; audit both admin and client before closure.
