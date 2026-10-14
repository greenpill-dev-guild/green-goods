# ENS L2 Sender Admin Recovery Plan

**Feature Slug**: `ens-l2-sender-admin-recovery`
**Stage**: `backlog`
**Status**: `BACKLOG — support UI exists; sender recovery and live inventory remain gated`
**Created**: `2026-04-26`
**Last Updated**: `2026-10-06`

## Status reconciliation (2026-10-06)

Current source includes `ENSUsernameChangeRequest` and its Profile entry, preparing a support packet with desired slug, reason and contact. `useENSReleaseName` retains the legacy sponsored-release guard. Those portions are source-present, not fresh rendered or deployed proof. Sender admin recovery, the supported operator runbook and a fresh cross-chain inventory remain open. Revalidate the deployed sender, support policy and the name-reservation boundary before migration or implementation; no broadcast is authorized.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Ship first-time passkey claims on the current sender | `claimNameSponsored()` already exists on the deployed sender and should not be blocked by recovery work |
| 2 | Keep the legacy sponsored-release gate until sender recovery is live | Prevents passkey users from calling unsupported `releaseNameSponsored()` on the current Arbitrum sender |
| 3 | Treat current-contract username changes as support-assisted | Same-passkey users can still release through existing `releaseName()` if the smart account is funded |
| 4 | Build L2 recovery as a focused contract/admin workstream | The gap is structural and should not be buried inside generic ENS ops polish |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Define current support flow | `ui`, `state_api` | Step 1 | ⏳ |
| Add L2 sender admin recovery | `contracts` | Step 2 | ⏳ |
| Preserve/migrate existing sender state | `contracts` | Step 3 | ⏳ |
| Rewire L1 receiver and GardenToken safely | `contracts` | Step 4 | ⏳ |
| Add support/admin status UX | `ui`, `state_api` | Step 5 | ⏳ |
| Verify cross-chain recovery | `qa_pass_1`, `qa_pass_2` | Step 6 | ⏳ |

## Immediate Updates To Make Now

- [x] Source-present support entry and username-change request sheet (October 6 source inspection; rendered/deployed proof not refreshed).
- [x] Source-present support packet captures current/desired names, account, reason and contact; operator delivery remains a separate check.
- [ ] Add operator instructions for the current-contract path:
  - fund the user's current smart account on Arbitrum,
  - have the user sign existing `releaseName()`,
  - wait for CCIP release,
  - let the user claim the new name through sponsored claim.
- [ ] Add separate copy for lost-passkey recovery:
  - claim a new username immediately, or
  - request exact-name recovery handled by an operator.
- [ ] Keep the existing sponsored-release gate so no unsupported selector is submitted.

## Sender Recovery Implementation Steps

### Step 1: Lock The Support Policy

Document the supported cases:

- same passkey, wants new username;
- lost passkey, wants any new username;
- lost passkey, wants exact old username;
- abusive or squatted username release.

### Step 2: Design L2 Recovery Functions

Add narrowly scoped owner-only functions to a sender v2 candidate:

- release a gardener name for a known owner/slug;
- prevent garden names from being released through the user recovery path;
- optionally send the L1 release message using contract-funded CCIP;
- emit recovery events with operator and recovery reference.

### Step 3: Build Migration Manifest

Create a migration manifest from Arbitrum sender events plus L1 receiver reads. Include slug, owner, name type, and whether the record is active on L1.

### Step 4: Deploy And Rewire Sender V2

Dry-run, then broadcast:

- deploy sender v2;
- seed/migrate active records;
- fund sponsor balance;
- call `GardenToken.setENSModule(senderV2)`;
- call L1 receiver `setL2Sender(senderV2)`;
- verify sender, receiver, resolver, and app reads.

### Step 5: Add Admin/Support Surface

Expose a compact admin/support workflow for pending username-change requests, exact-name recovery, and post-recovery verification.

### Step 6: Remove Legacy Gate After Verification

Only after sender v2 is live and verified, remove the legacy-address sponsored-release block and re-enable self-service passkey release/change where appropriate.

## Validation

- [ ] Foundry tests for admin recovery, garden-name protection, and event emission
- [ ] Migration dry-run against a production-derived manifest
- [ ] Post-deploy verification across L2 sender, L1 receiver, and ENS resolver
- [ ] Shared/client tests for passkey request/change states
- [ ] Admin/support workflow tests if a UI surface is added
- [ ] Production build for touched client/admin surfaces
