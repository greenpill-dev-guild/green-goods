# Commitment Pooling: G$ Split-State Settlement Spec (August)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (the pooling module + register this attaches to — **zero changes to those contracts here**), `diagrams.md` D18–D23 (fund-flow topology, settlement sequence, disbursement state machine), `uiux-spec.md` (surface grammar), `reports/corrections-log.md`.
**Decision basis**: Architecture 2 (split-state) remains locked from the Linear doc "G$ in Green Goods: Bridged vs. Split-State Settlement" (`657f7233-9ba8-4c38-a0f9-e3a4fdc48739`) and the Architecture 3 re-score (`8243d7ef-f880-418e-86a6-f7da75067aa9`); their comparative reasoning is preserved in §10. The settlement transport was re-frozen on 2026-07-23 after Chainlink Functions retirement: Green Goods now uses **message-only Chainlink CCIP command + acknowledgment**, reusing the repository's existing CCIP sender/receiver pattern. The Arbitrum `SettlementModule` sends an authenticated settlement command; a bounded Celo `CeloSettlementExecutor` executes through Zodiac Roles; the executor sends an authenticated acknowledgment to Arbitrum. Canonical G$ never bridges. This decision replaces every normative Functions/CRE receipt-verification path and removes manual transaction reporting from the settlement lifecycle.

**What stays true from the locked register**: no bridged G$, ever. CCIP transports data only and receives no token amounts. Sarafu integration and transferable settlement vouchers stay deferred. One Celo Safe exists per garden (1:1 mapping, deployed on demand); the Green Goods protocol Safe is the direct House of Alignment receiving account; the only modeled Green Goods funding route is protocol → garden. The Celo executor is a narrowly scoped Zodiac Roles member, never a Safe owner and never an arbitrary-call bridge. Gardeners never initiate a cross-chain command in the field. If the Celo AA/paymaster spike fails, protocol → garden funding may continue while automated gardener consideration delivery and gardener sends remain blocked. No broadcast is authorized by this spec, a milestone date, or a passing implementation test.

> **Amendment 2026-07-31 (approved vocabulary alignment; net-new surface, no
> compatibility aliases)**: the acting persona noun is **gardener** and a
> disbursement row inside an immutable batch is a **batch entry**. Renamed
> identifiers, applied throughout this spec, the gallery, and the indexer
> config references: `memberDeliveryEnabled` → `gardenerDeliveryEnabled`,
> `setMemberDeliveryEnabled` → `setGardenerDeliveryEnabled`,
> `MemberDeliveryStatusChanged` → `GardenerDeliveryStatusChanged`,
> `MemberDeliveryDisabled` → `GardenerDeliveryDisabled`,
> `DuplicateBatchMember` → `DuplicateBatchEntry`, `BatchMemberMismatch` →
> `BatchEntryMismatch`; §5 is now "Gardener receipt + multi-chain app" and the
> app query key is `queryKeys.settlement.gardenerBalance`. "Member" survives
> only in the Zodiac Roles sense (the executor as a Roles member), Hats
> membership, and quoted external (GoodDAO) language.

> **Amendment 2026-07-28 (approved group settlement contract; supersedes singular
> commitment-beneficiary wording below where it conflicts. Its payer identity is itself
> superseded by the 2026-08-08 register #90 correction — the payer garden Safe pays, so
> "provider" in this banner reads "payer" wherever the two differ)**: a fulfilled CeloSettlement
> commitment creates one garden-managed `CommitmentPayoutPlan`. The payer garden Safe is the
> payer (register #90; the provider garden pays only when it is also the payer). Creation asks CommitmentPooling to recompute one complete recognition vector and hash
> from the frozen on-chain facts; a payer-garden steward may atomically edit the complete amount
> vector before finalization, while payment weights remain
> derived. The canonical full-consideration base-unit allocation is rounding-equivalent to recognition;
> any noncanonical amount or retention divergence requires a reason. The plan declares
> `gardenRetainedAmount`, and `consideration.amount == gardenRetainedAmount + Σ contributorPayout.amount`.
> Retention creates no self-transfer. Every non-zero payout becomes one ordinary bounded
> disbursement with a derived contributor Celo account. Explicit finalization freezes the plan
> before any child dispatch; an all-retained zero-child plan completes at that point without CCIP.
> Pending/Partial/Complete/Failed display state is derived from finalization and child
> disbursements and is never a separate CCIP subject. `ProtocolToGarden` remains an independent
> funding/top-up route. Raw G$ transfers remain outside Envio.
>
> **Amendment 2026-07-30 (approved PRD-759 architecture lock)**: protocol-pool commitments use
> that same provider-garden payout-plan lifecycle. Fulfillment unlocks the existing
> create/edit/finalize/prepare app actions from canonical indexed state; it does not create a
> sixth offline `settlement` job, a per-device retry record, or a permissionless
> `queueDisbursement(commitmentId)` call. `queueFunding(garden, amount)` remains the separate
> discretionary garden seed/top-up action. The Operations route is visible to deployer, funding,
> or settlement capability, but the funding form itself requires protocol-steward or
> SettlementModule-owner authority and creates only a typed Funding/ProtocolToGarden Queued row
> with no commitment ID.
>
> **Amendment 2026-08-01 (approved credit-wave seam lock; pooling plan register #73)**: the
> borrow-and-repay `CreditRegister` chain is unblocked into this August wave
> (`../commitment-credit-follow-on/spec.md`, promoted backlog → active), and its
> loan-principal down-leg locks seam **(a)**: `DisbursementKind` gains a third member,
> `LoanPrincipal`, reserved until the credit lane dispatches. The kind names loan authority
> explicitly so the existing per-kind gates stay intact — `ContributorConsideration` remains bound to a
> Fulfilled commitment's payout plan, `Funding` remains the garden-level ProtocolToGarden hop,
> and no `commitmentId == 0` relaxation of the member-disbursement gate is introduced. A
> `LoanPrincipal` disbursement is queueable only against an Approved `CreditRegistry` loan (that
> module's own steward/executor gates), carries `fundingRoute = None`, and ties back through
> `Loan.disbursementId`. G$ **repayment** stays record-only on Arbitrum with no upward
> disbursement primitive and no bridge, exactly as the §9 follow-on touchpoint states. Until the
> credit lane dispatches, no code path queues this kind; the enum member exists so the ABI ships
> once.

**Current transport-availability fact (externally verified 2026-07-24; recheck at every
dry-run)**: Chainlink's official mainnet directory publishes the direct route in both
directions: Arbitrum One lists Celo and Celo lists Arbitrum One as outbound lanes, both at
CCIP v1.5.0. The official Arbitrum Sepolia directory does not list Celo Sepolia, so the exact
testnet pair is not currently available. Celo Sepolia is an active EVM testnet, but Celo's
official cross-chain-messaging page currently lists CCIP support only for Celo Mainnet; a
current official Celo Sepolia lane/router support statement was not found. Therefore the CCIP
command/ack ABI and security boundary are implementable and the production route is supported,
but Release still requires fresh directory/code-hash/fee verification, a paused message-only
ping/ack, audit, Safe/Zodiac/AA proof, and human authorization. A two-hop Ethereum test relay is
not approved by this spec and would require a new threat model, state machine, contracts, and
human architecture decision. Arbitrum Sepolia endpoint messages, Celo Sepolia executor/Safe
rehearsal, and local two-router lifecycle tests are useful evidence, but none may be reported as
an exact Arbitrum Sepolia↔Celo Sepolia lifecycle. A live Celo Sepolia CCIP endpoint rehearsal is
conditional on fresh official directory/API support for an exact lane.

---

## 1. The model in one paragraph

All commitment truth stays on Arbitrum. A NET-NEW **`SettlementModule`** explicitly finalizes a
payer-garden-managed payout plan, derives immutable contributor children or one garden-beneficiary
child from its frozen shape,
pays the native CCIP fee, and dispatches versioned message-only commands to Celo. A NET-NEW
**`CeloSettlementExecutor`** authenticates the Arbitrum selector and sender, derives the registered
Safe and canonical G$ configuration, executes only the bounded transfer path granted through
Zodiac Roles, records each outcome idempotently, and sends a versioned acknowledgment back to
Arbitrum. A child disbursement becomes `Confirmed` only when `SettlementModule` authenticates a
success acknowledgment for its current execution key and attempt. The parent payout-plan status is
derived from those children. Canonical G$ (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`, Celo)
never leaves Celo.

## 2. Fund-flow topology (diagrams.md D18)

```text
Good Labs Foundation-funded House of Alignment pilot ($800/month paid in G$, July–September 2026; $2,400 total)
  → Green Goods protocol Safe (Celo, designated receiving account)   ← settlement account of the PROTOCOL pool (root garden)
    → Garden Celo Safes (NET-NEW, ONE per garden, 1:1)       ← settlement accounts of garden pools, deployed on demand
      → Commitment contributors (same-address smart accounts on Celo)
```

- Each hop below the protocol Safe is a Celo G$ transfer executed by the bounded `CeloSettlementExecutor` as a scoped Zodiac Roles member. The Foundation pilot's three $800 monthly allocations are an upstream funding fact, not a Green Goods queued action; the $2,400 agreement must remain distinct from transaction-level G$ token counts and from onward settlement evidence. The module models exactly one downstream route—protocol → garden—with derived garden, recipients, amounts, and canonical G$ token. Every queued hop becomes complete only after the authenticated Celo executor sends a success acknowledgment for the current execution key and attempt through CCIP.
- Commitment considerations are paid by the fulfilled commitment's **payer** garden Safe — the side
  that made the ask, not the side that delivered (register #90). For an ordinary garden-pool
  commitment the asker and the doer are the same garden, so this is that garden's Safe exactly as
  before. The protocol pool is where they separate, and both directions matter:
  - A **protocol-pool Request** — Green Goods asking gardens to run an event or complete a survey —
    is paid by the **protocol Safe** to the claiming garden Safe for an institutional claim or to
    contributors for an individual claim. The protocol asked, so the protocol pays; the delivering
    garden never funds work it was asked to do.
  - A **protocol-pool Offer** — Green Goods providing a support session, onboarding, or technical
    help — is paid by the **claiming garden's Safe** to the protocol team's contributors. This is
    the leg that lets a garden spend G$ it earned on Green Goods services, closing the circulation
    loop that the topology above previously left open.
  Requests come in two flavours, and who receives follows who claimed: a garden-scoped Request
  (event, garden survey) is claimed by the garden and paid to **that garden's Celo Safe**, while an
  individual Request is claimed by a gardener and paid to **their own Celo account**. That is how a
  garden accumulates the G$ it later spends on Offers. Contributor recipients are same-address
  smart accounts on Celo; an institutional claimant instead uses the frozen
  `GardenBeneficiary` Safe path. `ProtocolToGarden`
  remains available as a discretionary treasury top-up, but it is no longer how the protocol pays
  for work it commissioned — that is now commitment-bound and therefore evidenceable.
- Top-ups flow down the chain (GG → garden) as **funding transfers** (not commitment-bound); they are recorded as funding events in the module so downstream exposure reporting stays honest. Protocol-Safe *inflow* (the HoA stream) is a Celo balance read + external treasury reporting, never a fabricated module event.

## 3. Arbitrum `SettlementModule`

### 3.0 Target implementation boundary frozen on 2026-07-23

This document is the implementation plan, not a description of contracts already present in
the repository. The complete target is the Commitment Pooling disbursement/account layer and
the message-only CCIP command/acknowledgment state machine defined below. There is no
intermediate owner-supplied settlement-facts API: queue functions derive eligibility, garden,
kind, recipients, and amounts from frozen CommitmentPoolingModule state, derive accounts from
the settlement registry, and derive canonical G$ only from SettlementModule's write-once
`gDollarToken`.

**App orchestration boundary.** The offline queue contains exactly the six Commitment Pooling
field-write kinds (`commitmentSeries`, `commitment`, `claim`, `evidence`, `workLink`,
`confirmation`). `transfer` remains an online-only wallet action and never enters this queue. A fulfilled protocol-pool
commitment follows the same indexed payout-plan UI and authority checks as a fulfilled garden-pool
commitment: a provider-garden steward creates and, when needed, edits the Draft, explicitly
finalizes it, then idempotently prepares each frozen non-zero contributor row. Fulfillment is the
economic approval; none of those actions add a second consideration-approval state. Discretionary
ProtocolToGarden funding is entered in the capability-gated Operations form and remains a
deliberate treasury write rather than a background agent or keeper action.

The source state is `None → Queued → Dispatched → Confirmed | Failed`, where `Failed` arrives by
the authenticated failure acknowledgment or — for a Dispatched subject whose snapshotted executor
peer was retired past its grace window — by the owner-only `failStrandedSubject` disposition
(`FailureCode.SourceStranded`, Decision Log #60; never from delay, never producing Confirmed),
with `Cancelled` available for an unbatched Queued item, an atomically cancelled whole Queued
batch, or a Failed batch entry. Delivery delay is an operational/indexed view over `Dispatched`,
not an authenticated payment failure and never a cancellation gate. A new logical attempt is
allowed only after an authenticated failure acknowledgment. Each deployed implementation accepts exactly
one immutable CCIP router through `CCIPReceiver`. Peer replacement may retain one explicitly
bounded previous peer so in-flight messages can finish. Router replacement is never a storage
setter: dispatch pauses, every old-router command and acknowledgment reaches a terminal or
explicitly abandoned release disposition, a new implementation with the new immutable router
is verified and upgraded, and only then does dispatch resume.

Implementation conventions: `UUPSUpgradeable` + `OwnableUpgradeable` +
`ReentrancyGuardUpgradeable`, implementation-constructor `_disableInitializers()`, generated
storage-layout proof, and canonical fact derivation with no caller-selected token, Safe,
target, selector, or calldata.

### 3.1 Commitment Pooling integration target

### 3.1.1 Target storage

| # | Entry | Type |
|---|---|---|
| 1 | `hatsModule` | `IHatsModule` |
| 2 | `commitmentPoolingModule` | `ICommitmentPoolingModule` (reads commitment/pool state) |
| 3 | `protocolGarden` | `address` (write-once initializer value; root/protocol garden whose settlement account is the GG protocol Safe) |
| 4 | `gDollarToken` | `address` (write-once initializer value; canonical Celo G$, never caller supplied) |
| 5 | `nextDisbursementId` | `uint256` (starts at 1) |
| 6 | `nextBatchId` | `uint256` |
| 7 | `nextPayoutPlanId` | `uint256` (starts at 1) |
| 8 | `settlementAccounts` | `mapping(address garden => SettlementAccount)` |
| 9 | `disbursements` | `mapping(uint256 => Disbursement)` |
| 10 | `batches` | `mapping(uint256 => Batch)` |
| 11 | `payoutPlanOfCommitment` | `mapping(uint256 commitmentId => uint256 payoutPlanId)` (0 = none) |
| 12 | `commands` | `mapping(bytes32 executionKey => CommandRecord)` |
| 13 | `commandMessageToKey` | `mapping(bytes32 messageId => bytes32 executionKey)` |
| 14 | `payoutPlans` | `mapping(uint256 payoutPlanId => CommitmentPayoutPlan)` |
| 15 | `contributorPayouts` | `mapping(uint256 payoutPlanId => mapping(address contributor => ContributorPayout))` |
| 16 | `ccipRoute` | `CcipRoute` (Celo selector, executor peer, destination gas limit, protocol version) |
| 17 | `gardenerDeliveryEnabled` | `bool` (false until the Celo AA/paymaster exit gate passes) |
| 18 | `batchSizeLimit` | `uint16` (0 disables batching; production value is measured and cannot exceed 24) |
| 19 | `dispatcher` | `address` (zero disables delegated dispatch; no queue, recovery, cancellation, or configuration authority) |
| 20 | `feeReserveMinimum` | `uint256` (native ETH floor preserved by dispatch, retry, and owner withdrawal) |
| 21 | `paused` | `bool` |
| 22 | `__gap` | expected `uint256[29]`; the compiler-generated baseline confirms the final length before interface/storage freeze |

The table is canonical declaration order. Its 21 feature slots include the three slots occupied
by `CcipRoute` and the packed `gardenerDeliveryEnabled` / `batchSizeLimit` / `dispatcher` slot.
The generated compiler baseline and concrete slot/offset assertions are final if prose arithmetic
or a future compiler layout differs.

`CommitmentPayoutPlan.contributorOrder` is a dynamic array nested in the value stored at
`payoutPlans[payoutPlanId]`; it does not add a top-level module storage entry. Creation persists
the complete ascending recognition order once, edits must match it exactly, and finalization plus
`payoutContributors` enumerate it rather than attempting to enumerate `contributorPayouts`.

The implementation constructor takes exactly
`(address ccipRouter_, uint64 sourceChainSelector_, uint64 destinationEvmChainId_)`.
All three are non-zero immutable arguments exposed as `CCIP_ROUTER()`,
`SOURCE_CHAIN_SELECTOR()`, and `DESTINATION_EVM_CHAIN_ID()`. The proxy initializer accepts
none. The source selector is the Chainlink CCIP selector—not `block.chainid`—and is the exact
value Celo receives as `message.sourceChainSelector` when recomputing `executionKey`.
`DESTINATION_EVM_CHAIN_ID` is `42220` for the production Arbitrum One deployment.
An isolated local/mock or paused Arbitrum Sepolia component rehearsal may use `11142220` only to
prove settlement-account and Safe identity checks; that value is not CCIP route evidence and the
component may not unpause or seed a canonical peer pair. Because CCIP does not currently publish
an Arbitrum Sepolia↔Celo Sepolia lane, endpoint proof uses a separate ephemeral Arbitrum
Sepolia↔Ethereum Sepolia implementation whose destination EVM chain ID is `11155111`. Its
addresses and artifacts live only under `.generated/runtime` and must never merge into canonical
`421614-latest.json`. Router upgrades
must preserve both immutable chain identities for that proxy. `SettlementModule` pays fees in native ETH only.
It never sends CCIP token amounts and never grants token approval to the router. The module
exposes native-fee balance/quote views and owner-only excess withdrawal after reserved-fee
checks. Dispatch and command retry spend the sponsored reserve rather than accepting caller
overpayment. On Celo, a caller-funded acknowledgment retry requires the exact current quote and
reverts atomically if the quote/send cannot be honored, returning the caller's CELO. This
removes a push-refund or trapped-overpayment path while preserving the safe
pull/guarded-excess principle used by the existing ENS CCIP integration. The generated
storage-layout baseline—not a prose slot estimate—sets the final storage gap.

**Member-funding namespace (register #103).** The ABI increment does not consume or reorder the
legacy layout above. It adds one ERC-7201 namespace,
`green.goods.settlement.commitment-funding`, with this declaration order:

| # | Entry | Type |
|---|---|---|
| 1 | `nextFundingId` | `uint256` (starts at 1) |
| 2 | `fundings` | `mapping(uint256 fundingId => CommitmentFunding)` |
| 3 | `fundingOfCommitmentFunder` | `mapping(uint256 commitmentId => mapping(address funder => uint256 fundingId))` |
| 4 | `fundingByDepositReference` | `mapping(bytes32 depositReference => uint256 fundingId)` |
| 5 | `fundingOfRefundDisbursement` | `mapping(uint256 disbursementId => uint256 fundingId)` |
| 6 | `consumedFundingOfCommitment` | `mapping(uint256 commitmentId => uint256 fundingId)` |

The namespace slot is the ERC-7201 derivation of that exact string. The implementation and
storage-layout tests freeze the computed slot before any upgrade. One funding record exists per
`(commitmentId, funder)`; the forward `refundDisbursementId` inside the record and the reverse
mapping above are both persistent and must agree. They are never cleared by failure, requeue, or
cancellation. `consumedFundingOfCommitment` is write-once when the accepted funder's deposit is
consumed, remains set through Closed or RefundQueued/Refunded, and lets payout completion close
funding locally without an external pooling read on the authenticated acknowledgment path. An
existing different funding ID is a `FundingRecordConflict`; no lifecycle clears or replaces it.

### 3.1.2 Target types

```solidity
enum DisbursementState { None, Queued, Dispatched, Confirmed, Failed, Cancelled }
enum DisbursementKind { ContributorConsideration, Funding, LoanPrincipal, GardenBeneficiary, Refund }  // Refund is appended last so ordinals 0-3 remain stable
enum FundingRoute { None, ProtocolToGarden }
enum FundingState { None, Pledged, DepositRecorded, Consumed, Closed, RefundQueued, Refunded, Withdrawn }
enum CommitmentSettlementFlow { Internal, ProtocolToGarden, GardenToProtocol, GardenToGarden } // derived read-model fact; never caller-authored
enum PayoutPlanStatus { Draft, Pending, Partial, Complete, Failed } // derived from plan + child states
enum FailureCode {
    None,
    GardenRouteUnavailable,
    InvalidRecipient,
    BatchSizeExceeded,
    TransferAmountExceeded,
    BatchAmountExceeded,
    PeriodCapExceeded,
    RouteRejected,
    RouteReverted,
    UnsupportedReceiverPaysFee,
    FeeQuoteExceeded,
    BalanceDeltaMismatch,
    // Source-side disposition, never sent by an executor. Appended last so ordinals 0-11 stay
    // identical to ICeloSettlementExecutor.FailureCode, and the acknowledgment bound still
    // rejects anything above BalanceDeltaMismatch arriving over CCIP. Written only by
    // failStrandedSubject (Decision Log #60).
    SourceStranded
}

struct SettlementAccount {
    uint64 chainId;        // exact destination EVM chain ID: 42220 production; 11142220 only for isolated, paused component proof
    address account;       // the garden's Celo Safe
    bool active;
    address[3] recoveryOwners; // sorted ascending; exact pilot owner set
    address rolesModifier;
    bytes32 roleKey;           // exact Zodiac Roles v2 key used by the Celo executor
    bytes32 allowanceKey;      // native Roles WithinAllowance key; there is no separate AllowanceModule
    bytes32 permissionsConfigHash; // immutable Safe/Roles/token/selector/condition-tree commitment; excludes mutable caps and live allowance balances
    bytes32 recoveryConfigHash; // hash(chainId, Safe, sorted owners, threshold)
    uint8 recoveryThreshold;    // exactly 2 for the pilot 2-of-3 set
}

struct CcipRoute {
    uint64 destinationChainSelector;
    address destinationExecutor;
    address previousDestinationExecutor;
    uint64 previousPeerExpiresAt;
    uint32 destinationGasLimit;
    uint8 protocolVersion;
}

struct Disbursement {
    uint256 commitmentId;  // consideration commitment; 0 for Funding and reserved LoanPrincipal
    uint256 payoutPlanId;  // consideration parent; 0 for Funding and reserved LoanPrincipal
    address contributor;   // consideration recipient identity; zero for Funding and reserved LoanPrincipal
    address garden;        // consideration/loan pool garden; target garden for Funding
    address executorGarden;// immutable payer: payerGarden for considerations, protocolGarden for Funding, loan pool garden for LoanPrincipal
    DisbursementKind kind;
    FundingRoute fundingRoute; // ProtocolToGarden only for Funding; None for both commitment kinds and LoanPrincipal
    address source;        // exact Celo sender Safe; always derived at queue time
    address recipient;     // Celo address (gardener smart account, garden Safe, or GG Safe)
    address token;         // G$ on Celo for August
    uint256 amount;
    DisbursementState state; // Celo execution/ack-pending is derived from executor events
    uint256 batchId;       // 0 = unbatched
    string reasonCID;      // failure/cancel reason (IPFS), empty otherwise
    uint32 attempt;
    bytes32 executionKey;
    bytes32 commandMessageId;
    uint64 dispatchedAt;
    uint64 confirmedAt;
    bytes32 acknowledgmentMessageId;
    uint8 failureCode;
    DisbursementState cancelledFromState; // None unless terminal state is Cancelled
}

struct CommitmentFunding {
    uint256 commitmentId;
    address funder;              // canonical claimant whose pending request was pledged
    address garden;              // immutable pool garden whose registered Celo Safe holds the deposit
    address refundAccount;       // immutable recorded Celo recipient; never replaced at queue time
    uint256 expectedAmount;      // frozen priced-Offer consideration
    uint256 depositedAmount;     // full steward-confirmed amount; may exceed expectedAmount
    bytes32 depositReference;    // unique non-zero Celo transaction reference
    FundingState state;
    uint256 refundDisbursementId;// one child ever; zero before a refund is queued
    uint64 pledgedAt;
    uint64 depositRecordedAt;
    uint64 consumedAt;
    uint64 closedAt;
}

struct CommitmentPayoutPlan {
    uint256 commitmentId;
    address providerGarden; // Arbitrum garden account that delivered; attribution only
    address payerGarden;    // Arbitrum garden account that owes the consideration (register #90)
    address source;         // payer garden Celo Safe
    address token;          // canonical G$
    DisbursementKind payoutKind; // immutable: ContributorConsideration or GardenBeneficiary
    uint256 declaredAmount;
    uint256 gardenRetainedAmount;
    uint256 contributorPayoutTotal;
    address beneficiaryGarden;    // Arbitrum garden identity; non-zero only for GardenBeneficiary
    address beneficiaryRecipient; // frozen registered Celo Safe; non-zero only for GardenBeneficiary
    uint256 beneficiaryAmount;    // equals declaredAmount for GardenBeneficiary; zero otherwise
    uint256 beneficiaryDisbursementId; // zero until first beneficiary preparation
    uint32 recognitionContributorCount;
    uint32 payablePayoutCount; // contributor non-zero rows or the one beneficiary row
    uint32 preparedPayoutCount;
    uint32 confirmedPayoutCount;
    uint32 failedPayoutCount;
    uint32 cancelledPayoutCount;
    uint32 paymentSnapshotVersion; // 1 at creation; increments once per full-vector edit
    bytes32 recognitionSnapshotHash;
    bytes32 paymentSnapshotHash;
    address[] contributorOrder; // immutable ascending recognition order used by edit/finalize/views
    string latestEditReasonCID;
    bool finalized;        // explicit finalization freezes every entry before dispatch
    uint64 createdAt;
    uint64 finalizedAt;
}

struct RecognitionEntry {
    address contributor;
    uint16 recognitionWeightBps;
}

struct ContributorPayoutInput {
    address contributor;
    uint256 amount;
}

/// @notice Immutable ordered hash preimage row. This is never stored as the
///         mutable ContributorPayout struct and excludes child lifecycle fields.
struct PaymentSnapshotEntry {
    address contributor;
    address recipient;
    uint16 recognitionWeightBps;
    uint16 paymentWeightBps;
    uint256 amount;
}

/// @notice Mutable stored row. Every edit supplies one unique row per recognition entry,
///         so every recognition contributor always has exactly one row and payability is
///         exactly `amount > 0`. There is no separate inclusion flag to drift from `amount`.
struct ContributorPayout {
    address contributor;
    uint16 recognitionWeightBps;
    uint16 paymentWeightBps;
    uint256 amount;
    address recipient;      // derived same-address Celo account
    uint256 disbursementId; // zero while Draft/unprepared and for zero-amount rows
}

struct Batch {
    address executorGarden;// every batch entry shares the same executor scope
    address source;        // every batch entry shares source + token
    address token;
    DisbursementKind kind;
    FundingRoute fundingRoute;
    uint256[] disbursementIds; // immutable after BatchCreated; length 1..batchSizeLimit
    DisbursementState state;
    uint32 attempt;
    bytes32 executionKey;
    bytes32 commandMessageId;
    uint64 dispatchedAt;
    uint64 confirmedAt;
    bytes32 acknowledgmentMessageId;
    uint8 failureCode;
}

struct CommandRecord {
    bool isBatch;
    uint256 subjectId;
    uint32 attempt;
    uint64 destinationChainSelector;
    address destinationExecutor;
    uint32 destinationGasLimit;
    uint8 protocolVersion;
    bytes32 commandPayloadHash;
    bytes32 latestCommandMessageId;
    bool acknowledged;
}

struct SettlementCommandV1 {
    uint8 version;
    uint256 settlementId;
    bool isBatch;
    uint32 attempt;
    address executorGarden;
    uint8 disbursementKind;
    address[] recipients;
    uint256[] amounts;
}

struct SettlementAcknowledgmentV1 {
    uint8 version;
    bytes32 executionKey;
    bytes32 originatingCommandMessageId;
    bool success;
    uint8 failureCode;
}
```

**Commitment-funding state machine (register #103).** A funding ID is immutable and never reused.
The stored transitions are:

```text
Pledged -> DepositRecorded -> Consumed -> Closed
                         \-> RefundQueued -> Refunded
Pledged -> Withdrawn
DepositRecorded -> RefundQueued
Consumed -> RefundQueued
```

- `recordFunding` freezes the priced Offer's expected amount, the claimant/funder, the pool garden,
  and the funder's chosen refund account. Exact replay is read-through success; conflicting reuse
  of the same `(commitmentId, funder)` is a hard error.
- `recordFundingDeposit` is the only `Pledged -> DepositRecorded` transition. The steward records a
  unique non-zero Celo transaction reference and the full deposit. The amount must be at least the
  frozen price. On fulfillment, only the price funds provider consideration and any excess stays
  with the garden as a top-up; on refund, the complete recorded deposit is returned.
- `consumeFunding` is the only `DepositRecorded -> Consumed` transition and re-reads the accepted
  commitment to prove the funder is its counterparty. It records the deposit as backing for that
  accepted promise and stores the write-once `consumedFundingOfCommitment` pointer; it never
  transfers G$.
- `Consumed -> Closed` occurs only when the existing payout plan for the same commitment derives
  `Complete`. The acknowledgment path resolves the funding ID only through the local
  `consumedFundingOfCommitment` pointer and performs no pooling call. It creates no payment and no
  new event; the read model derives closure from the payout-plan events. A fulfilled commitment
  whose payout has not completed remains `Consumed`.
- `queueFundingRefund` is the only refund-authority write. A still-pledged withdrawal becomes
  `Withdrawn` with nothing owed and emits `FundingWithdrawn`; exact event replay lets the later
  indexer derive this terminal state even when delivery precedes `FundingPledged` in its replay.
  `DepositRecorded` becomes refundable after decline, supersession, or an explicit
  steward-triggered funding withdrawal. `Consumed` becomes refundable only after the pooling
  module reports `Cancelled` or `Expired`; those states include the corresponding dispute
  outcomes. Delay, `Disputed`, `ReadyForConfirmation`, and `Fulfilled` are not eligible.
- The first eligible funded refund allocates one ordinary Queued disbursement with
  `kind = Refund`, `fundingRoute = None`, `commitmentId` and `contributor = funder`, source set to
  the immutable garden Safe, recipient set to `refundAccount`, canonical G$, and amount set to the
  full `depositedAmount`. Both funding-to-child and child-to-funding pointers are stored before
  `DisbursementQueued` is emitted. Every later call returns that same child; no state, failure,
  cancellation, retry, or replay can allocate a second refund.
- An authenticated success acknowledgment of that child moves `RefundQueued -> Refunded`. An
  authenticated failure leaves the funding in `RefundQueued`; ordinary `requeue` creates the next
  attempt on the same child. Cancelling the ordinary child never clears the refund obligation or
  relationship and never permits a replacement child.

Garden-Safe earmarks are accounting, not token locks. The spendable view is
`Safe balance - all open DepositRecorded/Consumed/RefundQueued obligations`; it is a warning and
authorization aid, not a custody guarantee. If the Safe is below its obligations, refund dispatch
fails through the existing bounded execution/acknowledgment path, stays owed, and the same child is
requeued only after the Safe is replenished. No log-only or timeout-only path marks it refunded.

`HARD_MAX_BATCH_SIZE = 24` is only the compile-time safety ceiling. `batchSizeLimit` starts at
zero and keeps batching disabled until worst-case destination gas, atomic Safe execution, and
acknowledgment overhead are measured. The Celo executor's source-acknowledgment gas limit is
300,000. A successful batch acknowledgment must close each completed funded plan through the
local `consumedFundingOfCommitment` pointer and must not call Commitment Pooling. The measured
configured limit must fit that fixed receiver budget for the worst case where every entry
completes a distinct funded payout plan; if 24 does not fit, production freezes a lower measured
limit rather than silently raising the acknowledgment gas limit. Production may set a value from
1 through 24 while paused; both chains must report the same configured value before batching is
enabled. A batch
is an immutable logical attempt: entry IDs never change and a failed batch is never requeued
as a batch. Batch composition also mirrors state: `dispatchBatch` moves the batch and every entry from
Queued to Dispatched together, an authenticated success acknowledgment moves the batch and every
entry to Confirmed, an authenticated execution-failure acknowledgment moves the batch and every
entry to Failed carrying the batch's bounded `failureCode`, and `cancelBatch` moves the batch and
every entry to Cancelled with `cancelledFromState = Queued`; plan counters are maintained by those
mirrored entry transitions, never by the batch row alone. Each failed entry is then individually
requeued or terminally cancelled before any new
attempt. Setting either chain's configured limit back to zero is the explicit batching kill switch.

The exact approved command tuple is:

```solidity
abi.encode(
    uint8(version),
    uint256(settlementId),
    bool(isBatch),
    uint32(attempt),
    address(executorGarden),
    uint8(disbursementKind),
    address[](recipients),
    uint256[](amounts)
);
```

`executionKey = keccak256(abi.encode(sourceChainSelector, sourceSettlementModule, isBatch, settlementId, attempt))`.
The `isBatch` domain separator is mandatory because disbursement IDs and batch IDs are
independent counters and may have the same numeric value. The destination recomputes the key
from the authenticated source selector/sender and decoded command; a tuple whose subject type
does not match the key is invalid. The exact approved acknowledgment tuple is:

```solidity
abi.encode(
    uint8(version),
    bytes32(executionKey),
    bytes32(originatingCommandMessageId),
    bool(success),
    uint8(failureCode)
);
```

`CcipRoute.protocolVersion` is configured at exactly `1` for the first supported lane, matching the
`version` field of `SettlementCommandV1` and `SettlementAcknowledgmentV1`; both chains must report
the same value, and any later version is a drained cutover with zero grace rather than a live bump.
Initial dispatch snapshots the exact destination selector, executor peer, gas limit, protocol
version, and `commandPayloadHash = keccak256(encodedCommandTuple)` into `CommandRecord`.
Transport retries rebuild the canonical tuple, require the hash to match, and reuse that complete route
snapshot, `executionKey`, and logical payload; each retry has a new CCIP message ID. A
same-key retry can never target a replacement executor because idempotency storage is local to
one executor contract. Within one disbursement, a new `attempt` and execution key can be created only
after an authenticated execution-failure acknowledgment. Cancelling an unbatched Queued or
Failed commitment-consideration child terminally closes that child without clearing or replacing the
stable `payoutPlanOfCommitment` parent pointer. No second payout plan or replacement child may be
created for that contributor row; requeue is the retry path for an authenticated failure.
Cancelling a Queued batch closes every immutable batch entry atomically through `cancelBatch`; no
queued entry with a non-zero `batchId` can be cancelled alone. A delay,
missing acknowledgment, or manual CCIP execution state never creates a new logical attempt. The target failure contract is the
`FailureCode` enum above: `None == 0` means success and the source accepts only codes through
`BalanceDeltaMismatch == 11` **over CCIP**; `SourceStranded == 12` is a source-side disposition
written only by `failStrandedSubject` and never accepted from an executor. `success == true` requires `failureCode == None`; `success == false`
requires one of the bounded non-zero codes. A contradictory pair is malformed and reverts
without mutating the subject. Wrong router, selector, sender, version, token-bearing messages, and
malformed payloads are unauthenticated or structurally invalid inputs and revert without
storing an outcome or sending an acknowledgment. An authenticated, well-formed command that
fails route, recipient, configured batch, transfer, aggregate, periodic-cap, or bounded Safe
execution policy stores the exact negative outcome and sends a failure acknowledgment. This
lets Arbitrum fail and explicitly requeue the attempt without treating untrusted input as a
settlement result.

Peer grace is a liveness window, not a timeout-based failure oracle. A planned rotation pauses
new dispatch, inventories every command bound to the retiring peer, and sets grace longer than
the measured finality, service, manual-execution, and acknowledgment windows. The retiring peer
must reach zero unresolved commands before expiry or a later rotation. Otherwise the value lane
stays paused while the owner (an ops-policy timelock target, waived this release) either extends the bounded grace after re-verification or
escalates an explicit quarantine/upgrade disposition; the implementation never silently
requeues, cancels, overwrites, or pays a replacement command merely because grace elapsed.

### 3.1.3 Target interface + permission matrix

| Function | Authorized caller | Gates |
|---|---|---|
| `registerSettlementAccount(garden, chainId, account, recoveryOwners[3], rolesModifier, roleKey, allowanceKey, permissionsConfigHash)` / `updateSettlementRecovery(garden, recoveryOwners[3])` / `setAccountActive(garden, bool)` | steward or module owner | registration is write-once for garden/account/Roles/role/allowance keys and the immutable permission-tree hash; `chainId == DESTINATION_EVM_CHAIN_ID()` (`42220` production; `11142220` only in isolated, paused component proof and never as lane evidence); account/Roles/keys/hashes non-zero; owners sorted, unique, non-zero and none is a current executor; threshold fixed at 2. Recovery update may change only owners and the recovery hash. The permission hash excludes mutable executor caps, fee policy, period policy, and live allowance balances; their dedicated setters/events remain authoritative. Replacing the immutable target/selector/condition tree requires a paused new executor/route registration and re-verification |
| `setCcipRoute(selector, executor, gasLimit, version, previousPeerGraceSeconds)` | module owner — owner-direct in code; timelock ownership is an ops-policy target, waived this release (`timelockWaivedForRelease`) | requires pause; immutable implementation router is unchanged; non-zero supported route values. Same-selector/same-version executor rotation may store the prior peer with expiry no later than `block.timestamp + 30 days`. While that previous peer remains authorized, a second executor, selector, or version rotation reverts rather than overwriting its grace; the owner must drain it or wait until expiry. Repeating the call with the unchanged active route may only extend that same previous peer's expiry, never shorten it, revive a cleared peer, or reshuffle peers. Selector or protocol-version change requires a drained cutover with zero grace and clears the previous peer |
| `setBatchSizeLimit(limit)` | module owner — owner-direct in code; timelock ownership is an ops-policy target, waived this release (`timelockWaivedForRelease`) | requires pause; 0–24; zero explicitly disables batching; source and destination configured limits must match before any non-zero release |
| `setDispatcher(dispatcher)` | module owner — owner-direct in code; timelock ownership is an ops-policy target, waived this release (`timelockWaivedForRelease`) | requires pause; zero disables delegated dispatch; dispatcher can dispatch/retry only |
| `setFeeReserveMinimum(minimum)` | module owner — owner-direct in code; timelock ownership is an ops-policy target, waived this release (`timelockWaivedForRelease`) | requires pause; the new floor is immediately observable and every dispatch/retry/withdrawal must preserve it |
| `setGardenerDeliveryEnabled(bool)` | module owner | enabling requires the Celo AA/paymaster exit evidence recorded in the settlement handoff; disabling blocks new contributor-payout preparation and gardener sends but never blocks the funding route |
| `createCommitmentPayoutPlan(commitmentId, recognitionEntries[], recognitionSnapshotHash)` | resolved payer-garden settlement steward | commitment `Fulfilled`; no existing plan; non-zero immutable `payerGarden`; caller is its operator/owner steward; declared consideration is non-zero and uses exactly `CeloSettlement` with zero source/token sentinels. The active payer account freezes `source`; module configuration freezes `token`. Shape derives from the commitment and can never be edited: Request + Garden claim creates `GardenBeneficiary`, requires `providerGarden != payerGarden`, an active registered provider/beneficiary account, an empty recognition vector/hash, and freezes that garden, its Celo Safe, and `beneficiaryAmount = declaredAmount`; it creates no contributor rows. Every other combination creates `ContributorConsideration`, requires zero beneficiary fields, validates the complete recognition vector through `CommitmentPoolingModule.validateRecognitionSnapshot`, persists the ascending contributor order, and creates the deterministic full-consideration default vector. Cross-garden contributor shape starts and remains at zero retention. Both shapes begin Draft with no child; `gardenerDeliveryEnabled` is not a creation gate. The creation event carries the immutable kind and beneficiary fields so reverse indexing needs no RPC read |
| `setContributorPayouts(planId, gardenRetainedAmount, payouts[], reasonCID)` | resolved payer-garden settlement steward | caller is an operator/owner steward of immutable `payerGarden`; payer account active; Draft `ContributorConsideration` plan only. `GardenBeneficiary` reverts `PayoutKindMismatch` and is never editable into a contributor plan. Replaces the complete payout vector atomically in stored contributor order; recipients derive from approved Celo profiles and weights derive from amounts. `gardenRetainedAmount` must be zero when `payerGarden != providerGarden`. Contributor conservation is always `declaredAmount == gardenRetainedAmount + contributorPayoutTotal`. Zero rows remain visible and create no child. Noncanonical amount/retention divergence requires a reason. After all validation, increment the snapshot version once, emit the complete versioned replacement, and emit its trailing commit marker |
| `finalizeCommitmentPayoutPlan(planId)` | resolved payer-garden settlement steward | caller is an operator/owner steward of immutable `payerGarden`; payer account active; Draft only. Contributor shape revalidates recognition, recipients, weights, retention eligibility, and contributor conservation. Beneficiary shape rechecks that the beneficiary account is active and still resolves to the frozen Safe, then enforces zero retention, zero contributor total/order, and `declaredAmount == beneficiaryAmount`; it always has `payablePayoutCount == 1`. Finalization freezes the plan and creates no child. Only a contributor plan with zero payable rows may become Complete locally. Every beneficiary plan becomes Pending. `gardenerDeliveryEnabled` is not a finalization gate |
| `prepareContributorPayout(planId, contributor)` | resolved payer-garden settlement steward | caller is an operator/owner steward of immutable `payerGarden`; finalized `ContributorConsideration` plan; frozen row has non-zero amount/recipient. Existing child returns idempotently before pause/account/delivery rechecks. First preparation requires active payer, unpaused source, `gardenerDeliveryEnabled`, and Pending/Partial parent; creates one Queued child, stores the row child ID, increments `preparedPayoutCount`, and emits `DisbursementQueued(kind=ContributorConsideration)` |
| `prepareGardenBeneficiaryPayout(planId)` | resolved payer-garden settlement steward | caller is an operator/owner steward of immutable `payerGarden`; finalized `GardenBeneficiary` plan. Existing child returns idempotently before pause/account rechecks. First preparation requires active payer and beneficiary accounts, beneficiary Safe still equal to the frozen recipient, unpaused source, and Pending/Partial parent; creates one Queued child with `garden = beneficiaryGarden`, `contributor = address(0)`, stores `beneficiaryDisbursementId`, increments `preparedPayoutCount`, and emits `DisbursementQueued(kind=GardenBeneficiary)`. `gardenerDeliveryEnabled` is irrelevant because the recipient is a Safe |
| `queueFunding(garden, amount)` | protocol steward or module owner | the single modeled route is ProtocolToGarden, recorded on the disbursement's immutable `fundingRoute` fact; target garden must differ from `protocolGarden`; executorGarden is snapshotted as protocolGarden; source, recipient, and canonical G$ derive from funding config + active settlement accounts; no arbitrary addresses/tokens; event `DisbursementQueued(kind=Funding)` |
| `recordFunding(commitmentId, funder, refundAccount)` | pool-garden settlement steward | settlement reads the pooling module and requires an existing active ApprovalGated claim by `funder` on a non-zero-priced Offer using `CeloSettlement`; pool and pool garden must resolve, and the garden's settlement account must be active. Expected amount derives from the commitment and is frozen; `refundAccount` is a non-zero immutable Celo recipient. First use creates `Pledged`; an exact retry returns the existing ID without an event, while a changed refund account or changed frozen price reverts `FundingRecordConflict` |
| `recordFundingDeposit(fundingId, amount, depositReference)` | immutable pool-garden settlement steward | `Pledged` only; unique non-zero reference; `amount >= expectedAmount`. The complete deposit is recorded, including any excess, and state becomes `DepositRecorded`. Excess is a garden top-up only when delivery completes; if a refund becomes eligible, the complete recorded amount is owed |
| `consumeFunding(fundingId)` | immutable pool-garden settlement steward | `DepositRecorded` only; pooling must report the commitment Accepted with `counterparty == funder`. State becomes `Consumed` and the write-once `consumedFundingOfCommitment` pointer is stored. Pooling never reads settlement state and acceptance is not gated on this write: accepting without a recorded deposit knowingly fronts the Offer from the Safe and creates no member refund obligation |
| `queueFundingRefund(fundingId)` | immutable pool-garden settlement steward | mechanically derives one of three outcomes. `Pledged` withdrawal closes to `Withdrawn` with no child and emits `FundingWithdrawn`. `DepositRecorded` is refundable after decline, supersession, or steward-triggered withdrawal. `Consumed` is refundable only when the existing pooling read reports terminal non-fulfillment (`Cancelled` or `Expired`, including those dispute outcomes). Refund uses the immutable garden Safe, canonical G$, recorded refund account, and full `depositedAmount`; it creates exactly one `DisbursementQueued(kind=Refund, contributor=funder)` child and stores both relationship directions before emission. Any existing child returns idempotently; fulfillment is never refund-eligible |
| `queueLoanPrincipal(loanId)` | immutable pool-garden settlement steward | configured CreditRegistry required; exact `(registry, loanId)` retry returns the existing child before new queue gates. First queue requires source unpaused, an Approved non-expired loan, Open pool with credit enabled, active pool-garden settlement account, principal within the remaining registry reservation, and matching Settlement/Pooling/Hats configuration; source/recipient/token/amount derive from those records. Stores both relationship directions and emits `DisbursementQueued(kind=LoanPrincipal)` plus `LoanPrincipalQueued` |
| `createBatch(ids[])` | resolved settlement steward for the immutable executorGarden | 1–`batchSizeLimit` unique Queued ids; same executorGarden, source, token, kind, and fundingRoute; unique recipients before fee quote/mutation. Every commitment-bound kind rechecks its immutable payer account. `GardenBeneficiary` additionally rechecks every immutable beneficiary garden account and frozen Safe. Refund rechecks the immutable funding garden/account and relationship; Funding rechecks the protocol source plus every target garden; LoanPrincipal rechecks the active loan reservation and pool source. Mixed kinds/routes revert; same-kind children may batch only when executor/token match. Entry ids are immutable; event `BatchCreated` |
| `dispatchDisbursement(id)` / `dispatchBatch(batchId)` | resolved settlement steward for immutable `executorGarden`, or exact configured `dispatcher` | subject Queued. Every commitment-bound kind rechecks payer activity immediately before fee quote/send; `GardenBeneficiary` also rechecks beneficiary account activity and frozen Safe. Funding rechecks protocol source and target accounts. Deactivation blocks dispatch without mutation. Delegated dispatch executes only an immutable payer-steward-approved plan; owner has no value-moving bypass. Preserve native reserve floor, build the fixed payload with no target/token/calldata override, send no token amounts, persist key/message ID, and move Queued → Dispatched |
| `retryCommand(id)` / `retryBatchCommand(batchId)` | resolved settlement steward for immutable `executorGarden`, or exact configured `dispatcher` | subject remains Dispatched without authenticated acknowledgment; native fee balance covers the quote without falling below `feeReserveMinimum`; uses the command's snapshotted selector/executor/gas/version/payload hash, never the later active route; records a new CCIP message ID; never creates a second payment authority |
| CCIP acknowledgment receiver | the implementation's immutable CCIP router only | zero token amounts; supported snapshotted version; execution key maps to the current subject/attempt; `originatingCommandMessageId` must already map to that same key; source selector and encoded sender must equal that `CommandRecord`'s snapshotted destination selector/executor (which must still be the active or unexpired previous global peer); success requires `FailureCode.None`, failure requires a bounded non-zero code. Success → Confirmed; execution failure → Failed. Duplicate/stale acknowledgments are emitted and ignored without mutating settled state |
| `requeue(id)` | resolved settlement steward for immutable `executorGarden` | Failed → Queued, `attempt++`; operates on one child, clears command/ack fields and active `batchId` while the failed Batch keeps its historical members. Any `payoutPlanId != 0` child, regardless of contributor/beneficiary kind, moves one parent counter from failed back to active. A new execution key is created only on next dispatch; prior failure code/reason remain historical facts |
| `cancelDisbursement(id, reasonCID)` | resolved settlement steward for immutable `executorGarden` | unbatched Queued (`batchId == 0`) or Failed only, and `kind != Refund`; Refund children cannot be cancelled because their immutable funding relationship remains an open recorded obligation and the same child must stay dispatchable or requeueable. Other kinds record `cancelledFromState`, preserve failed history, and create no new key. Any commitment-bound child updates the same general plan counters and never clears/replaces `payoutPlanOfCommitment` or its row/beneficiary child pointer. Dispatched subjects cannot be cancelled on timeout alone; event `DisbursementCancelled` |
| `cancelBatch(batchId, reasonCID)` | resolved batch steward | batch must be Queued and contain no Refund entry; atomically marks the immutable batch and every other-kind entry Cancelled-from-Queued and preserves the entry list. Refund batches remain Queued so their recorded obligations retain the ordinary dispatch/failure/requeue path. No child or batch cancellation clears `payoutPlanOfCommitment`, and there is no partial queued-batch cancellation; event `BatchCancelled` |
| `initialize(owner, hatsModule, commitmentPoolingModule, protocolGarden, gDollarToken)` | proxy initializer | every address non-zero; protocol garden and canonical G$ become write-once configuration; disbursement, batch, and payout-plan IDs start at 1; delivery disabled; batch limit/dispatcher/reserve start at zero; `paused = true`; owner-only UUPS authorization |
| fee operations (`fundFees`, `withdrawExcessFees`, `quoteCommandFee`, balance/readiness views) | anyone / owner / public | fees use native ETH; dispatch/retry and withdrawal preserve `feeReserveMinimum`; funding, floor changes, withdrawals, current balance, and low-balance state are observable |
| dependency setters (`setHatsModule`, `setCommitmentPoolingModule`) | module owner | source must be paused; zero rejected; every real change emits exact old/new addresses |
| `setCreditRegistry(registry)` | module owner | source must be paused; zero rejected; candidate must expose matching SettlementModule, CommitmentPoolingModule, and HatsModule configuration and be paused. Exact repeat is a no-op. Replacement is blocked while the previous registry has an active principal reservation; every real change emits `CreditRegistryUpdated` |
| `setPaused` | module owner | initialize paused; pausing is always allowed. Unpause requires non-zero dependencies, a complete non-zero CCIP route, active protocol settlement account, and non-zero fee reserve floor; paused source blocks contributor preparation, funding queue, batch creation, dispatch, command retry, and requeue while permitting configuration, fee funding/guarded excess withdrawal, Queued/Failed terminal cancellation, and authenticated acknowledgment receipt |
| views (`getDisbursement`, `getBatch`, `getPayoutPlan`, `contributorPayoutOf`, `payoutContributors`, `payoutPlanOfCommitment`, `getCommitmentFunding`, `fundingOfCommitmentFunder`, `fundingRefundDisbursementOf`, `payoutPlanStatus`, `settlementAccountOf`, `isAcknowledgmentPending`, `gardenerDeliveryEnabled`, `ccipRoute`, `dispatcher`, fee floor/balance/low state) | public | funding views expose the immutable claimant/garden/refund account, recorded deposit, exact state, and one refund-child pointer. `getPayoutPlan` exposes immutable shape and beneficiary fields; `payoutContributors` is empty for beneficiary shape and otherwise returns the immutable order. Status derives from all commitment-bound child states, not only contributor rows |

“Resolved settlement steward” names no new role. Every steward gate above resolves through the
module's `hatsModule` trust root as
`IHatsModule.isStewardOf(garden, msg.sender) || IHatsModule.isOwnerOf(garden, msg.sender)`,
evaluated against the subject's immutable `payerGarden` or `executorGarden` — the same
operator/owner predicate `_requireOperator` applies in
`packages/contracts/src/modules/Hypercerts.sol`. `IHatsModule.isOperatorOf` is the deprecated alias
that `HatsModule` forwards to `isStewardOf`, so either name resolves identically; the frozen
interface uses `isStewardOf`. A zero `hatsModule` reverts. Unlike the pooling module's pool gate,
no value-moving payout write has a module-owner fallback: a failed resolution is exactly
`NotSettlementSteward(caller, garden)`.

Account deactivation is a fail-closed authorization boundary, not a retroactive history rewrite.
It blocks every new commitment-plan value authorization (contributor edit, either-shape
finalization, first preparation, batch creation, and initial dispatch) after the payer account
becomes inactive. Beneficiary-shaped plans also recheck their beneficiary account and frozen Safe
at creation, finalization, first preparation, batch creation, and initial dispatch. Public reads,
authenticated acknowledgments, terminal cancellation, and exact-key retry/idempotent-return paths
do not create new payout authority and retain their separately stated gates.

Target event/error contract (the indexer config must not use these signatures until the
corresponding contracts exist):

```solidity
event FundingConfigurationLocked(address indexed protocolGarden, address indexed gDollarToken);
event FundingPledged(
    uint256 indexed fundingId,
    uint256 indexed commitmentId,
    address indexed funder,
    address garden,
    address refundAccount,
    uint256 expectedAmount,
    address recordedBy
);
event FundingDepositRecorded(
    uint256 indexed fundingId,
    bytes32 indexed depositReference,
    uint256 amount,
    address indexed recordedBy
);
event FundingConsumed(
    uint256 indexed fundingId,
    uint256 indexed commitmentId,
    address indexed funder,
    uint256 depositedAmount,
    address consumedBy
);
event FundingWithdrawn(
    uint256 indexed fundingId,
    uint256 indexed commitmentId,
    address indexed funder,
    address withdrawnBy
);
event SettlementAccountRegistered(
    address indexed garden,
    uint64 chainId,
    address indexed account,
    address[3] recoveryOwners,
    address rolesModifier,
    bytes32 roleKey,
    bytes32 allowanceKey,
    bytes32 permissionsConfigHash,
    bytes32 recoveryConfigHash,
    uint8 recoveryThreshold
);
event SettlementRecoveryUpdated(
    address indexed garden,
    address[3] recoveryOwners,
    bytes32 recoveryConfigHash
);
event SettlementAccountStatusChanged(address indexed garden, bool active);
event CcipRouteUpdated(
    uint64 indexed destinationChainSelector,
    address indexed destinationExecutor,
    address indexed previousDestinationExecutor,
    uint64 previousPeerExpiresAt,
    uint32 destinationGasLimit,
    uint8 protocolVersion
);
event GardenerDeliveryStatusChanged(bool enabled);
event BatchSizeLimitUpdated(uint16 previousLimit, uint16 limit);
event DispatcherUpdated(address indexed previousDispatcher, address indexed dispatcher);
event FeeReserveMinimumUpdated(uint256 previousMinimum, uint256 minimum);
event HatsModuleUpdated(address indexed previousModule, address indexed newModule);
event CommitmentPoolingModuleUpdated(address indexed previousModule, address indexed newModule);
event PausedSet(bool paused);
event CommitmentPayoutPlanCreated(
    uint256 indexed payoutPlanId,
    uint256 indexed commitmentId,
    address indexed providerGarden,
    address payerGarden,
    address source,
    address token,
    uint8 payoutKind,
    uint256 declaredAmount,
    uint256 gardenRetainedAmount,
    address beneficiaryGarden,
    address beneficiaryRecipient,
    uint256 beneficiaryAmount,
    bytes32 recognitionSnapshotHash,
    address createdBy
);
/// @notice ContributorConsideration creation emits one for every sorted recognition row,
///         immediately after CommitmentPayoutPlanCreated. Draft edits emit the complete
///         replacement sequence. GardenBeneficiary emits none and cannot be edited.
event ContributorPayoutSet(
    uint256 indexed payoutPlanId,
    uint32 indexed paymentSnapshotVersion,
    address indexed contributor,
    address recipient,
    uint16 recognitionWeightBps,
    uint16 paymentWeightBps,
    uint256 amount,
    string reasonCID,
    address editedBy
);
/// @notice Trailing commit marker for creation and every complete Draft replacement.
///         Indexers buffer rows by (payoutPlanId, paymentSnapshotVersion) and
///         atomically publish only when this summary's rowCount and canonical
///         PaymentSnapshotEntry[] hash match.
event CommitmentPayoutSnapshotCommitted(
    uint256 indexed payoutPlanId,
    uint32 indexed paymentSnapshotVersion,
    uint32 rowCount,
    uint256 gardenRetainedAmount,
    uint256 contributorPayoutTotal,
    bytes32 paymentSnapshotHash,
    string reasonCID,
    address editedBy
);
event CommitmentPayoutPlanFinalized(
    uint256 indexed payoutPlanId,
    uint8 payoutKind,
    uint32 payablePayoutCount,
    uint256 contributorPayoutTotal,
    uint256 beneficiaryAmount,
    uint256 gardenRetainedAmount,
    bytes32 recognitionSnapshotHash,
    bytes32 paymentSnapshotHash,
    bool completedWithoutDispatch,
    uint64 finalizedAt
);
event DisbursementQueued(
    uint256 indexed disbursementId,
    uint256 indexed commitmentId,
    address indexed garden,
    uint256 payoutPlanId,
    address contributor,
    address executorGarden,
    uint8 kind,
    uint8 fundingRoute,
    address source,
    address recipient,
    address token,
    uint256 amount
);
event BatchCreated(
    uint256 indexed batchId,
    address indexed executorGarden,
    address indexed source,
    address token,
    uint8 kind,
    uint8 fundingRoute,
    uint256[] disbursementIds
);
event SettlementCommandDispatched(
    bytes32 indexed executionKey,
    bytes32 indexed commandMessageId,
    bool indexed isBatch,
    uint256 subjectId,
    uint32 attempt,
    uint64 destinationChainSelector,
    address destinationExecutor,
    uint32 destinationGasLimit,
    uint8 protocolVersion,
    bytes32 commandPayloadHash,
    uint256 fee
);
event SettlementCommandRetried(
    bytes32 indexed executionKey,
    bytes32 indexed commandMessageId,
    bool indexed isBatch,
    uint256 subjectId,
    uint32 attempt,
    uint64 destinationChainSelector,
    address destinationExecutor,
    uint32 destinationGasLimit,
    uint8 protocolVersion,
    bytes32 commandPayloadHash,
    uint256 fee
);
event SettlementAcknowledged(
    bytes32 indexed executionKey,
    bytes32 indexed acknowledgmentMessageId,
    bytes32 indexed originatingCommandMessageId,
    bool isBatch,
    uint256 subjectId,
    bool success,
    uint8 failureCode
);
event DuplicateAcknowledgmentIgnored(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId);
event StaleAcknowledgmentIgnored(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId);
event DisbursementRequeued(uint256 indexed disbursementId, uint32 attempt);
event DisbursementCancelled(
    uint256 indexed disbursementId,
    address indexed actor,
    uint8 cancelledFromState,
    string reasonCID
);
event BatchCancelled(uint256 indexed batchId, address indexed actor, string reasonCID);
event FeeReserveFunded(address indexed funder, uint256 amount);
event ExcessFeesWithdrawn(address indexed recipient, uint256 amount);

error FundingConfigurationIncomplete();
error FundingRecordConflict(uint256 commitmentId, address funder, uint256 existingFundingId);
error UnknownCommitmentFunding(uint256 fundingId);
error CommitmentFundingNotInState(uint256 fundingId, FundingState actual);
error FundingDepositReferenceRequired();
error FundingDepositReferenceUsed(bytes32 depositReference, uint256 existingFundingId);
error FundingDepositBelowPrice(uint256 fundingId, uint256 expectedAmount, uint256 depositedAmount);
error FundingClaimantMismatch(uint256 fundingId, address funder, address acceptedCounterparty);
error FundingRefundNotEligible(uint256 fundingId);
error FundingRefundAlreadyLinked(uint256 fundingId, uint256 disbursementId);
error RefundDisbursementCannotBeCancelled(uint256 disbursementId);
error ZeroAddress();
error UnauthorizedCaller(address caller);
error NotSettlementSteward(address caller, address garden);
error UnknownSettlementAccount(address garden);
error SettlementAccountInactive(address garden);
error InvalidSettlementChain(uint64 chainId);
error InvalidRecoveryConfiguration();
error UnknownDisbursement(uint256 disbursementId);
error UnknownBatch(uint256 batchId);
error DisbursementNotInState(uint256 disbursementId, DisbursementState actual);
error BatchNotInState(uint256 batchId, DisbursementState actual);
error AmountRequired();
error ConsiderationNotDeclared(uint256 commitmentId);
error InvalidPayerGarden(uint256 commitmentId);
error CommitmentPayoutPlanExists(uint256 commitmentId, uint256 payoutPlanId);
error UnknownPayoutPlan(uint256 payoutPlanId);
error PayoutPlanFinalized(uint256 payoutPlanId);
error PayoutPlanNotFinalized(uint256 payoutPlanId);
error PayoutKindMismatch(uint256 payoutPlanId, DisbursementKind expected, DisbursementKind actual);
error IneligibleContributor(uint256 commitmentId, address contributor);
error InvalidRecognitionVector();
error RecognitionSnapshotMismatch(bytes32 expected, bytes32 actual);
error InvalidPayoutVector();
error TooManyPayoutContributors(uint256 supplied, uint256 maximum);
error RecognitionPaymentDivergenceRequiresReason();
error PayoutPlanInvariantMismatch(
    uint256 declaredAmount,
    uint256 retainedAmount,
    uint256 contributorTotal,
    uint256 beneficiaryAmount
);
error BatchSizeOutOfBounds(uint256 supplied, uint256 maximum);
error DuplicateBatchEntry(uint256 disbursementId);
error DuplicateBatchRecipient(address recipient);
error BatchEntryMismatch(uint256 disbursementId);
error InvalidCcipSource();
error InvalidCcipSender();
error CcipTokensNotAllowed();
error UnsupportedMessageVersion();
error InvalidExecutionKey();
error InsufficientNativeFee();
error FeeReserveFloorViolated(uint256 requiredMinimum, uint256 remainingBalance);
error DispatchedSettlementCannotBeCancelled();
error BatchedDisbursementCannotBeCancelled(uint256 disbursementId, uint256 batchId);
error GardenerDeliveryDisabled();
error SourceMustBePaused();
error SourceNotReady();

interface ISettlementModule {
    function initialize(
        address owner_,
        address hatsModule_,
        address commitmentPoolingModule_,
        address protocolGarden_,
        address gDollarToken_
    ) external;
    function setCcipRoute(
        uint64 destinationChainSelector,
        address destinationExecutor,
        uint32 destinationGasLimit,
        uint8 protocolVersion,
        uint64 previousPeerGraceSeconds
    ) external;
    function setBatchSizeLimit(uint16 limit) external;
    function setDispatcher(address dispatcher_) external;
    function setFeeReserveMinimum(uint256 minimum) external;
    function registerSettlementAccount(
        address garden,
        uint64 chainId,
        address account,
        address[3] calldata recoveryOwners,
        address rolesModifier,
        bytes32 roleKey,
        bytes32 allowanceKey,
        bytes32 permissionsConfigHash
    ) external;
    function updateSettlementRecovery(
        address garden,
        address[3] calldata recoveryOwners
    ) external;
    function setAccountActive(address garden, bool active) external;
    function setGardenerDeliveryEnabled(bool enabled) external;

    function createCommitmentPayoutPlan(
        uint256 commitmentId,
        RecognitionEntry[] calldata recognitionEntries,
        bytes32 recognitionSnapshotHash
    ) external returns (uint256 payoutPlanId);
    function setContributorPayouts(
        uint256 payoutPlanId,
        uint256 gardenRetainedAmount,
        ContributorPayoutInput[] calldata payouts,
        string calldata reasonCID
    ) external;
    function finalizeCommitmentPayoutPlan(uint256 payoutPlanId) external;
    function prepareContributorPayout(
        uint256 payoutPlanId,
        address contributor
    ) external returns (uint256 disbursementId);
    function prepareGardenBeneficiaryPayout(
        uint256 payoutPlanId
    ) external returns (uint256 disbursementId);
    function queueFunding(address garden, uint256 amount) external returns (uint256 disbursementId);
    function recordFunding(
        uint256 commitmentId,
        address funder,
        address refundAccount
    ) external returns (uint256 fundingId);
    function recordFundingDeposit(uint256 fundingId, uint256 amount, bytes32 depositReference) external;
    function consumeFunding(uint256 fundingId) external;
    function queueFundingRefund(uint256 fundingId) external returns (uint256 disbursementId);
    function queueLoanPrincipal(uint256 loanId) external returns (uint256 disbursementId);
    function createBatch(uint256[] calldata disbursementIds) external returns (uint256 batchId);
    function dispatchDisbursement(uint256 disbursementId) external returns (bytes32 messageId);
    function dispatchBatch(uint256 batchId) external returns (bytes32 messageId);
    function retryCommand(uint256 disbursementId) external returns (bytes32 messageId);
    function retryBatchCommand(uint256 batchId) external returns (bytes32 messageId);
    function requeue(uint256 disbursementId) external;
    function cancelDisbursement(uint256 disbursementId, string calldata reasonCID) external;
    function cancelBatch(uint256 batchId, string calldata reasonCID) external;

    function getDisbursement(uint256 disbursementId) external view returns (Disbursement memory);
    function getBatch(uint256 batchId) external view returns (Batch memory);
    function settlementAccountOf(address garden) external view returns (SettlementAccount memory);
    function getPayoutPlan(uint256 payoutPlanId) external view returns (CommitmentPayoutPlan memory);
    function contributorPayoutOf(
        uint256 payoutPlanId,
        address contributor
    ) external view returns (ContributorPayout memory);
    function payoutContributors(uint256 payoutPlanId) external view returns (address[] memory);
    function payoutPlanOfCommitment(uint256 commitmentId) external view returns (uint256);
    function getCommitmentFunding(uint256 fundingId) external view returns (CommitmentFunding memory);
    function fundingOfCommitmentFunder(uint256 commitmentId, address funder) external view returns (uint256);
    function fundingRefundDisbursementOf(uint256 fundingId) external view returns (uint256);
    function payoutPlanStatus(uint256 payoutPlanId) external view returns (PayoutPlanStatus);
    function MAX_PAYOUT_CONTRIBUTORS() external pure returns (uint256);
    function isAcknowledgmentPending(bool isBatch, uint256 subjectId) external view returns (bool);
    function commandRecord(bytes32 executionKey) external view returns (CommandRecord memory);
    function gardenerDeliveryEnabled() external view returns (bool);
    function ccipRoute() external view returns (CcipRoute memory);
    function quoteCommandFee(bool isBatch, uint256 subjectId) external view returns (uint256);
    function HARD_MAX_BATCH_SIZE() external pure returns (uint256);
    function batchSizeLimit() external view returns (uint16);
    function dispatcher() external view returns (address);
    function feeReserveMinimum() external view returns (uint256);
    function nativeFeeBalance() external view returns (uint256);
    function isFeeReserveLow() external view returns (bool);
    function protocolGarden() external view returns (address);
    function gDollarToken() external view returns (address);
    function hatsModule() external view returns (address);
    function commitmentPoolingModule() external view returns (address);
    function paused() external view returns (bool);
    function CCIP_ROUTER() external view returns (address);
    function SOURCE_CHAIN_SELECTOR() external view returns (uint64);
    function DESTINATION_EVM_CHAIN_ID() external view returns (uint64);

    function fundFees() external payable;
    function withdrawExcessFees(address payable recipient, uint256 amount) external;
      function setHatsModule(address module) external;
      function setCommitmentPoolingModule(address module) external;
    function setCreditRegistry(address registry) external;
    function setPaused(bool paused_) external;
}
```

**Paused-first source configuration.** Initialization sets `paused = true`.
It emits `FundingConfigurationLocked`, `HatsModuleUpdated(address(0), hatsModule)`,
`CommitmentPoolingModuleUpdated(address(0), commitmentPoolingModule)`, and `PausedSet(true)` so a
replay materializes every immutable/dependency/pause fact without RPC inference.
`setHatsModule` and `setCommitmentPoolingModule` reject zero, reject calls while unpaused with
`SourceMustBePaused`, treat an exact repeat as a no-op, and emit their exact old/new events for
real changes. `setPaused(false)` revalidates both dependencies, every non-zero active-route field,
the active protocol-garden settlement account, and a non-zero fee reserve floor; any incomplete
state reverts `SourceNotReady`. This makes a trust-root change observable and prevents a setter
from racing an otherwise dispatchable command.

**Commitment payout-plan binding.** Rail and declared amount come from `commitment.consideration`; the
rail must be `CeloSettlement` and its declared source/token must both be zero sentinels, which
makes the core module's `recordConsiderationPaid` path unavailable. The plan token derives exclusively
from this module's write-once `gDollarToken`; the payer is the active registered Celo Safe for
`commitment.payerGarden` — the asking side, which is the pool garden for a Request and the claiming
garden for an Offer (register #90). For every garden-internal commitment that address equals
`commitment.providerGarden`, so single-garden behaviour is unchanged; in the protocol pool they
differ, which is the entire point. `executorGarden = payerGarden`. `providerGarden` is still stored
for attribution and role scope, and is never spent.

Plan creation rejects `payerGarden == address(0)` with `InvalidPayerGarden(commitmentId)` before
any account lookup or state write. That closes malformed/backfilled records rather than assuming
the pooling lifecycle ran correctly. For Garden-beneficiary shape it also requires an active
registered account for `providerGarden`, freezes that account's Safe as the recipient, and rejects
the shape when provider and payer are equal. Missing or inactive payer/beneficiary accounts fail
closed; there is no fallback recipient and no contributor fan-out.

**Who receives is decided by who earned, which the claim type already records (register #91).** A
protocol pool asks for two different kinds of thing, and the module distinguishes them at claim
time: garden-scoped work (running an event, a garden-scoped survey) is claimed by the garden
through `ClaimType.Garden`, which only a garden steward may do, while individual work is claimed by
a gardener through `ClaimType.Individual`. The payout recipient follows that distinction:

- **Request + `ClaimType.Garden`** — one recipient: the claiming garden's active registered Celo
  Safe. The garden took the commitment on as an institution and earns it as one; how it then
  distributes internally is the garden's own business and is not a protocol concern. This is what
  lets a garden accumulate G$ from protocol Requests and later spend it on protocol Offers. The
  full declared amount goes to that Safe; this shape does not use `gardenRetainedAmount`.
- **Request + `ClaimType.Individual`** — recipients are the frozen eligible contributors' own Celo
  accounts, unchanged.
- **Offer, either claim type** — recipients are the contributors, because on an Offer the
  delivering side is the creator and their roster while the claimant is the *payer*. Paying the
  claimant here would be a self-transfer.

For a Request the claiming garden is both `counterparty` and `providerGarden`, so the Garden-claim
recipient resolves to `settlementAccounts[providerGarden]`. The Arbitrum GardenAccount remains
attribution only and is never a G$ recipient; the recipient is always a registered **Celo Safe** or
a contributor's Celo account.

**This needs its own disbursement kind, and the earlier "no new `DisbursementKind`" scope call was
wrong (corrected 2026-08-08).** The contributor machinery cannot carry it: plan creation allocates
the whole amount across contributor rows, `prepareContributorPayout` only ever materializes a
`ContributorConsideration` child for a roster member, and a 100%-retained plan produces no payable row at
all and completes locally — which would silently leave the money in the payer Safe rather than
paying the garden. `Funding` cannot carry it either, because `Funding` is deliberately not
commitment-bound, and `ContributorConsideration` cannot honestly classify a garden Safe as a contributor.

`DisbursementKind.GardenBeneficiary` is therefore added, with a matching queue path:

- **Plan shape.** Creation derives and freezes `payoutKind`. A Garden-claimed Request becomes
  `GardenBeneficiary` with `beneficiaryGarden = providerGarden`, the active account's Celo Safe in
  `beneficiaryRecipient`, `beneficiaryAmount = declaredAmount`, one payable child, zero retention,
  zero contributor total, and no contributor rows. The recognition input/hash must both be empty.
  Its `paymentSnapshotVersion` is 1 and its immutable `paymentSnapshotHash` is exactly
  `keccak256(abi.encode(block.chainid, payoutPlanId, payoutKind, beneficiaryGarden,
  beneficiaryRecipient, beneficiaryAmount))`; it emits no contributor snapshot rows or commit
  marker. The creation and finalization events carry enough data for an indexer to recompute it.
  Every other commitment becomes `ContributorConsideration` and has zero beneficiary fields. No
  edit or finalization path may convert one shape into the other.
- **`prepareGardenBeneficiaryPayout(planId)`** mirrors contributor preparation: resolved
  payer-garden settlement steward, finalized plan, idempotent (returns the existing child and emits
  nothing on repeat), and a first preparation additionally requires the payer-garden settlement
  account active, source unpaused, the **claiming garden's** settlement account active and still
  resolving to the frozen Safe, and parent
  status Pending/Partial. It allocates one immutable Queued child and emits
  `DisbursementQueued(kind=GardenBeneficiary)`. `gardenerDeliveryEnabled` does **not** gate it —
  that flag governs delivery to individual gardener accounts, and this recipient is a Safe.
- **Batching and dispatch.** `GardenBeneficiary` follows the same homogeneity rule as every other
  kind: same kind, source, token, executor, and unique recipients per batch. `createBatch` and
  `dispatchDisbursement` recheck both the immutable payer-garden account and the beneficiary
  garden's account immediately before fee quote and send; deactivating either side or finding a
  recipient mismatch blocks authorization without mutating the Queued subject. Requeue,
  acknowledgement, and cancellation update the same general parent counters as contributor
  children; they never clear the beneficiary child pointer or the commitment-to-plan pointer.
- **Authority.** Creation, edit, finalization, and preparation all resolve stewardship from the
  immutable `payerGarden`, unchanged. The receiving garden has no authority over a payment made to
  it, exactly as a contributor has none over theirs.

**Retention is only meaningful when the payer is also the earner's institution.** `gardenRetainedAmount`
was designed for provider-pays, where a garden kept a slice of what it earned before distributing
the rest to its own contributors. Once payer and provider can differ it stops meaning that: on a
protocol Request it would let the protocol withhold part of what it commissioned, and on a protocol
Offer it would let the paying garden withhold part of what it owes the provider's contributors.
The rule is therefore: **`gardenRetainedAmount` must be zero whenever `payerGarden != providerGarden`,
and whenever the plan carries a beneficiary row.** It keeps its existing meaning only for
garden-internal commitments, where payer and provider are the same garden. Finalization enforces
this alongside the conservation check. The Arbitrum GardenAccount is attribution only and never a G$
recipient. A plan accepts only contributors from the commitment's frozen eligible roster
(`approvedWorkCredits + evidenceCredits > 0`, where `evidenceCredits` is the canonical 0-or-1
participation credit and never the number of evidence CIDs). Each contributor recipient derives from
the shared Celo account profile; callers never type an arbitrary recipient. Creation receives the
complete sorted Hypercert recognition vector and calls
`CommitmentPoolingModule.validateRecognitionSnapshot`. That view requires the complete eligible
set and recomputes every weight from the frozen on-chain credit records and immutable cycle
policy before returning
`recognitionSnapshotHash = keccak256(abi.encode(block.chainid, commitmentId, recognitionEntries))`.
The SettlementModule compares returned and supplied hashes, so a caller cannot make an arbitrary
split authoritative by supplying a self-consistent vector and hash. `validateRecognitionSnapshot` is
a Commitment Pooling core-module view, so `contract-spec.md` §6.1 is the canonical owner of that
preimage; this section restates it only for the payout-plan caller. A change lands in
`contract-spec.md` §6.1 first and is mirrored here, never authored independently in this document.
The default payment vector distributes the full declared consideration by deterministic base-unit
apportionment: floor each `declaredAmount * recognitionWeightBps / 10_000`, then assign remaining
base units by descending fractional remainder and ascending lowercase contributor address. The
module then normalizes those integer amounts into `paymentWeightBps` using the same deterministic
ordering. A normalized weight difference caused solely by this canonical amount vector is
**rounding-only equivalence**: creation uses an empty reason and the UI/indexer labels it “Matches
recognition · base-unit rounded.” This is computable from the declared amount and recognition
snapshot, so it does not create a caller-selectable exception.

A steward may replace the complete amount vector and retention while the plan is Draft. The
module derives payment weights from amounts, hashes the resulting vector, and requires one
emitted/indexed reason unless zero retention and every amount still exactly equals the canonical
full-consideration base-unit vector. Callers never submit an independent payment weight.
If `contributorPayoutTotal == 0`, the canonical payment-weight vector contains one zero weight for
every ordered recognition row; the implementation performs no division or largest-remainder pass.
Its snapshot hashes the explicit ordered zero rows plus full garden retention. Because this
payment vector differs from a non-empty 10,000-bps recognition vector, the edit requires a
non-empty reason such as “garden retains all support”; no special-case bypass erases that
divergence.
`paymentSnapshotHash` is exactly
`keccak256(abi.encode(block.chainid, payoutPlanId, paymentSnapshotVersion, gardenRetainedAmount, contributorPayoutTotal, paymentSnapshotEntries))`,
where `paymentSnapshotEntries` is the ascending-contributor
`PaymentSnapshotEntry[] { contributor, recipient, recognitionWeightBps, paymentWeightBps, amount }`
sequence emitted by `ContributorPayoutSet`. Creation hashes version 1; a Draft edit computes its
next version before hashing. The tuple deliberately excludes mutable `disbursementId`,
prepared/confirmed/failed/cancelled counters, and every other child lifecycle fact, so preparation
cannot change a frozen snapshot. The contract, trailing commit marker, indexer verifier, shared
helper, and tests use this exact ABI encoding and field order. Default token-unit and bps
remainders use descending fractional remainder, then ascending lowercase contributor address;
payout amount is never the remainder tiebreaker.
`finalizeCommitmentPayoutPlan` rechecks the immutable shape. Contributor shape enforces
`consideration.amount == gardenRetainedAmount + contributorPayoutTotal`; beneficiary shape enforces
zero retention and contributor total plus `consideration.amount == beneficiaryAmount`. It emits the
finalization event and blocks every later edit. It creates no child. After finalization,
`prepareContributorPayout`
materializes one immutable Queued child from one frozen non-zero row; an exact repeat returns the
stored ID without allocating or emitting again, regardless of the child's later terminal state or
a subsequently paused/disabled source. This repeat path is permission-checked but read-like; the
pause and delivery gates apply only before first materialization. Zero-amount contributors remain visible
comparison rows and can never be prepared. A garden-internal contributor plan that is 100%
retained has no payable rows and becomes Complete on finalization without CCIP or a self-transfer.
A beneficiary plan always has one payable row and cannot complete until its child is Confirmed.
`MAX_PAYOUT_CONTRIBUTORS` is the same
measured constant as `MAX_CONTRIBUTORS_PER_COMMITMENT`, provisionally 32, and is frozen only
after measuring 8/16/24/32 plan-creation, full-vector edit,
finalization, preparation, and event payload costs. It is a transaction-safety bound, not a
product rule limiting team size. Funding top-ups remain explicit non-commitment disbursements.

**Derived parent status.** `payoutPlanStatus` is `Draft` until explicit finalization; `Complete`
immediately only when a finalized contributor plan has no payable payout, or when
`confirmedPayoutCount == payablePayoutCount`; `Partial` when at least one payable child is
Confirmed but the plan is not complete; and `Failed` when no child is Confirmed and
`failedPayoutCount + cancelledPayoutCount == payablePayoutCount`. Every other finalized
state is `Pending`, including unprepared rows, Queued/Dispatched children, or failed/cancelled
siblings while another row remains unprepared or active. Preparation and each child transition
moves the same general plan counters for any `payoutPlanId != 0` child; requeue moves one child
from failed back to active, and cancellation
moves a queued or failed row into the cancelled count without changing the payable total. A plan has no CCIP execution key, command,
acknowledgment, retry, or mutable
cross-chain state. Those facts belong only to child disbursements. The stable
`payoutPlanOfCommitment` pointer is never cleared by child or batch cancellation. One child failure
can requeue independently, and a large team can be partitioned across multiple batches
under the existing measured batch limit.

**Funding-route binding.** `queueFunding` never accepts source, recipient, or token. The single modeled route `ProtocolToGarden` stores source = the protocol settlement account, recipient = the target garden settlement account, garden = target garden, and immutable `executorGarden = protocolGarden`. `protocolGarden` and `gDollarToken` are write-once initializer facts with no setter, so queued and future funding commands cannot drift from the Celo executor's immutable canonical token. Both accounts must be active, amount must be non-zero, and token is always `gDollarToken`. HoA → protocol Safe is recorded in external treasury reporting, not fabricated as a module action Green Goods did not authorize.

**Canonical G$ fee semantics (net amount is the promise).** GoodDollar's canonical token
exposes `getFees(amount, sender, recipient) -> (fee, senderPays)` and can either charge the fee
in addition to the requested amount or deduct it from the recipient amount; DAO-contract
senders may be exempt. Green Goods defines every queued `amount` as the **exact net amount the
recipient must receive**, never as a gross transfer input:

1. immediately before Safe execution, the Celo executor quotes
   `getFees(amount, sourceSafe, recipient)` and snapshots source and recipient balances;
2. `fee == 0` is accepted; `fee > 0 && senderPays == true` is accepted only when the Safe can
   debit `amount + fee` and that gross debit remains within per-transfer, batch, and period
   caps;
3. `fee > 0 && senderPays == false` fails closed as
   `UnsupportedReceiverPaysFee`; the executor does not guess a gross-up because the fee formula
   can depend on sender, recipient, and amount;
4. after the bounded Safe call, recipient balance must increase by exactly `amount` and source
   balance must decrease by the quoted gross debit; otherwise the transaction reverts and the
   stored outcome is `BalanceDeltaMismatch`;
5. every non-zero fee must be no greater than both `maxFeeAmount` and
   `floor(amount × maxFeeBps / 10_000)`; zero in either fee-policy field rejects non-zero fees,
   and an exceeded policy returns `FeeQuoteExceeded`;
6. batches require unique recipient addresses, forbid the source Safe as a recipient, quote
   each batch entry separately, sum gross debits, and apply every fee/amount/period cap before the
   first transfer.

The release verifier must re-read the live token's `getFees` behavior and GoodDollar identity
exemption for every protocol/garden Safe. A zero-fee or sender-pays result is acceptable; a
non-zero receiver-pays result blocks that route until GoodDollar changes the policy or a new
human-approved exact-net adapter is specified. A generic ERC-20 success return is not
settlement proof.

**CCIP command/acknowledgment contract.** There is no manual reporting or manual verification entrypoint. `SettlementModule` is both the Arbitrum command sender and authenticated acknowledgment receiver. It sends data only; `destTokenAmounts` is always empty. The Celo receiver rejects token-bearing messages, validates the source selector and encoded sender, and accepts only the frozen protocol version and tuple shape.

`executionKey = keccak256(abi.encode(sourceChainSelector, sourceSettlementModule, isBatch, settlementId, attempt))` is the value-execution idempotency boundary. The subject-type domain separator prevents a same-numbered disbursement and batch from sharing authority. Retrying transport keeps the same attempt/key, destination executor, route/version/gas snapshot, and payload hash and creates only a new command message ID. A peer rotation cannot reroute that key to a replacement executor. `CeloSettlementExecutor` stores the outcome before attempting the acknowledgment; duplicate commands on the bound executor cannot execute the Safe again. `retryAcknowledgment(executionKey)` reads the stored outcome and sends a new acknowledgment message without touching G$.

On Arbitrum, only an authenticated success acknowledgment for the subject's current execution key and attempt sets `Confirmed`. An authenticated failure acknowledgment sets `Failed` with its bounded `uint8 failureCode`. Duplicate acknowledgments, stale attempts, unsupported versions, wrong selectors/senders, and token-bearing messages never mutate a current subject. The acknowledgment's `originatingCommandMessageId` must be one of the initial or retry message IDs already mapped to the same execution key; it need not be the latest ID because CCIP delivery can be out of order. A timeout or manual-execution eligibility is not an authenticated failure and therefore cannot cancel, requeue, or create a new attempt.

**Consideration-status precedence**:

1. Confirmed after authenticated success acknowledgment → “support arrived.”
2. Cancelled from Queued → “this support was withdrawn before it was sent.”
3. Cancelled from Failed → “this support was closed after delivery could not complete.”
4. Failed after authenticated execution-failure acknowledgment.
5. Celo `SettlementExecutionStored` indexed but acknowledgment absent → gardener copy remains “support on its way”; steward/ops may show acknowledgment pending.
6. Dispatched without Celo execution → “support on its way”; after the configured service window, add a delivery-delayed recovery state without changing contract state.
7. Queued.
8. A finalized contributor plan has an unprepared non-zero row and
   `gardenerDeliveryEnabled == false` → delivery-disabled preparation guard. A beneficiary Safe
   remains preparable when its payer/beneficiary accounts are active; Draft contributor
   creation/edit/finalization and a zero-child garden-internal all-retained completion remain
   available.

Changing the delivery gate never hides an already queued or historical result. The gate controls
new contributor-payout preparation and gardener wallet sends; every existing settlement renders from its
own canonical or derived state.

CCIP manual-execution eligibility and native-fee shortage are operational conditions, not payment-failure states.

**Deliberate non-couplings**:
- The Arbitrum module never custodies G$ and CCIP never transports G$. It commits an authenticated bounded instruction only.
- It does **not** call `commitmentPoolingModule.recordConsiderationPaid`. `ConsiderationRail` makes the paths
  mutually exclusive: `considerationPaid` records only `ArbitrumExternal`, while
  `SettlementAcknowledged(success=true)` records `CeloSettlement`. Shared selectors still
  present one consideration status per commitment by precedence: settlement-module state if a
  disbursement exists, else pooling-module `considerationPaid`. “Support arrived” is reserved for
  Confirmed. Never double-count.
- `Pool.settlementEnabled` / `Pool.settlementAdapter` on the pooling module **stay reserved for transferable settlement vouchers and stay untouched** (false/zero). August settlement presence is derived from `settlementAccounts[garden].active` on this module. Implementers must not flip the pooling-module flag.

### 3.1.4 Implementation acceptance gates

- Full state-machine coverage: unbatched/batch queue → dispatch → Celo execute → acknowledgment → Confirmed; authenticated execution failure → Failed → per-entry requeue or terminal cancel; disbursement/batch key-domain separation for the same numeric ID and attempt; homogeneous batch kind/fundingRoute enforcement; same-key command retry on the exact snapshotted destination and rejection of cross-executor reroute/acknowledgment during peer grace; duplicate/out-of-order command delivery without duplicate payment; independent acknowledgment retry; contradictory success/failure-code pairs; individual cancel from unbatched Queued or Failed but never Dispatched; atomic whole-batch cancel while Queued and no partial queued-batch cancel; duplicate commitment queue, duplicate batch entry, batch limit zero rejecting batches while permitting exactly-one-recipient unbatched commands, re-disable from non-zero to zero, configured limit + 1, hard ceiling + 1, malformed payload, stale acknowledgment, wrong router/source/sender, and token-bearing CCIP messages revert or are ignored as specified.
- Binding tests: every contributor consideration derives source/executorGarden from the fulfilled
  commitment's **payer** garden Safe — the pool garden for a Request, the claiming garden for an
  Offer — and never from the provider garden when the two differ. Cover all four cases: garden
  Request and garden Offer must resolve payer == provider; a protocol-pool Request must spend the
  protocol Safe while paying either the claiming garden Safe or its individual contributors as
  claim type requires; a protocol-pool Offer must spend the claiming garden's Safe while paying
  protocol-team contributors. Recipient tests must cover
  both Request flavours: a `ClaimType.Garden` Request pays exactly one recipient, the claiming
  garden's active Celo Safe, and never fans out to its contributors; a `ClaimType.Individual`
  Request pays contributor accounts. An Offer always pays contributors regardless of claim type,
  and never pays its own claimant. A Garden-claimed Request's plan must carry exactly one
  immutable `GardenBeneficiary` shape and no contributor rows, must freeze the active beneficiary
  Safe, reject every attempt to edit it as a contributor plan, reject a non-zero
  `gardenRetainedAmount`, refuse creation/finalization/preparation/batching/dispatch while the
  relevant beneficiary account is missing or inactive, and remain independent of
  `gardenerDeliveryEnabled`. It has one payable child and cannot become Complete before that child
  is Confirmed. Finalization must reject a non-zero `gardenRetainedAmount` on any plan whose
  `payerGarden != providerGarden`. Creation rejects zero `payerGarden` before state mutation.
  Acknowledgment, failure, requeue, and cancel tests update identical parent counters for both
  commitment-bound kinds and never clear either stable child pointer.
  No garden's stewardship can create, edit, finalize, prepare, requeue, cancel, or
  directly dispatch a plan whose payer garden it does not steward: those actions resolve
  operator/owner Hats from the immutable payer/executor garden. A configured dispatcher can execute only a plan
  already finalized by that garden and has no editing or configuration authority.
  Every non-zero recipient derives from a frozen eligible contributor's Celo account; arbitrary,
  duplicate, inactive, non-contributor, or self-Safe recipients are impossible. Tests cover
  full sorted recognition-vector/hash verification against
  `CommitmentPoolingModule.validateRecognitionSnapshot`, rejection of a self-consistent but
  noncanonical vector/hash, recognition-copy defaults, immutable ascending contributor-order
  persistence and public enumeration, creation-time version-1 ordered `ContributorPayoutSet`
  emission for every initial row plus a matching trailing snapshot summary, caller-inaccessible
  payment weights, amount-derived deterministic weights, canonical full-consideration base-unit
  apportionment, a one-base-unit/multiple-contributor rounding-only default with no reason,
  deterministic fractional-remainder/address ties, reason-required noncanonical divergence,
  canonical all-zero payment weights without division, reason-required all-retained divergence,
  zero-payment exclusion, explicit retention, exact invariant equality, versioned atomic
  full-vector edits with a trailing summary/hash commit marker whose exact typed
  `PaymentSnapshotEntry[]` preimage excludes every mutable child field,
  explicit finalization before preparation/dispatch, idempotent one-child preparation from a
  frozen row, no draft/finalization orphan children, zero-child all-retained completion without CCIP,
  exact preparation retry after Confirmed/Failed/Cancelled and while paused/delivery-disabled,
  immutable `payoutPlanOfCommitment` across child/batch cancellation, partial completion,
  a Failed/Cancelled plus Queued/Dispatched mix remaining Pending until a child confirms or all
  active delivery ends, duplicate-recipient batch rejection before any fee quote or dispatch,
  independent failure/requeue, and multi-batch teams. No consideration, wrong rail/token, inactive payer,
  non-Fulfilled commitment, or a second plan reverts. Core `recordConsiderationPaid` symmetrically rejects
  `CeloSettlement`. ProtocolToGarden still derives its source/recipient/token independently.
- Gating tests: non-steward queue/dispatch reverts; source pause blocks queue/batch/dispatch/
  command-retry/requeue while permitting terminal cancellation and authenticated acknowledgments;
  destination pause rejects new execution without a result/negative acknowledgment while
  permitting stored acknowledgment retry; Celo execution requires the implementation's
  immutable router plus the active or unexpired previous Arbitrum peer;
  `CeloSettlementExecutor` is never a Safe owner; its Zodiac role cannot perform arbitrary calls;
  disabling gardener delivery permits plan creation/edit/finalization and all-retained local
  completion, while blocking non-zero contributor preparation/gardener sends but not the funding
  route.
- Configuration tests prove protocol garden/canonical G$ have no post-initialization setter,
  the implementation's immutable source selector matches the deployment chain's official CCIP
  selector, `DESTINATION_EVM_CHAIN_ID` matches every registered Celo account, and both chain
  identities are preserved across router upgrades,
  dispatcher authority is dispatch/retry-only, and every dispatch/retry/withdrawal preserves the
  observable native-fee floor.
- Storage-layout tests use generated layouts for both UUPS contracts and include dynamic batch-entry storage plus command/ack replay protection.
- Exact contract proof: `bun run --filter @green-goods/contracts test:match -- test/unit/Settlement.t.sol`, `bun run --filter @green-goods/contracts test:match -- test/unit/CeloSettlementExecutor.t.sol`, `bun run --filter @green-goods/contracts test:match -- test/integration/CCIPSettlement.t.sol`, `bun run --filter @green-goods/contracts test:match -- test/integration/DualChainSettlement.t.sol`, `bun run --filter @green-goods/contracts test:script`, `bun run --filter @green-goods/contracts build:full`, `bun run --filter @green-goods/contracts lint:check`, then `bun run --filter @green-goods/contracts test`. Focused unit cases prove both proxies initialize paused, trust-root/configuration setters reject unpaused calls, old/new dependency events are exact, incomplete unpause fails closed, and pause remains reachable after activation. The asynchronous Arbitrum-router/Celo-router fixture proves command/ack success, transport retries, acknowledgment retry, duplicate/out-of-order delivery, fee shortage, pause, bounded peer rotation, immutable-router cutover rehearsal, and measured batch execution.
- Required dry-run/post-check tooling: add repository Bun wrappers for a settlement plan,
  Celo executor dry run, Arbitrum module dry run, Safe/Roles configuration simulation, and a
  pre-release verifier. The strict verifier remains blocked until live routes, approved
  reserve/cap values, the frozen Commitment Pooling dependency, and production deployment
  evidence exist. Broadcast remains separately authorized.

Deployment artifacts are exact: `deployments/{chainId}-latest.json` gains
`settlementModule` on Arbitrum and `settlementExecutor` on Celo. The adjacent settlement
metadata records implementation/proxy where applicable, immutable router, active/previous
peer and peer expiry, immutable source selector plus destination EVM chain ID, configured
remote selector, gas limits, measured batch-size limit, code hashes,
deployment block, pause state, onchain reserve threshold, and
reviewed Commitment Pooling dependency code hash. Celo `settlement.routes` records every live
garden/Safe/Roles/role-key/probe tuple; strict verification reads and simulates those live
contracts instead of trusting a boolean. No broadcast, Safe role grant, ping, or value canary
is part of this implementation wave.

The 2026-07-23 planning snapshot records Arbitrum One selector
`4949039107694359620` and router `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8`,
plus Celo mainnet selector `1346049177634351622` and router
`0xfB48f15480926A4ADf9116Dca468bDd2EE6C5F62`;
~~the repository's Celo network entry remains zero until the implementation/configuration lane
is explicitly dispatched~~ — **superseded 2026-08-06: the Celo entry now holds both values and is
verified on chain by `bun run contracts:settlement:verify-lane`; see the amendment in §10.2.**
These values are evidence, not timeless constants. Immediately
before implementation, dry-run, and broadcast, the verifier must read the official Chainlink
CCIP directory, prove the Arbitrum One ↔ Celo lane in both directions, reject zero or mismatched
router/selector values, read router bytecode, and persist the source URL, observation time,
block, router/selector pair, and code hash in the settlement metadata.

**Selector serialization is a release-critical migration.** ✅ **Done 2026-08-06 — this paragraph
describes the problem, not remaining work.** All five `ccipChainSelector` entries are base-10
strings, read through the single parser `script/lib/NetworkSelectors.sol`, and three regression
tests reject the numeric form. Nothing below is outstanding for PRD-686.

CCIP selectors exceed JavaScript's
safe-integer range. `deployments/networks.json` ~~currently stores~~ *stored* non-zero selectors as
JSON numbers; a normal `JSON.parse` already rounds Arbitrum's official
`4949039107694359620` to `4949039107694360000`. The settlement implementation lane must
migrate every `ccipChainSelector` to a base-10 string, update Solidity/TypeScript consumers to
parse exact `uint64`/`bigint` values, and add a round-trip fixture for Ethereum, Sepolia,
Arbitrum, and Celo. All settlement deployment metadata and handoff evidence serialize
selectors as decimal strings. No lossy JS `number` representation is accepted.

## 4. `CeloSettlementExecutor` + Safe authority boundary

`CeloSettlementExecutor` is the planned Green Goods Celo contract and CCIP receiver. It must
own no G$, accept no CCIP token amounts, and expose no arbitrary target/calldata entrypoint.

- **Authenticated input**: the implementation's immutable CCIP router plus the active Arbitrum
  peer or its explicitly bounded unexpired predecessor; supported message version; data-only
  message. A paused executor reverts a new command before execution/result storage, allowing
  CCIP recovery after unpause without fabricating a business failure; stored acknowledgment
  retry remains available while paused. Any authentication mismatch reverts
  before business execution.
- **Derived execution**: command `executorGarden` resolves through `gardenRoutes` to the exact
  source Safe/Roles route. For a contributor child disbursement it is the fulfilled commitment's
  `payerGarden`; for `ProtocolToGarden` funding it is `protocolGarden`, while the target
  provider garden Safe is only the derived funding recipient. The two intents never share a
  command key or settlement record. The route contains a configured
  `safe` and exact `IZodiacRoles` modifier. The executor itself is the Roles member.
  Configuration verifies live Safe/route code, a 1:1 Safe↔garden mapping, Safe non-ownership,
  Roles avatar/target equality, enabled executor membership, assignment to the exact non-zero
  `bytes32 roleKey`, and the reviewed condition tree for that role.
  Once configured, a garden cannot be retargeted to another Safe or Roles modifier; executor
  replacement uses the bounded peer-rotation path. Router replacement uses the paused,
  old-message-drained implementation-upgrade cutover and never a router setter. Canonical G$ is immutable contract
  configuration; token, target, selector, and calldata are never payload fields. The executor enforces
  `maxBatchSize`, `maxTransferAmount`, `maxBatchAmount`, and a fail-closed per-garden
  periodic cap. Every amount cap measures the Safe's gross debit, including a supported
  sender-paid G$ fee, while the command amount remains the promised net receipt.
  Non-zero fees also pass both owner-configured limits: `maxFeeBps <= 10_000` and
  `maxFeeAmount`; the proportional calculation uses overflow-safe `Math.mulDiv` with
  round-down semantics. `setFeePolicy(uint16 maxFeeBps, uint256 maxFeeAmount)` is owner-only
  and requires pause. A zero value in either field deliberately blocks non-zero fees.
  `setPeriodicCap(uint64 periodDuration, uint256 maxPeriodAmount)` is
  owner-only and requires pause; zero policy values intentionally reject execution until the
  human-approved production policy is set. `gardenPeriodSpends` resets each configured period.
- **Idempotency**: `executionResults[executionKey]` is written before acknowledgment
  dispatch, including the exact authenticated current/previous source peer that sent the
  command. A duplicate command never calls the route again. If the stored acknowledgment is
  still pending, the duplicate delivery may retry it.
- **Independent acknowledgment**: execution outcome and acknowledgment delivery are separate.
  `quoteAcknowledgmentFee` quotes the current router. Permissionless
  `retryAcknowledgment(executionKey)` requires the exact caller-supplied CELO fee and never
  consumes the protocol reserve; owner-only `retryAcknowledgmentSponsored` uses the reserve
  while preserving its onchain minimum. Either path can resend even after a prior successful
  CCIP submission because the Arbitrum terminal handler is idempotent. Automatic acknowledgment
  after execution and sponsored retry emit `AcknowledgmentDeferred` when quote, reserve, or send
  failure prevents submission. A caller-funded retry requires the exact quote and reverts on
  send failure so the caller's CELO is returned atomically. `AcknowledgmentSent.reserveFunded`
  distinguishes reserve spend from caller-funded retry; there is no separate
  `acknowledgmentPending()` view. Every initial/retried acknowledgment targets the execution
  result's stored `acknowledgmentReceiver`, never whatever source peer happens to be active
  later, and reuses the stored command `protocolVersion`; this preserves in-flight return
  routing and ABI compatibility during bounded peer rotation.
- **Bounded authority boundary**: the contract constructs only canonical-G$
  `transfer(address,uint256)` calls and sends them through
  Zodiac Roles v2
  `execTransactionWithRoleReturnData(gDollarToken, 0, transferCalldata, SafeOperation.Call, roleKey, true)`;
  no payload field controls target, selector, role key, or calldata. The explicit stored
  `bytes32 roleKey` avoids dependence on a mutable default-role mapping, and
  `shouldRevert = true` makes a denied or failed inner call fail closed. The full batch runs
  in one non-reentrant executor transaction. Every Roles call targets canonical G$ directly;
  the role never grants a self-call or arbitrary batch target. Any rejected, reverted, or
  false-returning transfer reverts the outer transaction and rolls back all earlier recipients.
  Canonical G$ is also an ERC-777/SuperToken, so the adapter performs no untrusted callback
  after the token call, requires unique recipients in a batch, and checks exact source and
  recipient balance deltas inside the same non-reentrant transaction. Fee quotes and all
  gross-debit caps are checked before execution. The receiver reserves the execution key, then
  invokes an `onlySelf` bounded execution subcall inside `try/catch`. A Safe/token revert or
  balance-delta mismatch rolls back every transfer in that subcall while the outer receiver
  stores one negative idempotent outcome and can still acknowledge it. The outer CCIP receiver
  is `nonReentrant`; the `onlySelf` adapter exposes no public execution authority.
  Strict deployment verification reads the live
  Safe and Roles configuration and probes allowed transfer plus denied selector/target calls.
  The production Roles condition tree and governance transactions remain a Release gate.
- **Ownership**: the executor uses `OwnableUpgradeable`; the owner can configure garden routes, update caps,
  update the reserve minimum, rotate the authenticated peer under pause, withdraw only excess
  reserve, and pause. The router changes only through the paused/drained implementation upgrade
  path. Production ownership by the approved timelock is checked by deployment
  verification and remains a human-governed Release invariant.
- **Pause semantics**: pause blocks new command execution and all value-policy changes occur
  while paused. It does not block fee funding, guarded excess withdrawal, or retry of an
  already stored acknowledgment. A paused delivery has no execution result and no negative
  business acknowledgment.
- **Failure semantics**: authenticated commands store and negatively acknowledge
  `GardenRouteUnavailable`, `InvalidRecipient`, `BatchSizeExceeded`,
  `TransferAmountExceeded`, `BatchAmountExceeded`, `PeriodCapExceeded`, `RouteRejected`,
  `RouteReverted`, `UnsupportedReceiverPaysFee`, `FeeQuoteExceeded`, or
  `BalanceDeltaMismatch`. Authentication, unsupported version, token-bearing messages, and malformed
  tuple shape revert before an execution result is stored.

The implementation hand-declares the minimal reviewed Safe/Zodiac ABI locally; it adds no
Solidity Safe or Zodiac dependency. Safe deployment addresses and bytecode hashes are consumed
as pinned data from the official Safe v1.4.1 deployment registry. If the implementation later
chooses `@safe-global/safe-deployments` as a JavaScript dependency instead, that install requires
fresh explicit owner approval. The adapter ABI is:

```solidity
enum SafeOperation { Call, DelegateCall }

interface IZodiacRoles {
    function execTransactionWithRoleReturnData(
        address to,
        uint256 value,
        bytes calldata data,
        SafeOperation operation,
        bytes32 roleKey,
        bool shouldRevert
    ) external returns (bool success, bytes memory returnData);
}
```

For canonical G$ `transfer`, the executor additionally requires `returnData.length == 32` and
`abi.decode(returnData, (bool)) == true`. `shouldRevert = true` closes the failed-call path;
the explicit return-value check closes a non-reverting ERC-20 `false` path.

Command-shape validation uses the authenticated `isBatch` field: `false` requires exactly one
recipient/amount pair; `true` requires 1–`maxBatchSize`, and fails with
`BatchSizeExceeded` when batching is disabled or the measured limit is exceeded. Both shapes
require equal arrays, non-zero recipients/amounts, and the configured transfer, aggregate, and
fee/period policies. A recipient may never equal the source Safe. For `Funding`, every recipient
must be a different active registered garden Safe
(`safeToGarden[recipient] != address(0)` and active). `GardenBeneficiary` applies the same
registered-active-garden-Safe predicate but remains commitment-bound. For
`ContributorConsideration`, the authenticated source module remains authoritative for the derived
contributor account while Celo still enforces non-zero address, source-Safe inequality, role
conditions, and value caps. `gardenerDeliveryEnabled` is a source-side authorization gate only for
`ContributorConsideration`; it never gates a registered Safe recipient.

### 4.1 Frozen Celo implementation, storage, and ABI

`CeloSettlementExecutor` uses `UUPSUpgradeable` + `OwnableUpgradeable` +
`ReentrancyGuardUpgradeable`, with `_disableInitializers()` in the implementation constructor.
Its implementation constructor takes exactly `(address ccipRouter_, address gDollarToken_)`;
both non-zero values are immutable implementation arguments exposed as `CCIP_ROUTER()` and
`G_DOLLAR_TOKEN()`. The proxy initializer never accepts either value. A router change therefore
requires a new implementation built with the approved router, an owner-authorized UUPS upgrade
while paused, and the drained-message/code-hash verifier. `_authorizeUpgrade` is owner-only and
reverts unless paused. The verifier rejects a replacement whose immutable G$ differs from the
current implementation. No router or token setter exists.

Frozen Celo types:

```solidity
enum ResultStatus { None, Success, Failed }
enum AcknowledgmentDeferralCode { None, QuoteFailed, FeeReserveLow, SendFailed }

struct SourcePeer {
    uint64 sourceChainSelector;
    address sourceSettlementModule;
    address previousSourceSettlementModule;
    uint64 previousPeerExpiresAt;
    uint8 protocolVersion;
}

struct GardenRoute {
    address safe;
    address rolesModifier;
    bytes32 roleKey;
    bytes32 allowanceKey;
    bytes32 permissionsConfigHash;
    bool active;
}

struct ExecutionResult {
    bytes32 commandMessageId;
    bytes32 acknowledgmentMessageId;
    address acknowledgmentReceiver; // exact authenticated source peer for this command
    uint8 protocolVersion; // decoded command version; acknowledgment retries reuse it
    ResultStatus status;
    FailureCode failureCode;
    AcknowledgmentDeferralCode acknowledgmentDeferralCode;
    bool acknowledgmentSent;
}

struct GardenPeriodSpend {
    uint64 periodStartedAt;
    uint256 amount;
}
```

Frozen Celo proxy storage, after inherited upgrade/ownership/reentrancy storage:

| # | Entry | Type |
|---|---|---|
| 1 | `sourcePeer` | `SourcePeer` |
| 2 | `gardenRoutes` | `mapping(address garden => GardenRoute)` |
| 3 | `safeToGarden` | `mapping(address safe => address garden)` (enforces 1:1 binding) |
| 4 | `executionResults` | `mapping(bytes32 executionKey => ExecutionResult)` |
| 5 | `maxBatchSize` | `uint16` (0 disables batch commands only; cannot exceed 24) |
| 6 | `maxTransferAmount` | `uint256` (0 rejects execution) |
| 7 | `maxBatchAmount` | `uint256` (0 rejects execution) |
| 8 | `periodDuration` | `uint64` (0 rejects execution) |
| 9 | `maxPeriodAmount` | `uint256` (0 rejects execution) |
| 10 | `gardenPeriodSpends` | `mapping(address garden => GardenPeriodSpend)` |
| 11 | `acknowledgmentFeeReserveMinimum` | `uint256` (native CELO floor) |
| 12 | `paused` | `bool` |
| 13 | `maxFeeBps` | `uint16` (0 rejects non-zero G$ fees; cannot exceed 10,000) |
| 14 | `maxFeeAmount` | `uint256` (0 rejects non-zero G$ fees) |
| 15 | `__gap` | expected `uint256[36]`; the compiler-generated baseline confirms the final length before interface/storage freeze |

Exact target interface:

```solidity
interface ICeloSettlementExecutor {
    /// @notice Initializes with paused == true. Source peer, caps, fee/period
    ///         policy, reserve floor, and garden routes are configured while paused.
    function initialize(
        address owner_,
        uint64 sourceChainSelector_,
        address sourceSettlementModule_,
        uint8 protocolVersion_
    ) external;

    function configureGardenRoute(
        address garden,
        address safe,
        address rolesModifier,
        bytes32 roleKey,
        bytes32 allowanceKey,
        bytes32 permissionsConfigHash
    ) external;
    function setGardenRouteActive(address garden, bool active) external;
    function setSourcePeer(
        address sourceSettlementModule,
        uint8 protocolVersion,
        uint64 previousPeerGraceSeconds
    ) external;
    function setCaps(
        uint16 maxBatchSize_,
        uint256 maxTransferAmount_,
        uint256 maxBatchAmount_
    ) external;
    function setFeePolicy(uint16 maxFeeBps_, uint256 maxFeeAmount_) external;
    function setPeriodicCap(uint64 periodDuration_, uint256 maxPeriodAmount_) external;
    function setAcknowledgmentFeeReserveMinimum(uint256 minimum) external;
    function setPaused(bool paused_) external;

    function retryAcknowledgment(bytes32 executionKey) external payable returns (bytes32 messageId);
    function retryAcknowledgmentSponsored(bytes32 executionKey) external returns (bytes32 messageId);
    function quoteAcknowledgmentFee(bytes32 executionKey) external view returns (uint256);
    function fundAcknowledgmentFees() external payable;
    function withdrawExcessAcknowledgmentFees(address payable recipient, uint256 amount) external;

    function gardenRouteOf(address garden) external view returns (GardenRoute memory);
    function executionResultOf(bytes32 executionKey) external view returns (ExecutionResult memory);
    function sourcePeer() external view returns (SourcePeer memory);
    function gardenPeriodSpend(address garden) external view returns (GardenPeriodSpend memory);
    function acknowledgmentFeeReserveMinimum() external view returns (uint256);
    function nativeFeeBalance() external view returns (uint256);
    function isAcknowledgmentFeeReserveLow() external view returns (bool);
    function maxBatchSize() external view returns (uint16);
    function maxTransferAmount() external view returns (uint256);
    function maxBatchAmount() external view returns (uint256);
    function maxFeeBps() external view returns (uint16);
    function maxFeeAmount() external view returns (uint256);
    function periodDuration() external view returns (uint64);
    function maxPeriodAmount() external view returns (uint256);
    function paused() external view returns (bool);
    function HARD_MAX_BATCH_SIZE() external pure returns (uint256);
    function CCIP_ROUTER() external view returns (address);
    function G_DOLLAR_TOKEN() external view returns (address);
}
```

`configureGardenRoute` is write-once for the garden/Safe/Roles tuple and immutable
`permissionsConfigHash`. That hash commits only the Safe, Roles address, role/allowance keys,
canonical G$, exact `transfer` selector, and condition-tree shape. It explicitly excludes
`maxBatchSize`, transfer/batch/fee/period caps, spent allowance, and other mutable policy state,
which remain independently evented and verified. Deactivation is reversible;
retargeting is not. A replacement Safe or Roles modifier requires a new executor proxy deployment
and bounded source-peer migration rather than mutating the existing route. All configuration and
policy setters require pause. `setCaps` accepts `maxBatchSize_` from 0 through 24; zero disables
only commands whose authenticated tuple has `isBatch == true`. An unbatched command must have
exactly one recipient and remains executable when `maxBatchSize == 0`; zero
`maxTransferAmount` or `maxBatchAmount` still fails all value execution closed. Source chain
selector is write-once at initialization. `setFeePolicy` rejects `maxFeeBps > 10_000`; zero
values are valid fail-closed configuration, not an unlimited policy. Same-selector/same-version
peer rotation stores only the immediately previous module with a bounded expiry. Protocol-version
change requires a paused/drained zero-grace cutover and clears the previous peer. A second peer or
version rotation while the stored previous peer remains inside its inclusive grace window reverts
rather than discarding that peer's promised authority. A same-route
maintenance call may only extend the existing previous peer's expiry, capped at 30 days from
the call; it cannot shorten expiry, revive a cleared peer, or change peer order. The inherited
UUPS upgrade surface is intentionally absent from the consumer interface;
the implementation test proves owner-only `_authorizeUpgrade`, pause, immutable-router change,
unchanged G$, and the external drained-message precondition.

Initialization sets `paused = true`. Pausing is always owner-callable. Unpause rejects with
`ExecutorNotReady` until the source selector/module/version, transfer and aggregate caps,
period duration/cap, and acknowledgment reserve floor are non-zero; the fee policy may remain
zero only as the documented fail-closed no-fee configuration. This readiness check does not
pretend a route exists: every command still requires its exact active garden route.
Initialization emits the first `SourcePeerUpdated` and `PausedSet(true)` events so the executor
configuration seed is replayable without a deployment callback.

Exact pre-execution errors:

```solidity
error InvalidCcipSource();
error ZeroAddress();
error InvalidCcipSender();
error CcipTokensNotAllowed();
error UnsupportedMessageVersion();
error MalformedSettlementCommand();
error UnknownExecutionKey(bytes32 executionKey);
error GardenRouteAlreadyConfigured(address garden);
error SafeAlreadyAssigned(address safe, address garden);
error PolicyNotConfigured();
error InvalidFeePolicy(uint16 maxFeeBps, uint256 maxFeeAmount);
error IncorrectAcknowledgmentFee(uint256 quoted, uint256 supplied);
error AcknowledgmentFeeReserveFloorViolated(uint256 requiredMinimum, uint256 remainingBalance);
error ExecutorMustBePaused();
error ExecutorNotReady();
error ImmutableGdollarMismatch(address currentToken, address replacementToken);
```

Required Celo events:

```solidity
event SourcePeerUpdated(
    uint64 indexed sourceChainSelector,
    address indexed sourceSettlementModule,
    address indexed previousSourceSettlementModule,
    uint64 previousPeerExpiresAt,
    uint8 protocolVersion
);
event GardenRouteConfigured(
    address indexed garden,
    address indexed safe,
    address indexed rolesModifier,
    bytes32 roleKey,
    bytes32 allowanceKey,
    bytes32 permissionsConfigHash
);
event GardenRouteStatusChanged(address indexed garden, bool active);
event CapsUpdated(uint16 maxBatchSize, uint256 maxTransferAmount, uint256 maxBatchAmount);
event FeePolicyUpdated(uint16 maxFeeBps, uint256 maxFeeAmount);
event PeriodicCapUpdated(uint64 periodDuration, uint256 maxPeriodAmount);
event AcknowledgmentFeeReserveMinimumUpdated(uint256 previousMinimum, uint256 minimum);
event AcknowledgmentFeeReserveFunded(address indexed funder, uint256 amount);
event ExcessAcknowledgmentFeesWithdrawn(address indexed recipient, uint256 amount);
event PausedSet(bool paused);
event SettlementExecutionStored(
    bytes32 indexed executionKey,
    bytes32 indexed commandMessageId,
    address indexed executorGarden,
    address acknowledgmentReceiver,
    uint8 protocolVersion,
    bool isBatch,
    uint256 settlementId,
    uint32 attempt,
    ResultStatus status,
    FailureCode failureCode
);
event DuplicateSettlementMessage(bytes32 indexed executionKey, bytes32 indexed commandMessageId);
event AcknowledgmentSent(
    bytes32 indexed executionKey,
    bytes32 indexed commandMessageId,
    bytes32 indexed acknowledgmentMessageId,
    uint256 fee,
    bool reserveFunded
);
event AcknowledgmentDeferred(
    bytes32 indexed executionKey,
    bytes32 indexed commandMessageId,
    AcknowledgmentDeferralCode reasonCode
);
```

- **Safes — one per garden, 1:1 mapping, every garden eligible**: the existing GG protocol
  Safe covers the protocol pool; each participating garden gets exactly one Celo Safe
  attributed to its Arbitrum garden account. Deployment is on-demand and Release-gated. The
  implementation lane must add a `settlement-safe` **dry-run/predict/deploy/verify** target,
  but no broadcast is authorized by this plan. The command consumes reviewed governance
  inputs and never invents owners.
- **Deterministic Safe address is fully specified**: use the official released Safe v1.4.1
  `SafeProxyFactory.createProxyWithNonce` and `SafeL2` singleton recorded for the target chain
  in `@safe-global/safe-deployments`. During the temporary address-bootstrap stage, the initializer
  contains the sorted deployment EOA and existing Celo Garden recovery Safe, threshold 1, zero
  setup delegatecall, the released compatibility fallback handler, and zero payment
  token/amount/receiver. `saltNonce =
  uint256(keccak256(abi.encode("GG_COMMITMENT_POOL_SAFE_V1",
  uint64(sourceProtocolChainId), garden)))` (`42161` in production, `421614` in the Sepolia
  rehearsal).
  Prediction hashes the exact factory, singleton, initializer bytes, and salt nonce; changing
  any owner, handler, Safe release, or chain deployment changes the predicted address and
  requires a new reviewed artifact. The existing protocol Safe is verified and registered,
  never redeployed. The dry-run persists all inputs, predicted address, code hashes, and
  factory/singleton/fallback-handler versions before any broadcast.
- **Temporary owner bootstrap**: before the final Garden-controlled address is available, a Safe
  may exist as exactly 1-of-2 with the deployment EOA and the existing Celo Garden recovery Safe.
  The recovery Safe must reread as module-free 2-of-3. The Garden Safe must have zero native and
  canonical-G$ balance, no guard, no modules, and no Zodiac or executor authority. The deployment
  EOA may later replace itself with one exact reviewed Garden owner through a nonce-bound,
  receipt-backed `swapOwner` Safe transaction. The script derives `prevOwner` from the live linked
  list and fails on any owner, threshold, balance, module, or replacement mismatch. This staged
  owner set is address preparation only and may never be registered as active settlement custody.
- **Owner set before value activation**: exactly 2-of-3 for the pilot — the protocol recovery
  multisig, the Dev Guild recovery multisig, and one named garden recovery delegate who can
  sign on Celo. Deployment fails if an owner is duplicated, zero, unnamed in the artifact, or
  also configured as an executor. The Arbitrum garden account is the canonical attribution and
  salt input. A later Garden-account substitution still requires the two production gates below.
- **Signer scoping (one Zodiac Roles Modifier; no AllowanceModule)**: deploy or verify one
  Roles Modifier whose avatar and target are the Safe. `CeloSettlementExecutor`—not an
  operator key—is assigned to the exact `roleKey`. That role permits only canonical G$
  `transfer(address,uint256)` and references a centrally defined native Roles allowance
  through `WithinAllowance(allowanceKey)` on the amount argument. The executor independently
  enforces gross-debit per-transfer, batch, and period caps so GoodDollar fees cannot bypass
  the calldata allowance. No separate Allowance Module contract exists in this topology.
  Removing the role still leaves the final 2-of-3 recovery owners able to rotate modules safely.
- **Artifact and hash split**: `packages/contracts/deployments/{chainId}-settlement-safes.json`
  records garden, Safe, sorted owners, threshold, factory/singleton/handler, initializer hash,
  salt nonce, Roles address, exact `roleKey`, exact `allowanceKey`, normalized permission
  condition tree, scoped selector, caps, code hashes, and receipt blocks.
  `recoveryConfigHash = keccak256(abi.encode(chainId, safe, sortedOwners, uint8(2)))`;
  `permissionsConfigHash` separately commits the immutable Safe, Roles address,
  role/allowance keys, canonical G$, exact selector, and condition-tree shape. It excludes
  mutable caps, fee/period policy, current period spend, and live allowance balances. Arbitrum
  registration persists the same immutable hash; policy events and live reads prove mutable
  limits independently.
  Strict verification reads the live Safe owner set, enabled modules, Roles avatar/target,
  executor membership, role assignment, allowance, and allowed/denied probe results; a stored
  hash alone is never proof of later Celo configuration.
- **Ownership nuance (named honestly)**: the current AccountV3 implementation does not treat the
  Arbitrum Garden NFT owner as a signer on Celo because the bound token is on a foreign chain. The
  fork proof in `erc6551-garden-safe-owner-spike.md` shows that a guardian-trusted executor can make
  a foreign Garden account satisfy one owner slot in a real threshold-2 Safe alongside one
  recovery owner, while both recovery owners retain the recovery path. That is mechanics, not a
  production authorization design: the exact Arbitrum implementation/account is not deployed at
  the same address on Celo and no Garden-bound authenticated relay exists. The pilot therefore
  keeps the three named recovery owners above. A later owner-set change requires both missing
  gates to close and is not required for base settlement.
- **Gas**: the Arbitrum module holds monitored native ETH for outbound commands; the Celo executor holds monitored native CELO for acknowledgments. Neither route uses LINK fee payment. Fee shortage is surfaced before dispatch where possible and is never presented as settlement failure. Gardener receipts are pure ERC-20 transfers; gardener sends use sponsored gas (§5).

## 5. Gardener receipt + multi-chain app

**Decision (register #16)**: gardeners receive at **same-address smart accounts on Celo** — the same passkey-owned account address they have on Arbitrum, counterfactually deployable on Celo.

- **Verification spike (first week of the implementation track, blocking only gardener
  delivery)**: Pimlico's current official
  [supported-chains page](https://docs.pimlico.io/guides/supported-chains) distinguishes chain
  support from account-implementation support. EntryPoint v0.7
  `0x0000000071727De22E5E9d8BAf0edAc6f37da032` is listed on Arbitrum One (`42161`), Arbitrum
  Sepolia (`421614`), Celo Mainnet (`42220`), and Celo Sepolia (`11142220`). The shared wallet,
  however, currently constructs Kernel `0.3.1` accounts. Pimlico lists Kernel `0.3.1` with v0.7
  on Arbitrum One, Arbitrum Sepolia, and Celo Mainnet, but **not** on Celo Sepolia. Celo Sepolia
  lists Kernel `0.2.4` with v0.7. Therefore Celo Mainnet is not blocked by this provider matrix;
  only an exact production-stack rehearsal on Celo Sepolia is unavailable.
- **Frozen workaround — two evidence tiers, no silent account migration**:
  1. **Testnet mechanics** use a test-only Kernel `0.2.4` profile on both Arbitrum Sepolia and
     Celo Sepolia. Shared adds explicit `421614` and `11142220` Pimlico endpoints plus a typed
     account-profile registry; both testnets must use the same Kernel version, EntryPoint,
     factory/implementation recipe, initializer, passkey owner, and salt so they derive the same
     counterfactual address. The Celo Sepolia policy is bounded to `11142220` and the surrogate
     transfer selector. One included sponsored first-use deploy-and-surrogate-transfer
     UserOperation proves chain switching, passkey validation, sponsorship, deployment, receipt,
     EntryPoint event, code, and exact surrogate balance deltas. This is explicitly
     **non-production account-stack evidence** and never enables gardener delivery by itself.
  2. **Production compatibility and enablement** remain Kernel `0.3.1`. Before
     `gardenerDeliveryEnabled` can become true, verify the exact production factory,
     implementation, initializer, passkey owner, and salt derive the same counterfactual address
     on Arbitrum One and Celo Mainnet; verify their chain-local code hashes and the bounded
     `42220` policy; then, under separate human authorization, include one minimum-value sponsored
     first-use Celo Mainnet UserOperation that deploys the account and transfers canonical G$.
     Exit requires the UserOperation receipt, included transaction receipt, EntryPoint
     `UserOperationEvent`, deployed-account code, and exact canonical-G$ source/recipient deltas.
     A Celo Mainnet fork proves token semantics before this live canary but cannot replace the
     included sponsored receipt.
- Both tiers record chain ID, account profile/version, provider and endpoint host,
  EntryPoint/factory/implementation addresses and code hashes, initializer hash, account salt,
  policy identifier, userOp hash, transaction hash, receipt block, sender/recipient deltas, and
  observation time in a private test/release evidence artifact. Never persist API keys or passkey
  material, and never copy wallet/account identifiers into Linear. The existing unversioned
  `erc4337EntryPoint` deployment-registry value remains an explicitly legacy v0.6 fact; the lane
  adds a versioned v0.7 key and never silently reinterprets the old address. Provider listing,
  testnet-only evidence, supported-entry-point response, simulation, or paymaster signature
  without the exact production receipt does not enable delivery.
- **Failure behavior**: if the spike fails, `gardenerDeliveryEnabled` remains false. ProtocolToGarden settlement may continue, but contributor-payout preparation, automated gardener delivery, and gardener G$ sends remain blocked. There is no alternate gardener-delivery path.

**Multi-chain app (register #17)** — the Single Chain principle amends to: **primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo, 42220) for value legs**. The CLAUDE.md principle edit rides the implementation PR, not this spec. August scope, all tiers:

| Tier | What ships | Notes |
|---|---|---|
| Reads | Celo Safe balances (admin funding views), gardener G$ balance (WalletDrawer only after the AA gate), command/execution/ack status everywhere | Status combines Arbitrum `SettlementModule` events with bounded Celo `CeloSettlementExecutor` events; balances use Celo RPC. Shared selectors distinguish queued, dispatched, executed/ack-pending, confirmed, failed, and delayed. |
| Operator writes | Queue and dispatch a command; retry the same command after transport delay; retry a stored Celo acknowledgment when fee/delivery recovers; create a new logical attempt only after authenticated execution failure. | Once dispatched, timeout alone cannot cancel or requeue the payment. |
| Gardener writes | Send G$ from the wallet on Celo: chain-aware send flow with **sponsored gas** (gardeners never hold CELO) | Entire row is gated by `gardenerDeliveryEnabled`; if the AA spike fails it does not ship. When enabled, this is an explicit online wallet action, never an offline job; `transfer` uses `{ chainId, token, to, amount }`. |

Shared substrate additions (current lane PRD-723; extends historical PRD-674's scope via this spec): settlement chain registry (`{ primary, settlement }` chain config), second public client, G$ token config, `queryKeys.settlement.*` family, settlement/disbursement hooks + selectors (including the consideration-status precedence rule from §3.1.3), and an online wallet `transfer` capability that is unavailable while `gardenerDeliveryEnabled == false`.

## 6. Indexer

Envio indexes Green Goods protocol events from both the Arbitrum `SettlementModule` and Celo `CeloSettlementExecutor`. It does **not** index raw G$ transfers or arbitrary Celo token events. The Celo event slice is necessary to distinguish “executed; acknowledgment pending” from “not delivered.” New config blocks use deployment-artifact placeholders pre-broadcast.

**Register #103 read-model target, documentation only.** The later indexer dispatch adds the
`CommitmentFunding` entity and maps `Refund`; this phase does not edit `packages/indexer/`. Until
that dispatch, the live GraphQL `DisbursementKind` representation intentionally remains at its
existing four Solidity-backed kinds (plus `UNKNOWN`). The dated ontology drift baseline owns that
temporary mismatch. Funding rows derive only from the four funding events plus the existing
claim, commitment, payout-plan, `DisbursementQueued`, requeue/cancel, and authenticated
acknowledgment events. Raw Celo transfers remain outside the indexer boundary.

```graphql
enum DisbursementState { UNKNOWN QUEUED DISPATCHED CONFIRMED FAILED CANCELLED }
enum DisbursementKind { UNKNOWN CONTRIBUTOR_CONSIDERATION FUNDING LOAN_PRINCIPAL GARDEN_BENEFICIARY REFUND }
enum FundingState { UNKNOWN PLEDGED DEPOSIT_RECORDED CONSUMED CLOSED REFUND_QUEUED REFUNDED WITHDRAWN }
enum FundingRoute { UNKNOWN NONE PROTOCOL_TO_GARDEN }
enum CommitmentSettlementFlow { UNKNOWN INTERNAL PROTOCOL_TO_GARDEN GARDEN_TO_PROTOCOL GARDEN_TO_GARDEN }
enum SettlementExecutionStatus { UNKNOWN SUCCESS FAILED }
enum CommitmentPayoutPlanStatus { DRAFT PENDING PARTIAL COMPLETE FAILED }

type SettlementConfiguration {
  id: ID! # chainId-settlement-config
  chainId: Int!
  role: String! # SOURCE or EXECUTOR
  gardenerDeliveryEnabled: Boolean # nullable SOURCE only; null = unknown/not configured and never ready
  protocolGarden: String # SOURCE only; write-once initializer fact
  gDollarToken: String! # source initializer or executor immutable artifact fact
  hatsModule: String # SOURCE only; event-owned mutable trust root
  commitmentPoolingModule: String # SOURCE only; event-owned mutable trust root
  localContract: String! # indexed SettlementModule or CeloSettlementExecutor address
  localRouter: String!
  localChainSelector: BigInt!
  remoteChainSelector: BigInt # nullable until an exact supported lane is verified
  remoteEvmChainId: Int # nullable until verified deployment pairing; never derived from selector arithmetic
  activePeer: String # nullable before peer wiring; a test peer is not lane evidence
  previousPeer: String
  previousPeerExpiresAt: BigInt
  protocolVersion: Int!
  dispatcher: String # SOURCE only; null means delegated dispatch disabled
  batchSizeLimit: Int!
  maxTransferAmount: BigInt # EXECUTOR only
  maxBatchAmount: BigInt # EXECUTOR only
  maxFeeBps: Int # EXECUTOR only
  maxFeeAmount: BigInt # EXECUTOR only
  periodDuration: Int # EXECUTOR only
  maxPeriodAmount: BigInt # EXECUTOR only
  feeReserveMinimum: BigInt!
  nativeFeeBalance: BigInt!
  feeReserveLow: Boolean!
  peerConfigured: Boolean!
  paused: Boolean!
  updatedAt: Int!
}

type SettlementAccount {
  id: ID! # chainId-lowercaseGarden
  chainId: Int!
  garden: String!
  gardenId: String! # relationship to documented bare-address Garden.id
  accountChainId: Int!
  account: String!
  active: Boolean!
  recoveryConfigHash: String!
  recoveryThreshold: Int!
  recoveryOwners: [String!]!
  rolesModifier: String!
  roleKey: String! # bytes32 Zodiac Roles v2 key
  allowanceKey: String! # native Roles WithinAllowance key
  permissionsConfigHash: String!
  updatedAt: Int!
}

type SettlementGardenRoute {
  id: ID! # executorChainId-lowercaseGarden
  chainId: Int! # executor chain, 42220 for the pilot
  sourceChainId: Int! # source Garden identity chain, 42161 for Arbitrum One
  garden: String!
  gardenId: String! # relationship to documented bare-address Garden.id on sourceChainId
  settlementAccountId: String! # sourceChainId-lowercaseGarden
  safe: String!
  rolesModifier: String!
  roleKey: String! # bytes32 Zodiac Roles v2 key
  allowanceKey: String!
  permissionsConfigHash: String!
  active: Boolean!
  configuredAt: Int!
  updatedAt: Int!
}
type CommitmentFunding {
  id: ID! # chainId-fundingId
  chainId: Int!
  fundingId: BigInt!
  pledgeSeen: Boolean!
  commitmentId: BigInt
  commitmentEntityId: String
  funder: String
  garden: String
  gardenId: String
  refundAccount: String
  expectedAmount: BigInt
  depositedAmount: BigInt!
  depositReference: String
  state: FundingState!
  refundDisbursementId: BigInt
  refundDisbursementEntityId: String
  pledgeBlockNumber: BigInt
  pledgeLogIndex: Int
  depositBlockNumber: BigInt
  depositLogIndex: Int
  consumeBlockNumber: BigInt
  consumeLogIndex: Int
  withdrawBlockNumber: BigInt
  withdrawLogIndex: Int
  pledgedAt: Int
  depositRecordedAt: Int
  consumedAt: Int
  withdrawnAt: Int
  closedAt: Int
  updatedAt: Int!
}

# Bounded replay join. Refund disbursements carry commitmentId + funder but no fundingId;
# the index may therefore exist before FundingPledged and retain one stable Refund child.
type CommitmentFundingIndex {
  id: ID! # chainId-commitmentId-lowercaseFunder
  chainId: Int!
  commitmentId: BigInt!
  commitmentEntityId: String!
  funder: String!
  fundingId: BigInt
  fundingEntityId: String
  refundDisbursementId: BigInt
  refundDisbursementEntityId: String
  updatedAt: Int!
}
type Disbursement {
  id: ID! # chainId-disbursementId
  chainId: Int!
  disbursementId: BigInt!
  garden: String!
  gardenId: String! # relationship to documented bare-address Garden.id on the source chain
  executorGarden: String!
  executorGardenId: String! # relationship to documented bare-address Garden.id on the source chain
  commitmentId: BigInt
  commitmentEntityId: String
  payoutPlanId: BigInt payoutPlanEntityId: String contributor: String contributorEntityId: String
  fundingId: BigInt fundingEntityId: String
  settlementFlow: CommitmentSettlementFlow # commitment-bound only; null for Funding/LoanPrincipal
  kind: DisbursementKind! fundingRoute: FundingRoute! source: String!
  recipient: String! token: String! amount: BigInt!
  state: DisbursementState! batchId: BigInt batchEntityId: String reasonCID: String
  attempt: Int! executionKey: String commandMessageId: String dispatchedAt: Int
  celoExecutionTx: String acknowledgmentMessageId: String confirmedAt: Int failureCode: Int
  cancelledFromState: DisbursementState
  createdAt: Int! updatedAt: Int!
}

type CommitmentPayoutPlan {
  id: ID! # chainId-payoutPlanId
  chainId: Int!
  payoutPlanId: BigInt!
  commitmentId: BigInt!
  commitmentEntityId: String!
  providerGarden: String!
  providerGardenId: String! # relationship to documented bare-address Garden.id on chainId
  payerGarden: String! # the Safe actually spent; equals providerGarden for garden-internal commitments
  payerGardenId: String! # relationship to documented bare-address Garden.id on chainId
  settlementFlow: CommitmentSettlementFlow! # derived from payer/provider + write-once protocol garden
  source: String!
  token: String!
  payoutKind: DisbursementKind! # ContributorConsideration or GardenBeneficiary
  declaredAmount: BigInt!
  gardenRetainedAmount: BigInt!
  contributorPayoutTotal: BigInt!
  beneficiaryGarden: String
  beneficiaryGardenId: String
  beneficiaryRecipient: String
  beneficiaryAmount: BigInt!
  beneficiaryDisbursementId: BigInt
  beneficiaryDisbursementEntityId: String
  recognitionContributorCount: Int!
  payablePayoutCount: Int!
  preparedPayoutCount: Int!
  confirmedPayoutCount: Int!
  failedPayoutCount: Int!
  cancelledPayoutCount: Int!
  recognitionSnapshotHash: String!
  paymentSnapshotHash: String!
  paymentSnapshotVersion: Int!
  latestEditReasonCID: String
  finalized: Boolean!
  status: CommitmentPayoutPlanStatus! # derived from child disbursements
  disbursementEntityIds: [String!]!
  createdBy: String!
  createdAt: Int!
  finalizedAt: Int
  updatedAt: Int!
}

type ContributorPayout {
  id: ID! # chainId-payoutPlanId-lowercaseContributor
  chainId: Int!
  payoutPlanId: BigInt!
  payoutPlanEntityId: String!
  commitmentId: BigInt!
  commitmentEntityId: String!
  contributor: String!
  contributorEntityId: String!
  recipient: String!
  paymentSnapshotVersion: Int!
  recognitionWeightBps: Int!
  paymentWeightBps: Int!
  amount: BigInt!
  disbursementId: BigInt
  disbursementEntityId: String
  latestEditReasonCID: String
  editedBy: String!
  createdAt: Int!
  updatedAt: Int!
}

type SettlementBatch {
  id: ID! # chainId-batchId
  chainId: Int! batchId: BigInt! executorGarden: String! executorGardenId: String!
  source: String! token: String! kind: DisbursementKind! fundingRoute: FundingRoute!
  disbursementIds: [BigInt!]! disbursementEntityIds: [String!]!
  state: DisbursementState! attempt: Int! executionKey: String commandMessageId: String
  dispatchedAt: Int celoExecutionTx: String acknowledgmentMessageId: String confirmedAt: Int
  reasonCID: String failureCode: Int
  createdAt: Int! updatedAt: Int!
}

type SettlementMessage {
  id: ID! # chainId-messageId
  chainId: Int! messageId: String! executionKey: String!
  direction: String! # COMMAND or ACKNOWLEDGMENT
  isBatch: Boolean!
  subjectId: BigInt!
  attempt: Int # command event supplies it; acknowledgment replay may fill it from the subject/key join
  destinationPeer: String
  destinationGasLimit: Int # COMMAND only
  protocolVersion: Int!
  commandPayloadHash: String # COMMAND only
  sourceChainId: Int! destinationChainId: Int!
  status: String! txHash: String! fee: BigInt
  createdAt: Int! updatedAt: Int!
}

type SettlementExecution {
  id: ID! # chainId-executionKey
  chainId: Int!
  sourceChainId: Int!
  executionKey: String!
  commandMessageId: String!
  acknowledgmentReceiver: String!
  protocolVersion: Int!
  executorGarden: String!
  executorGardenId: String! # relationship to documented bare-address Garden.id on sourceChainId
  isBatch: Boolean!
  settlementId: BigInt!
  attempt: Int!
  status: SettlementExecutionStatus!
  failureCode: Int!
  txHash: String!
  acknowledgmentMessageId: String
  acknowledgmentSent: Boolean!
  acknowledgmentDeferralCode: Int!
  createdAt: Int!
  updatedAt: Int!
}
```

`CommitmentSettlementFlow` is a deterministic read-model projection, never a caller-authored
contract field. For every commitment plan, derive it in this order from immutable event facts and
the write-once `SettlementConfiguration.protocolGarden`: equal payer/provider is `INTERNAL`;
protocol payer with a non-protocol provider is `PROTOCOL_TO_GARDEN`; non-protocol payer with the
protocol provider is `GARDEN_TO_PROTOCOL`; the remaining unequal pair is reserved
`GARDEN_TO_GARDEN`. Copy it to commitment-bound disbursements through their stable payout-plan
relationship. Funding and reserved loan rows leave it null because their route/loan identity owns
their semantics. Reverse event delivery buffers only until the plan and configuration facts exist;
it never guesses from `garden`, `source`, or recipient addresses.

`peerConfigured` is a derived readiness fact, not a synonym for “a peer address appeared in an
event.” It is true only when `activePeer`, `remoteChainSelector`, and `remoteEvmChainId` are all
present and match freshly verified supported-lane deployment metadata. An isolated local/mock
peer event may populate its exact observable address/selector while leaving
`remoteEvmChainId = null` and `peerConfigured = false`.

Exact Envio contract block for Arbitrum One `42161` and the Arbitrum Sepolia `421614`
rehearsal (addresses remain deployment-artifact placeholders until broadcast):

```yaml
- name: SettlementModule
  handler: src/EventHandlers.ts
  events:
    - event: FundingConfigurationLocked(address indexed protocolGarden, address indexed gDollarToken)
    - event: SettlementAccountRegistered(address indexed garden, uint64 chainId, address indexed account, address[3] recoveryOwners, address rolesModifier, bytes32 roleKey, bytes32 allowanceKey, bytes32 permissionsConfigHash, bytes32 recoveryConfigHash, uint8 recoveryThreshold)
    - event: SettlementRecoveryUpdated(address indexed garden, address[3] recoveryOwners, bytes32 recoveryConfigHash)
    - event: SettlementAccountStatusChanged(address indexed garden, bool active)
    - event: CcipRouteUpdated(uint64 indexed destinationChainSelector, address indexed destinationExecutor, address indexed previousDestinationExecutor, uint64 previousPeerExpiresAt, uint32 destinationGasLimit, uint8 protocolVersion)
    - event: GardenerDeliveryStatusChanged(bool enabled)
    - event: BatchSizeLimitUpdated(uint16 previousLimit, uint16 limit)
    - event: DispatcherUpdated(address indexed previousDispatcher, address indexed dispatcher)
    - event: FeeReserveMinimumUpdated(uint256 previousMinimum, uint256 minimum)
    - event: HatsModuleUpdated(address indexed previousModule, address indexed newModule)
    - event: CommitmentPoolingModuleUpdated(address indexed previousModule, address indexed newModule)
    - event: PausedSet(bool paused)
    - event: CommitmentPayoutPlanCreated(uint256 indexed payoutPlanId, uint256 indexed commitmentId, address indexed providerGarden, address payerGarden, address source, address token, uint8 payoutKind, uint256 declaredAmount, uint256 gardenRetainedAmount, address beneficiaryGarden, address beneficiaryRecipient, uint256 beneficiaryAmount, bytes32 recognitionSnapshotHash, address createdBy)
    - event: ContributorPayoutSet(uint256 indexed payoutPlanId, uint32 indexed paymentSnapshotVersion, address indexed contributor, address recipient, uint16 recognitionWeightBps, uint16 paymentWeightBps, uint256 amount, string reasonCID, address editedBy)
    - event: CommitmentPayoutSnapshotCommitted(uint256 indexed payoutPlanId, uint32 indexed paymentSnapshotVersion, uint32 rowCount, uint256 gardenRetainedAmount, uint256 contributorPayoutTotal, bytes32 paymentSnapshotHash, string reasonCID, address editedBy)
    - event: CommitmentPayoutPlanFinalized(uint256 indexed payoutPlanId, uint8 payoutKind, uint32 payablePayoutCount, uint256 contributorPayoutTotal, uint256 beneficiaryAmount, uint256 gardenRetainedAmount, bytes32 recognitionSnapshotHash, bytes32 paymentSnapshotHash, bool completedWithoutDispatch, uint64 finalizedAt)
    - event: DisbursementQueued(uint256 indexed disbursementId, uint256 indexed commitmentId, address indexed garden, uint256 payoutPlanId, address contributor, address executorGarden, uint8 kind, uint8 fundingRoute, address source, address recipient, address token, uint256 amount)
    - event: BatchCreated(uint256 indexed batchId, address indexed executorGarden, address indexed source, address token, uint8 kind, uint8 fundingRoute, uint256[] disbursementIds)
    - event: SettlementCommandDispatched(bytes32 indexed executionKey, bytes32 indexed commandMessageId, bool indexed isBatch, uint256 subjectId, uint32 attempt, uint64 destinationChainSelector, address destinationExecutor, uint32 destinationGasLimit, uint8 protocolVersion, bytes32 commandPayloadHash, uint256 fee)
    - event: SettlementCommandRetried(bytes32 indexed executionKey, bytes32 indexed commandMessageId, bool indexed isBatch, uint256 subjectId, uint32 attempt, uint64 destinationChainSelector, address destinationExecutor, uint32 destinationGasLimit, uint8 protocolVersion, bytes32 commandPayloadHash, uint256 fee)
    - event: SettlementAcknowledged(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId, bytes32 indexed originatingCommandMessageId, bool isBatch, uint256 subjectId, bool success, uint8 failureCode)
    - event: DuplicateAcknowledgmentIgnored(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId)
    - event: StaleAcknowledgmentIgnored(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId)
    - event: DisbursementRequeued(uint256 indexed disbursementId, uint32 attempt)
    - event: DisbursementCancelled(uint256 indexed disbursementId, address indexed actor, uint8 cancelledFromState, string reasonCID)
    - event: BatchCancelled(uint256 indexed batchId, address indexed actor, string reasonCID)
    - event: FeeReserveFunded(address indexed funder, uint256 amount)
    - event: ExcessFeesWithdrawn(address indexed recipient, uint256 amount)
```

For `ContributorConsideration`, the source handler treats `CommitmentPayoutPlanCreated`, its version-1 ordered
`ContributorPayoutSet` rows, and the trailing version-1
`CommitmentPayoutSnapshotCommitted` as one complete creation snapshot. It buffers rows by
`(payoutPlanId, paymentSnapshotVersion)`, rebuilds the exact ordered
`PaymentSnapshotEntry[]` tuple defined above, verifies the trailing row count and canonical hash,
and only then
publishes the plan summary and atomic replacement vector. It therefore materializes every initial
`ContributorPayout` even when the draft is never edited. A later full-vector edit increments the
version once, re-emits every ordered row even when unchanged, and commits one trailing summary;
an incomplete or mismatched sequence never replaces the prior published snapshot. Handlers never
need an RPC read to infer retention, total, version completeness, or the payment hash. For
`GardenBeneficiary`, creation carries the complete immutable beneficiary shape and must be followed
by no contributor rows; any contributor snapshot event for that plan is an invariant violation.

Exact Celo network block for Celo Mainnet `42220` and the Celo Sepolia `11142220`
rehearsal (the rehearsal network uses explicit `rpc_config`):

```yaml
- name: CeloSettlementExecutor
  handler: src/EventHandlers.ts
  events:
    - event: SourcePeerUpdated(uint64 indexed sourceChainSelector, address indexed sourceSettlementModule, address indexed previousSourceSettlementModule, uint64 previousPeerExpiresAt, uint8 protocolVersion)
    - event: GardenRouteConfigured(address indexed garden, address indexed safe, address indexed rolesModifier, bytes32 roleKey, bytes32 allowanceKey, bytes32 permissionsConfigHash)
    - event: GardenRouteStatusChanged(address indexed garden, bool active)
    - event: CapsUpdated(uint16 maxBatchSize, uint256 maxTransferAmount, uint256 maxBatchAmount)
    - event: FeePolicyUpdated(uint16 maxFeeBps, uint256 maxFeeAmount)
    - event: PeriodicCapUpdated(uint64 periodDuration, uint256 maxPeriodAmount)
    - event: AcknowledgmentFeeReserveMinimumUpdated(uint256 previousMinimum, uint256 minimum)
    - event: AcknowledgmentFeeReserveFunded(address indexed funder, uint256 amount)
    - event: ExcessAcknowledgmentFeesWithdrawn(address indexed recipient, uint256 amount)
    - event: PausedSet(bool paused)
    - event: SettlementExecutionStored(bytes32 indexed executionKey, bytes32 indexed commandMessageId, address indexed executorGarden, address acknowledgmentReceiver, uint8 protocolVersion, bool isBatch, uint256 settlementId, uint32 attempt, uint8 status, uint8 failureCode)
    - event: DuplicateSettlementMessage(bytes32 indexed executionKey, bytes32 indexed commandMessageId)
    - event: AcknowledgmentSent(bytes32 indexed executionKey, bytes32 indexed commandMessageId, bytes32 indexed acknowledgmentMessageId, uint256 fee, bool reserveFunded)
    - event: AcknowledgmentDeferred(bytes32 indexed executionKey, bytes32 indexed commandMessageId, uint8 reasonCode)
```

The Celo network block indexes exactly the fourteen `CeloSettlementExecutor` events frozen in §4.
Every entity/message ID is chain-composite. A Celo execution persists the exact authenticated
source peer as `acknowledgmentReceiver`, so delayed retry during peer rotation returns to the
module that originated that execution. `AcknowledgmentDeferred.reasonCode` is the bounded
`None | QuoteFailed | FeeReserveLow | SendFailed` enum; an opaque hash is never the operator
contract. A Celo garden route is keyed by executor chain +
garden address but its `gardenId` and `settlementAccountId` use the authenticated source chain,
so the read model never invents a `42220-garden` relationship for an Arbitrum Garden account.
`SettlementExecutionStored` carries the decoded
subject domain, ID, and attempt so the Celo record remains self-describing even when
cross-network replay order is inverted; it sets the derived executed/ack-pending view and
records the Celo transaction. Only
`SettlementAcknowledged(success=true)` on Arbitrum changes canonical state to Confirmed.

Handlers follow `commitmentPool.ts` patterns (create-if-not-exists, dedup, composite IDs,
`bun codegen`). `CommitmentPayoutPlanCreated` materializes the one stable
commitment-to-plan pointer, immutable payout kind, payer/provider identities, derived settlement
flow, and beneficiary fields. Contributor-shape creation and each atomic draft edit emit the
complete ordered, version-tagged `ContributorPayoutSet` sequence followed by
`CommitmentPayoutSnapshotCommitted`; handlers buffer by version, require exact row count/hash,
and atomically replace the vector and plan-level retention/totals only at that commit marker.
Beneficiary shape accepts no contributor snapshot rows and binds its one child from the later
`DisbursementQueued(kind=GardenBeneficiary)` event.
Handlers store emitted amount-derived weights without accepting a conflicting local recomputation.
`CommitmentPayoutPlanFinalized`
records shape, payable count, payment snapshot hash, and finalization time, then derives
zero-payable contributor Complete or unprepared Pending. A later
`DisbursementQueued(kind=ContributorConsideration)` binds the newly
prepared immutable child to the already-indexed contributor row and increments the prepared
counter; `GardenBeneficiary` instead binds the plan's beneficiary child pointer. The draft event
never carries a child ID. Child transitions for both kinds maintain the general plan counters
used for the Pending/Partial/Complete/Failed view. Child and batch cancellations update only
their rows and derived parent status, never delete the commitment-to-plan pointer. Command retries
and acknowledgment retries create new message rows but never duplicate settlement execution.
`DisbursementQueued` is the immutable source/route fact, so handlers never infer the funding path.
Route/peer, source and executor batch limits, executor transfer/aggregate/fee/period caps, pause,
dispatcher, reserve-floor, funding, fee-spend, withdrawal, and source dependency-update events
update the appropriate chain's singleton `SettlementConfiguration`; Celo route events update
`SettlementGardenRoute`. `FundingConfigurationLocked` seeds `protocolGarden` and canonical
`gDollarToken`; `HatsModuleUpdated` and `CommitmentPoolingModuleUpdated` are the only event-owned
changes to their corresponding source trust-root fields. Every Arbitrum command send spends the
module reserve. Every Celo acknowledgment send carries the native fee plus `reserveFunded`, so
the handler decrements the CELO reserve only for the automatic/sponsored path and never for an
exact caller-funded retry. `feeReserveLow` derives from indexed balance versus indexed floor,
while the shared live-read path refreshes the current native balance before any write. For a
verified supported lane, `remoteEvmChainId` is verified generated deployment metadata: on a
source row it is the paired executor EVM chain ID, and on an executor row it is the paired
Arbitrum source EVM chain ID. Celo relationship-bearing handlers require that field for
`SettlementGardenRoute.sourceChainId`, `SettlementExecution.sourceChainId`, Garden/account
relationship IDs, and the source/destination sides of command and acknowledgment messages. If it
is null, they fail closed instead of creating a cross-chain relationship. They never derive an
EVM chain ID from a CCIP selector, JavaScript number coercion, `transaction.from`, the local Celo
event context, or a test-only peer address. `packages/contracts/script/utils/envio-integration.ts`
must preserve the Commitment Pooling, Arbitrum SettlementModule, and CeloSettlementExecutor
blocks; the boundary checker allows exactly their Green Goods protocol events and rejects raw G$
transfer indexing.

The indexer targets Envio `3.2.1` only after corrected PR #649 lands. The migration must re-read
the v3 config schema and must not copy the v2-only `unordered_multichain_mode` flag. Celo Sepolia
`11142220` continues to use an explicit `rpc_config` data source because HyperSync coverage is not
assumed.

Generated verified deployment constants seed each `SettlementConfiguration` row on the first
relevant protocol configuration event: `FundingConfigurationLocked` for the source and
`SourcePeerUpdated` for the executor. Every seed contains role, local contract, immutable router,
and exact decimal-string local selector. Only a freshly verified supported lane supplies the
remote CCIP identity in `remoteChainSelector`, paired EVM chain ID in `remoteEvmChainId`, and a
route-ready peer. The required production pair is source `42161` / executor `42220`.
Arbitrum Sepolia `421614` and Celo Sepolia `11142220` are independent component rehearsals:
their rows may preserve an explicitly labeled local/mock peer event, but
`remoteEvmChainId = null`, `peerConfigured = false`, and no route/execution/message relationship
may treat them as a CCIP pair unless a fresh official directory/API read publishes the exact lane
and router. No deployment-block callback is assumed. Events then own every mutable on-chain
field; `peerConfigured` remains the derived readiness conjunction defined above.
The preservation fixture fails if a production seed is absent, rounded, or inconsistent with the
indexed contract block, including selector and EVM-chain pairing. It separately proves that both
Sepolia component blocks survive updates without a fabricated remote EVM identity or route-ready
peer. No handler invents local router/selector/remote-chain values from JavaScript numbers, and
receipt-only message rows keep `fee = null` until a source send event supplies it.

Exact indexer proof from the repo root: `bun run --filter @green-goods/indexer codegen`, `bun run --filter @green-goods/indexer setup-generated`, `bun run --filter @green-goods/indexer check:indexing-boundary`, `bun run --filter @green-goods/indexer test`, and `bun run --filter @green-goods/indexer build`. The preservation regression runs before and after codegen and compares both configured network blocks and every locked signature.

## 7. Surface impact (deltas to `uiux-spec.md` / `wireframes.md`; W21/W22/W23 are the settlement frames)

- **W2 commitment detail (PWA)**: consideration copy deliberately collapses transport detail to three truthful phrases — “support on its way” before an authenticated outcome (delay keeps this phrase), “support arrived” + Celo ref after Confirmed, and “support is being rearranged” after an authenticated failure until stewards reconcile or cancel it (cancellation then uses its own truthful withdrawn/closed copy). A calm action explanation may accompany any of them, but the gardener surface never renders a success phrase for a failed state and never exposes the Queued / Dispatched / acknowledgment-pending / Failed operational state nouns. Steward and Operations surfaces retain the full state and recovery detail.
- **W23 WalletDrawer G$ section (settlement delta to W5)**: only after the AA gate, G$ balance section (Celo) + received-support rows; send action → chain-aware transfer flow. When disabled, no balance/send affordance renders and explanatory copy points to the blocked delivery gate.
- **W21 Garden Pool tab settlement section (delta to W7)**: settlement account card (Safe address, active, cap snapshot, plus read-only gardener-delivery status) + disbursement queue. The CCIP command/ack console is **W22** and distinguishes retrying the same command from retrying a stored acknowledgment or creating a new attempt.
- **W10 commitment dialog**: `CeloSettlement` exposes the recognition-aligned contributor payout draft and never "Record payout"; W21 finalizes the plan and prepares each payable row. `ArbitrumExternal` exposes "Record payout" and never creates a settlement plan. Batch actions remain in W21/W22.
- **Admin Operations tab funding view (capability-gated)**: route visibility derives from
  `isDeployer || canQueueFunding || canOperateSettlement`, while each write keeps its exact
  onchain authority. The form is shown only for `canQueueFunding` (protocol steward or module
  owner), and deployer alone cannot submit. Protocol-Safe inflow, GG→garden funding hops, Safe
  balances, native ETH/CELO fee reserves, command/ack message IDs and explorer links,
  delivery/manual-execution guidance, Safe/Roles/cap health, and batch console stay in this
  workspace.
- Editorial/community: no change (aggregates only; settlement is not a public story before its separately authorized Release gate).

i18n families extend `app.pool.*`, `cockpit.garden.pool.*`, `cockpit.community.pools.*` with `settlement.*` keys (en/es/pt, same gate). Banned-vocab rules apply to all new copy.

### 7.1 Chain placement, registry, and dual-chain development contract

Green Goods does **not** deploy its full protocol stack to Celo for Commitment Pooling:

> **Amendment 2026-08-10 (current Phase A contract).** The production roles in the table remain
> binding, but the configured Arbitrum Sepolia/Celo Sepolia network records and testnet deployment
> artifacts described below are withdrawn and must not be re-added. The exact two-process local
> fixture remains mandatory and may use `421614` and `11142220` only as isolated local chain
> identities; it may not share fork state, RPC handles, contract objects, or storage snapshots.
> Ethereum Sepolia may provide separately labeled endpoint evidence where useful, never exact-route
> proof or canonical artifact state. The release ladder is local/fork confidence, optional Ethereum
> Sepolia endpoint rehearsal, separately authorized Arbitrum One, then separately authorized Celo.
> This amendment changes deployment tooling and evidence only; it does not reopen the frozen
> settlement ABI, storage, message tuples, or acknowledgment state machine.

| Chain role | Production | Testnet | Custom Green Goods deployments |
|---|---|---|---|
| protocol/control | Arbitrum One `42161` | Arbitrum Sepolia `421614` | CommitmentPoolingModule, CommitmentRegistry, existing resolver/token upgrades, TestimonyResolver, AssessmentV3 schema registration, SettlementModule |
| protocol external dependencies | Arbitrum One | Arbitrum Sepolia | EAS, SchemaRegistry, Hats, EntryPoint v0.7/account stack, and CCIP router are dependencies rather than Green Goods contracts; official `421614` EAS/SchemaRegistry addresses are consumed after bytecode proof, while Hats remains a version-pinned test deployment |
| settlement execution | Celo Mainnet `42220` | Celo Sepolia `11142220` | CeloSettlementExecutor only; testnet is an independent paused component rehearsal and also gets the non-production G$ fee surrogate |
| external settlement dependencies | Celo Mainnet | Celo Sepolia | production uses the verified CCIP router, Safe base contracts, one Safe per participating garden, Zodiac Roles configuration, and canonical G$; testnet uses only verified component dependencies or explicitly labeled local/test fixtures and does not imply a CCIP peer lane |
| deterministic legacy validation | Ethereum Sepolia `11155111` | same | existing repo regression deployments remain supported but do not stand in for Arbitrum Sepolia |
| local | two Anvil processes | two Anvil processes | Arbitrum-shaped protocol stack on one RPC; Celo-shaped executor/Safe/roles/surrogate on the other |

`packages/contracts/deployments/networks.json` implementation changes are additive and
fail-closed:

- add separate `arbitrum-sepolia` (`421614`) and `celo-sepolia` (`11142220`) records; keep
  `sepolia` (`11155111`) unchanged for existing deterministic validation;
- require chain-local bytecode proof for every external dependency. For `421614`, consume
  official EAS `0x2521021fc8BF070473E1e1801D3c7B4aB701E1dE` and SchemaRegistry
  `0x45CB6Fa0870a8Af06796Ac15915619a0f22cd475`; deploy only Hats as an explicitly labeled,
  version-pinned test dependency. Never reuse an Ethereum Sepolia address by assumption;
- encode every `ccipChainSelector` as a decimal string, never a JSON number, and parse it
  directly to `uint64`/`bigint`;
- replace Celo's placeholder CCIP router/selector only from a fresh official-directory read;
  add per-network Safe factory/singleton/fallback-handler/MultiSend facts from the released Safe
  deployment registry; keep canonical G$ separate from the Celo Sepolia surrogate;
- distinguish `protocol` and `settlement` roles in deploy selection. The Celo target must not
  deploy or overwrite GardenToken, CommitmentPoolingModule, CommitmentRegistry, EAS schemas, or
  unrelated historical Celo artifact keys;
- do not reuse the existing `deploy:celo` command: it selects the full `core` target and carries
  the prohibited bulk `--update-schemas` flag. Add a distinct
  `settlement-executor --network celo|celo-sepolia` target that persists only
  executor/Safe/local-configuration keys (plus peer keys only for a verified supported lane) and
  preserves every historical `42220-latest.json` core key;
- replace the current single `assertSepoliaGate` behavior with role-aware gates: protocol
  targets require successful `421614` rehearsal evidence, while settlement-executor targets
  require successful `11142220` executor/Safe/Roles/surrogate evidence. Neither may depend on a
  full `11155111` Green Goods deployment;
- create `421614-latest.json` and `11142220-latest.json` only through the normal deployment
  persistence path. Missing pre-broadcast addresses are pending; a dry-run that cannot predict,
  persist, merge, and verify them is a deployment-path blocker.

The implementation adds Bun-wrapped, help-documented commands for:

1. two deterministic local chains plus an explicit courier process that forwards mock CCIP
   messages/receipts between routers;
2. independent Arbitrum and Celo fork start/verify/stop commands pinned to block numbers;
3. selective dry-run/deploy/verify targets for protocol, executor, Safe prediction/config, and
   post-deploy peer wiring only where an exact supported lane has been verified;
4. a cross-chain lifecycle fixture that exports only message tuples and receipts between
   processes—never shared mutable fork state;
5. post-deploy verification that rereads proxy implementations, owners/timelocks, routers,
   selectors, supported-lane peers when applicable, Safe/Role/allowance configuration, token fee
   mode, and artifact hashes before any Envio update.

**The courier and lifecycle fixture (items 1 and 4) are exact.** The courier is a Bun script under
`packages/contracts/script/settlement/`, never a Foundry test: a `.t.sol` runs in one EVM and cannot
orchestrate two Anvil processes. `script/settlement/dual-chain-courier.ts` is the forwarding
process, `script/settlement/dual-chain-lifecycle.test.ts` is the fixture that drives it, both run
under the existing `test:script` (`vitest run script/**/*.test.ts`), and both are exposed as
help-documented `settlement:dual-chain:up`, `settlement:dual-chain:down`, and
`settlement:courier` package commands.

- **Processes.** Two Anvil instances with distinct ports and chain IDs, chosen so the pair runs
  beside the existing single local chain on `3009`: Arbitrum-side `--chain-id 421614 --port 3012`
  and Celo-side `--chain-id 11142220 --port 3013`, each with its own
  `--config-out .generated/runtime/dual-chain-{arbitrum,celo}.json`. Neither process forks the
  other's head and neither is a fork of the other. Ports `3010` and `3011` are deliberately skipped:
  `3010` is the September Community PWA's reserved local port
  (`.plans/active/community-interface/spec.md` decision 11), and leaving `3011` free keeps a spare
  beside it. Confirm both ports are still unclaimed before adding a third local chain.
- **Routers.** Both chains deploy a paired router derived from the existing
  `packages/contracts/src/registries/LocalCCIPRouter.sol`. It keeps that contract's `getFee` and
  `ccipSend` signatures and its deterministic `messageId` derivation, but replaces the inline
  `ICCIPReceiver.ccipReceive` call with a stored outbound message plus an emitted outbound event,
  and adds a separate courier-only delivery entrypoint that rebuilds `Client.Any2EVMMessage` from a
  supplied tuple. Delivery therefore becomes asynchronous and externally ordered instead of
  same-transaction. Each router is constructed with its own chain's explicitly labeled local test
  selector constant; no official-directory selector is fabricated for either testnet.
- **The only values that cross the process boundary** are one serialized JSON record per message
  and one per delivery receipt. A command record is
  `{ direction: "COMMAND", messageId, sourceChainSelector, sender, receiver, data, destTokenAmounts: [] }`,
  where `sender` is the Arbitrum `SettlementModule`, `receiver` is the `CeloSettlementExecutor`,
  `data` is the hex-encoded `SettlementCommandV1` tuple, `sourceChainSelector` is a decimal string,
  and `destTokenAmounts` is always empty. An acknowledgment record has the same shape with
  `direction: "ACKNOWLEDGMENT"`, the executor as `sender`, the module as `receiver`, and the
  hex-encoded `SettlementAcknowledgmentV1` tuple as `data`. A receipt is
  `{ messageId, executionKey, deliveredOnChainId, txHash, blockNumber, status }`. No RPC handle,
  fork snapshot, storage slot, account state, block timestamp, or in-memory contract object is
  shared; neither process reads the other's chain, and every assertion reads only its own.
- **Fixture lifecycle.** Start both Anvils and wait for RPC readiness; deploy each side against its
  own chain (Arbitrum: paired router plus the paused `SettlementModule` proxy; Celo: paired router,
  paused `CeloSettlementExecutor` proxy, Safe/Roles configuration, and the fee-aware G$ surrogate);
  register peers and policy on each side independently (`setCcipRoute` on the source, source peer on
  the executor, caps, fee policy, period policy, reserve floors), then unpause each side through its
  own readiness gate; run the scenario on the source (register account, create/finalize the plan,
  prepare rows, optionally batch, dispatch); poll the source router's outbound events, serialize
  each new message, deliver it on the destination router, then poll the destination and deliver its
  acknowledgment back; assert terminal state by reading each chain independently; tear both
  processes down. The courier can hold, reorder, duplicate, and drop-then-replay any serialized
  record, so out-of-order, duplicate, and inverted delivery are provable across real processes. All
  addresses and artifacts stay under `.generated/runtime` and never merge into
  `421614-latest.json` or `11142220-latest.json`.

Existing defaults remain Arbitrum-first. `DEFAULT_CHAIN_ID`, the Sepolia build gate,
GardenToken, WorkApproval, existing deployment-registry behavior, and one-chain local
development must continue to pass unchanged. The new dual-chain mode is explicit; it does not
silently change the root `bun run dev` topology until its own smoke proof is green.

Envio uses the minimum chain set required by the read model. Arbitrum supplies all Commitment
Pooling and canonical SettlementModule state. Celo is configured only for the fourteen bounded
`CeloSettlementExecutor` events needed to distinguish execution from acknowledgment delay.
HyperIndex can index any EVM through RPC, so Celo support is technically available; no Celo
GardenToken deployment or raw G$ `Transfer` block is added. The deployment-artifact updater
must preserve existing protocol blocks plus the Arbitrum SettlementModule and Celo executor
blocks across two consecutive runs.

## 8. Linear-aligned sequencing (amends plan Track B)

Settlement implementation runs after the pooling consideration interface freezes:

1. **Protocol implementation**: versioned payload library, Arbitrum `SettlementModule`, Celo `CeloSettlementExecutor`, two-router asynchronous test harness, idempotent same-key retries, independent acknowledgment retry, native-fee reserve views, deployment/config dry runs, and bounded Safe adapter seam.
2. **Read model + surfaces**: index Arbitrum command/ack events and bounded Celo executor events; add shared state/queries; expose queued/dispatched/executed-ack-pending/confirmed/failed/delayed states; add admin fee/route/Safe health and retry controls; add client consideration states.
3. **Release evidence (separately authorized)**: Celo Sepolia is active, but the exact
   Arbitrum Sepolia↔Celo Sepolia CCIP lane is not currently published. The testnet evidence
   ladder below replaces the inaccurate “no active Celo testnet” claim. The direct
   Arbitrum One↔Celo mainnet route is published in both directions, but no mainnet deployment
   or canary is authorized in this implementation wave.

**Current dependency/support matrix and proof ladder (externally verified 2026-07-24)**:

| Dependency | Arbitrum Sepolia | Celo Sepolia | Required conclusion |
|---|---|---|---|
| EVM/RPC/explorer | supported | supported, chain ID `11142220`; replaces Alfajores | add both chain records and independent RPC health |
| CCIP router/selector | published for Arbitrum Sepolia | current official Celo docs list CCIP only for Celo Mainnet; Celo Sepolia router/lane support is unresolved | verify official live directory/API data and router bytecode at run time; do not seed a Celo Sepolia router from explorer inference |
| direct Arb Sepolia↔Celo Sepolia lane | **not listed in the official Arbitrum Sepolia directory** | no exact pair found in the reviewed official directory | no exact live testnet lifecycle; never substitute a two-hop relay silently |
| EAS + SchemaRegistry | official EAS `0x2521021fc8BF070473E1e1801D3c7B4aB701E1dE` and SchemaRegistry `0x45CB6Fa0870a8Af06796Ac15915619a0f22cd475` are published for `421614` | not used by the settlement executor | verify chain-local bytecode/code hashes, then consume the official addresses |
| Hats Protocol | Arbitrum One and Ethereum Sepolia are listed, but Arbitrum Sepolia is not | not used by the settlement executor | use a version-pinned test deployment or later official support for the source-chain rehearsal; mocks remain unit/local-only |
| Safe v1.4.1 base deployments | released registry includes `421614` | released registry includes `11142220`, with canonical factory, SafeL2, handler, and MultiSend records | dry-run deterministic prediction/deployment is feasible on both testnets |
| Zodiac Roles tooling | Arbitrum/mainnet chains supported | SDK lists Celo Mainnet (`42220`) but not Celo Sepolia (`11142220`) | deploy/verify contracts on Celo Sepolia with a pinned low-level script or add reviewed SDK chain support; do not rely on the hosted app |
| canonical G$ | not applicable | no official GoodDollar Celo Sepolia token found | deploy a test-only fee-aware surrogate; prove canonical behavior on a Celo Mainnet fork |
| gardener AA/bundler/paymaster | Pimlico v0.7 supports Kernel `0.2.4` and `0.3.1` on `421614` | Pimlico v0.7 supports Kernel `0.2.4`, but not the production Kernel `0.3.1`, on `11142220` | run the same-address Kernel `0.2.4` sponsored surrogate transfer on both testnets as non-production mechanics evidence; keep Kernel `0.3.1` for production and require the exact Arbitrum One/Celo Mainnet derivation plus one separately authorized included sponsored Celo Mainnet canonical-G$ transfer before enabling gardener delivery |
| Envio | indexes source protocol events | any EVM can be indexed through RPC; Celo executor events are supported | configure Celo only for Green Goods executor observability, never raw G$ transfers |

The surrogate implements the canonical integration surface used here:
`transfer`, `transferAndCall`, `balanceOf`, `getFees(amount,sender,recipient)`, and
owner-controlled `pause`/`unpause`, with fixtures for zero fee, sender-pays, receiver-pays, fee
changes, DAO exemption, paused-token `RouteReverted`, ERC-677 callback behavior, and ERC-777-style
reentrancy attempts. The executor is accepted only if call tracing proves it invokes plain
ERC-20 `transfer`, never `transferAndCall`, `send`, or `operatorSend`; the callback-capable
surrogate makes accidental selector drift observable, and a Celo Mainnet fork proves the same
distinction against canonical G$. Its address is testnet-only and cannot populate the mainnet
`gDollarToken` key. A freshly verified Alfajores G$ deployment may supplement token-fee
semantics, but Alfajores is not the current deployment lane, provides no CCIP proof, and never
replaces Celo Sepolia.

Proof order:

1. Deterministic two-router local command/ack tests, including duplicates, inversion, stale
   peers, fee modes, and out-of-order delivery.
2. Two concurrent local chains (Arbitrum-shaped `421614`, Celo-shaped `11142220`) with mock
   routers and an explicit message courier that relays receipts between processes; one process
   never pretends to fork two heads.
3. Separate pinned Arbitrum One/Sepolia and Celo Mainnet/Sepolia fork tests proving real
   dependencies and configurations without broadcasting or joining fork state. An Arbitrum
   Sepolia fork is a full-stack proof only after official EAS/SchemaRegistry and the chain-local
   test Hats deployment are persisted and bytecode-verified.
4. Endpoint-specific live testnet rehearsals: a separate ephemeral Arbitrum Sepolia
   sender/receiver talks to Ethereum Sepolia using peer-appropriate selectors and
   `DESTINATION_EVM_CHAIN_ID = 11155111`. Its artifacts remain under `.generated/runtime` and
   never merge into canonical deployment records. Celo Sepolia independently proves executor,
   Safe/Roles, fee-surrogate, pause,
   and recovery configuration; it adds a live CCIP sender/receiver rehearsal only if a fresh
   official directory/API read publishes the exact peer lane and router. These proofs never
   stand in for the absent Arb↔Celo lane. This rung is release-ops evidence: the settlement lane
   cannot produce it, because the same lane authority that scopes this spec forbids the live
   testnet deploys it requires, and no lane-completion clause may depend on it.
5. Exact-mainnet-lane gate: the direct bidirectional Arbitrum One↔Celo Mainnet route is
   currently published at v1.5.0; immediately before any candidate deployment, prove it remains
   operational and that fresh fee quotes, router/peer code hashes, service windows, and
   message-only command/ack delivery match the frozen configuration.
6. Mainnet candidates deployed paused with no Safe role or value authority; external audit,
   timelock, peer/code-hash checks, Safe/Zodiac review, and message-only ping/ack.
7. Human-authorized, tightly capped minimum-value G$ canary, observation period, and separate
   approval before raising caps.

**Owner ruling on the endpoint proof.** Lane GREEN is rungs 1 through 3. Rungs 4 through 7 —
including the ephemeral Arbitrum Sepolia↔Ethereum Sepolia endpoint proof — are release-ops
evidence and never gate settlement-lane completion. Where a lane-GREEN acceptance sentence names
the endpoint proof, that clause constrains **artifact placement only**: its addresses and artifacts
stay under `.generated/runtime` and never merge into canonical `421614-latest.json`. A reader who
finds the endpoint proof folded into a pre-broadcast GREEN sentence reads it as that placement
constraint, not as work the lane owes; the lane's own authority forbids the live testnet deploys the
proof requires, so treating it as a completion gate would make the lane unfinishable by
construction.

**Test file per rung.** Rung 1 is `test/unit/Settlement.t.sol` (Arbitrum source behavior),
`test/unit/CeloSettlementExecutor.t.sol` (Celo executor behavior), `test/integration/CCIPSettlement.t.sol`
(both contracts in one EVM behind the paired routers, full command/ack lifecycle and authentication
rejection), and `test/integration/DualChainSettlement.t.sol` (the same pair with deferred,
externally ordered delivery: duplicates, inversion, stale peers, fee modes, out-of-order
acknowledgment, bounded peer rotation, and measured batch execution). Rung 2 is
`script/settlement/dual-chain-lifecycle.test.ts` under `test:script`, driving
`script/settlement/dual-chain-courier.ts` across the two Anvil processes described in §7.1. Rung 3
is `test/fork/ArbitrumSettlement.t.sol` and `test/fork/CeloSettlement.t.sol` under `test:fork`,
following the existing `test/fork/<Chain><Subject>.t.sol` convention and gated on the fork RPC
URLs. Rungs 4 through 7 have no repository test file; their evidence lives in the release-ops
artifacts named in `handoffs/human-release-ops.md`.

External Safe owner identities, exact live Zodiac selectors/caps, audit disposition, partner evidence, mainnet deployment, and the canary remain Release blockers. They do not block RED-first contract implementation against the frozen bounded interface.

## 9. Out of scope (base MVP; stretch called out)

Bridged G$ (never). CCIP token transfer. Arbitrary destination target/calldata. A settlement receiver that is also a Safe owner. Cancellation or a new logical attempt based only on timeout. Raw Celo/G$ transfer indexing. A settlement relayer or settlement-write automation in `packages/agent`; optional later alerts may read indexed health only and hold no dispatch, retry, acknowledgment, configuration, Safe, or value authority. Sarafu integration. Transferable settlement vouchers and `settlementAdapter` activation. Gardener settlement controls in the separate September Community PWA. Any broadcast, Safe role grant, mainnet ping, or value canary without the human Release gate.

> **Borrow-and-repay touchpoint (August-wave companion chain, `../commitment-credit-follow-on/spec.md`; unblocked 2026-08-01).** The companion `CreditRegistry` disburses **G$ micro-loans** as a `SettlementModule` disbursement (the advance down-leg) and records the repayment on Arbitrum — repayment stays **record-only** (no upward disbursement, no bridge). The seam is resolved: `DisbursementKind.LoanPrincipal` is in the ABI now (2026-08-01 amendment above) and unqueueable until the credit lane dispatches. Its reserved row shape uses `commitmentId = 0`, `payoutPlanId = 0`, `contributor = address(0)`, the loan's pool garden as `garden`/`executorGarden`, the active garden Safe as source, the borrower's canonical Celo account as recipient, canonical G$ as token, principal as amount, and `FundingRoute.None`; `Loan.disbursementId` is the reverse relationship. The credit lane adds the dedicated Approved-loan queue function and batch preflight. Contributor-consideration payout-plan functions remain commitment-bound and are never overloaded for credit.

---

## 10. Alternatives considered

*Extracted 2026-07-18 from the two Linear research documents this spec's §Decision-basis cites — "G$ in Green Goods: Bridged vs. Split-State Settlement" (`657f7233`) and "Architecture 3 Re-Score: Sarafu Commitment Pools on Celo" (`8243d7ef`), both dated 2026-07-02. Those documents recorded the only comparison behind the locked choice; this spec previously carried the conclusion alone. Preserved here so they can be retired.*

- **Architecture 1 — bridged G$ on Arbitrum.** Bridge or wrap G$ onto Arbitrum so proof and value share one chain.
- **Architecture 2 — split-state (ADOPTED).** Commitment truth on Arbitrum; canonical G$ settles on Celo from a garden-controlled Safe via a batched, operator-executed step.
- **Architecture 3 — Sarafu pools on Celo.** Keep the Arbitrum proof layer, run pooling and settlement on Grassroots Economics' deployed `erc20-pool` stack.

### 10.1 Why Architecture 1 lost

**Buy-pressure fidelity to the GoodDollar reserve — the decisive criterion.** G$ is reserve-backed on an augmented bonding curve: buying against the reserve mints and raises price. Demand for *wrapped* G$ on Arbitrum reaches that reserve only if an arbitrageur buys canonical G$ on Celo, bridges it, then sells into the wrapped pool — a loop that closes only when the Arbitrum price exceeds Celo price + bridge cost + exit friction. At pool-relevant volumes (tens to low hundreds of dollars) fees dwarf the spread on a cent-fraction token, so the arbitrage never runs and buy pressure becomes **cosmetic**. Architecture 2 inverts this: the garden, a patron, or the HoA stream acquires canonical G$ *on Celo*, so demand originates on the reserve chain and no arbitrage is required. **This, not build cost or custody convenience, is why bridging was rejected.** (The "uneconomic at pool sizes" step is the research pass's own inference, labelled as such in the source — not a measured figure.)

**Partner gate.** V4 (GIP-24) recentralized minting and reserve on Celo and made the bridge mesh Celo-primary. There is no canonical Arbitrum G$; creating one asks GoodDollar to bless infrastructure against its own direction. The source concluded Architecture 1 "may not be blessable by GoodDollar at all."

**Bridge risk.** Ronin **$625M** (Mar 2022, validator key compromise), Wormhole **~$325M** (Feb 2022, wETH minted without collateral), Nomad **$190M** (Aug 2022, upgrade accepting the 0x00 root). A wrapper adds unbacked-mint risk, depeg from canonical G$, stuck liquidity mid-settlement, and **no backstop** — GoodDollar will not backstop a wrapper it did not bless.

**Market depth.** G$ trades thin: 24h volume **$11,910.67** total, most active pair USDGLO/$G on Uniswap V3 Celo at **$10,892.52**, Crypto.com **$4,057**, Binance **$48.41** (CoinGecko; undated in source, sampled July 2026). ⚠️ **These do not reconcile** — the three venue figures sum to $14,997.93, above the stated $11,910.67 total, so they mix timestamps or metric definitions. The qualitative point (G$ markets are thin, so an Arbitrum pool would be thinner still) stands; the specific numbers should be re-sampled to one timestamp before being reused as evidence. A thin Arbitrum pool becomes the price oracle that decouples the wrapper from the $0.0001 canonical anchor — exits then fail or execute at punitive rates against the mutual-aid participants the system exists to serve.

**Causal background — the Dec-2023 reserve exploit.** Per the Good Labs Foundation post-mortem, 2023-12-17 saw "the unauthorized withdrawal of 627,328.47 cDAI and the unapproved minting of 14 billion G$ tokens," inflating supply from ~6 billion (~233% per Messari). ~1 billion G$ was liquidated on Celo/Fuse DEXs, price fell ~95%, reserve paused. This drove the V4 consolidation to Celo-primary that makes Arbitrum a dead end for canonical G$.

### 10.2 Bridging and messaging paths evaluated

Two buckets, rejected for different reasons; Hyperlane and LayerZero appear in both.

**Token-bridging (Arch 1).** LayerZero OFT/OFT-Adapter was technically cleanest (burn-and-mint, non-custodial) but **must be deployed and owned by the token issuer** — a Greenpill-deployed OFT is an unblessed synthetic. Axelar ITS, Wormhole NTT and canonical lock-and-mint carry the same constraint. A **Hyperlane warp route** was the one path Greenpill could run alone, and was rejected precisely for that. Extending GoodDollar's official mesh needs a GIP.

**Messaging for the settle-trigger (Arch 2).** The 2026-07-02 research declined cross-chain messaging in favour of operator execution plus receipt verification. That conclusion is **superseded by the 2026-07-23 transport re-freeze** after Chainlink Functions retirement and review of Green Goods' existing Chainlink CCIP sender/receiver integration. Message-only CCIP is now adopted because it creates an authenticated Arbitrum-command → bounded-Celo-execution → Arbitrum-acknowledgment path without bridging G$. The old cost figures were point-in-time estimates and are not release evidence; implementation must quote the live route and monitor native fee reserves.

> **Amendment 2026-08-06 (transport verified; testing pattern recorded).** Nothing here is
> implemented — `src/` still contains no settlement module, and `settlementEnabled` /
> `settlementAdapter` remain reserved MVP fields that are always false and zero. What has changed
> is that the transport this architecture depends on is now **proven live rather than assumed**,
> and the lane has a testing approach it does not have to invent.
>
> **Lane, verified on chain 2026-08-06.** Celo Mainnet's `ccipRouter` and `ccipChainSelector` were
> both **zero** in `deployments/networks.json`, so nothing cross-chain to Celo could be fork-tested
> at all. They now hold the official Chainlink directory values, checked against live forks of both
> chains rather than trusted:
>
> | | Arbitrum One | Celo Mainnet |
> |---|---|---|
> | router | `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` | `0xfB48f15480926A4ADf9116Dca468bDd2EE6C5F62` |
> | chain selector | `4949039107694359620` | `1346049177634351622` |
>
> Both report `typeAndVersion() == "Router 1.2.0"`, `isChainSupported` is true in **both**
> directions, and both directions quote a non-zero native fee for a message-only, zero-token
> payload. Re-runnable as `bun run contracts:settlement:verify-lane`
> (`test/fork/CrossChainSettlementLane.t.sol`). It is read-only: no broadcast, no deployment, no
> funds. The routers and selectors are read from `networks.json`, so a pass proves the shipped
> config is the live one.
>
> **Testing pattern — use `test/fork/CrossChainENS.t.sol`, do not re-derive one.** It already runs
> two forks in one process, alternates with `vm.selectFork`, hand-builds a
> `Client.Any2EVMMessage`, and delivers it with `vm.prank(router)` then `receiver.ccipReceive`.
> That is the right shape: a CCIP receiver's whole trust model is "the router called me, from this
> source selector, with this sender," so impersonating the real router on a fork exercises exactly
> that boundary with real contracts on both ends. The only simulated part is Chainlink's transport
> — their audited infrastructure, not ours. Same reasoning as the pooling fork decision: simulate
> only what belongs to someone else.
>
> The August 10 owner decision applies the revised release ladder. Celo Sepolia Safe/Zodiac
> rehearsal is dropped. Ethereum Sepolia endpoint proof is optional where it adds evidence and is
> never canonical or target-chain proof. The frozen architecture in §3, §4, and §4.1 is untouched.

### 10.3 Why Architecture 3 is an evolution, not a replacement

It wins decisively on **build reuse** — pool, limiter, quoter and registry already exist and are permissionlessly deployable (~1 CELO via `ge-publish`). It loses on **third-party protocol dependency**: it binds Green Goods to GE's roadmap and maintenance, **doubles the partnership surface** (GoodDollar *and* GE must agree), and amends the locked "one poolId carries both capabilities" principle to "poolId anchors proof; settlement venue is a referenced external Celo contract." It is also less reversible.

**Named gates to revisit it:** (1) an **ERC-777 reentrancy audit** of the deployed pool version — G$'s ERC-777 superform is a documented vector (Uniswap V1 imBTC, 2020-04-18, ~1,278 ETH; Cream Finance, 2021-08-30, 418,311,571 AMP + 1,308.09 ETH, ~$25M+); (2) a **Grassroots Economics conversation** confirming partnership, roadmap, third-party pool support and `erc20-pool` licence status; (3) GoodDollar confirming HoA G$ may seed a non-GE pool; (4) operator burden of bare-Safe settlement becoming binding. Target end-state if those clear: the **hybrid** — the garden Celo Safe transacts against a Sarafu pool instead of bare Safe-to-Safe transfers.

*Licensing nuance recorded nowhere else:* interacting with **deployed** GE contracts creates no AGPL obligation; only forking or reimplementing triggers copyleft. This is narrower than the clean-room rule (register #17) and needs counsel to confirm. The `erc20-pool` repo had **no LICENSE file** as of 2026-07-02 despite the org's stated AGPL-3.0 policy.

Canonical design-only continuation: `exchange-architecture-brief.md` carries the PRD-651 voucher,
quoter, limiter, venue, Sarafu-hybrid fork, settlement-rail generality, evidence gates, and
2026-08-19 conversation questions. The pointer authorizes no implementation and leaves
`settlementAdapter` / `settlementEnabled` activation gated.

### 10.4 ⚠️ Superseded by GIP-24 — the exit fee

Doc `8243d7ef` asserted a "correction" that the G$ exit contribution is **3%, not 10%**, citing pre-V4 documentation, and treated it as leak containment reducible via the G$X discount token. **That correction is itself superseded.** GIP-24 (V4) is authoritative: **10% decreasing toward a 5% floor** while outflows stay under 20% over two months. Doc `657f7233` was right. The G$X "reducible from 3%" mechanism rides the same pre-V4 source and must not be relied on without re-confirmation. **Not superseded:** V4 outflow limits of **40K cUSD/week and 80K cUSD/month** — both documents agree.

### 10.5 Scored comparison

Doc `657f7233` scored Architecture 2 the winner on **8 of 10** criteria. ⚠️ **Only the discriminating rows were carried across below — three of the ten are not reproduced here.** Before `657f7233` is deleted, either copy the full ten-row table or restate this as "the majority of criteria"; as written, the 8-of-10 result cannot be reconstructed from the repo, which defeats the preservation goal. Architecture 1's only genuine advantages were single-chain custody simplicity and lower build cost *if* a blessed Arbitrum OFT existed — which it does not.

| Criterion | Arch 1 | Arch 2 | Arch 3 |
|---|---|---|---|
| Buy-pressure fidelity to canonical reserve | Poor | **Best** | Good |
| Trust assumptions / attack surface | Poor | **Good** | Fair |
| Reversibility if wrong | Fair | **Best** | Fair |
| Third-party protocol dependency | Low | Low | **High** |
| Build reuse | Low | Low | **High** |
| Custody complexity | **Best** | Fair | Fair/Poor |
| Counsel / partner gates | GoodDollar | GoodDollar | GoodDollar **+ GE** |

### 10.6 Facts preserved verbatim

- **G$ token addresses** — Celo `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` (18 dec, canonical) · Fuse `0x495d133B938596C9984d462F007B676bDc57eCEC` (2 dec) · Ethereum `0x67C5870b4A41D4Ebef24d2456547A03F1f3e094B` · XDC `0xEC2136843a983885AebF2feB3931F73A8eBEe50c`. **Not natively on Arbitrum.** GOOD is a separate non-transferable governance token, out of scope.
- **Official bridge mesh** — spender `0xa3247276DbCC76Dd7705273f766eB3E8a5ecF4a5` (same on all chains); Axelar = bridge id 0, LayerZero = bridge id 1; 300M G$ max per bridge; fee estimator at `goodserver.gooddollar.org`; Fuse/XDC are LayerZero-only. V4 shut the legacy Ethereum–Fuse bridge and reversed direction so Celo is source of truth.
- **V4 reserve** — Mento Broker + Mento Expansion Controller (G$/cUSD), replacing Ethereum's GoodReserveCDai. G$ initial value $0.0001 under V4.
- **Sarafu scale — report as a range; sources conflict ~6× on users, both "as of 2025-07-20".** GE's 2025 Network Survey: 55 pools, 561 vouchers, 4,476 users, 251,449 P2P exchanges, 1,803 pool swaps, 899 impact reports. Cosmo-Local Credit white paper citing Dune: 26,367 users, 285,197 P2P exchanges, 188 active pools, 745 vouchers, $320,692 pool swap volume. Sept-2024 baseline: 33 pools, 239 vouchers, 3,149 MAU.
- **Unresolved at time of writing** — no deployed Sarafu pool was found holding G$, and no GoodDollar × GE collaboration exists. This is "no evidence found", **not** on-chain proof: sarafu.network and Celoscan pool pages were bot-blocked during the research pass.

---

## 11. Circulation measurement (extracted 2026-07-18)

Source: Linear doc `6c7a2e4e-c96a-4b8a-985d-3b9ac262087a`, "Circular G$ Economies Inside Green Goods Garden Commitment Pools" (2026-07-02). Metrics attach to the count-safe indexed stats `promiseKeptRate` and `openCommitmentCount`; operational unit totals are available only through exact-label `CommitmentUnitSummary` rows and never combine unlike labels.

This section preserves circulation formulas and their settlement/read-model dependencies. It does
not define when Green Goods may claim that pooling strengthened settlement capacity.
`pilot-evidence-spec.md` owns that claim gate, including baselines, exposure/coercion/repair
safeguards, falsification, privacy, and publication.

### Metric definitions

Reproduced as written. The document states **no excluded states** for any metric. Windows are the doc's where stated (velocity, hoard share); the rest are inferred from its pervasive one-season framing.

| Metric | Formula (numerator / denominator) | Observation window |
|---|---|---|
| Recirculation rate | in-pool G$ spend / total G$ paid out — ⚠️ **must be cohort-based and non-duplicative**, see note below | season |
| Reseed rate | G$ returning to the next season pool / G$ that entered this season | season boundary |
| Velocity | total in-pool G$ transaction volume / average pool G$ balance over the season | over the season |
| Leak rate | G$ cashed out or DEX-exited / total G$ entered | season, compared across seasons |
| Hoard share | G$ idle in gardener wallets at season end / total distributed | at season end |
| promiseKeptRate | existing indexed stat, carried unchanged | season |

Plus a **per-season cohort view** — "track each season's seed cohort separately (how far did *this* season's G$ travel before leaving)."

**⚠️ Recirculation must be defined non-duplicatively.** If "in-pool G$ spend" is implemented by summing transfers, the same payout spent twice inside a garden contributes twice while the denominator stays fixed — the rate can exceed 100% and degenerates into transaction volume, which is exactly what the reporting promise rejects. The healthy-season test asks whether settled G$ *circulated at least once*, so the numerator must be cohort-based: the share of a season's distributed G$ that was spent in-pool at least once, counted per unit, not per transfer. Settle this before the metric drives the 2026-09-30 evaluation.

### One-season targets

**The document states no numeric target for any metric.** Every target is a directional hedge, carried verbatim:

- **Recirculation rate** — "a majority of settled G$ is spent inside the pool at least once before any cash-out."
- **Reseed rate** — "a meaningful, growing share (avoid treasury hoarding while proving retention)."
- **Velocity** — "Watch the trend, not an absolute; rising velocity with stable promiseKeptRate is the healthy signal."
- **Leak rate** — "minority, and falling across seasons."
- **Hoard share** — no target stated; "High hoard means the sink is missing."
- **promiseKeptRate** — "keep high; a healthy loop does not trade circulation for broken promises."

Only recirculation ("majority") and leak ("minority") imply a threshold at all, and the document never writes the number. Any numeric gate is a decision still to be made, not an extraction.

### Healthy-season test

All five conditions, as stated. "One season is 'healthy' if:"

1. most settled G$ recirculated at least once in-pool before cash-out;
2. leak rate is a minority and trending down;
3. promiseKeptRate held high;
4. at least one merchant or sink absorbed repeat spend; and
5. stewards were not the only nodes keeping it alive.

(Section F's experiment "done condition" is a separate, experiment-scoped test — not this.)

### Settled-flow tagging dependency

The document names this **"the one hard dependency"**: the metrics "require the settlement/read model to tag G$ flows by type (in-pool spend vs cash-out)."

- **What must be tagged** — each settled G$ flow, by type: in-pool spend versus cash-out.
- **Where** — in the settlement/read model, on the settled flow itself. The doc asks whether "the split-state settlement path [can] tag in-pool spend vs cash-out for measurement," and asks GoodDollar to "confirm settled-flow tagging is possible for reporting."
- **What becomes uncomputable without it** — "recirculation rate, leak rate, and reseed rate." Stated twice: "If it cannot be tagged, the loop cannot be called healthy with evidence, and HoA reporting will be narrative-only."

HoA reporting must carry "G$ seeded, G$ recirculated in-pool, reseed rate, leak rate, promises kept, and a short promises-kept narrative with evidence" — answering GoodDAO's requirement that members "must distribute their funds in a way that increases G$ circulation, while promoting their own growth and growth of the GoodDollar reserve."

### Redemption points, sinks, and merchant design

*Green Goods design proposal, not observed precedent.* Six mechanisms in the document's own ranking order:

1. **In-pool service sink / garden store** (highest fit) — confirmed promise pays the gardener in G$; gardener buys seeds, tools, food, or workshop access from a garden-run store priced in G$; store revenue reseeds the pool. Needs only settlement payout plus a simple G$ point-of-sale.
2. **Local merchant acceptance loop** (high fit, high friction) — gardener pays a participating kiosk/vendor; merchant re-spends or cashes out. Leaks at the merchant's cash-out.
3. **Seasonal cycle with soft spend-by** (high fit, culturally native) — demurrage reframed as seasonal rhythm, on the existing cycle state machine (Draft → Seeded → Open → InProgress → Reviewing → Reconciled → Composted).
4. **Re-seeding / compost loop** (medium-high fit) — at season close, a share of pool revenue and unspent G$ is composted into the next season's seed.
5. **Mutual-aid commitment exchange without settlement** (medium fit, proof-only) — offers and requests matched and confirmed with no G$ moving.
6. **Patron top-up matching** (medium fit, growth-oriented) — "Keeps circulating only if paired with sinks; otherwise it just enlarges the amount available to cash out."

Ranking rationale, verbatim: "sinks and merchant loops create the *reason* to hold G$; seasonal and compost loops create the *rhythm* and structurally retain funds; proof-only and patronage are enablers. Without a sink (mechanism 1), everything else just accelerates the trip to the exit."

Named sinks: garden store; seed/tool bank, equipment hire, water/solar service fees; season fees (workshop, learning circle, market stall); re-seeding the next cycle's pool. Named leaks: cash-out to fiat via local off-ramp; sell to reserve or DEX swap; hoarding.

### Comparables (external precedent, not Green Goods design)

| Precedent | Figures exactly as given | Evidence quality |
|---|---|---|
| **Sarafu** | Jan 2020–Jun 2021; "over 400,000 transactions totaling 293.7 million Sarafu among approximately 40,000 users"; five largest geographic modules "capture 99.7% of the total transaction volume"; flow dominated by cycles of length 2 and 3 | Peer-reviewed — Mattsson, Criscione & Takes, *Scientific Reports* 13, Art. 5864 (2023) |
| **Banco Palmas** (Conjunto Palmeiras, Fortaleza) | "80% of [Palmeira] inhabitants' purchases were made outside the community" (1997) → "93% were made in the district" (2011); merchant discounts of 5–10% for paying in social currency | Hedged in-doc as "a single secondary estimate," via *People Money* |
| **Chiemgauer** | Demurrage scrip of 3% of note value every six months; velocity 10.6 in 2009 vs roughly 3.5 for the former Deutsche Mark ("three times greater than that of the Euro"); businesses "exchange 100 Chiemgauer for €95 minus VAT" (5% reconversion fee); 3% of each euro-to-Chiemgauer exchange routed to a local nonprofit chosen by the buyer; scale stayed roughly 2,500 users | Founder-authored (Gelleri, IJCCR); 10.6 hedged as "a 2009 author estimate" |
| **Sardex / WIR** | No figures given. "Golden rule": spend only what you expect to earn back; no interest on positive balances, penalties on stale negative balances; transaction cycles increase in prevalence over time | Cited without numbers |
| **GoodMarket** (2020–21 beta) | 212 items, ~G$5,981, 50+ trades, among only 500 eToro employees; four-week snapshot averaged "23 users making 53 transactions" | Self-reported; storefront now dormant; current community site "not an official product of GoodDollar" |
| **GoodCollective — DeTrash + Silvi** | DeTrash (Neduc, Coroadinho, Brazil): "48 women" recycled "2,000 kg of waste", received "$USD 700". Silvi (near Kakamega Forest, Kenya): "onboarded 39 people", compensated "at least two farmers". Combined: "over $USD 700 was automatically distributed to 50 pilot participants" | Oct 2024 case study, Serota; self-reported pilot. Blockers verbatim: "additional training required to establish web3 wallets, dependency on local off-ramps, and currency volatility" |

**Exit fee as a recirculation lever (GIP-24).** "10% no exception (to be gradually decreased to 5%)," replacing V3's 3% exit contribution; passed unanimously via Snapshot, late March 2025. "If the reserve experiences a net outflow of less than 20% over a two-month period, the guardians will reduce the fee by 1% incrementally until it reaches a minimum of 5%." The Celo Reserve (with Mento Labs) was funded with 200k cUSD, net-outflow limits of 40K cUSD per week and 80K cUSD per month, 1 G$ set at $0.0001. In-pool spend is the fee-free path; cash-out is the taxed path.

### Conflicts with current truth

- **SUPERSEDED** — the doc's entry point 1, "HoA stream into a garden-controlled account." Current topology: the HoA stream lands directly in the **Green Goods protocol Safe on Celo** as an upstream fact the module never queues; `ProtocolToGarden` is the only modeled queued route onward to a garden Celo Safe (`reports/corrections-log.md` §9). No working-capital hop.
- **UNMODELED (not superseded)** — the entry points "patron top-ups / matching into a season pool" and "gardener's own claimed UBI G$ brought into the pool," and the loop "store/merchant revenue in G$ reseeds the next season's pool." None has a modeled route. **Amended 2026-08-02**: one return leg above garden Safes is now modelled — gardens spending earned G$ on Green Goods team services (plan Decision Log #45; `reports/corrections-log.md` 2026-08-02). **Amended 2026-08-08**: that leg is no longer merely a circulation-model claim. Under the payer correction (register #90) a garden claiming a protocol-pool Offer records itself as `payerGarden`, so its payment is an ordinary commitment-bound `ContributorConsideration` from its own Safe — a modelled, indexed path. It adds no `FundingRoute`; the indexer derives `GARDEN_TO_PROTOCOL` from payer/provider identity. Its external compatibility with the House of Alignment mandate is **confirmed** as of 2026-08-08; GoodDollar want to see circulation. The three entry points above remain unmodeled exactly as recorded.
- **CONFIRMED** — the exit fee (GIP-24, 10% decreasing to a 5% floor) matches current truth, resolving the doc's own caveat to "confirm the current value before quoting it to gardeners." GIP-24 (exit fee) is distinct from GIP-26 (the House of Alignment distribution stream).

---

**Settlement-evidence implications (separate blocked lane; not settlement implementation scope)**

1. **Flow-type intent is now modeled.** `CommitmentSettlementFlow` derives `INTERNAL`,
   `PROTOCOL_TO_GARDEN`, `GARDEN_TO_PROTOCOL`, or reserved `GARDEN_TO_GARDEN` from immutable
   payer/provider identity and the protocol garden. This closes direction attribution for Green
   Goods settlement intent. It does not observe the actual Celo transfer or classify later wallet,
   merchant, cash-out, or DEX activity.
2. **Celo-side token observation, which the indexer boundary currently excludes.**
   `settlement-spec.md` §6 indexes Green Goods protocol events from both SettlementModule and
   CeloSettlementExecutor, but no raw G$ transfers or arbitrary token events. Every in-pool
   spend, merchant payment, cash-out, DEX swap, and idle balance is therefore still outside the
   Envio boundary. Four of the five metrics have a numerator or denominator living entirely on
   Celo. For the first evidence cycle, use only the exact approved Celo observation or attested
   read model assigned under `pilot-evidence-spec.md` §§5.2 and 10.3. If that source or its
   cohort denominator is unavailable, the result is **Unavailable**. This does not authorize
   extending Envio to raw G$ transfers, estimating the missing denominator, or adding
   participant-level tracking. A repeated-cycle need for a Celo read model is a separate
   architecture decision.
3. **Reseed rate needs Celo-side observation and season attribution — not a new funding route.** Its numerator is "G$ returning to the next season pool." A garden carrying store revenue or retained G$ into its next season does so **inside its own persistent Celo Safe** (§2), which is already the garden pool's settlement account — the funds never travel above it, so this is independent of the open Garden→protocol question in `reports/corrections-log.md` §9b. What it does require is observing Celo-side balances and attributing them to a season cohort. Do not add an upward funding route to scope on this metric's account.
4. **A pool-balance time series.** Velocity divides by "average pool G$ balance over the season," which needs sampled balances over time for the pool's Celo Safe. The admin Operations funding view currently plans a point-in-time Celo balance *read*, not a series.
5. **A registry of in-pool counterparties per garden per season.** "In-pool spend" is only decidable against a known set (garden store, seed/tool bank, participating merchant, steward accounts). Without an allowlist, every transfer out of a gardener wallet is indistinguishable from a cash-out.
6. **Season cohort identity carried through settlement,** so "this season's G$" is separable for the per-season cohort view.
7. **Denominator risk from `gardenerDeliveryEnabled`.** Contributor delivery is gated on the Celo AA/paymaster spike; if it fails, `gardenerDeliveryEnabled` stays false and contributor-payout preparation plus gardener G$ sends are blocked while `ProtocolToGarden` continues. ProtocolToGarden is treasury funding, not a contributor payout, so it does not populate the “total G$ paid out” denominator. If gardener delivery is off in season one, that denominator is near-empty and no circulation metric has a meaningful base.
8. **Numeric threshold values remain an operational assignment.** "Majority" and "minority" are not implementable gates. The two-key capacity-plus-safeguard model and stop-condition classes are approved in `pilot-evidence-spec.md`; each garden's meaningful-change and warning values must be dated before comparison-cycle outcomes are reviewed.

### 11.9 Why this section exists

The GoodDollar-facing plan commits Green Goods to reporting *"how much G$ recirculates inside a
garden versus leaves it — real circulation, not just transaction volume."* That commitment had
**no specced data source**: §§3.1.2–3.1.3 model disbursement state only, and §6 indexes Green Goods
protocol events from both `SettlementModule` and `CeloSettlementExecutor` while explicitly
excluding raw G$ transfers and arbitrary Celo token events.

The definitions above were the only written record of how those metrics are computed, and they lived in a Linear document with no spec home. They are preserved here so the document can be retired. `pilot-evidence-spec.md` now owns the approved evaluation design. Items 1–8 in "Settlement-evidence implications" are source dependencies and proof limits, not open implementation scope. Until the required source, denominator, attribution, and garden-specific threshold assignments are complete, the affected healthy-season result is **Unavailable** and cannot be evaluated as pass/fail.

These items belong to the human-owned, blocked `settlement_evidence` execution sub-lane,
`pilot-evidence-spec.md`, and `handoffs/human-settlement-evidence.md`, due at the separately labeled
2026-09-30 operational checkpoint. The first cycle is the reproducible human-reviewed operational
process in `pilot-evidence-spec.md` §10.1; it does not expand settlement, Envio, or participant
tracking. Before evidence collection or calculation is dispatched, complete the named source,
garden, threshold, qualitative, safeguarding, privacy, reproducibility, and publication
assignments in `pilot-evidence-spec.md` §10.3. Missing evidence remains unavailable rather than
creating implementation authority. Tracked at `reports/corrections-log.md` §9c.

### 11.10 Selected return leg and its gate

Decision Log #45 resolves the model choice: gardens spend earned G$ on Green Goods team
services such as support sessions, onboarding, and workshops. Local merchant, store, seed-bank,
and neighbour-spend routes remain explicitly unmodeled; they are not alternate arrows in the
selected architecture.

**Both halves are now closed.** The external half resolved on 2026-08-08: GoodDollar confirmed the
arrangement and stated they want to see circulation. The "awaiting confirmation" label is
therefore retired from the gallery, the implementation surfaces, and the partner-facing claim
rules; the compatibility question must no longer be presented as pending. What still gates
partner-facing claims is evidence that circulation actually happened, which is `pilot-evidence-spec.md`'s
job — not the mandate reading, which is settled.

The internal half changed shape the same day. The return leg is no longer only a circulation-model
claim: under the payer correction (register #90) a garden claiming a protocol-pool Offer records
`payerGarden = <that garden>`, so its payment for Green Goods services is an ordinary
commitment-bound `ContributorConsideration` disbursement from its own Safe. It introduces no new
`FundingRoute`; direction is derived as `GARDEN_TO_PROTOCOL` from `payerGarden` vs
`providerGarden`, both already carried on the disbursement — so it is a **modelled and
indexed** path rather than an off-protocol social fact. This also supplies what §11's first
settlement-evidence implication said was missing: the protocol↔garden leg now has a named derived
flow fact. The remaining metrics that depend on
Celo-side observation of gardener spend are unchanged and still outside the Envio boundary.
