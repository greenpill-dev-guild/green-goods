# Recover a Kernel passkey account with a wallet

**Feature slug** `eoa-passkey-recovery`  
**Stage** Backlog  
**Status** Contract steps 1 and 2 on a pull request for review; later steps wait on rollout decisions  
**Created** 2026-11-08  
**Last updated** 2026-11-21  
**Linear Issue** [PRD-1447](https://linear.app/green-goods/issue/PRD-1447/recover-a-kernel-passkey-account-with-a-wallet)  
**Linear Project** [Kernel Account Recovery](https://linear.app/green-goods/project/kernel-account-recovery-7dc77ff47aa6)  
**Linear Source** `source:plans`  
**Research source** [RESR-21](https://linear.app/green-goods/issue/RESR-21/kernel-guardian-recovery-and-ens-username-recovery-boundary)

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Start with deployed, pinned Kernel 0.3.3 WebAuthn accounts on Arbitrum One. | The fork proved this deployment shape. Eligibility and grant compatibility are version-specific. |
| 2 | Use one owner-enrolled EOA with single-use recovery authority. Keep rotation atomic and narrowly scoped. | The recovery wallet must work after total loss. Atomic replacement avoids leaving the original account without a signer. |
| 3 | Resolve the account by a chain-verified recovery binding in the existing passkey directory. | The replacement passkey derives a different factory address. A clean browser needs a durable way to find the original. |
| 4 | Discover and remove verified reporting grants by permission ID on 0.3.3. | The fork's nonce sweep broke owner ERC-1271. Targeted removal retired the tested grants and preserved signing. |
| 5 | Treat grant review as an explicit post-recovery step. | Rotation leaves the grants active. The recovered owner chooses which reporting permissions to retire and can finish later. |
| 6 | Gate rollout on the guardian delay policy, finality policy, and confirmed eligible cohort. | The immediate fork fixture proved mechanics. These choices determine production takeover exposure and what the app can honestly promise. |
| 7 | The chain is the authority for a recovered account, and the passkey directory keeps a pointer the app re-checks against the chain before signing. (Afo, 21 Nov 2026) | The recovery contract's event and the validator's stored key cannot be forged by the directory. A pointer keeps sign-in by name working. It is one additive directory migration, in a follow-up pull request. |
| 8 | The contract takes any delay set at enrollment, 0 to 30 days. The app's default is 48 hours, and the current passkey can cancel a pending request. (Afo, 21 Nov 2026) | The delay stays an app setting, so it can change without a new contract. |

## Implementation sequence

| Step | Checkpoint and owning surface | Focused proof |
|---|---|---|
| 1 | **Pin the account boundary.** In Contracts, capture Arbitrum implementation, root, validator and EntryPoint pins for the supported 0.3.3 account. Inventory eligible account profiles and deployed reporting modules. Establish a failing fork test for an unauthorized guardian and a mismatched account. | The test rejects an unsupported root, chain, implementation, and a guardian bound to another account. |
| 2 | **Implement the recovery executor.** In Contracts, add and test guardian enrollment, replacement, removal, and one atomic key rotation. Specify its receipt and generation contract before a consumer depends on it. | Actual validator on a pinned Arbitrum fork rejects old signatures, preserves the key on failure, and rejects replay and arbitrary calls. |
| 3 | **Pin the reviewed executor deployment.** In the Contracts CLI and deployment artifacts, define the versioned, signer-free simulation and bytecode verification path. Treat live activation as its own release action. | The verifier reproduces the fork pins and refuses missing or mismatched code. |
| 4 | **Define and verify the recovered binding.** In Shared, define the recovery proof and the pure validation boundary beside existing passkey-directory contracts. Pin all inputs that join the chain receipt to the replacement credential. | Fixtures reject wrong account, key, credential, RP, purpose, chain, stale generation, and superseded or unconfirmed receipt. |
| 5 | **Persist and reconcile the binding.** In Agent, extend the existing directory challenge, lookup, and SQLite ownership paths. Add an additive migration and atomic completion with uniqueness, idempotency, and the current binding generation. | Old directory rows still work. Restore rehearsal preserves original identities. Duplicate, concurrent, and interrupted completion return consistent results. |
| 6 | **Use the binding at sign-in.** In Shared auth workflows, resolve verified recovered credentials at the original chain/address and route sign and send through the existing account client. Keep the normal derivation path for unrecovered accounts. | A clean browser signs in at the original address. The original and stale credentials fail. Existing 0.3.1, 0.3.3, and pilot paths pass their regressions. |
| 7 | **Discover 0.3.3 reporting grants.** In Shared reporting permission management, add version-aware discovery and classification from `SelectorSet`, verified descriptors, and current onchain state. Keep the Agent optional for discovery. | A clean client finds both live grants from the fork; partial history, unrelated permission, and unrecognized policy state stay distinguishable. |
| 8 | **Send and reconcile targeted revocation.** In Shared permission management and its hook, build and submit owner-signed targeted uninstalls and check the resulting state. Keep the 0.3.1 routing separate. | Revoked grants and stale approvals fail, an unrelated permission survives, and owner ERC-1271 and UserOperations succeed. Pending and partial results reconcile on retry. |
| 9 | **Expose recovery in the client.** Add enrollment and removal to account settings, a signed-out recovery entry, and a post-recovery link to review the verified grants. Use Shared hooks, localized copy and the existing transaction sender. | The user can enroll, lose access, recover, sign in, and revoke from a clean browser. Controls explain guardian authority and the state of outstanding grants. |
| 10 | **Prove the rollout path.** Run the full scenario with pinned deployment artifacts, then rehearse with the approved RP, device and sponsorship policy in the serving environment. Keep enrollment gated until the acceptance checks pass. | The fork and browser evidence cover the same account, verified grant revocation, interruption recovery and rollback of new enrollment. |

## Progress

| Step | State on 2026-11-21 |
|---|---|
| 1 | Done on the pull request: the executor refuses an account on another root validator, an address with no code, a Kernel that has not installed it, and a guardian bound to another account. The implementation and chain pins the app must check before offering enrollment are still to be captured in Shared. |
| 2 | Done on the pull request: enrollment, replacement, removal, delay, cancellation, expiry and one atomic rotation, with unit tests and [fork proof](reports/2026-11-21-arbitrum-fork.md). |
| 3 to 10 | Not started. Step 3 waits on a deployment decision; steps 4 to 6 wait on where the recovered-account record lives. |

## Dependencies and ownership

Contracts owns rotation authority and its events. The existing passkey directory owns binding persistence and the public lookup contract. Shared auth owns resolving and using the verified account. Shared reporting owns permission discovery and revocation. Client composes these flows. Read the owning package guides before editing, plus the [reuse contract](../../../.claude/context/codebase-architecture.md#reuse-and-capability-ownership) and [testing contract](../../../.claude/context/testing.md).

The [passkey continuity hub](../../active/passkey-account-continuity/spec.md) owns adoption and related origins. Reuse its directory and RP rules and reconcile the migration sequence before changing stored credentials. Keep pilot proof semantics intact unless that cohort is separately accepted. The [agent messaging hub](../../active/agent-messaging-channels/spec.md) owns current delegation rollout. Introducing production grant issuance on 0.3.3 is a separate acceptance decision.

## Test strategy and execution gate

Record RED and GREEN in each behavior-changing lane when implementation starts. Use focused Contracts fork and unit proof, Shared auth and permission suites, Agent SQLite migration and replay tests, and the Client browser journey. Run the selector's mandatory critical-surface gates for the exact implementation changes. Keep current-head evidence and real-device proof separate from the research fork. [Acceptance checks](eval.md) · [Validation pipeline](../../../.claude/context/validation-pipeline.md)

Move this hub to active after Product accepts the delivery scope. Use the Plan Hub start gate to verify the Product mirror and evidence lanes before editing runtime code. The mirror tracks the whole plan. Lane details stay in this hub.
