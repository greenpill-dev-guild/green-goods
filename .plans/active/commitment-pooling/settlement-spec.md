# Commitment Pooling: G$ Split-State Settlement Spec (August)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (the pooling module + register this attaches to — **zero changes to those contracts here**), `diagrams.md` D8–D10 (fund-flow topology, settlement sequence, disbursement state machine), `uiux-spec.md` (surface grammar), `reports/corrections-log.md`.
**Decision basis**: Architecture 2 (split-state) remains locked from the Linear doc "G$ in Green Goods: Bridged vs. Split-State Settlement" (`657f7233-9ba8-4c38-a0f9-e3a4fdc48739`) and the Architecture 3 re-score (`8243d7ef-f880-418e-86a6-f7da75067aa9`); their comparative reasoning is preserved in §10. The settlement transport was re-frozen on 2026-07-23 after Chainlink Functions retirement: Green Goods now uses **message-only Chainlink CCIP command + acknowledgment**, reusing the repository's existing CCIP sender/receiver pattern. The Arbitrum `SettlementModule` sends an authenticated settlement command; a bounded Celo `CeloSettlementExecutor` executes through Zodiac Roles; the executor sends an authenticated acknowledgment to Arbitrum. Canonical G$ never bridges. This decision replaces every normative Functions/CRE receipt-verification path and removes manual transaction reporting from the settlement lifecycle.

**What stays true from the locked register**: no bridged G$, ever. CCIP transports data only and receives no token amounts. Sarafu integration and transferable settlement vouchers stay deferred. One Celo Safe exists per garden (1:1 mapping, deployed on demand); the Green Goods protocol Safe is the direct House of Alignment receiving account; the only modeled Green Goods funding route is protocol → garden. The Celo executor is a narrowly scoped Zodiac Roles member, never a Safe owner and never an arbitrary-call bridge. Gardeners never initiate a cross-chain command in the field. If the Celo AA/paymaster spike fails, protocol → garden funding may continue while automated member reward delivery and member sends remain blocked. No broadcast is authorized by this spec, a milestone date, or a passing implementation test.

---

## 1. The model in one paragraph

All commitment truth stays on Arbitrum. A NET-NEW **`SettlementModule`** derives immutable settlement facts, pays the native CCIP fee, and dispatches a versioned message-only command to Celo. A NET-NEW **`CeloSettlementExecutor`** on Celo authenticates the Arbitrum selector and sender, derives the registered Safe and canonical G$ configuration, executes only the bounded transfer path granted through Zodiac Roles, records the outcome idempotently, and sends a versioned acknowledgment back to Arbitrum. A settlement becomes `Confirmed` only when `SettlementModule` authenticates a success acknowledgment for the subject's current execution key and attempt. Canonical G$ (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`, Celo) never leaves Celo.

## 2. Fund-flow topology (diagrams.md D8)

```text
GoodDollar House of Alignment pilot funding (Celo, G$; mechanism pending partner evidence)
  → Green Goods protocol Safe (Celo, designated receiving account; live receipt evidence pending)   ← settlement account of the PROTOCOL pool (root garden)
    → Garden Celo Safes (NET-NEW, ONE per garden, 1:1)       ← settlement accounts of garden pools, deployed on demand
      → Members (same-address smart accounts on Celo)
```

- Each hop below the protocol Safe is a Celo G$ transfer executed by the bounded `CeloSettlementExecutor` as a scoped Zodiac Roles member. HoA → protocol Safe is an upstream funding fact, not a Green Goods queued action. The module models exactly one downstream route—protocol → garden—with derived garden, recipients, amounts, and canonical G$ token. Every queued hop becomes complete only after the authenticated Celo executor sends a success acknowledgment for the current execution key and attempt through CCIP.
- The protocol pool's declared rewards reference the GG protocol Safe as source; garden pool rewards reference that garden's Celo Safe.
- Top-ups flow down the chain (GG → garden) as **funding transfers** (not commitment-bound); they are recorded as funding events in the module so downstream exposure reporting stays honest. Protocol-Safe *inflow* (the HoA stream) is a Celo balance read + external treasury reporting, never a fabricated module event.

## 3. Arbitrum `SettlementModule`

### 3.0 Target implementation boundary frozen on 2026-07-23

This document is the implementation plan, not a description of contracts already present in
the repository. The complete target is the Commitment Pooling disbursement/account layer and
the message-only CCIP command/acknowledgment state machine defined below. There is no
intermediate owner-supplied settlement-facts API: queue functions derive eligibility, garden,
kind, recipients, amounts, and canonical G$ from frozen CommitmentPoolingModule state and the
registered settlement accounts.

The source state is `None → Queued → Dispatched → Confirmed | Failed`, with `Cancelled`
available for an unbatched Queued item, an atomically cancelled whole Queued batch, or an
authenticated Failed member. Delivery delay is an operational/indexed view over `Dispatched`,
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
| 7 | `settlementAccounts` | `mapping(address garden => SettlementAccount)` |
| 8 | `disbursements` | `mapping(uint256 => Disbursement)` |
| 9 | `batches` | `mapping(uint256 => Batch)` |
| 10 | `commitmentDisbursed` | `mapping(uint256 commitmentId => uint256 disbursementId)` (0 = none; one live disbursement per commitment) |
| 11 | `commands` | `mapping(bytes32 executionKey => CommandRecord)` |
| 12 | `commandMessageToKey` | `mapping(bytes32 messageId => bytes32 executionKey)` |
| 13 | `ccipRoute` | `CcipRoute` (Celo selector, executor peer, destination gas limit, protocol version) |
| 14 | `memberDeliveryEnabled` | `bool` (false until the Celo AA/paymaster exit gate passes) |
| 15 | `batchSizeLimit` | `uint16` (0 disables batching; production value is measured and cannot exceed 24) |
| 16 | `dispatcher` | `address` (zero disables delegated dispatch; no queue, recovery, cancellation, or configuration authority) |
| 17 | `feeReserveMinimum` | `uint256` (native ETH floor preserved by dispatch, retry, and owner withdrawal) |
| 18 | `paused` | `bool` |

The implementation constructor takes exactly `(address ccipRouter_, uint64 sourceChainSelector_)`.
Both are non-zero immutable arguments exposed as `CCIP_ROUTER()` and
`SOURCE_CHAIN_SELECTOR()`. The proxy initializer accepts neither. The source selector is the
Chainlink CCIP selector—not `block.chainid`—and is the exact value Celo receives as
`message.sourceChainSelector` when recomputing `executionKey`. Router upgrades must preserve
the verified source selector for that proxy. `SettlementModule` pays fees in native ETH only.
It never sends CCIP token amounts and never grants token approval to the router. The module
exposes native-fee balance/quote views and owner-only excess withdrawal after reserved-fee
checks. Dispatch and command retry spend the sponsored reserve rather than accepting caller
overpayment. On Celo, a caller-funded acknowledgment retry requires the exact current quote and
reverts atomically if the quote/send cannot be honored, returning the caller's CELO. This
removes a push-refund or trapped-overpayment path while preserving the safe
pull/guarded-excess principle used by the existing ENS CCIP integration. The generated
storage-layout baseline—not a prose slot estimate—sets the final storage gap.

### 3.1.2 Target types

```solidity
enum DisbursementState { None, Queued, Dispatched, Confirmed, Failed, Cancelled }
enum DisbursementKind { CommitmentReward, Funding }   // Funding = Safe top-up hop, not commitment-bound
enum FundingRoute { None, ProtocolToGarden }
enum FailureCode {
    None,
    GardenRouteUnavailable,
    InvalidRecipient,
    BatchSizeExceeded,
    TransferAmountExceeded,
    BatchAmountExceeded,
    PeriodCapExceeded,
    RouteRejected,
    RouteReverted
}

struct SettlementAccount {
    uint64 chainId;        // 42220 in August; field exists so a future venue never needs migration
    address account;       // the garden's Celo Safe
    bool active;
    address[3] recoveryOwners; // sorted ascending; exact pilot owner set
    address rolesModifier;
    bytes32 roleKey;           // exact Zodiac Roles v2 key used by the Celo executor
    address allowanceModule;
    bytes32 recoveryConfigHash; // hash(chainId, Safe, sorted owners, threshold, Roles, roleKey, Allowance)
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
    uint256 commitmentId;  // 0 for Funding kind
    address garden;        // pool garden (Arbitrum garden account)
    address executorGarden;// immutable source/payer garden: commitment.garden for rewards, protocolGarden for Funding
    DisbursementKind kind;
    FundingRoute fundingRoute; // None for CommitmentReward
    address source;        // exact Celo sender Safe; always derived at queue time
    address recipient;     // Celo address (member smart account, garden Safe, or GG Safe)
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

struct Batch {
    address executorGarden;// every member shares the same executor scope
    address source;        // every member shares source + token
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

`HARD_MAX_BATCH_SIZE = 24` is only the compile-time safety ceiling. `batchSizeLimit` starts at
zero and keeps batching disabled until worst-case destination gas, atomic Safe execution, and
acknowledgment overhead are measured. Production may set a value from 1 through 24 while
paused; both chains must report the same configured value before batching is enabled. A batch
is an immutable logical attempt: member IDs never change and a failed batch is never requeued
as a batch. Each failed member is individually requeued or terminally cancelled before any new
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

Initial dispatch snapshots the exact destination selector, executor peer, gas limit, protocol
version, and `commandPayloadHash = keccak256(encodedCommandTuple)` into `CommandRecord`.
Transport retries rebuild the canonical tuple, require the hash to match, and reuse that complete route
snapshot, `executionKey`, and logical payload; each retry has a new CCIP message ID. A
same-key retry can never target a replacement executor because idempotency storage is local to
one executor contract. Within one disbursement, a new `attempt` and execution key can be created only
after an authenticated execution-failure acknowledgment. Cancelling an unbatched Queued or
Failed commitment reward terminally closes that disbursement, clears its live
`commitmentDisbursed` pointer, and allows a later fresh disbursement ID without deleting the
old command/outcome history. Cancelling a Queued batch does the same atomically for every
immutable member through `cancelBatch`; no queued member with a non-zero `batchId` can be
cancelled alone. A delay,
missing acknowledgment, or manual CCIP execution state never creates a new logical attempt. The target failure contract is the
`FailureCode` enum above: `None == 0` means success and the source accepts only codes through
`RouteReverted == 8`. `success == true` requires `failureCode == None`; `success == false`
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
stays paused while the timelocked owner either extends the bounded grace after re-verification or
escalates an explicit quarantine/upgrade disposition; the implementation never silently
requeues, cancels, overwrites, or pays a replacement command merely because grace elapsed.

### 3.1.3 Target interface + permission matrix

| Function | Authorized caller | Gates |
|---|---|---|
| `registerSettlementAccount(garden, chainId, account, recoveryOwners[3], rolesModifier, roleKey, allowanceModule)` / `updateSettlementRecovery(garden, recoveryOwners[3], allowanceModule)` / `setAccountActive(garden, bool)` | steward or module owner | registration is write-once for garden/account/Roles/roleKey; chainId == 42220; account/modules/roleKey non-zero; owners sorted, unique, non-zero and none is a current executor; threshold fixed at 2. Recovery update may change only owners + Allowance metadata and cannot retarget the Celo execution route; events as frozen below |
| `setCcipRoute(selector, executor, gasLimit, version, previousPeerGraceSeconds)` | module owner behind the deployment timelock | requires pause; immutable implementation router is unchanged; non-zero supported route values. Same-selector/same-version executor rotation may store the prior peer with expiry no later than `block.timestamp + 30 days`. Repeating the call with the unchanged active route may only extend that same previous peer's expiry, never shorten it, revive a cleared peer, or reshuffle peers. Selector or protocol-version change requires a drained cutover with zero grace and clears the previous peer |
| `setBatchSizeLimit(limit)` | module owner behind the deployment timelock | requires pause; 0–24; zero explicitly disables batching; source and destination configured limits must match before any non-zero release |
| `setDispatcher(dispatcher)` | module owner behind the deployment timelock | requires pause; zero disables delegated dispatch; dispatcher can dispatch/retry only |
| `setFeeReserveMinimum(minimum)` | module owner behind the deployment timelock | requires pause; the new floor is immediately observable and every dispatch/retry/withdrawal must preserve it |
| `setMemberDeliveryEnabled(bool)` | module owner | enabling requires the Celo AA/paymaster exit evidence recorded in the settlement handoff; disabling blocks new commitment-reward queues and member sends but never blocks the funding route |
| `queueDisbursement(commitmentId)` | commitment-pool steward | `memberDeliveryEnabled`; commitment `Fulfilled`; active owning-pool settlement account at `settlementAccounts[commitment.garden]`; no live disbursement; declared reward rail is exactly `CeloSettlement`, token equals configured G$, and source equals that owning-pool Celo Safe. `executorGarden = commitment.garden`. Individual beneficiary = stored provider same-address Celo AA account. Garden beneficiary = the separately active `settlementAccounts[providerGarden].account`, never the Arbitrum GardenAccount. Module derives source, beneficiary, token, and amount without caller overrides; event `DisbursementQueued` |
| `queueFunding(garden, amount)` | protocol steward or module owner | the single modeled route is ProtocolToGarden, recorded on the disbursement's immutable `fundingRoute` fact; target garden must differ from `protocolGarden`; executorGarden is snapshotted as protocolGarden; source, recipient, and canonical G$ derive from funding config + active settlement accounts; no arbitrary addresses/tokens; event `DisbursementQueued(kind=Funding)` |
| `createBatch(ids[])` | resolved settlement steward for the immutable executorGarden | 1–`batchSizeLimit` unique ids, all Queued + same executorGarden, derived source, token, kind, and fundingRoute; mixed funding/reward or mixed route batches revert because the command carries one kind; the protocol executor is not a human role and cannot create source batches; member ids are persisted and immutable; event `BatchCreated` |
| `dispatchDisbursement(id)` / `dispatchBatch(batchId)` | stored steward, module owner, or exact configured `dispatcher` | subject is Queued; native fee balance covers the quote without falling below `feeReserveMinimum`; builds the fixed versioned payload with no target/token/calldata override; sends no token amounts; persists execution key/message ID; Queued → Dispatched; emits `SettlementCommandDispatched` |
| `retryCommand(id)` / `retryBatchCommand(batchId)` | stored steward, module owner, or exact configured `dispatcher` | subject remains Dispatched without authenticated acknowledgment; native fee balance covers the quote without falling below `feeReserveMinimum`; uses the command's snapshotted selector/executor/gas/version/payload hash, never the later active route; records a new CCIP message ID; never creates a second payment authority |
| CCIP acknowledgment receiver | the implementation's immutable CCIP router only | zero token amounts; supported snapshotted version; execution key maps to the current subject/attempt; `originatingCommandMessageId` must already map to that same key; source selector and encoded sender must equal that `CommandRecord`'s snapshotted destination selector/executor (which must still be the active or unexpired previous global peer); success requires `FailureCode.None`, failure requires a bounded non-zero code. Success → Confirmed; execution failure → Failed. Duplicate/stale acknowledgments are emitted and ignored without mutating settled state |
| `requeue(id)` | steward | Failed → Queued, `attempt++`; operates on one member only, clears command/ack fields and the active `batchId` association while the immutable failed Batch keeps its historical member list, and creates a new execution key only on the next unbatched dispatch. A failed batch itself remains immutable |
| `cancelDisbursement(id, reasonCID)` | steward | unbatched Queued (`batchId == 0`) or Failed only; records `cancelledFromState`, preserves failed attempt/failure history, and creates no new execution key. Commitment rewards clear only the live commitment pointer after terminal state is stored. A Dispatched subject cannot be cancelled merely because delivery or acknowledgment is late; event `DisbursementCancelled` |
| `cancelBatch(batchId, reasonCID)` | resolved batch steward | batch must be Queued; atomically marks the immutable batch and every member Cancelled-from-Queued, preserves the member list, and clears each commitment's live pointer after terminal state is stored. No partial queued-batch cancellation; event `BatchCancelled` |
| `initialize(owner, hatsModule, commitmentPoolingModule, protocolGarden, gDollarToken)` | proxy initializer | every address non-zero; protocol garden and canonical G$ become write-once configuration; IDs start at 1; delivery disabled; batch limit/dispatcher/reserve start at zero; owner-only UUPS authorization |
| fee operations (`fundFees`, `withdrawExcessFees`, `quoteCommandFee`, balance/readiness views) | anyone / owner / public | fees use native ETH; dispatch/retry and withdrawal preserve `feeReserveMinimum`; funding, floor changes, withdrawals, current balance, and low-balance state are observable |
| admin setters (`setHatsModule`, `setCommitmentPoolingModule`, `setPaused`) | module owner | dependency changes require pause. Paused source blocks new queue, batch creation, dispatch, command retry, and requeue; it permits configuration, fee funding/guarded excess withdrawal, Queued/Failed terminal cancellation, authenticated acknowledgment receipt, and unpause |
| views (`getDisbursement`, `getBatch`, `settlementAccountOf`, `disbursementOfCommitment`, `isAcknowledgmentPending`, `memberDeliveryEnabled`, `ccipRoute`, `dispatcher`, fee floor/balance/low state) | public | indexed read model derives delivery delay from Dispatched timestamp and Celo executor events; live write preflight refreshes the current native balance |

Target event/error contract (the indexer config must not use these signatures until the
corresponding contracts exist):

```solidity
event FundingConfigurationLocked(address indexed protocolGarden, address indexed gDollarToken);
event SettlementAccountRegistered(
    address indexed garden,
    uint64 chainId,
    address indexed account,
    address[3] recoveryOwners,
    address rolesModifier,
    bytes32 roleKey,
    address allowanceModule,
    bytes32 recoveryConfigHash,
    uint8 recoveryThreshold
);
event SettlementRecoveryUpdated(
    address indexed garden,
    address[3] recoveryOwners,
    bytes32 recoveryConfigHash,
    address indexed allowanceModule
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
event MemberDeliveryStatusChanged(bool enabled);
event BatchSizeLimitUpdated(uint16 previousLimit, uint16 limit);
event DispatcherUpdated(address indexed previousDispatcher, address indexed dispatcher);
event FeeReserveMinimumUpdated(uint256 previousMinimum, uint256 minimum);
event PausedSet(bool paused);
event DisbursementQueued(
    uint256 indexed disbursementId,
    uint256 indexed commitmentId,
    address indexed garden,
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
error RewardNotDeclared(uint256 commitmentId);
error CommitmentAlreadyDisbursed(uint256 commitmentId, uint256 disbursementId);
error BatchSizeOutOfBounds(uint256 supplied, uint256 maximum);
error DuplicateBatchMember(uint256 disbursementId);
error BatchMemberMismatch(uint256 disbursementId);
error InvalidCcipSource();
error InvalidCcipSender();
error CcipTokensNotAllowed();
error UnsupportedMessageVersion();
error InvalidExecutionKey();
error InsufficientNativeFee();
error FeeReserveFloorViolated(uint256 requiredMinimum, uint256 remainingBalance);
error DispatchedSettlementCannotBeCancelled();
error BatchedDisbursementCannotBeCancelled(uint256 disbursementId, uint256 batchId);
error MemberDeliveryDisabled();

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
        address allowanceModule
    ) external;
    function updateSettlementRecovery(
        address garden,
        address[3] calldata recoveryOwners,
        address allowanceModule
    ) external;
    function setAccountActive(address garden, bool active) external;
    function setMemberDeliveryEnabled(bool enabled) external;

    function queueDisbursement(uint256 commitmentId) external returns (uint256 disbursementId);
    function queueFunding(address garden, uint256 amount) external returns (uint256 disbursementId);
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
    function disbursementOfCommitment(uint256 commitmentId) external view returns (uint256);
    function isAcknowledgmentPending(bool isBatch, uint256 subjectId) external view returns (bool);
    function commandRecord(bytes32 executionKey) external view returns (CommandRecord memory);
    function memberDeliveryEnabled() external view returns (bool);
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

    function fundFees() external payable;
    function withdrawExcessFees(address payable recipient, uint256 amount) external;
    function setHatsModule(address module) external;
    function setCommitmentPoolingModule(address module) external;
    function setPaused(bool paused_) external;
}
```

**Commitment reward binding.** Rail, source, token, and amount come from `commitment.reward`; callers supply no source/recipient/token/amount override. The rail must be `CeloSettlement`, which makes the core module's `recordRewardPaid` path unavailable for the same commitment. The declared source must equal the owning pool's active registered Celo Safe: `executorGarden = commitment.garden`. For the protocol pool this is the GG protocol Safe. Individual claims preserve the unit-provider beneficiary: Offer → creator, Request → accepted counterparty, using the same-address Celo AA route. Garden claims resolve beneficiary to the separately active registered Celo Safe for `commitment.providerGarden`; the Arbitrum GardenAccount is attribution only and is never a Celo G$ recipient. Token must equal configured `gDollarToken`. Funding top-ups remain explicit non-commitment disbursements.

**Funding-route binding.** `queueFunding` never accepts source, recipient, or token. The single modeled route `ProtocolToGarden` stores source = the protocol settlement account, recipient = the target garden settlement account, garden = target garden, and immutable `executorGarden = protocolGarden`. `protocolGarden` and `gDollarToken` are write-once initializer facts with no setter, so queued and future funding commands cannot drift from the Celo executor's immutable canonical token. Both accounts must be active, amount must be non-zero, and token is always `gDollarToken`. HoA → protocol Safe is recorded in external treasury reporting, not fabricated as a module action Green Goods did not authorize.

**CCIP command/acknowledgment contract.** There is no manual reporting or manual verification entrypoint. `SettlementModule` is both the Arbitrum command sender and authenticated acknowledgment receiver. It sends data only; `destTokenAmounts` is always empty. The Celo receiver rejects token-bearing messages, validates the source selector and encoded sender, and accepts only the frozen protocol version and tuple shape.

`executionKey = keccak256(abi.encode(sourceChainSelector, sourceSettlementModule, isBatch, settlementId, attempt))` is the value-execution idempotency boundary. The subject-type domain separator prevents a same-numbered disbursement and batch from sharing authority. Retrying transport keeps the same attempt/key, destination executor, route/version/gas snapshot, and payload hash and creates only a new command message ID. A peer rotation cannot reroute that key to a replacement executor. `CeloSettlementExecutor` stores the outcome before attempting the acknowledgment; duplicate commands on the bound executor cannot execute the Safe again. `retryAcknowledgment(executionKey)` reads the stored outcome and sends a new acknowledgment message without touching G$.

On Arbitrum, only an authenticated success acknowledgment for the subject's current execution key and attempt sets `Confirmed`. An authenticated failure acknowledgment sets `Failed` with its bounded `uint8 failureCode`. Duplicate acknowledgments, stale attempts, unsupported versions, wrong selectors/senders, and token-bearing messages never mutate a current subject. The acknowledgment's `originatingCommandMessageId` must be one of the initial or retry message IDs already mapped to the same execution key; it need not be the latest ID because CCIP delivery can be out of order. A timeout or manual-execution eligibility is not an authenticated failure and therefore cannot cancel, requeue, or create a new attempt.

**Reward-status precedence**:

1. Confirmed after authenticated success acknowledgment → “support arrived.”
2. Cancelled from Queued → “this support was withdrawn before it was sent.”
3. Cancelled from Failed → “this support was closed after delivery could not complete.”
4. Failed after authenticated execution-failure acknowledgment.
5. Celo `SettlementExecutionStored` indexed but acknowledgment absent → “confirming arrival.”
6. Dispatched without Celo execution → “support on its way”; after the configured service window, add a delivery-delayed recovery state without changing contract state.
7. Queued.
8. No disbursement exists and `memberDeliveryEnabled == false` for a commitment reward → delivery-disabled availability guard.

Changing the delivery gate never hides an already queued or historical result. The gate controls
new commitment-reward queues and member wallet sends; every existing settlement renders from its
own canonical or derived state.

CCIP manual-execution eligibility and native-fee shortage are operational conditions, not payment-failure states.

**Deliberate non-couplings**:
- The Arbitrum module never custodies G$ and CCIP never transports G$. It commits an authenticated bounded instruction only.
- It does **not** call `commitmentPoolingModule.recordRewardPaid`. `RewardRail` makes the paths
  mutually exclusive: `rewardPaid` records only `ArbitrumExternal`, while
  `SettlementAcknowledged(success=true)` records `CeloSettlement`. Shared selectors still
  present one reward status per commitment by precedence: settlement-module state if a
  disbursement exists, else pooling-module `rewardPaid`. “Support arrived” is reserved for
  Confirmed. Never double-count.
- `Pool.settlementEnabled` / `Pool.settlementAdapter` on the pooling module **stay reserved for transferable settlement vouchers and stay untouched** (false/zero). August settlement presence is derived from `settlementAccounts[garden].active` on this module. Implementers must not flip the pooling-module flag.

### 3.1.4 Implementation acceptance gates

- Full state-machine coverage: unbatched/batch queue → dispatch → Celo execute → acknowledgment → Confirmed; authenticated execution failure → Failed → per-member requeue or terminal cancel; disbursement/batch key-domain separation for the same numeric ID and attempt; homogeneous batch kind/fundingRoute enforcement; same-key command retry on the exact snapshotted destination and rejection of cross-executor reroute/acknowledgment during peer grace; duplicate/out-of-order command delivery without duplicate payment; independent acknowledgment retry; contradictory success/failure-code pairs; individual cancel from unbatched Queued or Failed but never Dispatched; atomic whole-batch cancel while Queued and no partial queued-batch cancel; duplicate commitment queue, duplicate batch member, batch limit zero rejecting batches while permitting exactly-one-recipient unbatched commands, re-disable from non-zero to zero, configured limit + 1, hard ceiling + 1, malformed payload, stale acknowledgment, wrong router/source/sender, and token-bearing CCIP messages revert or are ignored as specified.
- Binding tests: every reward derives `executorGarden` and source from the commitment's owning pool garden, including protocol-Safe source for protocol commitments. Individual Offer/Request rewards derive the stored provider same-address AA recipient; Garden claims derive the separately registered `providerGarden` Celo Safe and never the Arbitrum GardenAccount. Queueing with no reward, `None`/`ArbitrumExternal` rail, zero amount, wrong source/token, inactive source or Garden-recipient account, or non-Fulfilled commitment reverts. Core `recordRewardPaid` symmetrically rejects `CeloSettlement`, proving one commitment cannot record both reward rails. The funding route derives its source/recipient/token; arbitrary routes, addresses, and tokens are impossible.
- Gating tests: non-steward queue/dispatch reverts; source pause blocks queue/batch/dispatch/
  command-retry/requeue while permitting terminal cancellation and authenticated acknowledgments;
  destination pause rejects new execution without a result/negative acknowledgment while
  permitting stored acknowledgment retry; Celo execution requires the implementation's
  immutable router plus the active or unexpired previous Arbitrum peer;
  `CeloSettlementExecutor` is never a Safe owner; its Zodiac role cannot perform arbitrary calls;
  disabling member delivery blocks commitment-reward queues and member sends but not the
  funding route.
- Configuration tests prove protocol garden/canonical G$ have no post-initialization setter,
  the implementation's immutable source selector matches the deployment chain's official CCIP
  selector and is preserved across router upgrades,
  dispatcher authority is dispatch/retry-only, and every dispatch/retry/withdrawal preserves the
  observable native-fee floor.
- Storage-layout tests use generated layouts for both UUPS contracts and include dynamic batch-member storage plus command/ack replay protection.
- Exact contract proof: `bun run --filter @green-goods/contracts test:match -- test/unit/Settlement.t.sol`, `bun run --filter @green-goods/contracts test:match -- test/unit/CeloSettlementExecutor.t.sol`, `bun run --filter @green-goods/contracts test:match -- test/integration/CCIPSettlement.t.sol`, `bun run --filter @green-goods/contracts test:script`, `bun run --filter @green-goods/contracts build:full`, `bun run --filter @green-goods/contracts lint:check`, then `bun run --filter @green-goods/contracts test`. The asynchronous Arbitrum-router/Celo-router fixture proves command/ack success, transport retries, acknowledgment retry, duplicate/out-of-order delivery, fee shortage, pause, bounded peer rotation, immutable-router cutover rehearsal, and measured batch execution.
- Required dry-run/post-check tooling: add repository Bun wrappers for a settlement plan,
  Celo executor dry run, Arbitrum module dry run, Safe/Roles configuration simulation, and a
  pre-release verifier. The strict verifier remains blocked until live routes, approved
  reserve/cap values, the frozen Commitment Pooling dependency, and production deployment
  evidence exist. Broadcast remains separately authorized.

Deployment artifacts are exact: `deployments/{chainId}-latest.json` gains
`settlementModule` on Arbitrum and `settlementExecutor` on Celo. The adjacent settlement
metadata records implementation/proxy where applicable, immutable router, active/previous
peer and peer expiry, immutable local plus remote selectors, gas limits, measured batch-size limit, code hashes,
deployment block, pause state, onchain reserve threshold, and
reviewed Commitment Pooling dependency code hash. Celo `settlement.routes` records every live
garden/Safe/Roles/role-key/probe tuple; strict verification reads and simulates those live
contracts instead of trusting a boolean. No broadcast, Safe role grant, ping, or value canary
is part of this implementation wave.

The 2026-07-23 planning snapshot records Arbitrum One selector
`4949039107694359620` and router `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8`,
plus Celo mainnet selector `1346049177634351622` and router
`0xfB48f15480926A4ADf9116Dca468bDd2EE6C5F62`;
the repository's Celo network entry remains zero until the implementation/configuration lane
is explicitly dispatched. These values are evidence, not timeless constants. Immediately
before implementation, dry-run, and broadcast, the verifier must read the official Chainlink
CCIP directory, prove the Arbitrum One ↔ Celo lane in both directions, reject zero or mismatched
router/selector values, read router bytecode, and persist the source URL, observation time,
block, router/selector pair, and code hash in the settlement metadata.

**Selector serialization is a release-critical migration.** CCIP selectors exceed JavaScript's
safe-integer range. `deployments/networks.json` currently stores non-zero selectors as JSON
numbers; a normal `JSON.parse` already rounds Arbitrum's official
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
  source Safe/Roles route. For a commitment reward it is the commitment's owning pool garden; for
  `ProtocolToGarden` funding it is `protocolGarden`, while the target garden Safe is only the
  derived recipient. The route contains a configured
  `safe` and exact `IZodiacRoles` modifier. The executor itself is the Roles member.
  Configuration verifies live Safe/route code, a 1:1 Safe↔garden mapping, Safe non-ownership,
  Roles avatar/target equality, enabled executor membership, assignment to the exact non-zero
  `bytes32 roleKey`, and the reviewed condition tree for that role.
  Once configured, a garden cannot be retargeted to another Safe or Roles modifier; executor
  replacement uses the bounded peer-rotation path. Router replacement uses the paused,
  old-message-drained implementation-upgrade cutover and never a router setter. Canonical G$ is immutable contract
  configuration; token, target, selector, and calldata are never payload fields. The executor enforces
  `maxBatchSize`, `maxTransferAmount`, `maxBatchAmount`, and a fail-closed per-garden
  periodic cap. `setPeriodicCap(uint64 periodDuration, uint256 maxPeriodAmount)` is
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
  `execTransactionWithRoleReturnData(gDollarToken, 0, transferCalldata, Enum.Operation.Call, roleKey, true)`;
  no payload field controls target, selector, role key, or calldata. The explicit stored
  `bytes32 roleKey` avoids dependence on a mutable default-role mapping, and
  `shouldRevert = true` makes a denied or failed inner call fail closed. The full batch runs
  in one non-reentrant executor transaction. Every Roles call targets canonical G$ directly;
  the role never grants a self-call or arbitrary batch target. Any rejected, reverted, or
  false-returning transfer reverts the outer transaction and rolls back all earlier recipients.
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
  `TransferAmountExceeded`, `BatchAmountExceeded`, `PeriodCapExceeded`, `RouteRejected`, or
  `RouteReverted`. Authentication, unsupported version, token-bearing messages, and malformed
  tuple shape revert before an execution result is stored.

The adapter ABI matches the reviewed Zodiac Roles v2 implementation exactly:

```solidity
interface IZodiacRoles {
    function execTransactionWithRoleReturnData(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
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
period policies. For `Funding`, every recipient must be a different active registered garden
Safe (`safeToGarden[recipient] != address(0)` and active); for `CommitmentReward`, the
authenticated source module remains authoritative for the derived individual-AA or
providerGarden-Safe recipient while Celo still enforces non-zero address, role conditions,
and value caps.

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

Exact target interface:

```solidity
interface ICeloSettlementExecutor {
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
        bytes32 roleKey
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
    function periodDuration() external view returns (uint64);
    function maxPeriodAmount() external view returns (uint256);
    function paused() external view returns (bool);
    function HARD_MAX_BATCH_SIZE() external pure returns (uint256);
    function CCIP_ROUTER() external view returns (address);
    function G_DOLLAR_TOKEN() external view returns (address);
}
```

`configureGardenRoute` is write-once for the garden/Safe/Roles tuple. Deactivation is reversible;
retargeting is not. A replacement Safe or Roles modifier requires a new executor proxy deployment
and bounded source-peer migration rather than mutating the existing route. All configuration and
policy setters require pause. `setCaps` accepts `maxBatchSize_` from 0 through 24; zero disables
only commands whose authenticated tuple has `isBatch == true`. An unbatched command must have
exactly one recipient and remains executable when `maxBatchSize == 0`; zero
`maxTransferAmount` or `maxBatchAmount` still fails all value execution closed. Source chain
selector is write-once at initialization. Same-selector/same-version
peer rotation stores only the immediately previous module with a bounded expiry. Protocol-version
change requires a paused/drained zero-grace cutover and clears the previous peer. A same-route
maintenance call may only extend the existing previous peer's expiry, capped at 30 days from
the call; it cannot shorten expiry, revive a cleared peer, or change peer order. The inherited
UUPS upgrade surface is intentionally absent from the consumer interface;
the implementation test proves owner-only `_authorizeUpgrade`, pause, immutable-router change,
unchanged G$, and the external drained-message precondition.

Exact pre-execution errors:

```solidity
error InvalidCcipSource();
error InvalidCcipSender();
error CcipTokensNotAllowed();
error UnsupportedMessageVersion();
error MalformedSettlementCommand();
error UnknownExecutionKey(bytes32 executionKey);
error GardenRouteAlreadyConfigured(address garden);
error SafeAlreadyAssigned(address safe, address garden);
error PolicyNotConfigured();
error IncorrectAcknowledgmentFee(uint256 quoted, uint256 supplied);
error AcknowledgmentFeeReserveFloorViolated(uint256 requiredMinimum, uint256 remainingBalance);
error ExecutorMustBePaused();
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
    bytes32 roleKey
);
event GardenRouteStatusChanged(address indexed garden, bool active);
event CapsUpdated(uint16 maxBatchSize, uint256 maxTransferAmount, uint256 maxBatchAmount);
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
  attributed to its Arbitrum garden account. Deployment remains **on-demand and
  Release-gated**. No `settlement-safe` deployment command is delivered in the current
  repository because Safe creation, owner recovery, and the production Roles condition tree
  require separately approved governance inputs. The planned executor registers an already
  deployed Safe/Rules pair only after live one-to-one, non-owner, avatar/target, membership,
  and role checks; strict verification re-proves that route. A future Safe deployer may use
  deterministic garden input, but this spec does not claim an executable target that does not
  exist.
- **Owner set at deployment**: exactly 2-of-3 for the pilot — the protocol recovery multisig, the Dev Guild recovery multisig, and one named garden recovery delegate who can sign on Celo. Deployment fails if an owner is duplicated, zero, unnamed in the artifact, or also configured as an executor. The Arbitrum garden account is the canonical attribution and deterministic deployment input, but is **not** inserted as a non-signing owner. The script writes `packages/contracts/deployments/{chainId}-settlement-safes.json` with garden, Safe, sorted owners, threshold, Roles, exact `roleKey`, Allowance, scoped selectors, per-period cap, salt, code hashes, and receipt blocks. Registration recomputes `recoveryConfigHash = keccak256(abi.encode(chainId, safe, sortedOwners, uint8(2), rolesModifier, roleKey, allowanceModule))`. `addExecutor` performs a bounded three-owner rejection; the post-deploy verifier also reads the live Safe owner set and Roles membership because Arbitrum cannot prove later Celo configuration drift by itself.
- **Signer scoping (Zodiac Roles Modifier)**: the `CeloSettlementExecutor` contract—not an operator key—is the Roles member and may only call the canonical G$ transfer/approved atomic batch path. The cap policy bounds value per transfer, batch, and period. Removing the executor role still leaves the 2-of-3 recovery owners able to rotate modules safely.
- **Ownership nuance (named honestly)**: an Arbitrum ERC-6551 account cannot sign on Celo today. “Garden-controlled” means the Arbitrum module authorizes the garden mapping and reward, accountable Celo governance signers control recovery, and scoped executors perform the bounded transfer. A future validated cross-chain module may let the garden account trigger its Safe literally; that path is not required for base settlement.
- **Gas**: the Arbitrum module holds monitored native ETH for outbound commands; the Celo executor holds monitored native CELO for acknowledgments. Neither route uses LINK fee payment. Fee shortage is surfaced before dispatch where possible and is never presented as settlement failure. Member receipts are pure ERC-20 transfers; member sends use sponsored gas (§5).

## 5. Member receipt + multi-chain app

**Decision (register #16)**: members receive at **same-address smart accounts on Celo** — the same passkey-owned account address they have on Arbitrum, counterfactually deployable on Celo.

- **Verification spike (first week of the August track, blocking for this leg)**: confirm our AA stack on Celo — account factory deployable at same addresses, bundler + paymaster support (Pimlico or equivalent) on 42220, passkey signature validation parity. Exit: one testnet/mainnet round-trip — receive G$ at the counterfactual address, deploy on first send, sponsored send succeeds.
- **Failure behavior**: if the spike fails, `memberDeliveryEnabled` remains false. ProtocolToGarden settlement may continue, but commitment-reward queueing, automated member delivery, and member G$ sends remain blocked. There is no alternate member-delivery path.

**Multi-chain app (register #17)** — the Single Chain principle amends to: **primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo, 42220) for value legs**. The CLAUDE.md principle edit rides the implementation PR, not this spec. August scope, all tiers:

| Tier | What ships | Notes |
|---|---|---|
| Reads | Celo Safe balances (admin funding views), member G$ balance (WalletDrawer only after the AA gate), command/execution/ack status everywhere | Status combines Arbitrum `SettlementModule` events with bounded Celo `CeloSettlementExecutor` events; balances use Celo RPC. Shared selectors distinguish queued, dispatched, executed/ack-pending, confirmed, failed, and delayed. |
| Operator writes | Queue and dispatch a command; retry the same command after transport delay; retry a stored Celo acknowledgment when fee/delivery recovers; create a new logical attempt only after authenticated execution failure. | Once dispatched, timeout alone cannot cancel or requeue the payment. |
| Member writes | Send G$ from the wallet on Celo: chain-aware send flow with **sponsored gas** (members never hold CELO) | Entire row is gated by `memberDeliveryEnabled`; if the AA spike fails it does not ship. When enabled, this is an explicit online wallet action, never an offline job; `transfer` uses `{ chainId, token, to, amount }`. |

Shared substrate additions (extends PRD-674's scope via this spec): settlement chain registry (`{ primary, settlement }` chain config), second public client, G$ token config, `queryKeys.settlement.*` family, settlement/disbursement hooks + selectors (including the reward-status precedence rule from §3.3), and an online wallet `transfer` capability that is unavailable while `memberDeliveryEnabled == false`.

## 6. Indexer

Envio indexes Green Goods protocol events from both the Arbitrum `SettlementModule` and Celo `CeloSettlementExecutor`. It does **not** index raw G$ transfers or arbitrary Celo token events. The Celo event slice is necessary to distinguish “executed; acknowledgment pending” from “not delivered.” New config blocks use deployment-artifact placeholders pre-broadcast.

```graphql
enum DisbursementState { UNKNOWN QUEUED DISPATCHED CONFIRMED FAILED CANCELLED }
enum DisbursementKind { UNKNOWN COMMITMENT_REWARD FUNDING }
enum FundingRoute { UNKNOWN NONE PROTOCOL_TO_GARDEN }
enum SettlementExecutionStatus { UNKNOWN SUCCESS FAILED }

type SettlementConfiguration {
  id: ID! # chainId-settlement-config
  chainId: Int!
  role: String! # SOURCE or EXECUTOR
  memberDeliveryEnabled: Boolean # SOURCE only
  localRouter: String!
  localChainSelector: BigInt!
  remoteChainSelector: BigInt!
  activePeer: String!
  previousPeer: String
  previousPeerExpiresAt: BigInt
  protocolVersion: Int!
  dispatcher: String # SOURCE only; null means delegated dispatch disabled
  batchSizeLimit: Int!
  maxTransferAmount: BigInt # EXECUTOR only
  maxBatchAmount: BigInt # EXECUTOR only
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
  gardenId: String! # composite Garden relationship
  accountChainId: Int!
  account: String!
  active: Boolean!
  recoveryConfigHash: String!
  recoveryThreshold: Int!
  recoveryOwners: [String!]!
  rolesModifier: String!
  roleKey: String! # bytes32 Zodiac Roles v2 key
  allowanceModule: String!
  updatedAt: Int!
}

type SettlementGardenRoute {
  id: ID! # executorChainId-lowercaseGarden
  chainId: Int! # executor chain, 42220 for the pilot
  sourceChainId: Int! # source Garden identity chain, 42161 for Arbitrum One
  garden: String!
  gardenId: String! # sourceChainId-lowercaseGarden
  settlementAccountId: String! # sourceChainId-lowercaseGarden
  safe: String!
  rolesModifier: String!
  roleKey: String! # bytes32 Zodiac Roles v2 key
  active: Boolean!
  configuredAt: Int!
  updatedAt: Int!
}
type Disbursement {
  id: ID! # chainId-disbursementId
  chainId: Int! disbursementId: BigInt! garden: String! gardenId: String!
  executorGarden: String! executorGardenId: String! commitmentId: BigInt commitmentEntityId: String
  kind: DisbursementKind! fundingRoute: FundingRoute! source: String!
  recipient: String! token: String! amount: BigInt!
  state: DisbursementState! batchId: BigInt batchEntityId: String reasonCID: String
  attempt: Int! executionKey: String commandMessageId: String dispatchedAt: Int
  celoExecutionTx: String acknowledgmentMessageId: String confirmedAt: Int failureCode: Int
  cancelledFromState: DisbursementState
  createdAt: Int! updatedAt: Int!
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
  executorGardenId: String!
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

Exact Envio contract block for both Arbitrum and Sepolia (addresses remain deployment-artifact placeholders until broadcast):

```yaml
- name: SettlementModule
  handler: src/EventHandlers.ts
  events:
    - event: FundingConfigurationLocked(address indexed protocolGarden, address indexed gDollarToken)
    - event: SettlementAccountRegistered(address indexed garden, uint64 chainId, address indexed account, address[3] recoveryOwners, address rolesModifier, bytes32 roleKey, address allowanceModule, bytes32 recoveryConfigHash, uint8 recoveryThreshold)
    - event: SettlementRecoveryUpdated(address indexed garden, address[3] recoveryOwners, bytes32 recoveryConfigHash, address indexed allowanceModule)
    - event: SettlementAccountStatusChanged(address indexed garden, bool active)
    - event: CcipRouteUpdated(uint64 indexed destinationChainSelector, address indexed destinationExecutor, address indexed previousDestinationExecutor, uint64 previousPeerExpiresAt, uint32 destinationGasLimit, uint8 protocolVersion)
    - event: MemberDeliveryStatusChanged(bool enabled)
    - event: BatchSizeLimitUpdated(uint16 previousLimit, uint16 limit)
    - event: DispatcherUpdated(address indexed previousDispatcher, address indexed dispatcher)
    - event: FeeReserveMinimumUpdated(uint256 previousMinimum, uint256 minimum)
    - event: PausedSet(bool paused)
    - event: DisbursementQueued(uint256 indexed disbursementId, uint256 indexed commitmentId, address indexed garden, address executorGarden, uint8 kind, uint8 fundingRoute, address source, address recipient, address token, uint256 amount)
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

Exact Celo network block:

```yaml
- name: CeloSettlementExecutor
  handler: src/EventHandlers.ts
  events:
    - event: SourcePeerUpdated(uint64 indexed sourceChainSelector, address indexed sourceSettlementModule, address indexed previousSourceSettlementModule, uint64 previousPeerExpiresAt, uint8 protocolVersion)
    - event: GardenRouteConfigured(address indexed garden, address indexed safe, address indexed rolesModifier, bytes32 roleKey)
    - event: GardenRouteStatusChanged(address indexed garden, bool active)
    - event: CapsUpdated(uint16 maxBatchSize, uint256 maxTransferAmount, uint256 maxBatchAmount)
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

The Celo network block indexes exactly the thirteen `CeloSettlementExecutor` events frozen in §4.
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

Handlers follow `commitmentPool.ts` patterns (create-if-not-exists, dedup, composite IDs, `bun codegen`). Command retries and acknowledgment retries create new message rows but never duplicate settlement execution. `DisbursementQueued` is the immutable source/route fact, so handlers never infer the funding path. Route/peer, source and executor batch limits, executor transfer/aggregate/period caps, pause, dispatcher, reserve-floor, funding, fee-spend, and withdrawal events update the appropriate chain's singleton `SettlementConfiguration`; Celo route events update `SettlementGardenRoute`. Every Arbitrum command send spends the module reserve. Every Celo acknowledgment send carries the native fee plus `reserveFunded`, so the handler decrements the CELO reserve only for the automatic/sponsored path and never for an exact caller-funded retry. `feeReserveLow` derives from indexed balance versus indexed floor, while the shared live-read path refreshes the current native balance before any write. `packages/contracts/script/utils/envio-integration.ts` must preserve the Commitment Pooling, Arbitrum SettlementModule, and CeloSettlementExecutor blocks; the boundary checker allows exactly their Green Goods protocol events and rejects raw G$ transfer indexing.

The generated indexer configuration seeds each `SettlementConfiguration` row at its deployment
block from the verified deployment metadata: role, local contract, immutable router, exact
decimal-string local selector, and remote chain identity. Events then own every mutable field.
The preservation fixture fails if either seed is absent, rounded, or inconsistent with the
indexed contract block. No handler invents local router/selector values from JavaScript
numbers, and receipt-only message rows keep `fee = null` until a source send event supplies it.

Exact indexer proof from the repo root: `bun run --filter @green-goods/indexer codegen`, `bun run --filter @green-goods/indexer setup-generated`, `bun run --filter @green-goods/indexer check:indexing-boundary`, `bun run --filter @green-goods/indexer test`, and `bun run --filter @green-goods/indexer build`. The preservation regression runs before and after codegen and compares both configured network blocks and every locked signature.

## 7. Surface impact (deltas to `uiux-spec.md` / `wireframes.md`; W21/W22/W23 are the settlement frames)

- **W2 commitment detail (PWA)**: reward row gains distinct settlement status — “support is queued” (Queued), “support on its way” (Dispatched), “support on its way — delivery delayed” (derived delay; contract state remains Dispatched), “confirming arrival” (Celo execution indexed; acknowledgment pending), “support arrived” + Celo ref (Confirmed), “still arranging support — your promise is recorded” (authenticated execution failure), “this support was withdrawn before it was sent — your promise and its record stay intact” (Cancelled from Queued), and “this support was closed after delivery could not complete — your promise and its record stay intact” (Cancelled from Failed).
- **W23 WalletDrawer G$ section (settlement delta to W5)**: only after the AA gate, G$ balance section (Celo) + received-support rows; send action → chain-aware transfer flow. When disabled, no balance/send affordance renders and explanatory copy points to the blocked delivery gate.
- **W21 Garden Pool tab settlement section (delta to W7)**: settlement account card (Safe address, active, cap snapshot, plus read-only member-delivery status) + disbursement queue. The CCIP command/ack console is **W22** and distinguishes retrying the same command from retrying a stored acknowledgment or creating a new attempt.
- **W10 commitment dialog**: `CeloSettlement` exposes "Queue disbursement" and never "Record payout"; `ArbitrumExternal` exposes "Record payout" and never queues settlement. Batch actions remain in W21/W22.
- **Admin Operations tab funding view (deployer-gated)**: protocol-Safe inflow, GG→garden funding hops, Safe balances, native ETH/CELO fee reserves, command/ack message IDs and explorer links, delivery/manual-execution guidance, Safe/Roles/cap health, and batch console.
- Editorial/community: no change (aggregates only; settlement is not a public story before its separately authorized Release gate).

i18n families extend `app.pool.*`, `cockpit.garden.pool.*`, `cockpit.community.pools.*` with `settlement.*` keys (en/es/pt, same gate). Banned-vocab rules apply to all new copy.

## 8. Linear-aligned sequencing (amends plan Track B)

Settlement implementation runs after the pooling reward interface freezes:

1. **Protocol implementation**: versioned payload library, Arbitrum `SettlementModule`, Celo `CeloSettlementExecutor`, two-router asynchronous test harness, idempotent same-key retries, independent acknowledgment retry, native-fee reserve views, deployment/config dry runs, and bounded Safe adapter seam.
2. **Read model + surfaces**: index Arbitrum command/ack events and bounded Celo executor events; add shared state/queries; expose queued/dispatched/executed-ack-pending/confirmed/failed/delayed states; add admin fee/route/Safe health and retry controls; add client reward states.
3. **Release evidence (separately authorized)**: because no active Celo CCIP testnet is available, the old two-week Celo-testnet requirement is replaced by the explicit alternative gate below. No mainnet deployment or canary is authorized in this implementation wave.

**No-active-Celo-testnet alternative gate**:

1. Deterministic two-router local command/ack tests, including duplicate and out-of-order delivery.
2. Separate Arbitrum and Celo fork processes proving route configuration without broadcasting.
3. Mainnet candidates deployed paused with no Safe role or value authority.
4. Message-only ping/ack canary.
5. External audit, timelock, peer/code-hash checks, and Safe/Zodiac configuration review.
6. Human-authorized, tightly capped minimum-value G$ canary.
7. Observation period and explicit human approval before raising caps.

External Safe owner identities, exact live Zodiac selectors/caps, audit disposition, partner evidence, mainnet deployment, and the canary remain Release blockers. They do not block RED-first contract implementation against the frozen bounded interface.

## 9. Out of scope (base MVP; stretch called out)

Bridged G$ (never). CCIP token transfer. Arbitrary destination target/calldata. A settlement receiver that is also a Safe owner. Cancellation or a new logical attempt based only on timeout. Raw Celo/G$ transfer indexing. A settlement relayer or settlement-write automation in `packages/agent`; optional later alerts may read indexed health only and hold no dispatch, retry, acknowledgment, configuration, Safe, or value authority. Sarafu integration. Transferable settlement vouchers and `settlementAdapter` activation. Member settlement controls in the separate September Community PWA. Any broadcast, Safe role grant, mainnet ping, or value canary without the human Release gate.

> **Borrow-and-repay touchpoint (blocked follow-on, `../../backlog/commitment-credit-follow-on/spec.md`).** A companion `CreditRegister` may disburse **G$ micro-loans** as a `SettlementModule` disbursement (the advance down-leg) and record the repayment on Arbitrum — repayment stays **record-only** (no upward disbursement, no bridge). One small seam to resolve when it lands: either add `DisbursementKind.LoanPrincipal` (§3.2) **or** let `queueDisbursement` accept a `commitmentId == 0` credit disbursement (it currently gates on a Fulfilled commitment, §3.3). Out of scope for this spec; flagged so the seam is a conscious choice, not a surprise.

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

### 10.3 Why Architecture 3 is an evolution, not a replacement

It wins decisively on **build reuse** — pool, limiter, quoter and registry already exist and are permissionlessly deployable (~1 CELO via `ge-publish`). It loses on **third-party protocol dependency**: it binds Green Goods to GE's roadmap and maintenance, **doubles the partnership surface** (GoodDollar *and* GE must agree), and amends the locked "one poolId carries both capabilities" principle to "poolId anchors proof; settlement venue is a referenced external Celo contract." It is also less reversible.

**Named gates to revisit it:** (1) an **ERC-777 reentrancy audit** of the deployed pool version — G$'s ERC-777 superform is a documented vector (Uniswap V1 imBTC, 2020-04-18, ~1,278 ETH; Cream Finance, 2021-08-30, 418,311,571 AMP + 1,308.09 ETH, ~$25M+); (2) a **Grassroots Economics conversation** confirming partnership, roadmap, third-party pool support and `erc20-pool` licence status; (3) GoodDollar confirming HoA G$ may seed a non-GE pool; (4) operator burden of bare-Safe settlement becoming binding. Target end-state if those clear: the **hybrid** — the garden Celo Safe transacts against a Sarafu pool instead of bare Safe-to-Safe transfers.

*Licensing nuance recorded nowhere else:* interacting with **deployed** GE contracts creates no AGPL obligation; only forking or reimplementing triggers copyleft. This is narrower than the clean-room rule (register #17) and needs counsel to confirm. The `erc20-pool` repo had **no LICENSE file** as of 2026-07-02 despite the org's stated AGPL-3.0 policy.

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
| Hoard share | G$ idle in member wallets at season end / total distributed | at season end |
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
- **UNMODELED (not superseded)** — the entry points "patron top-ups / matching into a season pool" and "gardener's own claimed UBI G$ brought into the pool," and the loop "store/merchant revenue in G$ reseeds the next season's pool." None has a modeled route; there is no return leg above garden Safes.
- **CONFIRMED** — the exit fee (GIP-24, 10% decreasing to a 5% floor) matches current truth, resolving the doc's own caveat to "confirm the current value before quoting it to gardeners." GIP-24 (exit fee) is distinct from GIP-26 (the House of Alignment distribution stream).

---

**Settlement-evidence implications (separate blocked lane; not settlement implementation scope)**

1. **A flow-type tag on settled flows.** Nothing in `settlement-spec.md` carries one. `DisbursementKind {CommitmentReward, Funding}` and `FundingRoute {None, ProtocolToGarden}` exist but tag the *purpose of an outbound disbursement*, not recirculation vs leak — neither is a substitute.
2. **Celo-side observation, which the indexer boundary currently excludes.** `settlement-spec.md` §Indexer: "Envio indexes the Arbitrum SettlementModule, not Celo token events." Every in-pool spend, merchant payment, cash-out, DEX swap, and idle balance is a Celo G$ fact. Four of the five metrics have a numerator or denominator living entirely on Celo. For the first evidence cycle, use only the exact approved Celo observation or attested read model assigned under `pilot-evidence-spec.md` §§5.2 and 10.3. If that source or its cohort denominator is unavailable, the result is **Unavailable**. This does not authorize extending Envio to raw G$ transfers, estimating the missing denominator, or adding participant-level tracking. A repeated-cycle need for a Celo read model is a separate architecture decision.
3. **Reseed rate needs Celo-side observation and season attribution — not a new funding route.** Its numerator is "G$ returning to the next season pool." A garden carrying store revenue or retained G$ into its next season does so **inside its own persistent Celo Safe** (§2), which is already the garden pool's settlement account — the funds never travel above it, so this is independent of the open Garden→protocol question in `reports/corrections-log.md` §9b. What it does require is observing Celo-side balances and attributing them to a season cohort. Do not add an upward funding route to scope on this metric's account.
4. **A pool-balance time series.** Velocity divides by "average pool G$ balance over the season," which needs sampled balances over time for the pool's Celo Safe. The admin Operations funding view currently plans a point-in-time Celo balance *read*, not a series.
5. **A registry of in-pool counterparties per garden per season.** "In-pool spend" is only decidable against a known set (garden store, seed/tool bank, participating merchant, steward accounts). Without an allowlist, every transfer out of a member wallet is indistinguishable from a cash-out.
6. **Season cohort identity carried through settlement,** so "this season's G$" is separable for the per-season cohort view.
7. **Denominator risk from `memberDeliveryEnabled`.** Individual member delivery is gated on the Celo AA/paymaster spike; if it fails, `memberDeliveryEnabled` stays false and commitment-reward queueing plus member G$ sends are blocked while `ProtocolToGarden` continues. If member delivery is off in season one, "total G$ paid out" — the recirculation denominator — is near-empty and no circulation metric has a meaningful base.
8. **Numeric threshold values remain an operational assignment.** "Majority" and "minority" are not implementable gates. The two-key capacity-plus-safeguard model and stop-condition classes are approved in `pilot-evidence-spec.md`; each garden's meaningful-change and warning values must be dated before comparison-cycle outcomes are reviewed.

### 11.9 Why this section exists

The GoodDollar-facing plan commits Green Goods to reporting *"how much G$ recirculates inside a garden versus leaves it — real circulation, not just transaction volume."* That commitment had **no specced data source**: §3.2 models disbursement state only, and §6 explicitly scopes the indexer to "the Arbitrum SettlementModule, not Celo token events."

The definitions above were the only written record of how those metrics are computed, and they lived in a Linear document with no spec home. They are preserved here so the document can be retired. `pilot-evidence-spec.md` now owns the approved evaluation design. Items 1–8 in "Settlement-evidence implications" are source dependencies and proof limits, not open implementation scope. Until the required source, denominator, attribution, and garden-specific threshold assignments are complete, the affected healthy-season result is **Unavailable** and cannot be evaluated as pass/fail.

These items belong to the human-owned, blocked `settlement_evidence` execution sub-lane,
`pilot-evidence-spec.md`, and `handoffs/human-settlement-evidence.md`, due at the separately labeled
2026-09-30 operational checkpoint. The first cycle is the reproducible human-reviewed operational
process in `pilot-evidence-spec.md` §10.1; it does not expand settlement, Envio, or participant
tracking. Before evidence collection or calculation is dispatched, complete the named source,
garden, threshold, qualitative, safeguarding, privacy, reproducibility, and publication
assignments in `pilot-evidence-spec.md` §10.3. Missing evidence remains unavailable rather than
creating implementation authority. Tracked at `reports/corrections-log.md` §9c.

### 11.10 One conflict carried across deliberately

The source document's Recommendation 1 treats a working sink as a **proceed-gate**: *"Do not scale HoA distributions or add gardens until at least one garden has a working service sink."* The repo rule in `visual-assets.md` says the local spend sink is *"a circulation aim / ordering criterion, never a launch gate."*

Both are live, and they are reconcilable but not identical: settlement **capability** is not sink-gated, while scaling the G$ **distribution** into a garden does follow sink readiness — which is also what the GoodDollar-facing July plan commits to ("build the place to spend before widening the flow"). Recorded so the tension is visible rather than silently resolved in one direction.
