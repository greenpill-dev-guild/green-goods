# Yield & Split Management UI Spec

## Summary

This hub exposes the existing yield-split contract surface through shared hooks and admin/client UI. It replaces hardcoded split defaults with on-chain reads, adds an operator split editor, surfaces pending and escrowed yield, exposes `splitYield()` in the admin vault flow, and brings the client ConvictionDrawer onto the same live split config.

## Users

- Primary: garden operators managing yield and treasury behavior in admin
- Secondary: client users viewing community split configuration

## Functional Requirements

1. Add shared hooks for reading split config, setting split ratios, and reading pending/escrowed yield.
2. `GardenYieldCard` must read live split config, expose an edit flow for authorized users, and surface pending/escrowed yield plus explorer links.
3. `PositionCard` must expose a `splitYield()` action and strategy health diagnostics in the operator workflow.
4. `ConvictionDrawer` must read the real split config instead of using `DEFAULT_SPLIT_CONFIG`.
5. All new UI strings must ship in `en`, `es`, and `pt`.

## Non-Functional Constraints

- Package boundaries: hooks live in `packages/shared`; UI changes stay in `packages/admin` and `packages/client`
- Contracts: no new contract work in this hub; treat contract support as pre-existing
- Data access: read split config directly from chain rather than adding indexer schema
- Dependency: do not promote this hub ahead of `signal-pool-yield-wiring`
- UX: keep split editing modal-based to avoid unstable inline validation

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Shared yield hooks and invalidation | `state_api` | Primary hook/data lane |
| Admin + client UI surfaces | `ui` | Operator and viewer surfaces |
| Contracts | `contracts` | `n/a` |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential UX + regression validation |

## Risks

- UI can expose yield actions before routing is fully wired; keep this hub downstream from the wiring prerequisite.
- Pending-yield display can overfit to current vault assets; start with the assets already represented in admin.
- Hardcoded fallbacks can linger in secondary surfaces; audit both admin and client before closure.
