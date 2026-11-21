# ENS L2 Sender Admin Recovery Plan

**Feature Slug**: `ens-l2-sender-admin-recovery`
**Stage**: `backlog`
**Status**: `BACKLOG — registrar contract and carry-over on a pull request for review; deploy and cutover not started`
**Created**: `2026-04-26`
**Last Updated**: `2026-11-21`

## Status reconciliation (2026-10-06)

Current source includes `ENSUsernameChangeRequest` and its Profile entry, preparing a support packet with desired slug, reason and contact. `useENSReleaseName` retains the legacy sponsored-release guard. Those portions are source-present, not fresh rendered or deployed proof. Sender admin recovery, the supported operator runbook and a fresh cross-chain inventory remain open. Revalidate the deployed sender, support policy and the name-reservation boundary before migration or implementation; no broadcast is authorized.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Ship first-time passkey claims on the current sender | `claimNameSponsored()` already exists on the deployed sender and should not be blocked by recovery work |
| 2 | Keep the legacy sponsored-release gate until sender recovery is live | Prevents passkey users from calling unsupported `releaseNameSponsored()` on the current Arbitrum sender |
| 3 | Treat current-contract username changes as support-assisted | Same-passkey users can still release through existing `releaseName()` if the smart account is funded |
| 4 | Build L2 recovery as a focused contract/admin workstream | The gap is structural and should not be buried inside generic ENS ops polish |
| 5 | Sender v2 is an upgradeable (UUPS) registrar on Arbitrum; the L1 receiver stays and is re-pointed with `setL2Sender` (Afo, 21 Nov 2026) | No ENS names move on Ethereum, and later changes no longer need a new contract and migration |
| 6 | Every existing registration is carried over unchanged from a manifest built from the sender's events (Afo, 21 Nov 2026) | Nobody loses a name; the sender's mappings cannot be listed on chain |
| 7 | The owner may release a member's name with a support reference, never a garden name, and may assign the released name to a named account at once (Afo, 21 Nov 2026) | Exact-name recovery after a lost passkey needs both steps; garden names stay permanent |
| 8 | Members get no self-service release; a name changes only through the operator path (Afo, 21 Nov 2026) | Closes the release-and-reclaim loop on sponsored fees |

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

## Progress (2026-11-21)

| Step | State |
|---|---|
| 1 Support policy | Decided: decisions 7 and 8 above. The four cases map to: same passkey wanting a new name, and lost passkey wanting the exact old name, both go through operator release then assign; lost passkey wanting any new name registers under the new account; an abusive name is an operator release. |
| 2 Recovery functions | Done on the pull request, with [handoff](handoffs/claude-contracts.md). |
| 3 Migration manifest | Done as a fork rehearsal that rebuilds the manifest from live events and reconciles it with the sender and with L1 ([report](reports/2026-11-21-live-state-fork.md)). An operator command that writes the manifest to a file is still to build. |
| 4 Deploy and rewire | Not started. The order to follow is below. |
| 5 Admin and support surface | Not started. |
| 6 Remove the legacy gate | Not started; waits for step 4. |

## Cutover order (for step 4; nothing here is authorized yet)

The previous sender cannot be paused and L1 reports nothing back when it skips a message, so the order matters.

1. Deploy the registrar and its proxy. Do not authorize the garden token on it yet.
2. Freeze the previous sender with owner calls: set its protocol hat to one nobody wears, withdraw its ETH, and remove the garden token as an authorized caller. Member claims and garden registrations through it now revert.
3. Wait until every message the previous sender already sent has landed on L1.
4. Build the manifest from the previous sender's registration and release events. Check every row against the sender's state and against the L1 receiver (same account, same type). Stop on any mismatch. Check the other direction too: the L1 receiver must hold no name the manifest lacks, counting its own registration events and any name its owner registered directly. A name only L1 holds would make L1 skip a later registration without a word.
5. Import the manifest into the registrar, check the import against the sender, and end the import.
6. Point the L1 receiver at the registrar (`setL2Sender`), then point the garden token at it (`setENSModule`) and authorize the garden token on the registrar.
7. Verify on both chains: a garden registration lands on L1, and the previous sender's messages are refused.

Operator recovery after cutover: release the name, confirm the L1 receiver shows it free, then assign it. If L1 skipped a registration, clear L1 and use `adminResendRegistration`.

## Validation

- [ ] Foundry tests for admin recovery, garden-name protection, and event emission
- [ ] Migration dry-run against a production-derived manifest
- [ ] Post-deploy verification across L2 sender, L1 receiver, and ENS resolver
- [ ] Shared/client tests for passkey request/change states
- [ ] Admin/support workflow tests if a UI surface is added
- [ ] Production build for touched client/admin surfaces
