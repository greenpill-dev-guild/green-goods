# Commitment Pooling — Cross-Surface Acceptance Matrix

**Status**: canonical execution companion  
**Updated**: 2026-07-27
**Sources**: `contract-spec.md`, `settlement-spec.md`, `pilot-evidence-spec.md`, `uiux-spec.md`, `wireframes.md`
**Purpose**: one exact target for the handoffs' copy/state matrix, public claim/copy matrix, and final QA acceptance matrix. Specs win if this summary drifts.

## 1. State and copy matrix

| Condition | Client PWA | Admin | Editorial / docs | Required exit |
|---|---|---|---|---|
| `None` / `UNKNOWN` sentinel | Loading, not-found, or retry; never a state chip | Recovery row; never a selectable state | No claim | Creation event or explicit not-found |
| Pool NotReady | Pool absent | Checklist: charter, non-zero provider open-commitment cap, qualifying Baseline assessment | Planned/readiness only | App enables `markPoolReady` only after all three; the contract enforces charter + non-zero count cap, while current non-revoked Baseline remains an app/shared/admin preflight |
| Pool Paused | “New participation paused” + reason; browse/evidence/recovery stay available | Reason + resume; create/claim/Ready-submit/confirm disabled; safe wind-down enabled | Neutral quiet-period copy | Resume event clears reason |
| Pooling trust-root configuration | No public UI | Pooling module initializes paused; register initialized with module zero is non-operational until one-time wiring; module dependency/schema setters require pause and emit old/new facts; the onchain unpause guard requires six non-zero dependencies plus four non-zero, pairwise-distinct UIDs; release sequencing additionally keeps pooling paused until GardenToken and WorkApprovalResolver upgrades establish and verify both reverse links; the frozen module interface exposes `paused()` because register replacement after initial wiring calls it and requires the current module paused | No UI copy | Interface/implementation ABI proof plus zero/collision/unpaused/incomplete-unpause/max-plus-one tests fail before storage or events; transaction-plan proof rejects unpause before both reverse links and all chain-2/chain-3 readiness facts |
| Named confirmer bound | Confirmer picker never submits more than 32 addresses | Admin shows a validation error before write | “Choose up to 32 confirmers” | Contract rejects 33 before class/commitment mutation; duplicate/provider filtering remains threshold-safe |
| Claim Pending | Canonical claimant + “requested by” actor + provider context | Same stored row; accept/decline key canonical claimant | Counts only | Accept, decline, supersede, cancel, or expire |
| Claim Declined | Reason + fresh-request CTA | Selected row only | Not public | New request, never retry old row |
| Claim Superseded | Taken/no-longer-available copy; no retry | Indexed terminal row | Not public | Browse exit |
| Evidence-only Accepted | Evidence + declared assessment requirements | Attach assessment; submit Ready; override separate | Active counts only | Evidence, assessment when declared, submit Ready |
| DomainImpact Accepted | Per-action Work/approval progress; no manual Ready-submit | Positional requirement rows; override separate | Active counts only | Every `approvedWorkCounts[i] >= requiredApprovedWorkCounts[i]` + assessment when declared |
| Fulfilled Celo reward awaiting queue | “Arranging settlement; your promise is fulfilled” | Automatic `settlement` job pending/retrying state plus an exhausted state with explicit retry; no payout-approval button | Fulfilled, settlement not yet queued | Permissionless derived queue or exact historical-pointer reconciliation |
| Settlement queued | “Support is queued” | Dispatch action + fee quote/reserve | Planned, not sent | Successful command dispatch |
| Command dispatched | “Support on its way” | Command message ID, elapsed time, fee/route health | Sent, never received | Indexed Celo execution or authenticated failure acknowledgment |
| Executed; acknowledgment pending | “Confirming arrival” | Celo execution + retry acknowledgment guidance | Confirming, never received | Authenticated success acknowledgment |
| Confirmed settlement | “Support arrived” | Command, Celo execution, acknowledgment, Celo ref | Confirmed | Authenticated current success acknowledgment |
| Authenticated execution failure | Calm failure/recovery | Bounded failure code + per-member new-attempt/cancel controls | Failed | Explicit reconciliation |
| Cancelled from Queued | “Support was withdrawn before it was sent” | Cancellation reason + Queued origin | Cancelled before send | Terminal; no execution key; permanent commitment pointer blocks every fresh queue |
| Cancelled from Failed | “Support was closed after delivery could not complete” | Failed attempt/code + cancellation reason/origin | Cancelled after authenticated failure | Terminal; no new execution key; permanent commitment pointer blocks every fresh queue |
| Queued batch cancelled | Each member uses Cancelled-from-Queued copy | One whole-batch action, reason, immutable member list, and blast radius; no member-level cancel | Batch and every member Cancelled before send | Atomic terminal transition; no partial queued-batch state; every reward pointer remains terminal |
| Delivery/fee delay | Still on its way / confirming; never failed | Retry same command or stored acknowledgment; manual-execution guidance | Delivery delayed, not payment failure | Delivery/fee recovery |
| Member delivery disabled | No Individual G$ balance/send/delivery CTA; Garden-claim reward state remains visible | Gate reason; new Individual commitment-reward queues and member sends are blocked, while existing queued/historical Individual outcomes stay visible and continue through their recorded lifecycle; Garden-claim rewards and non-commitment garden seeding remain available | Explicit member-delivery-blocked copy; no claim that Safe-to-Safe routes or existing settlement history are blocked | AA/paymaster exit evidence + enabled event for new Individual delivery |

## 2. Identity, permissions, and payout formulas

| Contract fact | Canonical formula | UI / test assertion |
|---|---|---|
| Claim type | runtime `kind == stored claimType` | Mismatch is a contract error, not eligibility copy |
| Individual claim | `claimant = requestedBy = msg.sender`; counterparty = caller | One identity row |
| Garden claim | `claimant = gardenContext`; `requestedBy = authenticated operator`; counterparty = GardenAccount | Show both GardenAccount and requester |
| Provider | Offer → creator; Request → accepted counterparty | Provider excluded from ordinary/named/fallback confirmation |
| Work linker | accepted canonical claimant/counterparty or steward | Creator is not an extra path |
| Pre-accept cancellation | creator or steward | Both paths tested |
| Accepted cancellation | steward only | Member control hidden |
| Individual G$ beneficiary | stored provider same-address Celo AA | AA gate required |
| Garden G$ beneficiary | registered `providerGarden` Celo Safe | Never send to Arbitrum GardenAccount |
| Commitment-reward source | registered Safe for the owning pool `commitment.garden`; protocol commitment → GG protocol Safe | `executorGarden` and source never switch to the provider garden; Garden claim uses providerGarden only as recipient/attribution |
| Reward-rail exclusivity | `ArbitrumExternal` may use core `recordRewardPaid`; `CeloSettlement` may use SettlementModule; `None` has zero reward fields | A commitment cannot record both rail outcomes; Celo queue rejects the external rail and core payout recording rejects the Celo rail |
| Celo reward queue authority | `queueDisbursement(commitmentId)` is permissionless because source, beneficiary, token, amount, rail, Fulfilled state, and the permanent one-disbursement-ever pointer are contract-derived | The indexer exposes queue-ready only when every source/beneficiary prerequisite is true and no pointer exists. A signed-in app creates at most one device-local attempt per `(chainId, commitmentId, userAddress)`, re-checks readiness + pointer before every send/retry, reconciles a competing exact pointer, and suppresses every terminal pointer. Blocked readiness creates no attempt/retry; local exhaustion leaves Fulfilled untouched and is never global |
| Non-commitment garden funding authority | `queueFunding(garden, amount)` is reserved to a current protocol steward or SettlementModule owner; source, registered recipient Safe, and canonical G$ are derived | Operations nav/route is capability-gated, but the submit control separately enforces `canQueueFunding`; deployer alone cannot submit. The queued result is typed `Funding` and has no commitment ID |
| Discretionary garden funding | `queueFunding(garden, amount)` by protocol steward or SettlementModule owner | Initial-scope seed/top-up outside any commitment only; never the normal protocol-pool reward path and never agent/keeper value authority |
| Canonical funding config | initializer-locked `protocolGarden` + canonical Celo G$ | No post-initialization setter; Celo router upgrade must preserve immutable G$ |
| Settlement trust-root configuration | both source and executor initialize paused; source dependency changes require pause and emit old/new; source unpause requires complete route, active protocol account, and fee floor; executor unpause requires source peer, caps, period policy, and reserve floor | Incomplete or unpaused configuration fails before authority or dispatch changes; indexed configuration shows the active dependency addresses |
| Assessment v3 placement | `assessmentV3` is one additive schema UID on the existing upgraded `AssessmentResolver` proxy | The proxy upgrade uses only `upgrade.ts assessment-resolver`; every tx-plan has an explicit sender verified against live `owner()`; registration computes the deterministic EAS UID and either registers an empty record or reconciles an exact existing record after partial persistence failure; read-before-set skips the exact UID and rejects a conflicting non-zero UID; v2 UID/address/owner/state stay preserved; no `AssessmentV3Resolver` contract or resolver artifact key; live `42161 schemaUID() == 0` is remediated from the verified v2 artifact before v3 activation; the `421614` rehearsal deploys/pins current v2 before upgrading |
| Community Testimony activation | preparation one-way pins the deterministic exact UID while module is zero; named `--finalize-community-testimony` reconciles the exact EAS record and sets the verified module last | no zero-UID wildcard; UID zero/conflict rejects and exact repeat is a no-op; module zero or module-before-UID rejects; permissionless pre-registration is accepted only when the record is already exact and remains inactive; deployment retries reuse only exact predicted implementation/proxy code, ERC-1967 implementation, owner/EAS/state and ordered recovery state; finalization accepts no address override, rejects module-before-record state, and no attestation succeeds until exact record proof is followed by module activation |
| Canonical G$ amount | queued `amount` is exact net recipient receipt; zero-fee and sender-pays are supported; non-zero receiver-pays fails closed | quote `getFees`; enforce absolute and bps fee limits plus gross Safe-debit caps; exact source/recipient balance deltas; forbid source-as-recipient/duplicates; no guessed gross-up |
| Celo member AA gate | production remains Kernel `0.3.1`, which Pimlico supports on Arbitrum One and Celo Mainnet but not Celo Sepolia; testnets use the supported Kernel `0.2.4` profile on both `421614` and `11142220` | the same-address Kernel `0.2.4` sponsored surrogate transfer proves testnet mechanics but never enables delivery; enablement requires exact Kernel `0.3.1` Arbitrum One/Celo Mainnet derivation, code/policy/passkey proof, and one separately authorized included sponsored Celo Mainnet first-use canonical-G$ transfer with receipts, EntryPoint event, deployed code, and exact balance deltas recorded without secrets |
| Safe/Zodiac topology | deterministic Safe v1.4.1 proxy + one Roles Modifier + native `WithinAllowance(allowanceKey)` | no separate Allowance Module; minimal ABI hand-declared locally; immutable permissions hash excludes mutable caps/allowance balances; persist factory/singleton/initializer/salt plus recovery and permission hashes; allowed/denied live probes |
| Delegated dispatch | exact optional `dispatcher` address | Dispatch/retry only; never queue, requeue, cancel, or configure |
| Fee reserve | Arbitrum command sends always spend the module reserve; Celo acknowledgment sends identify `reserveFunded`; every reserve-funded send and withdrawal leaves native balance `>= configured minimum` | Floor, live balance, low state, funding, source fee spend, Celo sponsored fee spend, and caller-funded Celo retry are distinguishable and observable |
| Batch safety | configured limit is 0–24; zero disables batch commands only | Both chains match before enable and can return to zero; unbatched commands require one recipient and remain governed by non-zero transfer/aggregate/period caps |
| Batch command shape | every member shares executor garden, source, token, kind, and funding route | Mixed funding/reward or mixed-route batch creation reverts; indexed batch preserves the homogeneous facts |
| Execution-key domain | `keccak256(abi.encode(sourceChainSelector, sourceSettlementModule, isBatch, settlementId, attempt))` | A disbursement and batch with the same numeric ID/attempt produce different keys; command tuple carries the same authenticated `isBatch` value |
| Source selector identity | Arbitrum implementation constructor immutably stores the official local CCIP selector; Celo recomputes from authenticated `message.sourceChainSelector` | Both sides derive the same key without substituting `block.chainid`; upgrade verifier rejects a source-selector change |
| Remote EVM chain identity | verified generated `SettlementConfiguration.remoteEvmChainId` is required for each exact supported source/executor lane independently of its CCIP selector and remains null for independent component rehearsals | Production source `42161` uses executor `42220` and production executor `42220` uses source `42161`; `421614` and `11142220` component rows never claim a peer pairing or route readiness without a freshly published exact lane/router; Celo route/execution/message relationships fail closed when the field is null and never translate selectors or use the local Celo chain as Garden identity |
| Command destination binding | initial dispatch snapshots destination selector/executor/gas/version/payload hash; retry and acknowledgment validation use that snapshot | Peer rotation cannot reroute the same key to a replacement executor, and a globally accepted previous peer cannot acknowledge a command that was sent to the new peer |
| Acknowledgment origin binding | `originatingCommandMessageId` maps to the same execution key through the initial/retry message registry | An out-of-order acknowledgment may name any known send for that key, but cannot import an unrelated or invented command ID |
| Batch cancellation | `Queued batch -> cancelBatch(batchId, reasonCID)` atomically cancels the immutable member set; `cancelDisbursement` rejects queued members with `batchId != 0` | UI exposes one reasoned whole-batch action; indexer replay can never show a partially cancelled Queued batch |
| DomainImpact requirement shape | positional `domains[]`, `requiredActionUIDs[]`, `requiredApprovedWorkCounts[]`; equal lengths, 1–4 entries, each required count non-zero | Admin creation, shared types, contract tests, and indexed read model preserve array positions |
| Work approval credit | `requirementIndex` selects exactly one requirement; validated Work domain/action must match that indexed pair | One approval increments exactly `approvedWorkCounts[requirementIndex]`; no scalar or aggregate-only shortcut |
| DomainImpact progress | `approvedUnits = floor(targetUnits * Σ_i min(approvedWorkCounts[i], requiredApprovedWorkCounts[i]) / Σ_i requiredApprovedWorkCounts[i])` | Client/admin/indexer show per-action counts and this per-commitment approved-unit value; DomainImpact creation rejects a zero denominator; pool/cycle totals never mix labels |
| Provider concurrency cap | non-empty/non-zero class creation plus a non-zero count cap and `Registered -> Committed -> Released\|Fulfilled`; commit/release/fulfill require the full non-zero quota/live balance; only their register events mutate indexed exposure; dispute preserves the slot | Module and register zero-cap paths use `OpenCommitmentCapRequired(poolId)` before event/storage mutation; unit events carry poolId/cycleId/exact unitLabel; `hours` × 100 and `meals` × 1 each consume one slot; partial, zero, repeat, wrong-account, and terminal-state calls revert before count mutation; `CommitmentAccepted` alone never increments the indexer; no transition, out-of-order event, or replay double-counts |
| Register authority audit | `ModuleUpdated(oldModule, newModule)` is global to the register, not a pool transition | One pool-less `CommitmentEvent` sets `configurationKey = null` and stores the normalized old/new module addresses in generic `previousValue`/`newValue`; pool/cycle/commitment relations stay null, no pool `0` sentinel is invented, no actor comes from `transaction.from`, and no accounting row changes |
| Exact-label unit summaries | ID uses chain + POOL/CYCLE scope + scope ID + `viem.keccak256(viem.stringToBytes(unitLabel))` over the exact stored UTF-8 string | Indexer declares direct `viem@2.55.0` dependency matching the repo pin; two `hours` commitments share a row; `Hours` is distinct; composed/decomposed Unicode remains byte-distinct; replay changes neither row |
| Cross-commitment rate | `promiseKeptRate = commitmentsFulfilled / commitmentsDue` | Sole aggregate percentage; active progress uses state counts and exact-label groups |

## 3. Public claim and copy matrix

| Claim | Allowed wording | Forbidden wording | Authority |
|---|---|---|---|
| Feature availability | Built / Planned / Evidence-gated | Planned behavior described as live | canonical [Commitment Pooling Google Doc](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit) |
| Settlement proof | Queued / dispatched / executed-ack-pending / confirmed / failed / delayed | Dispatched or executed-ack-pending = arrived | `settlement-spec.md` §3.3 |
| Confirmation actor | Authenticated `CeloSettlementExecutor` acknowledgment through CCIP | Human verification, operator report, timeout as payment failure | `settlement-spec.md` |
| Chain placement | Proof/control on Arbitrum; canonical G$ on Celo | Bridged G$, Arbitrum G$ custody | `settlement-spec.md` |
| CCIP availability | CCIP is the frozen command/ack interface; the official directory currently publishes Arbitrum One↔Celo Mainnet in both directions at v1.5.0, while the exact Arbitrum Sepolia↔Celo Sepolia pair is not listed and Celo's current support page lists CCIP only for mainnet | “Exact Arbitrum Sepolia↔Celo Sepolia lifecycle proven”; “Celo Sepolia CCIP is live”; “dispatch means support arrived” | current Chainlink CCIP directory + Celo cross-chain docs + `settlement-spec.md` §8; fresh mainnet directory/code-hash/fee/ping-ack proof before value authority; ephemeral Arbitrum Sepolia↔Ethereum Sepolia endpoint proof is explicitly non-exact |
| Arbitrum Sepolia protocol dependencies | Safe v1.4.1 and official EAS/SchemaRegistry cover `421614`; Hats does not currently publish a `421614` deployment | “EAS must be test-deployed on 421614”; “Hats is officially deployed on 421614”; reuse of Ethereum Sepolia addresses without chain-local proof | official EAS repository + Hats supported chains + Safe deployments + `contract-spec.md` §7.3; verify EAS/SchemaRegistry bytecode and deploy only version-pinned test Hats |
| Fourth garden | “a fourth slot for a mature MRV-adoption anchor — open; candidates under consideration, none selected” | Any named fourth garden in any artifact, or any claim that a fourth garden is selected or participating | `plan.todo.md` Decision Log #29 (supersedes Decision Log #25 and Decision Log #27) |
| Community comparison | Alphabetical/neutral aggregates with small-community suppression | Rankings, leaderboards, credit scores | `uiux-spec.md` §7.2 |
| Funding | Supports the garden; not per-Need escrow or steering | Funding buys priority/control | Community spec |
| Credit/vouchers | Design-only/evidence-gated follow-on | August capability or dispatchable work | `../../backlog/commitment-credit-follow-on/spec.md`, PRD-651/697 |
| Pilot outcome | Observed change, mixed result, or strengthened settlement capacity only at the approved claim class | Settlement/transaction volume, feature use, or fulfillment alone described as causal livelihood/community impact | `pilot-evidence-spec.md` |

## 4. Final role / route / state proof

| Surface | Role | Required journey | Proof owner | GREEN evidence |
|---|---|---|---|---|
| Client `/home/:garden/pool` | member/provider/recipient | create, claim, evidence/work, Ready-submit, confirm/dispute, offline retry | `ui_client` | targeted tests + authenticated Brave + real device |
| Admin `/garden/pool` | operator/evaluator | readiness, cycles, seeding, claims, assessment, override/dispute | `ui_admin` | targeted tests + authenticated Brave |
| Admin `/community/pools` | protocol steward | Protocol pool plus current-garden pool only; no other-garden rows | `ui_admin` | targeted tests + authenticated Brave |
| Admin Operations | deployer | alphabetical cross-garden oversight, batch/CCIP command-ack controls, native fee reserves, peer/Safe/cap status | `ui_admin` | targeted tests + authenticated Brave |
| WalletDrawer | member | delivery-disabled and enabled Celo send | `ui_client` + `settlement` | AA evidence + authenticated real device |
| Public Garden / impact | funder/collaborator | planned/live/reporting labels, privacy thresholds, no ranking | `editorial` | component tests + rendered public proof |
| Indexer replay | operator | full composite Garden-ID replay, cutover, rollback rehearsal | `indexer` + `release_ops` | dry run, snapshot, replay, shared-query check, rollback record |
| Release | protocol release owner | authorized broadcasts, post-checks, peer/fee/Safe health, message-only ping/ack, one capped real exit proof | `release_ops` | signed checklist in `handoffs/human-release-ops.md` |

## 5. Runtime, post-QA documentation, and September gates

Runtime UI GREEN aggregates `ui_client`, `ui_admin`, and `editorial` before QA Pass 1.
Post-QA `docs` polish follows QA Pass 1 and must complete before QA Pass 2. Final
`walkthrough_videos` follow QA Pass 2 and do not block release certification. The September
`community` PWA records its own GREEN later and is not a dependency of these gates. Membership
persistence is conditional within Community and remains excluded until RESR-64; it does not block
the non-membership Community core.

## 6. Pilot operational measurement definitions

These targets measure product and operating reliability. They do not by themselves establish that
pooling strengthened settlement capacity. `pilot-evidence-spec.md` owns the required cohort,
baseline, claim hierarchy, safeguard/repair review, circulation-integrity rules, privacy tiers, and
stop conditions for that outcome claim.

| Target by 2026-09-30 | Canonical calculation |
|---|---|
| At least 90% passkey onboarding completion | Gardeners who complete passkey setup divided by gardeners who start their first authenticated action. |
| At least 99% eligible offline-job sync success | Eligible queued jobs that reach confirmed submission divided by eligible jobs that begin a normal send attempt. Exclude user-cancelled jobs and all time spent in `waiting_for_hat`; a retry-recovery cut uses only jobs that entered retry as both numerator population and denominator. |
| At least 95% steward validation without data repair | Eligible triage, seeding, and confirmation tasks completed without a corrective edit divided by all eligible observed tasks. |
| Median field submission at or below two minutes | Median time from first input to saved or submitted state, compared with a separately measured pre-pilot baseline; no baseline value is assumed. |

Every report includes numerator, denominator, sample size, observation window, excluded states, and qualitative context. Public reporting excludes wallet addresses, join-request records, and participant identifiers. Unavailable, suppressed, mixed, and zero results remain distinct.
