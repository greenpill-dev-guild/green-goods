# Batching and recovery specification

**Status:** Phase 1 local implementation underway; live compatibility proof pending.

## Evidence and ownership

Source baseline inspected at `73f05a9177125d6509105659f5a724472343cc31` on 2026-10-23. The checkout has concurrent edits; this is a source reference, not a clean-worktree validation receipt.

| Source | Existing capability | Gap |
|---|---|---|
| [Transaction types](../../../packages/shared/src/modules/transactions/types.ts), [confirmation](../../../packages/shared/src/modules/transactions/confirmation.ts) | Single-call checkpoint and reconciliation | Durable group/item outcomes and all receipts |
| [Passkey sender](../../../packages/shared/src/modules/transactions/passkey-sender.ts) | UserOperation identity, receipt checks, session guards | Explicit atomic calls; existing `sendBatch` is sequential |
| [Wallet sender](../../../packages/shared/src/modules/transactions/wallet-sender.ts) | EIP-5792 capability check and forced atomic calls | Persist opaque call ID before waiting; retain all receipts and protocol outcomes |
| [Queued work](../../../packages/shared/src/modules/work/upload-queued-work.ts), [work confirmation](../../../packages/shared/src/modules/work/work-confirmation.ts) | Bounded EAS groups, individual claims, checkpoints, receipt matching | Reuse for new bulk decisions without a second lifecycle |
| [Bulk hook](../../../packages/shared/src/hooks/work/useBatchWorkApproval.ts), [wallet bulk helper](../../../packages/shared/src/modules/work/wallet-submission/submit-batch-approval.ts) | Bulk API and `multiAttest` construction | Timeout currently continues into completion; passkey bulk helper bypasses common sender; pending state and metadata need parity |
| [Settings](../../../packages/admin/src/components/Garden/GardenSettingsEditor.tsx), [members](../../../packages/admin/src/components/Garden/AddMembersDialog.tsx) | Sequential progress and partial outcomes | Prepared selection, transport choice, durable item recovery |
| [Review form](../../../packages/admin/src/views/Garden/WorkDetail/ReviewForm.tsx), [Hub work queue](../../../packages/admin/src/views/Hub/components/HubWorkQueue.tsx) | Individual evidence review | Stage reviewed decisions and submit together |

No production app consumer of the bulk hook was found in the inspected source. Harden it before exposing it.

## Shared design

Keep domain preparation in `modules/garden` and `modules/work`. Keep capability, submission identity, reconciliation, and operation checkpoints in `modules/transactions`. React composition stays in Shared hooks; admin components render controls and results. Consume Shared through declared exports.

Two viable interfaces were considered:

| Shape | Tradeoff | Decision |
|---|---|---|
| Extend `TransactionSender` with a small checkpointed batch boundary | Reuses real adapters and guards; requires bounded caller migration | Selected |
| General persisted workflow coordinator | Could model arbitrary dependencies but overlaps the job queue and spreads domain rules | Deferred |

The boundary submits or reconciles one prepared group at a time. It does not determine permissions, invent decisions, schedule unrelated work, or become a generic workflow engine.

### Contract

Exact TypeScript names are settled with the first RED tests; these obligations are fixed:

- `PreparedBatch`: stable operation ID, account, chain, domain, item IDs, encoded calls/values, and fingerprint of the reviewed inputs. Use `Address` and repository chain helpers.
- Capability: account/chain-scoped `supported`, `ready`, `unsupported`, or unavailable/unknown. A failed probe is not proof of support; `ready` does not authorize an account upgrade. Native EAS multi-attestation is separate from wallet atomic capability.
- `BatchReference`: transaction hash, UserOperation hash, opaque wallet call ID, or opaque wallet transaction/proposal ID, with account and chain. Wallet IDs are strings, not necessarily `Hex`; retain connector context sufficient to attempt recovery without credentials.
- `BatchOutcome`: operation/group state, references, all receipts, and item outcomes. Pending results never require a fabricated hash or a success-shaped `TxResult`.
- Checkpoints: durable intent before the send boundary; known reference immediately after acceptance and before receipt waiting. Reconciliation only reads an existing submission.
- Compatibility: preserve single-call `TxResult` and legacy sequential `sendBatch`. A legacy atomic adapter may return a confirmed hash; unresolved results must carry their reference through a typed pending result/error. New callers use explicit capability and outcome contracts.

Do not activate batching for every passkey caller by flipping a global boolean. Opt each new feature in. Review existing `bundling-sender`, pool creation, reward editing, and pool setup consumers when changing atomic results; migrate only their shared contract, retaining their current business flow and rail eligibility.

### Journal and claims

Use installed Dexie for a small, versioned journal owned by `modules/transactions`, separate from the work database. Persist serializable encoded calls, immutable fingerprints, item IDs, group boundaries, state, timestamps, references, and receipt identities. Review payloads and attestation IDs remain authoritative in existing work/job records; the journal links them. Store no credentials or review media.

Reuse bounded database-open behavior. If extraction is needed, move only the neutral helper from `job-queue/database-open.ts` to a data/storage module and keep a compatibility export. Transactions must not depend on work/job-queue to open their store.

Acquire transactional claims for the operation and overlapping logical items in the same account/chain scope. Existing work jobs retain their own claims. Define acquisition order, renewal, and release to avoid deadlocks. Expired claims allow reconciliation, not automatic resend. Hydrate pending operations before enabling conflicting submits. Persist intent before opening the signer: a crash before the wallet returns an ID is still recoverable as unresolved.

Storage failure before send stops submission and retains the draft. Failure after send keeps any known reference in memory and exposes recovery information; it never becomes success or triggers another send. Account/session changes stop sends and hide other-account records without deleting them. Reconnect as the original account to recover.

Preserve unresolved records during cleanup. Phase 1 retires terminal payloads after 30 days and keeps compact operation-ID tombstones to prevent replay of the same retired operation. The dedicated database starts at version 1; future upgrades must preserve pending records. Incompatible or corrupt data fails closed; invalid records must surface an error, not permit a retry. Local claims cover tabs on the same origin, not other devices/subdomains or cleared browser storage. No global exactly-once guarantee is possible from this journal alone.

### State and recovery

| State | Required evidence | Next action |
|---|---|---|
| Prepared | Validated input; no send boundary crossed | Edit, cancel, or explicitly submit |
| Awaiting approval | Durable intent; signer request outstanding | Wait; explicit pre-broadcast rejection returns to editable state |
| Submitted | Known transaction, UserOperation, or wallet call reference | Reconcile |
| Confirmed | Successful execution and domain outcome verification | Complete matching items and refresh reads |
| Reverted | Authoritative failed-execution evidence | Explicit retry after revalidation |
| Unresolved | A send may have happened; status is missing or contradictory | Check status/reconnect; hold affected items |
| Declined before send | Explicit evidence no broadcast occurred | Keep unsent draft editable |
| Released | A person saw fresh domain state and chose to move on | Items are free; evidence stays; a late reference holds them again |

A disconnect, RPC error, missing indexer row, elapsed time, or expired wallet status does not prove absence of execution. Never automatically resend, split, or switch transports after an ambiguous send. The one proof of absence is a passkey record with no reference, because that reference is saved before the operation can be sent; such a record reopens. Every other hold ends only through a person's release, which reads the chain first. If a supposedly atomic wallet response shows partial execution, preserve evidence and reconcile items; do not label everything reverted.

Atomicity applies to each submitted group. Sequential calls or multiple groups can leave an operation partly complete. Show any split and expected application request count before signing. After rejection or uncertainty, later groups remain unsent until an explicit resume.

### Passkeys and wallets

**Passkeys:** encode all calls with the existing Kernel recipe and revert-on-failure batch mode. Preserve address, validator, chain allowlist, and EntryPoint configuration. Check UserOperation success, canonical receipt, and relevant Kernel execution-failure logs, not just outer receipt status. Recheck session ownership after signing and before broadcast. Estimate deployment overhead and paymaster constraints; never silently change the fee payer on sponsorship denial.

Local encoding inspection found batch/default execution mode for installed Kernel 0.3.1 and 0.3.3 paths. Deployed compatibility remains unproven. Enable only profile/chain combinations with conformance evidence; retain the safe single-call path elsewhere.

**Wallets:** probe the actual account/chain without prompting. Require atomic execution when using EIP-5792, save the opaque call ID before waiting, and validate the reported outcome and every receipt. A Safe proposal may remain pending for additional signers. Keep proposal identifiers distinct from execution hashes. If support is unavailable before sending, offer visible sequential fallback. Do not prompt for an account upgrade.

**Both:** simulate the ordered group and size it against gas, calldata, bundler/RPC, and sponsorship constraints. A single oversize item needs an explicit error or proven single-item path. Existing work caps of five UserOperation items and ten wallet items are provisional bounds, not general measured limits. Changed grouping or selection requires a fresh review summary. Atomic execution reduces requests; it does not guarantee lower gas cost or shorter confirmation time.

## Phase 2: garden settings

Snapshot the draft and current garden; prepare only changed fields. Finish banner compression/upload before chain submission and reuse its reference on retry. Uploads are outside chain atomicity. Reuse field encoders and validation through `modules/garden`.

Submit one atomic group when supported and within budget. Ordinary wallets keep sequential saves with persistent per-field outcomes. Reconcile after reload before deciding what remains. Retain drafts on rejection/uncertainty; confirm actual saved values and keep proposals distinct from saved fields. Retry only remaining unsent or definitely failed fields after refreshing current state.

## Phase 3: adding members

Resolve ENS before review and freeze resolved addresses. Normalize/deduplicate `(garden, address, role)` rows. Reuse `createGardenOperation` permissions, authoritative role checks, and rollback behavior. Existing roles become visible no-ops. Invalid rows show reasons; the user confirms any reduced valid selection.

Send one `grantRoles` call per bounded group through `single-call` mode, which gives every wallet one signature. Where it is unavailable, use a preselected sequential fallback. Keep person/role outcomes and earlier successes when a later group fails. Refresh authoritative membership and exclude confirmed rows from retries. Allow correction of failed rows. Do not expand caller permissions or include removals.

## Phase 4: deposits

A vault deposit can take three prompts today (reset the allowance, approve, deposit) and a cookie jar deposit two. [`useVaultDeposit`](../../../packages/shared/src/hooks/vault/useVaultDeposit.ts) and [`useCookieJarDepositMutation`](../../../packages/shared/src/hooks/cookie-jar/useCookieJarDepositMutation.ts) own their whole flows, so the client funding cards and endowment sheet and the admin deposit modals get the change through those hooks.

Finish the existing limit, preview, balance, and allowance reads first, then freeze one group for one account and chain. Reset the allowance only when the vault flow needs it (nonzero and too low), approve the exact amount, and deposit. Never approve more than the amount. Passkeys and wallets that report atomic `supported` send the group as one request, so a reverted group leaves no allowance behind. Other wallets keep today's approve then deposit in sequential mode, and the interface says up front that two signatures are coming.

A deposit moves money, so recovery matters more here than the prompt count. Today a receipt timeout reaches the funder as a failed deposit with a suggestion to try again, although the deposit may have landed. An unknown outcome must stay pending, survive a reload, and hold the next deposit into that vault or jar from the same account and chain until it is reconciled. Each attempt gets a new operation ID, and a confirmed deposit holds nothing.

Confirm a vault deposit only from a receipt whose `Deposit` event matches the vault, depositor, receiver, and amount. The jar's ABI shows no such event, so read a real deposit's logs before fixing its rule. A slow indexer leaves it pending.

The vault's `deposit(amount, receiver)` takes no minimum shares, so its slippage check can only run before signing. Today it runs after the approval lands. In an atomic group it runs last before signing, and nothing can land between the approval and the deposit. The window between signing and inclusion stays as it is today.

Enable only the account, chain, and asset combinations with recorded evidence. Octant checkout gets its own later slice because it is wallet only, on mainnet, with its own wrap step. Voucher deposits (one reviewed approval per call by design) and card endowment (thirdweb already batches it) stay out.

## Phase 5: bulk work approvals

Add staged review selection to the Hub **Work** queue and existing review flow. `HubConfirmQueue` handles commitment confirmations and is outside this change. Opening details and selecting for submission remain distinct interactions.

First release uses one garden, reviewer, and chain, and previously pending work. Each item needs an explicit individual decision. Approval requires the current confidence choice; rejection retains its required reason. Preserve feedback, verification method, audio/review-notes CID, action UID, and work UID. Finish uploads before group preparation. Do not invent default confidence or approve unseen records. Mixed approval/rejection decisions may share a group; show both counts in the summary.

Selection uses stable work UIDs and explicitly reviewed records. Filter changes never add hidden items. Garden/account/chain changes invalidate readiness while retaining correctly scoped drafts. Before signing, recheck operator permission, no self-review, expiry, work/action/garden relationship, and latest known decision. Stale decisions return to review.

The [WorkApproval resolver](../../../packages/contracts/src/resolvers/WorkApproval.sol) permits later decision attestations and has no compare-and-set guard for “still pending.” Preflight reduces races but cannot guarantee exclusive review across stewards/devices. Preserve existing latest-decision semantics and show reconciled outcomes. An on-chain concurrency rule is separate contract scope.

Reuse the EAS builder and queued approval preparation/confirmation. Each work keeps its own approval record/job and outcome. Submit one `multiAttest` call per bounded group through the common sender: a passkey UserOperation or ordinary wallet transaction. EIP-5792 is unnecessary for this single contract call. A resolver revert fails the whole EAS group; earlier groups remain complete.

Before UI wiring, remove wallet timeout-as-completion and the direct passkey bulk bypass. Pending overlays stay pending until matching attester, schema, recipient, and encoded decision data verifies each expected attestation. Preserve item-to-UID mapping through delayed/out-of-order EAS reads; no Envio schema change is proposed. Optional Karma/commitment hooks can fail independently, so approval success cannot imply those integrations or payment succeeded.

Admin submission remains an explicit online action. Persisted recovery jobs must not be swept into an automatic background sender. Preserve existing client offline-upload behavior separately.

## Architecture evidence and remaining uncertainty

- **Deletion test:** removing the shared boundary would make settings, members, and work each reimplement identity, checkpoint, and ambiguity handling. Domain builders remain separate because their rules differ.
- **Dependencies/adapters:** wallet RPC, Kernel/bundler/paymaster, and IndexedDB are external boundaries with real adapters. Test deterministic domain preparation directly; React only composes them.
- **Locality:** wallet changes stay in its adapter, review rules in work, membership rules in garden. Keep public exports minimal; no source-structure baseline expansion.
- **Test migration:** retain meaningful queue/single-call regressions. Replace false-success bulk expectations with pending/confirmed behavior and adapter conformance; do not mock the seam everywhere.
- **Confidence:** high in reuse direction; medium in deployed limits and wallet recovery behavior until measured. Reject a generic workflow graph, relay contract, new storage framework, and blanket unrelated migrations.

## Protocol references

Consulted during the preceding review on 2026-10-23; recheck installed and deployed versions at execution start.

- [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792): capability, atomic requirements, opaque IDs, receipts and bounded status availability.
- [EIP-7579](https://eips.ethereum.org/EIPS/eip-7579): batch call types and default versus try execution.
- [EAS implementation](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/EAS.sol) and [schema resolver](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/resolver/SchemaResolver.sol): native multi-attestation and resolver behavior. Installed code and deployment artifacts govern implementation.


## Phase 1 implementation decisions (2026-10-23)

The factory composes `TransactionSender.batches` for passkeys and wallets, opening its transaction journal only on explicit use. The embedded adapter retains its existing interface. `prepareBatch` snapshots and fingerprints calls; its modes are `atomic`, `sequential`, and `single-call`. The last mode lets one native contract call account for multiple logical items. New submissions require a fingerprinted `BatchBudget` and an adapter quote. Call-count and calldata bounds also limit the prepared selection; per-group gas/fee/payer ceilings are enforced by the transport. Domain preflight and per-item outcome verification remain required. Historical records without budgets can still reconcile.

Domain verification is required before every logical item becomes confirmed. A successful receipt with incomplete domain reads remains unresolved while preserving already verified items. Recovery retains the accepted identity and all receipts; contradictory wallet atomicity, chain, status codes, or receipt evidence remain unresolved. Proof of a pre-broadcast refusal leaves the draft editable. A declined/reverted attempt remains immutable; an explicit new attempt gets a fresh operation ID, while unresolved logical items block conflicting operations.

The existing work queue keeps its own persistence and claim authority. Bundled senders forward scoped batch references and recovery methods to each job; a missing/expired wallet status cannot fall through to absence-based retry. Legacy consumers that require one canonical hash remain pending for a multi-receipt result rather than assigning an arbitrary receipt to every item. Individual domain handlers continue to verify their own outcomes.

The installed Kernel 0.3.1/0.3.3 recipes passed software P-256-signed deployment, ordered groups of 2/5/10 calls, and revert rollback on an isolated Arbitrum fork. This proves the actual account/validator/EntryPoint execution fixture, not authenticated device signing or configured paymaster acceptance. Passkey gas/sponsorship ceilings are checked before signing; wallet quotes enforce ordered simulation ceilings because EIP-5792 leaves final fees to the wallet. Representative feature limits and live gates remain pending. See [the follow-up evidence](handoffs/phase-1-compatibility.md). No new batch UI is enabled by Phase 1.

## Recovery rules added on 2026-10-30

Reading the merged source found two gaps, and review of #1208 raised them independently. PR 1D closes both.

- **A hold can end.** A record with no reference and a `user-operation` quote reopens on reconcile. `batches.release` ends any other hold. A wallet's prompt can still be approved after its tab closes, and its status can expire, so neither case proves anything by itself. Release accepts that risk at a person's request, after a fresh read, and it keeps the evidence on the record.
- **A lapsed lease loses nothing.** Expiry lets another tab take over; until one does, the holder is still the only writer. An accepted reference is saved by `recordSubmission`, which needs no lease and can only add identity.

Operation IDs are minted per attempt and are unique in the browser. Reusing one across accounts fails closed with `batch-intent-changed`, because the fingerprint covers account and chain.

## Remaining actions

Phases 6 to 12 follow the same rules. Each caller supplies its domain preflight, its reviewed budget, and how to confirm each item, and each stays off until the enablement list names it. [The plan](plan.todo.md#slices) lists what each slice covers, and the actions that will not batch.
