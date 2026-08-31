# Public Garden Impact API Plan

**Feature Slug**: `public-garden-impact-api`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-08-29T00:24:32.707Z`
**Last Updated**: `2026-08-29T03:15:16Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Use a separate `garden-impact` public contract | The existing `public-impact` type is a frontend evidence slice, not an HTTP response |
| 2 | Keep aggregation pure and inject all source readers | Source failure and privacy behavior stay directly testable |
| 3 | Add strict, bounded readers instead of reusing tolerant UI helpers | Empty results must remain distinguishable from provider failure and truncation |
| 4 | Derive supported chains from direct deployment plus EAS endpoint data | Invalid chains must never fall back to another network |
| 5 | Count every positive nonrevoked approval once per Work | This is the accepted protocol-approval meaning for this endpoint |
| 6 | Represent missing schemas and failed sources as partial/null | Zero must mean a successful empty source |
| 7 | Keep wildcard CORS inside the new route | Existing authenticated/protected public routes retain their allowlist |
| 8 | Cache canonical 12-item snapshots after rate limiting | Limits remain effective and all request sizes share one bounded result |
| 9 | Keep this hub repository-only | No Linear mirror was requested |

## Implementation Notes

- The default reader is exposed through the existing Shared `./modules` package export. The Agent
  loads that barrel only when the route needs the default composition. A Bun-runtime import proof
  covers the deployed runtime path without adding a package-map entry.
- Review closure keeps by-action counts available when Action metadata fails, applies one shared
  Assessment source ceiling across schema versions, uses Hypercert lifecycle updates for activity,
  and returns a chain/address-stable impact resource URL.

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose targeted Shared/Agent tests, typechecks, source-structure proof, Plan Hub validation,
  the repository quick gate, and Agent/docs builds

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Versioned public response and route contract | `state_api` | Add contract types, route builder, and exports | ✅ |
| Strict source semantics and aggregation | `state_api` | Add readers, pure snapshot builder, and tests | ✅ |
| Public Agent endpoint | `state_api` | Add validation, CORS, rate limiting, LRU cache, and integration tests | ✅ |
| Builder documentation | `state_api` | Document the endpoint, source semantics, and operations | ✅ |
| UI behavior | `ui` | Not applicable | ✅ |
| Solidity/deployment behavior | `contracts` | Not applicable | ✅ |

## TDD / Proof Order

- [x] Identify the behavior boundary for the State/API lane before editing code
- [x] Write or select the minimal failing test/proof first
- [x] Run the RED command and record evidence in the lane handoff
- [x] Implement the smallest change that can satisfy the proof
- [x] Run the GREEN command and record evidence in the lane handoff
- [x] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

### UI

- [x] Marked not applicable; no UI, i18n, component, or browser-visible behavior changes.

### State / API

- [x] Add the dependency-light response contract and no-fallback support predicate.
- [x] Add strict source readers and pure source-aware aggregation.
- [x] Add the route-local CORS, rate limit, LRU cache, and HTTP status mapping.
- [x] Add Shared and Agent direct tests before implementation and record RED/GREEN proof.
- [x] Update API and Agent documentation.
- [x] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [x] Write `handoffs/codex-state-api.md`

### Contracts

- [x] Marked not applicable; no contract, ABI, deployment, broadcast, or release changes.

### QA Pass 1

- [ ] Verify `eval.md` behavior and regression criteria after State/API GREEN proof.

### QA Pass 2

- [ ] Review failure, recovery, privacy, caching, CORS, and source-cap edges.
- [ ] Run every selector-chosen check and reconcile the hub.

## Validation

- [x] Targeted Shared and Agent tests pass.
- [x] Shared source and test typechecks pass.
- [ ] Agent source and test typechecks are blocked by pre-existing address-type errors in the
  untouched Garden join-request source and tests.
- [x] `bun run check:source-structure` passes.
- [x] `node scripts/harness/plan-hub.mjs validate` passes.
- [ ] `node scripts/dev/ci-local.js --quick` passes every independent check but exits at the same
  Agent join-request type errors.
- [ ] `bun run build:agent` is blocked by the same untouched error; `bun run build:docs` passes.
