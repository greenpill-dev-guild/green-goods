# Commitment Pooling: G$ Split-State Settlement Spec (August)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (the pooling module + register this attaches to — **zero changes to those contracts here**), `diagrams.md` D8–D10 (fund-flow topology, settlement sequence, disbursement state machine), `uiux-spec.md` (surface grammar), `reports/corrections-log.md`.
**Decision basis**: Architecture 2 (split-state) locked in the Linear doc "G$ in Green Goods: Bridged vs. Split-State Settlement" (`657f7233-9ba8-4c38-a0f9-e3a4fdc48739`), re-affirmed by the Architecture 3 re-score (`8243d7ef-f880-418e-86a6-f7da75067aa9`) — **their comparative reasoning is preserved in §10**, and both are cleared for deletion; cite the IDs, since a multi-word Linear title search returns nothing even for a live document, and archived documents remain retrievable by ID; user decisions through 2026-07-20: settlement is built by the **2026-07-31 Build close** and targets the **2026-08-12 Release** only after its value-tier gate passes; one Celo Safe exists per garden (1:1 mapping, deployed on demand); member receipt targets same-address smart accounts; the app goes multi-chain this iteration; Green Goods designates its protocol Safe on Celo as the direct House of Alignment receiving account (topology corrected 2026-07-18; supersedes the 2026-07-10 two-hop topology — see corrections-log §9), while live mechanism and receiving-address evidence remain settlement unblock inputs; Green Goods settlement uses G$ on Celo without bridging it to Arbitrum; and receipt verification is a mandatory Chainlink Functions oracle path with no manual fallback. The release date waives no gate.

**What stays true from the locked register**: no bridged G$, ever. No bridge custodies G$ or holds unbounded value authority. Sarafu integration stays deferred. Transferable settlement vouchers stay gated on [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651). Build-phase settlement is operator-executed; bridge-executor automation is Follow On / Hardening only. Gardeners never sign cross-chain transactions in the field. If the Celo AA/paymaster spike fails, downstream protocol/garden funding may continue but automated member reward delivery remains blocked; there is no alternate member-claim path.

---

## 1. The model in one paragraph

All commitment truth stays on Arbitrum. A NET-NEW **`SettlementModule`** on Arbitrum registers each garden's Celo Safe, derives commitment rewards and the protocol → garden treasury route, owns the bounded failure/retry state machine, and sends reported Celo references to **Chainlink Functions** for receipt verification. Authorization happens where Hats lives; execution happens on Celo through Zodiac Roles + Allowance. Executors may report, but only the configured Functions router callback can produce `Verified` or receipt-invalid `Failed`; infrastructure errors leave the record `Reported` for retry. Canonical G$ (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`, Celo) never leaves Celo.

## 2. Fund-flow topology (diagrams.md D8)

```text
GoodDollar House of Alignment pilot funding (Celo, G$; mechanism pending partner evidence)
  → Green Goods protocol Safe (Celo, designated receiving account; live receipt evidence pending)   ← settlement account of the PROTOCOL pool (root garden)
    → Garden Celo Safes (NET-NEW, ONE per garden, 1:1)       ← settlement accounts of garden pools, deployed on demand
      → Members (same-address smart accounts on Celo)
```

- Each hop below the protocol Safe is a Safe-to-Safe G$ transfer executed by scoped Roles members. HoA → protocol Safe is an upstream funding fact, not a Green Goods queued action. The module models exactly one downstream route—protocol → garden—with derived source, recipient, and canonical G$ token. Every queued hop reports its Celo tx hash and becomes complete only after its Chainlink Functions callback verifies the finalized receipt.
- The protocol pool's declared rewards reference the GG protocol Safe as source; garden pool rewards reference that garden's Celo Safe.
- Top-ups flow down the chain (GG → garden) as **funding transfers** (not commitment-bound); they are recorded as funding events in the module so downstream exposure reporting stays honest. Protocol-Safe *inflow* (the HoA stream) is a Celo balance read + external treasury reporting, never a fabricated module event.

## 3. `SettlementModule` (NET-NEW `packages/contracts/src/modules/Settlement.sol`)

Scaffold conventions copied from `contract-spec.md` §6.1: UUPS + Ownable + ReentrancyGuard, `_disableInitializers`, steward gate copied from the pooling module (`_requirePoolSteward` shape — garden operator/owner via hatsModule, module owner fallback, protocol pool → root-garden Hats), CookieJar-style storage comment + 50-slot accounting.

### 3.1 Storage (slot accounting)

| # | Entry | Type |
|---|---|---|
| 1 | `hatsModule` | `IHatsModule` |
| 2 | `commitmentPoolingModule` | `ICommitmentPoolingModule` (reads commitment/pool state) |
| 3 | `protocolGarden` | `address` (root/protocol garden whose settlement account is the GG protocol Safe) |
| 4 | `gDollarToken` | `address` (canonical Celo G$; configured, never caller supplied) |
| 5 | `nextDisbursementId` | `uint256` (starts at 1) |
| 6 | `nextBatchId` | `uint256` |
| 7 | `settlementAccounts` | `mapping(address garden => SettlementAccount)` |
| 8 | `executors` | `mapping(address garden => mapping(address => bool))` (back-office Zodiac Roles members; never Safe owners) |
| 9 | `disbursements` | `mapping(uint256 => Disbursement)` |
| 10 | `batches` | `mapping(uint256 => Batch)` |
| 11 | `commitmentDisbursed` | `mapping(uint256 commitmentId => uint256 disbursementId)` (0 = none; one live disbursement per commitment) |
| 12 | `usedExecutionRefs` | `mapping(bytes32 => bool)` (a Celo tx ref belongs to one subject/attempt) |
| 13 | `verificationRequests` | `mapping(bytes32 requestId => VerificationSubject)` |
| 14 | `functionsConfig` | `FunctionsConfig` (subscription, DON, callback gas, pinned source, encrypted secrets ref) |
| 15 | `memberDeliveryEnabled` | `bool` (false until the Celo AA/paymaster exit gate passes) |
| 16 | `paused` | `bool` |

The Functions router is an immutable implementation-constructor argument following `FunctionsClient`; the proxy initializer never accepts a caller-supplied router. Actual slot accounting, not declaration counting, governs the gap: entries 1–13 consume thirteen slots; `FunctionsConfig` consumes five; `memberDeliveryEnabled` and `paused` pack into one; total named storage is nineteen slots. Gap: `uint256[31] private __gap;` (19 used + 31 reserved = 50). The generated storage-layout baseline is the acceptance authority.

### 3.2 Types

```solidity
enum DisbursementState { None, Queued, Executing, Reported, Verified, Failed, Cancelled }
enum DisbursementKind { CommitmentReward, Funding }   // Funding = Safe top-up hop, not commitment-bound
enum FundingRoute { None, ProtocolToGarden }
enum VerificationResult { Valid, ReceiptInvalid, InfrastructureError }

struct SettlementAccount {
    uint64 chainId;        // 42220 in August; field exists so a future venue never needs migration
    address account;       // the garden's Celo Safe
    bool active;
    address[3] recoveryOwners; // sorted ascending; exact pilot owner set
    address rolesModifier;
    address allowanceModule;
    bytes32 recoveryConfigHash; // hash(chainId, Safe, sorted owners, threshold, Roles, Allowance)
    uint8 recoveryThreshold;    // exactly 2 for the pilot 2-of-3 set
}

struct FunctionsConfig {
    uint64 subscriptionId;
    bytes32 donId;
    uint32 callbackGasLimit;
    uint64 requestTimeoutSeconds;
    string source;              // pinned JS; update emits its keccak256
    bytes encryptedSecretsReference;
}

struct Disbursement {
    uint256 commitmentId;  // 0 for Funding kind
    address garden;        // pool garden (Arbitrum garden account)
    address executorGarden;// immutable Hats/executor scope: reward garden or protocolGarden for Funding
    DisbursementKind kind;
    FundingRoute fundingRoute; // None for CommitmentReward
    address source;        // exact Celo sender Safe; always derived at queue time
    address recipient;     // Celo address (member smart account, garden Safe, or GG Safe)
    address token;         // G$ on Celo for August
    uint256 amount;
    DisbursementState state;
    uint256 batchId;       // 0 = unbatched
    bytes32 executionRef;  // Celo tx hash once Reported; never proof by itself
    string reasonCID;      // failure/cancel reason (IPFS), empty otherwise
    uint32 attempts;
    uint64 reportedAt;
    address reportedBy;
    uint64 verifiedAt;
    address verifiedBy;
    bytes32 verificationRequestId;
    uint64 verificationRequestedAt;
    bytes32 verificationEvidenceHash;
    bytes32 failureCode; // oracle-safe machine code; reasonCID remains human/operator context
}

struct Batch {
    address executorGarden;// every member shares the same executor scope
    address source;        // every member shares source + token
    address token;
    uint256[] disbursementIds; // immutable after BatchCreated; length 1..24
    DisbursementState state;
    bytes32 executionRef;
    uint64 reportedAt;
    address reportedBy;
    uint64 verifiedAt;
    address verifiedBy;
    bytes32 verificationRequestId;
    uint64 verificationRequestedAt;
    bytes32 verificationEvidenceHash;
    bytes32 failureCode;
}

struct VerificationSubject {
    bool isBatch;
    uint256 subjectId;
    bytes32 executionRef;
    uint64 requestedAt;
    uint64 expiresAt; // requestedAt + config timeout snapshotted for this request
    bool active;
}

struct VerificationResponse {
    VerificationResult result; // ABI uint8: 0 Valid, 1 ReceiptInvalid, 2 InfrastructureError
    bytes32 failureCode;        // zero only for Valid
    bytes32 evidenceHash;       // non-zero only for Valid
    uint64 receiptBlockNumber;
    bytes32 receiptBlockHash;
}
```

`MAX_BATCH_SIZE = 24`. A batch is an immutable attempt record: member IDs never change and a failed/rejected batch is never requeued. Each failed member is individually requeued (clearing `batchId`, `executionRef`, verification fields, and failure code while incrementing attempts) or canceled.

The Functions request has one exact bytes argument:

```solidity
bytesArgs[0] = abi.encode(
    uint64(42220),
    executionRef,
    source,
    token,
    recipients, // address[], length 1..24
    amounts     // uint256[], same length
);
```

The callback response is exactly `abi.encode(uint8 result, bytes32 failureCode, bytes32 evidenceHash, uint64 receiptBlockNumber, bytes32 receiptBlockHash)` (160 bytes). A non-empty Chainlink `err`, a response of another length, an enum value above 2, or `Valid` with zero evidence/block data is classified as `InfrastructureError` with a fixed code; it never reverts the callback and never marks a receipt invalid. Canonical receipt-invalid codes are exactly `RECEIPT_REVERTED`, `SAFE_EXECUTION_INVALID`, `TOKEN_LOG_INVALID`, and `TRANSFER_SET_MISMATCH`. Canonical infrastructure codes are exactly `FUNCTIONS_ERROR`, `RESPONSE_LENGTH`, `RESPONSE_ENUM`, `RESPONSE_EVIDENCE`, `REQUEST_TIMEOUT`, `RPC_UNAVAILABLE`, `FINALITY_UNAVAILABLE`, and `RECEIPT_NOT_FOUND`. No code may move between classes without a spec amendment.

### 3.3 Interface + permission matrix

| Function | Authorized caller | Gates |
|---|---|---|
| `setFundingConfiguration(protocolGarden, gDollarToken)` | module owner | all non-zero; protocol garden must be registered before funding is queued; event `FundingConfigurationUpdated` |
| `registerSettlementAccount(garden, chainId, account, recoveryOwners[3], rolesModifier, allowanceModule)` / `updateSettlementRecovery(garden, recoveryOwners[3], rolesModifier, allowanceModule)` / `setAccountActive(garden, bool)` | steward or module owner | chainId == 42220; account/modules non-zero; owners sorted, unique, non-zero and none is a current executor; threshold is fixed at 2; event `SettlementAccountRegistered` / `SettlementRecoveryUpdated` / `SettlementAccountStatusChanged` |
| `addExecutor(garden, addr)` / `removeExecutor(garden, addr)` | steward | bounded three-owner check rejects any configured recovery owner; deploy/register tooling separately proves the address is a scoped Zodiac Roles member in the live Celo Safe; event `ExecutorUpdated` |
| `setFunctionsConfig(subscriptionId, donId, callbackGasLimit, requestTimeoutSeconds, source, encryptedSecretsReference)` | module owner | all fields required; timeout is bounded 5 minutes..24 hours; source is pinned and its hash is emitted; changing configuration does not alter an active request |
| `setMemberDeliveryEnabled(bool)` | module owner | enabling requires the Celo AA/paymaster exit evidence recorded in the settlement handoff; disabling blocks new commitment-reward queues and member sends but never blocks the funding route |
| `queueDisbursement(commitmentId)` | commitment-pool steward | `memberDeliveryEnabled`; commitment `Fulfilled`; active provider-garden settlement account; no live disbursement; declared reward token equals configured G$. Individual beneficiary = stored provider same-address Celo AA account. Garden beneficiary = `settlementAccounts[providerGarden].account`, never the Arbitrum GardenAccount. Module derives source, beneficiary, token, and amount without caller overrides; event `DisbursementQueued` |
| `queueFunding(garden, amount)` | protocol steward or module owner | the single modeled route is ProtocolToGarden, recorded on the disbursement's immutable `fundingRoute` fact; executorGarden is snapshotted as protocolGarden; source, recipient, and canonical G$ derive from funding config + active settlement accounts; no arbitrary addresses/tokens; event `DisbursementQueued(kind=Funding)` |
| `createBatch(ids[])` | steward or executor for the immutable executorGarden | 1–24 unique ids, all Queued + same executorGarden, derived source, and token; member ids are persisted and immutable; event `BatchCreated` |
| `markDisbursementExecuting(id)` / `markBatchExecuting(batchId)` | executor | Queued → Executing for an unbatched disbursement, or for the batch + immutable members; events `DisbursementExecuting` / `BatchExecuting` |
| `reportExecution(id, executionRef)` / `reportBatchExecution(batchId, executionRef)` | executor for stored immutable `executorGarden` | Executing → Reported; ref mandatory and globally unused; persists `reportedBy = msg.sender`; events `DisbursementExecutionReported` / `BatchExecutionReported`. Reported is not member-visible proof of receipt |
| `requestVerification(id)` / `requestBatchVerification(batchId)` | stored executor, steward, or module owner | subject is Reported with no active request; sends the pinned Chainlink Functions request, persists the returned request id + timestamp, and emits `VerificationRequested`; state remains Reported and the UI derives “checking receipt” from the active request |
| Functions router callback | configured immutable router only | matches an active request id and execution ref. A valid finalized receipt produces Verified. A receipt-invalid result produces Failed. An infrastructure error/timeout clears the active request but leaves Reported for retry. Stale request ids are ignored and can never mutate state |
| `expireVerification(id)` / `expireBatchVerification(batchId)` | stored executor, steward, or module owner | active request and `block.timestamp >= requestedAt + snapshotted requestTimeoutSeconds`; clears only that request, leaves Reported, emits `VerificationInfrastructureFailed(..., REQUEST_TIMEOUT)`, then permits a fresh request |
| `recordFailed(id, reasonCID)` / `recordBatchFailed(batchId, reasonCID)` | executor or steward | Executing → Failed before a report; batch failure also marks each immutable member Failed; reason mandatory; events `DisbursementFailed` / `BatchFailed` |
| `requeue(id)` | steward | Failed → Queued, `attempts++`; operates on one member only and clears its `batchId`, execution ref, report, verification, evidence, and failure fields. The global `usedExecutionRefs` replay guard is never cleared. A failed batch itself is immutable and never requeued |
| `cancelDisbursement(id, reasonCID)` | steward | Queued or Failed → Cancelled; frees `commitmentDisbursed`; event `DisbursementCancelled` |
| `initialize(owner, hatsModule, commitmentPoolingModule, protocolGarden, gDollarToken)` | proxy initializer | every address non-zero; `nextDisbursementId` and `nextBatchId` start at 1; member delivery false; owner-only UUPS authorization |
| admin setters (`setHatsModule`, `setCommitmentPoolingModule`, `setPaused`) | module owner | pause blocks all mutations except failure recording, per-member cancellation, request expiry, callback completion, and unpause |
| views (`getDisbursement`, `getBatch`, `settlementAccountOf`, `disbursementOfCommitment`, `isExecutor`, `isVerificationPending`, `memberDeliveryEnabled`) | public | `memberDeliveryEnabled` is the canonical capability read and is also indexed from `MemberDeliveryStatusChanged` |

Canonical event/error contract (the config block in §6 must match these signatures exactly):

```solidity
event FundingConfigurationUpdated(
    address indexed protocolGarden,
    address indexed gDollarToken
);
event SettlementAccountRegistered(
    address indexed garden,
    uint64 chainId,
    address indexed account,
    address[3] recoveryOwners,
    address rolesModifier,
    address allowanceModule,
    bytes32 recoveryConfigHash,
    uint8 recoveryThreshold
);
event SettlementRecoveryUpdated(
    address indexed garden,
    address[3] recoveryOwners,
    bytes32 recoveryConfigHash,
    address indexed rolesModifier,
    address indexed allowanceModule
);
event SettlementAccountStatusChanged(address indexed garden, bool active);
event ExecutorUpdated(address indexed garden, address indexed executor, bool enabled);
event FunctionsConfigurationUpdated(
    uint64 subscriptionId,
    bytes32 indexed donId,
    uint32 callbackGasLimit,
    uint64 requestTimeoutSeconds,
    bytes32 indexed sourceHash,
    bytes32 secretsReferenceHash
);
event MemberDeliveryStatusChanged(bool enabled);
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
    uint256[] disbursementIds
);
event DisbursementExecuting(uint256 indexed disbursementId, address indexed executor);
event BatchExecuting(uint256 indexed batchId, address indexed executor);
event DisbursementExecutionReported(
    uint256 indexed disbursementId, bytes32 indexed executionRef, address indexed reportedBy
);
event BatchExecutionReported(uint256 indexed batchId, bytes32 indexed executionRef, address indexed reportedBy);
event VerificationRequested(
    bytes32 indexed requestId,
    bool indexed isBatch,
    uint256 indexed subjectId,
    bytes32 executionRef,
    uint64 expiresAt
);
event DisbursementVerified(
    uint256 indexed disbursementId,
    bytes32 indexed executionRef,
    address indexed verifiedBy,
    bytes32 evidenceHash
);
event BatchVerified(
    uint256 indexed batchId, bytes32 indexed executionRef, address indexed verifiedBy, bytes32 evidenceHash
);
event ReceiptVerificationFailed(
    bool indexed isBatch, uint256 indexed subjectId, bytes32 indexed requestId, bytes32 failureCode
);
event VerificationInfrastructureFailed(
    bool indexed isBatch, uint256 indexed subjectId, bytes32 indexed requestId, bytes32 failureCode
);
event StaleVerificationIgnored(bytes32 indexed requestId, bool indexed isBatch, uint256 indexed subjectId);
event DisbursementFailed(uint256 indexed disbursementId, address indexed actor, string reasonCID);
event BatchFailed(uint256 indexed batchId, address indexed actor, string reasonCID);
event DisbursementRequeued(uint256 indexed disbursementId, uint32 attempts);
event DisbursementCancelled(uint256 indexed disbursementId, address indexed actor, string reasonCID);

error FundingConfigurationIncomplete();
error SourceOrTokenMismatch(uint256 disbursementId);
error UnauthorizedCaller(address caller);
error NotSettlementSteward(address caller, address garden);
error NotExecutor(address caller, address garden);
error UnknownSettlementAccount(address garden);
error SettlementAccountInactive(address garden);
error InvalidSettlementChain(uint64 chainId);
error InvalidRecoveryConfiguration();
error RecoveryOwnerIsExecutor(address owner);
error ExecutorIsRecoveryOwner(address executor);
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
error ExecutionReferenceRequired();
error ExecutionReferenceUsed(bytes32 executionRef);
error VerificationAlreadyPending(bytes32 requestId);
error NoActiveVerificationRequest(uint256 subjectId);
error VerificationNotTimedOut(uint256 subjectId, uint64 expiresAt);
error InvalidFunctionsConfiguration();
error MemberDeliveryDisabled();

interface ISettlementModule {
    function initialize(
        address owner_,
        address hatsModule_,
        address commitmentPoolingModule_,
        address protocolGarden_,
        address gDollarToken_
    ) external;

    function setFundingConfiguration(address protocolGarden_, address gDollarToken_) external;
    function registerSettlementAccount(
        address garden,
        uint64 chainId,
        address account,
        address[3] calldata recoveryOwners,
        address rolesModifier,
        address allowanceModule
    ) external;
    function updateSettlementRecovery(
        address garden,
        address[3] calldata recoveryOwners,
        address rolesModifier,
        address allowanceModule
    ) external;
    function setAccountActive(address garden, bool active) external;
    function addExecutor(address garden, address executor) external;
    function removeExecutor(address garden, address executor) external;
    function setFunctionsConfig(
        uint64 subscriptionId,
        bytes32 donId,
        uint32 callbackGasLimit,
        uint64 requestTimeoutSeconds,
        string calldata source,
        bytes calldata encryptedSecretsReference
    ) external;
    function setMemberDeliveryEnabled(bool enabled) external;

    function queueDisbursement(uint256 commitmentId) external returns (uint256 disbursementId);
    function queueFunding(address garden, uint256 amount) external returns (uint256 disbursementId);
    function createBatch(uint256[] calldata disbursementIds) external returns (uint256 batchId);
    function markDisbursementExecuting(uint256 disbursementId) external;
    function markBatchExecuting(uint256 batchId) external;
    function reportExecution(uint256 disbursementId, bytes32 executionRef) external;
    function reportBatchExecution(uint256 batchId, bytes32 executionRef) external;
    function requestVerification(uint256 disbursementId) external returns (bytes32 requestId);
    function requestBatchVerification(uint256 batchId) external returns (bytes32 requestId);
    function expireVerification(uint256 disbursementId) external;
    function expireBatchVerification(uint256 batchId) external;
    function recordFailed(uint256 disbursementId, string calldata reasonCID) external;
    function recordBatchFailed(uint256 batchId, string calldata reasonCID) external;
    function requeue(uint256 disbursementId) external;
    function cancelDisbursement(uint256 disbursementId, string calldata reasonCID) external;

    function getDisbursement(uint256 disbursementId) external view returns (Disbursement memory);
    function getBatch(uint256 batchId) external view returns (Batch memory);
    function settlementAccountOf(address garden) external view returns (SettlementAccount memory);
    function disbursementOfCommitment(uint256 commitmentId) external view returns (uint256);
    function isExecutor(address garden, address executor) external view returns (bool);
    function isVerificationPending(bool isBatch, uint256 subjectId) external view returns (bool);
    function memberDeliveryEnabled() external view returns (bool);
    function MAX_BATCH_SIZE() external pure returns (uint256);
    function FUNCTIONS_ROUTER() external view returns (address);

    function setHatsModule(address module) external;
    function setCommitmentPoolingModule(address module) external;
    function setPaused(bool paused_) external;
}
```

**Commitment reward binding.** Token and amount come from `commitment.reward`; callers supply no source/recipient/token/amount override. Individual claims preserve the unit-provider beneficiary: Offer → creator, Request → accepted counterparty, using the same-address Celo AA route. Garden claims resolve beneficiary to the active registered Celo Safe for `commitment.providerGarden`; the Arbitrum GardenAccount is attribution only and is never a Celo G$ recipient. Source comes from the active provider-garden settlement account and token must equal configured `gDollarToken`. Funding top-ups remain explicit non-commitment disbursements.

**Funding-route binding.** `queueFunding` never accepts source, recipient, or token. The single modeled route `ProtocolToGarden` stores source = the protocol settlement account, recipient = the target garden settlement account, garden = target garden, and immutable `executorGarden = protocolGarden`, so a later configuration change cannot alter who may execute an already queued transfer. Both accounts must be active, amount must be non-zero, and token is always `gDollarToken`. HoA → protocol Safe is recorded in external treasury reporting, not fabricated as a module action Green Goods did not authorize.

**Verification contract.** There is no manual verification role or manual verification/rejection entrypoint. The pinned Chainlink Functions source resolves `executionRef` on Celo and returns the exact bounded response above for one active request. It must check chain 42220; a successful receipt whose block number/hash is at or behind the RPC `finalized` block; canonical G$ as the emitting token contract; and the multiset of canonical-G$ `Transfer(address,address,uint256)` logs whose `from` equals the stored Safe source and whose `(to, value)` pairs equal the expected recipient/amount multiset. Duplicate recipient/amount pairs are counted with multiplicity. Any additional canonical-G$ Transfer from the stored source in the same transaction is invalid. Safe success is exact: the stored Safe must emit either topic `keccak256("ExecutionSuccess(bytes32,uint256)")` or `keccak256("ExecutionFromModuleSuccess(address)")`; a module-success log must name the stored Roles module, and any `ExecutionFailure(bytes32,uint256)` or `ExecutionFromModuleFailure(address)` from that Safe invalidates the receipt. The outer Celo `transaction.from` is deliberately ignored because a Zodiac/Safe execution is submitted by an executor/module caller, not by the Safe. If the RPC cannot return a finalized block or receipt, the result is infrastructure error, not receipt invalid. A one-member request validates that member; a batch request validates all immutable members as one attempt. `evidenceHash = keccak256(abi.encode(uint64(42220), receiptBlockHash, executionRef, source, token, recipients, amounts))`, with recipients/amounts in immutable batch-member order. The callback stores the immutable Functions router as `verifiedBy`, never the reporter.

The implementation pins the already lockfile-resolved direct dependency `@chainlink/contracts@1.5.0` and imports `@chainlink/contracts/src/v0.8/functions/v1_3_0/FunctionsClient.sol`. The implementation PR adds that package as a direct dependency without changing the resolved version. It overrides `_fulfillRequest(bytes32,bytes,bytes)` from v1.3.0; no `dev/v1_X` import is allowed. The callback behavior is frozen as follows:

```solidity
function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override;
```

It first loads `verificationRequests[requestId]`. Unknown/inactive or non-current request IDs emit `StaleVerificationIgnored` using the preserved request record and return. Non-empty `err` or malformed response executes the infrastructure path. `Valid` applies only to the execution ref already snapshotted in that request, marks the single/batch and immutable members Verified, clears active request flags, and records `verifiedBy = FUNCTIONS_ROUTER`. `ReceiptInvalid` marks the immutable attempt and members Failed. `InfrastructureError` clears request fields only and leaves Reported. No callback branch calls an external contract or performs an unbounded loop; batch loops are bounded by 24.

`Valid` is the only path to `Verified`. `ReceiptInvalid` marks the immutable single/batch attempt and every batch member `Failed`; a steward must reconcile each member separately by requeueing or cancelling it. RPC, DON, subscription, decoding, timeout, or finality lookup failures are infrastructure failures: they clear the active request, retain `Reported`, and permit a new request. A callback whose request id is no longer the subject's active id emits `StaleVerificationIgnored` and performs no state mutation. Request creation snapshots `expiresAt = requestedAt + requestTimeoutSeconds`; `expireVerification`/`expireBatchVerification` enforce that timestamp and emit `VerificationInfrastructureFailed(..., REQUEST_TIMEOUT)` before a retry. Changing Functions configuration never changes an active request's source hash, DON, callback gas, or expiry snapshot.

**Deliberate non-couplings**:
- The module **never custodies funds and never calls Celo** — it is a ledger with teeth (state machine + permissions), exactly the shape the split-state doc recommends.
- It does **not** call `commitmentPoolingModule.recordRewardPaid`. `rewardPaid` on the pooling module remains the record for **Arbitrum rails** (jar/treasury); `DisbursementVerified` is the record for **Celo G$ legs**. Shared selectors present one reward status per commitment by precedence: settlement-module state if a disbursement exists, else pooling-module `rewardPaid`. “Support arrived” is reserved for Verified. Never double-count.
- `Pool.settlementEnabled` / `Pool.settlementAdapter` on the pooling module **stay reserved for transferable settlement vouchers and stay untouched** (false/zero). August settlement presence is derived from `settlementAccounts[garden].active` on this module. Implementers must not flip the pooling-module flag.

### 3.4 Acceptance criteria

- Full state-machine coverage: unbatched queue → executing → reported → Functions request → verified; queue → batch → executing → reported → request → verified; executing → failed → per-member requeue/cancel; receipt-invalid callback → failed → per-member requeue/cancel; infrastructure callback or permissioned timeout expiry → reported → new request; cancel frees the commitment; duplicate commitment queue, duplicate batch member, batch size 0/25, reused execution ref, malformed response, and stale callback mutation all revert, classify, or are ignored as specified.
- Binding tests: Individual Offer/Request rewards derive the stored provider same-address AA recipient; Garden claims derive the registered `providerGarden` Celo Safe and never the Arbitrum GardenAccount. Queueing with no reward, zero amount, wrong source/token, inactive account, or non-Fulfilled commitment reverts. The funding route derives its source/recipient/token; arbitrary routes, addresses, and tokens are impossible.
- Gating tests: non-steward queue reverts; non-executor execution/reporting reverts; a configured recovery owner cannot become executor; direct callback calls revert unless sent by the immutable Functions router; only eligible callers can request/retry/expire; disabling member delivery blocks commitment-reward queues and member sends but not the funding route.
- Storage-layout test asserts the generated nineteen-slot implementation layout + 31-slot gap and adds the `check-storage-layout.sh` entry, including dynamic batch-member storage and request replay protection.
- Exact contract proof: `bun run --filter @green-goods/contracts test:match -- test/unit/Settlement.t.sol`, `bun run --filter @green-goods/contracts test:script`, `bun run --filter @green-goods/contracts build:full`, `bun run --filter @green-goods/contracts lint:check`, then `bun run --filter @green-goods/contracts test`. The fixture covers queue → finalized Celo receipt → Functions callback against a Fulfilled commitment. The handoff also records subscription funding, router, DON, callback gas, pinned source hash, encrypted-secrets reference, retry window, and post-deployment health evidence.
- Exact dry-run/post-check path once the target exists: from `packages/contracts`, `bun script/deploy.ts settlement --network sepolia --dry-run`, `bun run verify:post-deploy:sepolia`, and `bun run verify:post-deploy:indexer:sepolia`. Broadcast remains separately authorized.

Deployment artifacts are exact: `deployments/{chainId}-latest.json` gains only top-level `settlementModule`; `deployments/{chainId}-settlement.json` records implementation/proxy, immutable Functions router, subscription, DON, callback gas, request timeout, source hash, encrypted-secrets-reference hash, funding configuration, deployment tx/block, and health-check request ID/result. `deployments/42220-settlement-safes.json` owns Safe recovery/role artifacts. Post-deploy health requires one mocked router callback on Sepolia, one live Functions request that returns infrastructure-safe data without mutating a disbursement, subscription balance above the recorded minimum, router/DON/source-hash equality, and indexer runtime visibility. No secret bytes are written to an artifact.

## 4. Celo side (ops + Safe modules, no new GG contracts)

- **Safes — one per garden, 1:1 mapping, every garden eligible**: the existing GG protocol Safe covers the protocol pool; each participating garden gets exactly one Celo Safe attributed to its Arbitrum garden account. Deployment is **on-demand, not launch-blocking**: the exact target is `bun script/deploy.ts settlement-safe --network celo --garden <arbitrumGardenAccount> --dry-run --pure-simulation` (broadcast is the same target with `--broadcast`, separately authorized). The admin “Set up settlement account” composes the same deterministic input; it does not contain a second deployment implementation. A salt `keccak256("GREEN_GOODS_CELO_SAFE_V1", arbitrumGardenAccount)` makes the address deterministic. `registerSettlementAccount` persists the garden↔Safe mapping, sorted owners, Roles/Allowance addresses, fixed threshold, and configuration hash.
- **Owner set at deployment**: exactly 2-of-3 for the pilot — the protocol recovery multisig, the Dev Guild recovery multisig, and one named garden recovery delegate who can sign on Celo. Deployment fails if an owner is duplicated, zero, unnamed in the artifact, or also configured as an executor. The Arbitrum garden account is the canonical attribution and deterministic deployment input, but is **not** inserted as a non-signing owner. The script writes `packages/contracts/deployments/{chainId}-settlement-safes.json` with garden, Safe, sorted owners, threshold, Roles, Allowance, scoped selectors, per-period cap, salt, code hashes, and receipt blocks. Registration recomputes `recoveryConfigHash = keccak256(abi.encode(chainId, safe, sortedOwners, uint8(2), rolesModifier, allowanceModule))`. `addExecutor` performs a bounded three-owner rejection; the post-deploy verifier also reads the live Safe owner set and Roles membership because Arbitrum cannot prove later Celo configuration drift by itself.
- **Signer scoping (Zodiac Roles Modifier)**: executor keys are Roles members and may only call the canonical G$ `transfer`/approved multisend path from the Safe — no arbitrary execution. **Allowance module**: per-period caps per Safe. Removing every Roles member still leaves the 2-of-3 recovery owners able to rotate modules safely; compromising one executor cannot bypass the modules through Safe ownership.
- **Ownership nuance (named honestly)**: an Arbitrum ERC-6551 account cannot sign on Celo today. “Garden-controlled” means the Arbitrum module authorizes the garden mapping and reward, accountable Celo governance signers control recovery, and scoped executors perform the bounded transfer. A future validated cross-chain module may let the garden account trigger its Safe literally; that path is not required for base settlement.
- **Gas**: executor keys hold CELO; funding source = GG protocol Safe ops budget. Member receipts are pure ERC-20 transfers (no member gas). Member *sends* use sponsored gas (§5).

## 5. Member receipt + multi-chain app

**Decision (register #16)**: members receive at **same-address smart accounts on Celo** — the same passkey-owned account address they have on Arbitrum, counterfactually deployable on Celo.

- **Verification spike (first week of the August track, blocking for this leg)**: confirm our AA stack on Celo — account factory deployable at same addresses, bundler + paymaster support (Pimlico or equivalent) on 42220, passkey signature validation parity. Exit: one testnet/mainnet round-trip — receive G$ at the counterfactual address, deploy on first send, sponsored send succeeds.
- **Failure behavior**: if the spike fails, `memberDeliveryEnabled` remains false. ProtocolToGarden settlement may continue, but commitment-reward queueing, automated member delivery, and member G$ sends remain blocked. There is no alternate member-delivery path.

**Multi-chain app (register #17)** — the Single Chain principle amends to: **primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo, 42220) for value legs**. The CLAUDE.md principle edit rides the implementation PR, not this spec. August scope, all tiers:

| Tier | What ships | Notes |
|---|---|---|
| Reads | Celo Safe balances (admin funding views), member G$ balance (WalletDrawer only after the AA gate), disbursement status everywhere | Status reads come from SettlementModule indexer entities; balances use Celo RPC. Shared selectors distinguish Reported, derived “checking receipt,” and Verified. |
| Operator writes | Batch execution flow: admin deep-links the queued batch into the Safe app; `markBatchExecuting` and `reportBatchExecution` are normal Arbitrum writes. A one-member/manual attempt uses `markDisbursementExecuting` + `reportExecution`. | A report never renders as received until the oracle callback verifies it. |
| Member writes | Send G$ from the wallet on Celo: chain-aware send flow with **sponsored gas** (members never hold CELO) | Entire row is gated by `memberDeliveryEnabled`; if the AA spike fails it does not ship. When enabled, this is an explicit online wallet action, never an offline job; `transfer` uses `{ chainId, token, to, amount }`. |

Shared substrate additions (extends PRD-674's scope via this spec): settlement chain registry (`{ primary, settlement }` chain config), second public client, G$ token config, `queryKeys.settlement.*` family, settlement/disbursement hooks + selectors (including the reward-status precedence rule from §3.3), and an online wallet `transfer` capability that is unavailable while `memberDeliveryEnabled == false`.

## 6. Indexer

Within the existing boundary, Envio indexes the Arbitrum SettlementModule, not Celo token events. `executionRef` links the report to a Celo transaction; `reportedBy` preserves who asserted it; request events expose the derived “checking receipt” state; `DisbursementVerified` records the immutable Functions router as `verifiedBy`. New config block (Arbitrum + Sepolia, zero-address placeholders pre-broadcast) and entities:

```graphql
enum DisbursementState { UNKNOWN QUEUED EXECUTING REPORTED VERIFIED FAILED CANCELLED }
enum DisbursementKind { UNKNOWN COMMITMENT_REWARD FUNDING }
enum FundingRoute { UNKNOWN NONE PROTOCOL_TO_GARDEN }

type SettlementConfiguration {
  id: ID! # chainId-settlement-config
  chainId: Int!
  memberDeliveryEnabled: Boolean!
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
  allowanceModule: String!
  updatedAt: Int!
}
type Disbursement {
  id: ID! # chainId-disbursementId
  chainId: Int! disbursementId: BigInt! garden: String! gardenId: String!
  executorGarden: String! executorGardenId: String! commitmentId: BigInt commitmentEntityId: String
  kind: DisbursementKind! fundingRoute: FundingRoute! source: String!
  recipient: String! token: String! amount: BigInt!
  state: DisbursementState! batchId: BigInt batchEntityId: String executionRef: String reasonCID: String
  attempts: Int! reportedAt: Int reportedBy: String verifiedAt: Int verifiedBy: String
  verificationRequestId: String verificationRequestedAt: Int verificationExpiresAt: Int
  verificationEvidenceHash: String failureCode: String
  createdAt: Int! updatedAt: Int!
}

type SettlementBatch {
  id: ID! # chainId-batchId
  chainId: Int! batchId: BigInt! executorGarden: String! executorGardenId: String!
  source: String! token: String! disbursementIds: [BigInt!]! disbursementEntityIds: [String!]!
  state: DisbursementState! executionRef: String
  reportedAt: Int reportedBy: String verifiedAt: Int verifiedBy: String reasonCID: String
  verificationRequestId: String verificationRequestedAt: Int verificationExpiresAt: Int
  verificationEvidenceHash: String failureCode: String
  createdAt: Int! updatedAt: Int!
}
```

Exact Envio contract block for both Arbitrum and Sepolia (addresses remain deployment-artifact placeholders until broadcast):

```yaml
- name: SettlementModule
  handler: src/EventHandlers.ts
  events:
    - event: FundingConfigurationUpdated(address indexed protocolGarden, address indexed gDollarToken)
    - event: SettlementAccountRegistered(address indexed garden, uint64 chainId, address indexed account, address[3] recoveryOwners, address rolesModifier, address allowanceModule, bytes32 recoveryConfigHash, uint8 recoveryThreshold)
    - event: SettlementRecoveryUpdated(address indexed garden, address[3] recoveryOwners, bytes32 recoveryConfigHash, address indexed rolesModifier, address indexed allowanceModule)
    - event: SettlementAccountStatusChanged(address indexed garden, bool active)
    - event: ExecutorUpdated(address indexed garden, address indexed executor, bool enabled)
    - event: FunctionsConfigurationUpdated(uint64 subscriptionId, bytes32 indexed donId, uint32 callbackGasLimit, uint64 requestTimeoutSeconds, bytes32 indexed sourceHash, bytes32 secretsReferenceHash)
    - event: MemberDeliveryStatusChanged(bool enabled)
    - event: DisbursementQueued(uint256 indexed disbursementId, uint256 indexed commitmentId, address indexed garden, address executorGarden, uint8 kind, uint8 fundingRoute, address source, address recipient, address token, uint256 amount)
    - event: BatchCreated(uint256 indexed batchId, address indexed executorGarden, address indexed source, address token, uint256[] disbursementIds)
    - event: DisbursementExecuting(uint256 indexed disbursementId, address indexed executor)
    - event: BatchExecuting(uint256 indexed batchId, address indexed executor)
    - event: DisbursementExecutionReported(uint256 indexed disbursementId, bytes32 indexed executionRef, address indexed reportedBy)
    - event: BatchExecutionReported(uint256 indexed batchId, bytes32 indexed executionRef, address indexed reportedBy)
    - event: VerificationRequested(bytes32 indexed requestId, bool indexed isBatch, uint256 indexed subjectId, bytes32 executionRef, uint64 expiresAt)
    - event: DisbursementVerified(uint256 indexed disbursementId, bytes32 indexed executionRef, address indexed verifiedBy, bytes32 evidenceHash)
    - event: BatchVerified(uint256 indexed batchId, bytes32 indexed executionRef, address indexed verifiedBy, bytes32 evidenceHash)
    - event: ReceiptVerificationFailed(bool indexed isBatch, uint256 indexed subjectId, bytes32 indexed requestId, bytes32 failureCode)
    - event: VerificationInfrastructureFailed(bool indexed isBatch, uint256 indexed subjectId, bytes32 indexed requestId, bytes32 failureCode)
    - event: StaleVerificationIgnored(bytes32 indexed requestId, bool indexed isBatch, uint256 indexed subjectId)
    - event: DisbursementFailed(uint256 indexed disbursementId, address indexed actor, string reasonCID)
    - event: BatchFailed(uint256 indexed batchId, address indexed actor, string reasonCID)
    - event: DisbursementRequeued(uint256 indexed disbursementId, uint32 attempts)
    - event: DisbursementCancelled(uint256 indexed disbursementId, address indexed actor, string reasonCID)
```

Handlers follow `commitmentPool.ts` patterns (create-if-not-exists, dedup, composite IDs, `bun codegen`). `MemberDeliveryStatusChanged` upserts the singleton `SettlementConfiguration(${chainId}-settlement-config)`; shared may bootstrap from the public getter before the first indexed event, but indexed state is canonical for subscriptions. Exact placeholder defaults are UNKNOWN/zero scalar state, empty strings/arrays, null optional fields, and event timestamps. Every relationship uses declared composite IDs. `SettlementBatch` is the immutable batch-attempt read model; batch handlers update at most 24 members and preserve Reported/checking/Verified/recovery fields. `DisbursementQueued` is the immutable source/route fact, so handlers never infer the funding path. Pool-level `queuedDisbursementValue` remains a shared-selector gauge.

Indexer/deployment work must explicitly extend both current hard-coded integration surfaces: `packages/contracts/script/utils/envio-integration.ts` must preserve and regenerate the Commitment Pooling and SettlementModule blocks, and `packages/indexer/scripts/check-indexing-boundary.mjs` must allow exactly their locked Green Goods protocol events. A regression fixture runs regeneration twice and proves neither block nor signature is removed. `Garden.id` migrates from raw address to `chainId-address` through a full replay/backfill and a coordinated shared-query cutover; no mixed identifier window is supported. Generic audit-event `actor` is nullable and populated only from an explicit event field—never inferred from `transaction.from`. Every new entity and relationship uses a chain-composite ID. EAS and raw Celo token transfers remain outside Envio.

Exact indexer proof from the repo root: `bun run --filter @green-goods/indexer codegen`, `bun run --filter @green-goods/indexer setup-generated`, `bun run --filter @green-goods/indexer check:indexing-boundary`, `bun run --filter @green-goods/indexer test`, and `bun run --filter @green-goods/indexer build`. The preservation regression runs before and after codegen and compares both configured network blocks and every locked signature.

## 7. Surface impact (deltas to `uiux-spec.md` / `wireframes.md`; W21/W22/W23 are the settlement frames)

- **W2 commitment detail (PWA)**: reward row gains settlement status — “support on its way” (Queued/Executing), “transfer reported” (Reported without active request), “checking receipt” (Reported with active request), “support arrived” + Celo ref (Verified), “still arranging support — your promise is recorded” (Failed), “this support was withdrawn before it was sent — your promise and its record stay intact” (Cancelled).
- **W23 WalletDrawer G$ section (settlement delta to W5)**: only after the AA gate, G$ balance section (Celo) + received-support rows; send action → chain-aware transfer flow. When disabled, no balance/send affordance renders and explanatory copy points to the blocked delivery gate.
- **W21 Garden Pool tab settlement section (delta to W7)**: settlement account card (Safe address, active, allowance snapshot, plus a read-only member-delivery gate status row — enabled/disabled · changed by · date · evidence ref; register #34f, the flip itself stays owner-only ops) + disbursement queue section; the batch execution and oracle console is **W22** (missing executor role renders a visible guard state, register #34e).
- **W10 commitment dialog**: "Queue disbursement" replaces/precedes "Record payout" for G$-rewarded commitments; batch actions.
- **Admin Operations tab funding view (deployer-gated)**: protocol-Safe inflow (HoA stream — Celo balance read), GG→garden funding hops, Safe balances, batch console. (The batch execution and oracle console W22 lives in this Operations workspace.)
- Editorial/community: no change (aggregates only; settlement is not a public story before its separately authorized Release gate).

i18n families extend `app.pool.*`, `cockpit.garden.pool.*`, `cockpit.community.pools.*` with `settlement.*` keys (en/es/pt, same gate). Banned-vocab rules apply to all new copy.

## 8. Linear-aligned sequencing (amends plan Track B)

SettlementModule work runs as **PR chain 2.5** — parallel with PRD-673/674 once PRD-672's interfaces freeze (the module only *reads* the pooling module):

1. **Product Commitment Pooling cycle (through PRD-686 due 2026-07-29)**: freeze the reward-binding/event/entity contract; confirm G$ token, Safe operating details, Chainlink subscription/router/DON/callback gas, pinned source and secrets reference; run the AA/paymaster spike; confirm the HoA stream's receiving address is the GG protocol Safe (receiving-address evidence recorded in the settlement handoff); and record the protocol → garden authorization/runbook. If the mandatory oracle path is not proven by the due date, settlement remains blocked with no manual fallback.
2. **Build phase (closes 2026-07-31)**: `Settlement.sol` + tests + deploy plumbing; the derived protocol → garden funding route; mandatory Functions request/callback; exact event config; complete Disbursement + SettlementBatch indexer entities; deterministic 2-of-3 Safe deploy/register tooling; Zodiac Roles + Allowance configuration; shared chain registry and selectors; admin execution/checking/verified states; PWA reward status and, only after the AA gate, G$ wallet. Build completion does not authorize value-tier broadcast.
3. **Release proof (2026-08-12; separately authorized)**: one real G$ reward derived from a Fulfilled commitment, queued on Arbitrum, executed from the registered garden Safe on Celo, reported, verified by the Functions callback against the finalized receipt, and rendered as “support arrived.” Protocol → garden funding hops are recorded separately from earned rewards; the upstream HoA stream stays in external treasury reporting. Audit, 48-hour timelock, two-week testnet, Safe/Functions/AA evidence, live-value proof, and explicit human authorization remain Release-tier gates. If any gate is absent, the settlement leg stays blocked rather than treating the date as authorization.

**Honest risk note**: this widens the Build phase by a contracts sub-lane plus indexer/shared/admin increments. The Chainlink Functions path is mandatory for any Verified state. A failed AA gate blocks commitment-reward delivery and member sends while allowing the protocol → garden funding route to continue; it never activates an alternate member-delivery path. Bridge-executor automation remains Follow On / Hardening work and cannot replace the oracle receipt check.

## 9. Out of scope (base MVP; stretch called out)

Bridged G$ (never). Bridge custody or unbounded value authority. Bridge-executor automation is Follow On / Hardening work, capped by Safe roles + Allowance and only if operator burden warrants it. Sarafu pool integration (a deferred future hybrid experiment, gated on a Grassroots Economics conversation + an ERC-777 audit; no dated phase is assigned to it). Transferable settlement vouchers and `settlementAdapter` activation (PRD-651, all its hard gates stand). Indexing Celo/G$ transfers. Member settlement controls in the separate September Community PWA.

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

**Messaging for the settle-trigger (Arch 2).** Hyperlane and LayerZero fit low-value high-frequency messages; Axelar GMP (~$0.10–$1) and CCIP ($0.20–$5) were heavier than needed. All declined in favour of **operator-executed settlement with read-only indexing**, so no bridge holds settlement authority and the human gate is preserved.

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

Source: Linear doc `6c7a2e4e-c96a-4b8a-985d-3b9ac262087a`, "Circular G$ Economies Inside Green Goods Garden Commitment Pools" (2026-07-02). Metrics attach to the existing indexed stats `promiseKeptRate`, `fulfilledUnits`, `openExposureUnits`, `cycleCompletionRate`.

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
2. **Celo-side observation, which the indexer boundary currently excludes.** `settlement-spec.md` §Indexer: "Envio indexes the Arbitrum SettlementModule, not Celo token events." Every in-pool spend, merchant payment, cash-out, DEX swap, and idle balance is a Celo G$ fact. Four of the five metrics have a numerator or denominator living entirely on Celo. Either the boundary extends to canonical G$ (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`) transfers for registered Safes and member AA accounts, or an off-chain attested read model supplies them — the current spec produces neither.
3. **Reseed rate needs Celo-side observation and season attribution — not a new funding route.** Its numerator is "G$ returning to the next season pool." A garden carrying store revenue or retained G$ into its next season does so **inside its own persistent Celo Safe** (§2), which is already the garden pool's settlement account — the funds never travel above it, so this is independent of the open Garden→protocol question in `reports/corrections-log.md` §9b. What it does require is observing Celo-side balances and attributing them to a season cohort. Do not add an upward funding route to scope on this metric's account.
4. **A pool-balance time series.** Velocity divides by "average pool G$ balance over the season," which needs sampled balances over time for the pool's Celo Safe. The admin Operations funding view currently plans a point-in-time Celo balance *read*, not a series.
5. **A registry of in-pool counterparties per garden per season.** "In-pool spend" is only decidable against a known set (garden store, seed/tool bank, participating merchant, steward accounts). Without an allowlist, every transfer out of a member wallet is indistinguishable from a cash-out.
6. **Season cohort identity carried through settlement,** so "this season's G$" is separable for the per-season cohort view.
7. **Denominator risk from `memberDeliveryEnabled`.** Individual member delivery is gated on the Celo AA/paymaster spike; if it fails, `memberDeliveryEnabled` stays false and commitment-reward queueing plus member G$ sends are blocked while `ProtocolToGarden` continues. If member delivery is off in season one, "total G$ paid out" — the recirculation denominator — is near-empty and no circulation metric has a meaningful base.
8. **Numeric thresholds are an open decision.** "Majority" and "minority" are not implementable gates. The numbers must be set before any healthy-season check can be automated or reported as pass/fail.

### 11.9 Why this section exists

The GoodDollar-facing plan commits Green Goods to reporting *"how much G$ recirculates inside a garden versus leaves it — real circulation, not just transaction volume."* That commitment had **no specced data source**: §3.2 models disbursement state only, and §6 explicitly scopes the indexer to "the Arbitrum SettlementModule, not Celo token events."

The definitions above were the only written record of how those metrics are computed, and they lived in a Linear document with no spec home. They are preserved here so the document can be retired — **not** because the measurement is designed. Items 1–8 in "Settlement-evidence implications" are open scope, and item 8 (nobody has set the numeric thresholds) means the healthy-season test cannot currently be evaluated pass/fail at all.

These items belong to the human-owned, blocked `settlement_evidence` execution sub-lane and `handoffs/human-settlement-evidence.md`, due at the separately labeled 2026-09-30 operational checkpoint. They do not expand the settlement or Envio implementation boundaries. Before any agent receives that lane, a human must lock source systems, privacy rules, thresholds, and the owning package or explicitly choose a no-code operational report. Tracked at `reports/corrections-log.md` §9c.

### 11.10 One conflict carried across deliberately

The source document's Recommendation 1 treats a working sink as a **proceed-gate**: *"Do not scale HoA distributions or add gardens until at least one garden has a working service sink."* The repo rule in `visual-assets.md` says the local spend sink is *"a circulation aim / ordering criterion, never a launch gate."*

Both are live, and they are reconcilable but not identical: settlement **capability** is not sink-gated, while scaling the G$ **distribution** into a garden does follow sink readiness — which is also what the GoodDollar-facing July plan commits to ("build the place to spend before widening the flow"). Recorded so the tension is visible rather than silently resolved in one direction.
