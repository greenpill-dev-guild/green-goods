# Commitment Pooling: G$ Split-State Settlement Spec (August)

**Feature Slug**: `commitment-pooling`
**Stage**: `active`
**Created**: 2026-07-04
**Companions**: `contract-spec.md` (the pooling module + register this attaches to — **zero changes to those contracts here**), `diagrams.md` D8–D10 (fund-flow topology, settlement sequence, disbursement state machine), `uiux-spec.md` (surface grammar), `corrections-log.md`.
**Decision basis**: Architecture 2 (split-state) locked in the Linear doc "G$ in Green Goods: Bridged vs. Split-State Settlement", re-affirmed by the Architecture 3 re-score; user decisions through 2026-07-10: settlement enters the **August release**, one Celo Safe per garden (1:1 mapping, deployed on demand), member receipt targets same-address smart accounts, app goes multi-chain this iteration, the House of Alignment flow funds the Dev Guild working-capital wallet, Green Goods settlement uses G$ on Celo without bridging it to Arbitrum, and receipt verification is a mandatory Chainlink Functions oracle path with no manual fallback.

**What stays true from the locked register**: no bridged G$, ever. No bridge custodies G$ or holds unbounded value authority. Sarafu integration stays deferred. Transferable settlement vouchers stay gated on [PRD-651](https://linear.app/greenpill-dev-guild/issue/PRD-651). Base August settlement is operator-executed; bridge-executor automation is stretch only. Gardeners never sign cross-chain transactions in the field. If the Celo AA/paymaster spike fails, downstream protocol/garden funding may continue but automated member reward delivery remains blocked; there is no alternate member-claim path.

---

## 1. The model in one paragraph

All commitment truth stays on Arbitrum. A NET-NEW **`SettlementModule`** on Arbitrum registers each garden's Celo Safe, derives commitment rewards and the two downstream treasury routes, owns the bounded failure/retry state machine, and sends reported Celo references to **Chainlink Functions** for receipt verification. Authorization happens where Hats lives; execution happens on Celo through Zodiac Roles + Allowance. Executors may report, but only the configured Functions router callback can produce `Verified` or receipt-invalid `Failed`; infrastructure errors leave the record `Reported` for retry. Canonical G$ (`0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`, Celo) never leaves Celo.

## 2. Fund-flow topology (diagrams.md D8)

```text
House of Alignment stream (Celo, G$)
  → Dev Guild Working Capital Safe (Celo, exists, receiving today)
    → Green Goods protocol Safe (Celo, exists)              ← settlement account of the PROTOCOL pool (root garden)
      → Garden Celo Safes (NET-NEW, ONE per garden, 1:1)     ← settlement accounts of garden pools, deployed on demand
        → Members (same-address smart accounts on Celo)
```

- Each hop below HoA is a Safe-to-Safe G$ transfer executed by scoped Roles members. HoA → working capital is an upstream funding fact, not a Green Goods queued action. The module models exactly two downstream routes—working capital → protocol and protocol → garden—with derived source, recipient, and canonical G$ token. Every queued hop reports its Celo tx hash and becomes complete only after its Chainlink Functions callback verifies the finalized receipt.
- The protocol pool's declared rewards reference the GG protocol Safe as source; garden pool rewards reference that garden's Celo Safe.
- Top-ups flow down the chain (WC → GG → garden) as **funding transfers** (not commitment-bound); they are recorded as funding events in the module so exposure reporting stays honest.

## 3. `SettlementModule` (NET-NEW `packages/contracts/src/modules/Settlement.sol`)

Scaffold conventions copied from `contract-spec.md` §6.1: UUPS + Ownable + ReentrancyGuard, `_disableInitializers`, steward gate copied from the pooling module (`_requirePoolSteward` shape — garden operator/owner via hatsModule, module owner fallback, protocol pool → root-garden Hats), CookieJar-style storage comment + 50-slot accounting.

### 3.1 Storage (slot accounting)

| # | Entry | Type |
|---|---|---|
| 1 | `hatsModule` | `IHatsModule` |
| 2 | `commitmentPoolingModule` | `ICommitmentPoolingModule` (reads commitment/pool state) |
| 3 | `workingCapitalAccount` | `address` (Dev Guild Celo working-capital Safe; source of the first GG-controlled hop) |
| 4 | `protocolGarden` | `address` (root/protocol garden whose settlement account is the GG protocol Safe) |
| 5 | `gDollarToken` | `address` (canonical Celo G$; configured, never caller supplied) |
| 6 | `nextDisbursementId` | `uint256` (starts at 1) |
| 7 | `nextBatchId` | `uint256` |
| 8 | `settlementAccounts` | `mapping(address garden => SettlementAccount)` |
| 9 | `executors` | `mapping(address garden => mapping(address => bool))` (back-office Zodiac Roles members; never Safe owners) |
| 10 | `disbursements` | `mapping(uint256 => Disbursement)` |
| 11 | `batches` | `mapping(uint256 => Batch)` |
| 12 | `commitmentDisbursed` | `mapping(uint256 commitmentId => uint256 disbursementId)` (0 = none; one live disbursement per commitment) |
| 13 | `usedExecutionRefs` | `mapping(bytes32 => bool)` (a Celo tx ref belongs to one subject/attempt) |
| 14 | `verificationRequests` | `mapping(bytes32 requestId => VerificationSubject)` |
| 15 | `functionsConfig` | `FunctionsConfig` (subscription, DON, callback gas, pinned source, encrypted secrets ref) |
| 16 | `memberDeliveryEnabled` | `bool` (false until the Celo AA/paymaster exit gate passes) |
| 17 | `paused` | `bool` |

The Functions router is an immutable implementation-constructor argument following `FunctionsClient`; the proxy initializer never accepts a caller-supplied router. Actual slot accounting, not declaration counting, governs the gap: entries 1–14 consume fourteen slots; `FunctionsConfig` consumes five; `memberDeliveryEnabled` and `paused` pack into one; total named storage is twenty slots. Gap: `uint256[30] private __gap;` (20 used + 30 reserved = 50). The generated storage-layout baseline is the acceptance authority.

### 3.2 Types

```solidity
enum DisbursementState { None, Queued, Executing, Reported, Verified, Failed, Cancelled }
enum DisbursementKind { CommitmentReward, Funding }   // Funding = Safe top-up hop, not commitment-bound
enum FundingRoute { None, WorkingCapitalToProtocol, ProtocolToGarden }
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
| `setFundingConfiguration(workingCapitalAccount, protocolGarden, gDollarToken)` | module owner | all non-zero; protocol garden must be registered before funding is queued; event `FundingConfigurationUpdated` |
| `registerSettlementAccount(garden, chainId, account, recoveryOwners[3], rolesModifier, allowanceModule)` / `updateSettlementRecovery(garden, recoveryOwners[3], rolesModifier, allowanceModule)` / `setAccountActive(garden, bool)` | steward or module owner | chainId == 42220; account/modules non-zero; owners sorted, unique, non-zero and none is a current executor; threshold is fixed at 2; event `SettlementAccountRegistered` / `SettlementRecoveryUpdated` / `SettlementAccountStatusChanged` |
| `addExecutor(garden, addr)` / `removeExecutor(garden, addr)` | steward | bounded three-owner check rejects any configured recovery owner; deploy/register tooling separately proves the address is a scoped Zodiac Roles member in the live Celo Safe; event `ExecutorUpdated` |
| `setFunctionsConfig(subscriptionId, donId, callbackGasLimit, requestTimeoutSeconds, source, encryptedSecretsReference)` | module owner | all fields required; timeout is bounded 5 minutes..24 hours; source is pinned and its hash is emitted; changing configuration does not alter an active request |
| `setMemberDeliveryEnabled(bool)` | module owner | enabling requires the Celo AA/paymaster exit evidence recorded in the settlement handoff; disabling blocks new commitment-reward queues and member sends but never blocks either funding route |
| `queueDisbursement(commitmentId)` | commitment-pool steward | `memberDeliveryEnabled`; commitment `Fulfilled`; active provider-garden settlement account; no live disbursement; declared reward token equals configured G$. Individual beneficiary = stored provider same-address Celo AA account. Garden beneficiary = `settlementAccounts[providerGarden].account`, never the Arbitrum GardenAccount. Module derives source, beneficiary, token, and amount without caller overrides; event `DisbursementQueued` |
| `queueFunding(route, garden, amount)` | protocol steward or module owner | route is WorkingCapitalToProtocol or ProtocolToGarden; executorGarden is snapshotted as protocolGarden; source, recipient, and canonical G$ derive from funding config + active settlement accounts; no arbitrary addresses/tokens; event `DisbursementQueued(kind=Funding)` |
| `createBatch(ids[])` | steward or executor for the immutable executorGarden | 1–24 unique ids, all Queued + same executorGarden, derived source, and token; member ids are persisted and immutable; event `BatchCreated` |
| `markDisbursementExecuting(id)` / `markBatchExecuting(batchId)` | executor | Queued → Executing for an unbatched disbursement, or for the batch + immutable members; events `DisbursementExecuting` / `BatchExecuting` |
| `reportExecution(id, executionRef)` / `reportBatchExecution(batchId, executionRef)` | executor for stored immutable `executorGarden` | Executing → Reported; ref mandatory and globally unused; persists `reportedBy = msg.sender`; events `DisbursementExecutionReported` / `BatchExecutionReported`. Reported is not member-visible proof of receipt |
| `requestVerification(id)` / `requestBatchVerification(batchId)` | stored executor, steward, or module owner | subject is Reported with no active request; sends the pinned Chainlink Functions request, persists the returned request id + timestamp, and emits `VerificationRequested`; state remains Reported and the UI derives “checking receipt” from the active request |
| Functions router callback | configured immutable router only | matches an active request id and execution ref. A valid finalized receipt produces Verified. A receipt-invalid result produces Failed. An infrastructure error/timeout clears the active request but leaves Reported for retry. Stale request ids are ignored and can never mutate state |
| `expireVerification(id)` / `expireBatchVerification(batchId)` | stored executor, steward, or module owner | active request and `block.timestamp >= requestedAt + snapshotted requestTimeoutSeconds`; clears only that request, leaves Reported, emits `VerificationInfrastructureFailed(..., REQUEST_TIMEOUT)`, then permits a fresh request |
| `recordFailed(id, reasonCID)` / `recordBatchFailed(batchId, reasonCID)` | executor or steward | Executing → Failed before a report; batch failure also marks each immutable member Failed; reason mandatory; events `DisbursementFailed` / `BatchFailed` |
| `requeue(id)` | steward | Failed → Queued, `attempts++`; operates on one member only and clears its `batchId`, execution ref, report, verification, evidence, and failure fields. The global `usedExecutionRefs` replay guard is never cleared. A failed batch itself is immutable and never requeued |
| `cancelDisbursement(id, reasonCID)` | steward | Queued or Failed → Cancelled; frees `commitmentDisbursed`; event `DisbursementCancelled` |
| `initialize(owner, hatsModule, commitmentPoolingModule, workingCapitalAccount, protocolGarden, gDollarToken)` | proxy initializer | every address non-zero; `nextDisbursementId` and `nextBatchId` start at 1; member delivery false; owner-only UUPS authorization |
| admin setters (`setHatsModule`, `setCommitmentPoolingModule`, `setPaused`) | module owner | pause blocks all mutations except failure recording, per-member cancellation, request expiry, callback completion, and unpause |
| views (`getDisbursement`, `getBatch`, `settlementAccountOf`, `disbursementOfCommitment`, `isExecutor`, `isVerificationPending`, `memberDeliveryEnabled`) | public | `memberDeliveryEnabled` is the canonical capability read and is also indexed from `MemberDeliveryStatusChanged` |

Canonical event/error contract (the config block in §6 must match these signatures exactly):

```solidity
event FundingConfigurationUpdated(
    address indexed workingCapitalAccount,
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

error InvalidFundingRoute(uint8 route);
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
        address workingCapitalAccount_,
        address protocolGarden_,
        address gDollarToken_
    ) external;

    function setFundingConfiguration(address workingCapitalAccount_, address protocolGarden_, address gDollarToken_)
        external;
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
    function queueFunding(FundingRoute route, address garden, uint256 amount)
        external
        returns (uint256 disbursementId);
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

**Funding-route binding.** `queueFunding` never accepts source, recipient, or token. `WorkingCapitalToProtocol` stores source = `workingCapitalAccount`, recipient = `settlementAccounts[protocolGarden].account`, garden = `protocolGarden`; `ProtocolToGarden` stores source = the protocol settlement account, recipient = the target garden settlement account, garden = target garden. Both store immutable `executorGarden = protocolGarden`, so a later configuration change cannot alter who may execute an already queued transfer. Both accounts must be active where applicable, amount must be non-zero, and token is always `gDollarToken`. HoA → working capital is recorded in external treasury reporting, not fabricated as a module action Green Goods did not authorize.

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
- Binding tests: Individual Offer/Request rewards derive the stored provider same-address AA recipient; Garden claims derive the registered `providerGarden` Celo Safe and never the Arbitrum GardenAccount. Queueing with no reward, zero amount, wrong source/token, inactive account, or non-Fulfilled commitment reverts. Each funding route derives its source/recipient/token; arbitrary routes, addresses, and tokens are impossible.
- Gating tests: non-steward queue reverts; non-executor execution/reporting reverts; a configured recovery owner cannot become executor; direct callback calls revert unless sent by the immutable Functions router; only eligible callers can request/retry/expire; disabling member delivery blocks commitment-reward queues and member sends but not either funding route.
- Storage-layout test asserts the generated twenty-slot implementation layout + 30-slot gap and adds the `check-storage-layout.sh` entry, including dynamic batch-member storage and request replay protection.
- Exact contract proof: `bun run --filter @green-goods/contracts test:match -- test/unit/Settlement.t.sol`, `bun run --filter @green-goods/contracts test:script`, `bun run --filter @green-goods/contracts build:full`, `bun run --filter @green-goods/contracts lint:check`, then `bun run --filter @green-goods/contracts test`. The fixture covers queue → finalized Celo receipt → Functions callback against a Fulfilled commitment. The handoff also records subscription funding, router, DON, callback gas, pinned source hash, encrypted-secrets reference, retry window, and post-deployment health evidence.
- Exact dry-run/post-check path once the target exists: from `packages/contracts`, `bun script/deploy.ts settlement --network sepolia --dry-run`, `bun run verify:post-deploy:sepolia`, and `bun run verify:post-deploy:indexer:sepolia`. Broadcast remains separately authorized.

Deployment artifacts are exact: `deployments/{chainId}-latest.json` gains only top-level `settlementModule`; `deployments/{chainId}-settlement.json` records implementation/proxy, immutable Functions router, subscription, DON, callback gas, request timeout, source hash, encrypted-secrets-reference hash, funding configuration, deployment tx/block, and health-check request ID/result. `deployments/42220-settlement-safes.json` owns Safe recovery/role artifacts. Post-deploy health requires one mocked router callback on Sepolia, one live Functions request that returns infrastructure-safe data without mutating a disbursement, subscription balance above the recorded minimum, router/DON/source-hash equality, and indexer runtime visibility. No secret bytes are written to an artifact.

## 4. Celo side (ops + Safe modules, no new GG contracts)

- **Safes — one per garden, 1:1 mapping, every garden eligible**: the existing GG protocol Safe covers the protocol pool; each participating garden gets exactly one Celo Safe attributed to its Arbitrum garden account. Deployment is **on-demand, not launch-blocking**: the exact target is `bun script/deploy.ts settlement-safe --network celo --garden <arbitrumGardenAccount> --dry-run --pure-simulation` (broadcast is the same target with `--broadcast`, separately authorized). The admin “Set up settlement account” composes the same deterministic input; it does not contain a second deployment implementation. A salt `keccak256("GREEN_GOODS_CELO_SAFE_V1", arbitrumGardenAccount)` makes the address deterministic. `registerSettlementAccount` persists the garden↔Safe mapping, sorted owners, Roles/Allowance addresses, fixed threshold, and configuration hash.
- **Owner set at deployment**: exactly 2-of-3 for the pilot — the protocol recovery multisig, the Dev Guild/working-capital recovery multisig, and one named garden recovery delegate who can sign on Celo. Deployment fails if an owner is duplicated, zero, unnamed in the artifact, or also configured as an executor. The Arbitrum garden account is the canonical attribution and deterministic deployment input, but is **not** inserted as a non-signing owner. The script writes `packages/contracts/deployments/{chainId}-settlement-safes.json` with garden, Safe, sorted owners, threshold, Roles, Allowance, scoped selectors, per-period cap, salt, code hashes, and receipt blocks. Registration recomputes `recoveryConfigHash = keccak256(abi.encode(chainId, safe, sortedOwners, uint8(2), rolesModifier, allowanceModule))`. `addExecutor` performs a bounded three-owner rejection; the post-deploy verifier also reads the live Safe owner set and Roles membership because Arbitrum cannot prove later Celo configuration drift by itself.
- **Signer scoping (Zodiac Roles Modifier)**: executor keys are Roles members and may only call the canonical G$ `transfer`/approved multisend path from the Safe — no arbitrary execution. **Allowance module**: per-period caps per Safe. Removing every Roles member still leaves the 2-of-3 recovery owners able to rotate modules safely; compromising one executor cannot bypass the modules through Safe ownership.
- **Ownership nuance (named honestly)**: an Arbitrum ERC-6551 account cannot sign on Celo today. “Garden-controlled” means the Arbitrum module authorizes the garden mapping and reward, accountable Celo governance signers control recovery, and scoped executors perform the bounded transfer. A future validated cross-chain module may let the garden account trigger its Safe literally; that path is not required for base settlement.
- **Gas**: executor keys hold CELO; funding source = GG protocol Safe ops budget. Member receipts are pure ERC-20 transfers (no member gas). Member *sends* use sponsored gas (§5).

## 5. Member receipt + multi-chain app

**Decision (#16)**: members receive at **same-address smart accounts on Celo** — the same passkey-owned account address they have on Arbitrum, counterfactually deployable on Celo.

- **Verification spike (first week of the August track, blocking for this leg)**: confirm our AA stack on Celo — account factory deployable at same addresses, bundler + paymaster support (Pimlico or equivalent) on 42220, passkey signature validation parity. Exit: one testnet/mainnet round-trip — receive G$ at the counterfactual address, deploy on first send, sponsored send succeeds.
- **Failure behavior**: if the spike fails, `memberDeliveryEnabled` remains false. WorkingCapitalToProtocol and ProtocolToGarden settlement may continue, but commitment-reward queueing, automated member delivery, and member G$ sends remain blocked. There is no alternate member-delivery path.

**Multi-chain app (decision #17)** — the Single Chain principle amends to: **primary chain (`VITE_CHAIN_ID`) + settlement chain (Celo, 42220) for value legs**. The CLAUDE.md principle edit rides the implementation PR, not this spec. August scope, all tiers:

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
enum FundingRoute { UNKNOWN NONE WORKING_CAPITAL_TO_PROTOCOL PROTOCOL_TO_GARDEN }

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
    - event: FundingConfigurationUpdated(address indexed workingCapitalAccount, address indexed protocolGarden, address indexed gDollarToken)
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

- **W2 commitment detail (PWA)**: reward row gains settlement status — “support on its way” (Queued/Executing), “transfer reported” (Reported without active request), “checking receipt” (Reported with active request), “support arrived” + Celo ref (Verified), “still arranging support — your promise is recorded” (Failed).
- **W23 WalletDrawer G$ section (settlement delta to W5)**: only after the AA gate, G$ balance section (Celo) + received-support rows; send action → chain-aware transfer flow. When disabled, no balance/send affordance renders and explanatory copy points to the blocked delivery gate.
- **W21 Garden Pool tab settlement section (delta to W7)**: settlement account card (Safe address, active, allowance snapshot) + disbursement queue section; the batch execution and oracle console is **W22**.
- **W10 commitment dialog**: "Queue disbursement" replaces/precedes "Record payout" for G$-rewarded commitments; batch actions.
- **Admin `/community` Pools mode funding view**: WC→GG→garden funding hops, Safe balances, batch console.
- Editorial/community: no change (aggregates only; settlement is not a public story in August).

i18n families extend `app.pool.*`, `cockpit.garden.pool.*`, `cockpit.community.pools.*` with `settlement.*` keys (en/es/pt, same gate). Banned-vocab rules apply to all new copy.

## 8. Linear-aligned sequencing (amends plan Track B)

SettlementModule work runs as **PR chain 2.5** — parallel with PRD-673/674 once PRD-672's interfaces freeze (the module only *reads* the pooling module):

1. **Product Commitment Pooling cycle (through PRD-686 due 2026-07-29)**: freeze the reward-binding/event/entity contract; confirm G$ token, Safe operating details, Chainlink subscription/router/DON/callback gas, pinned source and secrets reference; run the AA/paymaster spike; and record the working-capital → protocol → garden authorization/runbook. If the mandatory oracle path is not proven by the due date, settlement remains blocked with no manual fallback.
2. **August release build (target 2026-08-31)**: `Settlement.sol` + tests + deploy plumbing; derived funding routes; mandatory Functions request/callback; exact event config; complete Disbursement + SettlementBatch indexer entities; deterministic 2-of-3 Safe deploy/register tooling; Zodiac Roles + Allowance configuration; shared chain registry and selectors; admin execution/checking/verified states; PWA reward status and, only after the AA gate, G$ wallet.
3. **August exit proof**: one real G$ reward derived from a Fulfilled commitment, queued on Arbitrum, executed from the registered garden Safe on Celo, reported, verified by the Functions callback against the finalized receipt, and rendered as “support arrived.” Working-capital funding hops are recorded separately from earned rewards.

**Honest risk note**: this widens the August hard commitment by a contracts sub-lane plus indexer/shared/admin increments. The Chainlink Functions path is mandatory for any Verified state. A failed AA gate blocks commitment-reward delivery and member sends while allowing the two protocol/garden funding routes to continue; it never activates an alternate member-delivery path. Bridge-executor automation remains stretch work and cannot replace the oracle receipt check.

## 9. Out of scope (base MVP; stretch called out)

Bridged G$ (never). Bridge custody or unbounded value authority. Bridge-executor automation is an August stretch, else post-August, capped by Safe roles + Allowance and only if operator burden warrants it. Sarafu pool integration (a deferred future hybrid experiment, gated on a Grassroots Economics conversation + an ERC-777 audit; no dated phase is assigned to it). Transferable settlement vouchers and `settlementAdapter` activation (PRD-651, all its hard gates stand). Indexing Celo/G$ transfers. Member settlement controls in the separate September Community PWA.

> **Borrow-and-repay touchpoint (blocked follow-on, `credit-spec.md`).** A companion `CreditRegister` may disburse **G$ micro-loans** as a `SettlementModule` disbursement (the advance down-leg) and record the repayment on Arbitrum — repayment stays **record-only** (no upward disbursement, no bridge). One small seam to resolve when it lands: either add `DisbursementKind.LoanPrincipal` (§3.2) **or** let `queueDisbursement` accept a `commitmentId == 0` credit disbursement (it currently gates on a Fulfilled commitment, §3.3). Out of scope for this spec; flagged so the seam is a conscious choice, not a surprise.
