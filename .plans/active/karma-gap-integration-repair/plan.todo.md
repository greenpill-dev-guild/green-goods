# Karma GAP Integration Repair Plan

**Feature Slug**: `karma-gap-integration-repair`  
**Stage**: `active`  
**Status**: `ACTIVE`  
**Created**: `2026-08-26`  
**Last Updated**: `2026-08-26`  
**Linear Source**: `source:plans`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | GardenAccount is the Karma project owner | ProjectResolver checks its direct caller; permanent module authority would widen trust |
| 2 | Project access mirrors live Owner and Steward Hats | Matches Garden governance and the requested steward admin behavior |
| 3 | Membership is historical; admin is revocable | Preserves contribution history without retaining operational authority |
| 4 | Approved Work remains a Project Update | Existing product semantics are intentional; do not rewrite history as Impact |
| 5 | Future update text links Green Goods and EAS | Gives Karma readers a human route plus canonical attestation provenance |
| 6 | Profile metadata continuously reconciles | Prevents permanent drift after Garden edits |
| 7 | `imageURL` carries the canonical Garden image | Karma exposes no separate banner field |
| 8 | Best-effort writes emit structured outcomes | External failure must not block protocol truth or disappear silently |
| 9 | Existing Project Updates remain untouched | Immutable history is not duplicated to repair presentation |
| 10 | Arbitrum-only migration with Aiyeloja canary | Matches the deployed integration and constrains release risk |
| 11 | Upgrade and reconciliation are separate release actions | Implementation proof is not broadcast authority |
| 12 | Legacy GardenAccounts need a separate compatibility design | Live accounts delegate directly to the original implementation, so UUPS cannot deliver the new callback |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Correct project creation and ownership order | `contracts` | Steps 1-3 | implemented and validated |
| Add every Owner/Steward as member/admin and revoke stale admin | `contracts` | Steps 2-3 | implemented and validated for compatible accounts |
| Supported details, banner/image, and Project Update data | `contracts` | Steps 4-5 | implemented and validated |
| Correct emitter registration and replay-safe status | `state_api` | Steps 6-7 | implemented and validated |
| Typed status and role-aware retry hooks | `state_api` | Step 8 | implemented and validated |
| Steward-visible status and recovery controls | `ui` | Step 9 | implemented; authenticated browser proof blocked |
| Aiyeloja-first release inventory without broadcast | `contracts` | Step 10 | implemented; inventory correctly blocks immutable legacy accounts |

## Implementation Steps

### Step 1: Lock RED proofs for the real authority and ordering failures
**Files**: `packages/contracts/test/**`  
Add faithful ProjectResolver behavior, creation-order, revoked-role, idempotency, metadata, payload,
and failure-isolation tests. Record the failing commands before implementation.

### Step 2: Add the narrow GardenAccount access-sync seam
**Files**: `packages/contracts/src/accounts/Garden.sol`, interfaces, unit tests  
Add version discovery and module-only direct ProjectResolver reconciliation using Hats truth while
preserving storage layout and UUPS authorization.

### Step 3: Make project and role reconciliation deterministic
**Files**: `packages/contracts/src/modules/Karma.sol`, interfaces, integration tests  
Create/reconcile the project before role hooks, add permissionless role-verified reconciliation,
dedupe membership/details, and emit structured outcomes.

### Step 4: Reconcile canonical ProjectDetails continuously
**Files**: Karma library/module and Garden metadata hook call sites  
Hash canonical name/description/location/image details, write only on change, normalize the Garden
slug and HTTP image URL, and isolate external failure.

### Step 5: Repair future Project Update payloads
**Files**: Karma JSON builder/library, WorkApproval integration, schema tests  
Use supported fields only, Markdown Green Goods and EAS links, HTTP deliverable proof/metadata URLs,
and the existing Project Update semantic type.

### Step 6: Correct the indexer registration boundary
**Files**: `packages/indexer/config.yaml`, ABI/config registrations, boundary tests  
Register the Karma proxy/module emitter and remove the GardenAccount misregistration.

### Step 7: Add replay-safe Karma sync projections
**Files**: indexer schema, handlers, tests  
Persist chain-aware per-operation sync records and derive Garden-level current status without
indexing the EAS attestation stream.

### Step 8: Expose shared status and recovery mutations
**Files**: shared types, query keys, hooks, exports, direct tests  
Derive status from the indexer/account version, add role-aware reconcile, surface the immutable
legacy-account migration boundary without a false upgrade action, surface errors, and invalidate
canonical keys.

### Step 9: Add the `/garden` Karma integration panel
**Files**: admin Garden view/components/tests and shared i18n locales  
Render a compact operational panel for all states with Karma link, permission-aware retry and
migration-needed guidance, calm errors, and English/Spanish/Portuguese copy.

### Step 10: Add release inventory and canary tooling without broadcast
**Files**: `.plans/active/karma-gap-integration-repair/**`, contract release/upgrade tests or existing tooling extensions  
Generate a fresh read-only Arbitrum inventory at release time, identify account upgrade owners,
plan Aiyeloja first, require post-state verification before expansion, and make every mutating mode
explicitly separate and human-authorized.

### Step 11: Integrate, review, and validate
Run validation selected by `bun run validation:plan -- --intent ...`, independent critical-surface
review, indexer/shared/admin package proofs, and authenticated Brave UI proof. Record receipts last.

## Explicitly Out of Scope

- Production deploys, proxy upgrades, broadcasts, or live reconciliation.
- Celo and Sepolia Karma activation.
- Rewriting or duplicating historical Project Updates.
- Converting Work approval records into Karma Impact attestations.
- Karma upstream UI changes or a new permanent protocol admin.

## Validation

- [x] Contract focused RED/GREEN tests through package Bun wrappers
- [x] Storage layout, upgrade-path behavior, and contract size proof
- [x] Indexer codegen/boundary/tests/build as selected
- [x] Shared direct tests/typecheck and public-export proof
- [x] Admin targeted tests/build, Storybook state coverage, and en/es/pt coverage
- [ ] Authenticated Brave `/garden` rendered proof
- [x] Rendered validation selector and every selected focused check completed; no additional root quick gate was selected
- [x] No live transaction, broadcast, or deployment performed

Authenticated Brave proof is blocked because the browser extension connection is unavailable in
this session. Production repair is separately blocked because existing deterministic GardenAccounts,
including Aiyeloja's generation, are immutable ERC-6551 delegates rather than AccountProxy-backed
UUPS instances. See `release-runbook.md`.
