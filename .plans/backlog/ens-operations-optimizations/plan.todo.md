# ENS Operations Optimizations Plan

**Feature Slug**: `ens-operations-optimizations`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-25`
**Last Updated**: `2026-04-25`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep this as a follow-up hub | Current deploy should not expand beyond core ENS claim/release/funding readiness |
| 2 | Treat onchain receiver state as final truth | Indexer and UI projections are operational aids, not authority |
| 3 | Start with visibility before redesigning transport | CCIP is already integrated; the next bottleneck is observability and operations |
| 4 | Avoid blocking usernames on full analytics | Users need claim/release now; deeper history can land incrementally |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Ops sponsor and settlement visibility | `ui`, `state_api` | Steps 1-2 | ⏳ |
| Live post-deploy smoke checks | `contracts` | Step 3 | ⏳ |
| ENS event projection | `indexer` | Step 4 | ⏳ |
| Cooldown/retry UX | `client`, `shared` | Step 5 | ⏳ |
| RPC resilience and alerting | `contracts`, `state_api` | Step 6 | ⏳ |

## Lane Checklists

### UI / State API

- [ ] Add an admin/ops ENS status surface for sponsor runway and receiver health
- [ ] Show pending claim/release counts and stale settlement warnings
- [ ] Add shared query/data helpers without duplicating contract truth
- [ ] Add i18n for any user-facing cooldown or retry copy

### Contracts / Ops

- [ ] Extend post-deploy verification with a live ENS smoke sample
- [ ] Add RPC fallback reporting for status and migration commands
- [ ] Add monitor-friendly exit codes and alert text for sponsor runway
- [ ] Document the expected top-up and migration runbooks

### Indexer

- [ ] Project `NameRegistrationSent` and `NameReleaseSent` events
- [ ] Correlate CCIP message ids to receiver-side `NameRegistered` and `NameReleased`
- [ ] Expose read models for recent ENS activity and stale settlement windows

### Client UX

- [ ] Show release cooldown and next-claim eligibility
- [ ] Add delayed-settlement recovery guidance
- [ ] Keep username display shortened to the subdomain where the `.greengoods.eth` suffix would be duplicated

## Validation

- [ ] Targeted ENS hook tests
- [ ] Client ENS/Profile tests
- [ ] Indexer projection tests
- [ ] Contract post-deploy smoke on the target network
- [ ] Production client/admin build for touched surfaces

## Implementation Steps

### Step 1: Define ENS Ops Read Model

Identify the minimum fields operators need: sponsor balance, pending refunds, estimated fee, covered action count, L1 receiver, recent sends, stale sends, and current receiver sample state.

### Step 2: Add Ops Visibility Surface

Expose the read model in the admin or ops surface using shared query helpers. Keep the first version compact and action-oriented.

### Step 3: Add Live Smoke Checks

Extend post-deploy verification with a sample registration lookup that checks L2 sender state, L1 receiver state, and resolver behavior where applicable.

### Step 4: Project ENS Events

Add indexer handlers for sender and receiver events so operators can see history without manual Arbitrum/Ethereum log scans.

### Step 5: Improve Cooldown / Retry UX

Add user-facing states for release pending, cooldown active, claim-eligible date, stale delivery, and sponsor underfunded recovery.

### Step 6: Add Alerting and RPC Fallbacks

Make monitor output suitable for automation and add explicit provider fallback reporting so rate limits are diagnosable.
