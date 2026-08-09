// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ICommitmentPoolingModule {
    // ═════════════════════════════ Types ═════════════════════════════

    enum PoolType {
        Garden,
        Protocol
    }

    enum PoolState {
        None,
        NotReady,
        Ready,
        Open,
        Paused,
        Closed,
        Composted
    }

    enum CycleType {
        Season,
        Campaign
    }

    /// @notice On-chain subset. Draft is an app-side IndexedDB state;
    ///         InProgress and Reviewing are derived (spec section 5.2).
    enum CycleState {
        None,
        Seeded,
        Open,
        Reconciled,
        Composted,
        Cancelled
    }

    enum CommitmentDirection {
        Offer,
        Request
    }

    enum CommitmentType {
        DomainImpact,
        SupportService,
        SeasonCampaign,
        StewardCaptured
    }

    /// @notice On-chain subset. Draft is app-side; Active, EvidenceSubmitted,
    ///         PartiallyApproved, Reconciled are derived (spec section 5.3).
    enum CommitmentState {
        None,
        Offered,
        Requested,
        Accepted,
        ReadyForConfirmation,
        Fulfilled,
        Cancelled,
        Expired,
        Disputed
    }

    /// @notice Claimant class. Garden = a GardenAccount claims (protocol pool
    ///         cross-garden reach); Individual = a hat-wearing person claims.
    enum ClaimType {
        Garden,
        Individual
    }

    enum ClaimMode {
        Open,
        ApprovalGated
    }

    enum ContributorPolicy {
        Open,
        LeadManaged
    }

    enum ConfirmationPath {
        Ordinary,
        PoolFallback,
        ProtocolFallback
    }

    enum DisputeResolution {
        RestorePrevious,
        Fulfilled,
        Cancelled,
        Expired
    }

    enum ConsiderationRail {
        None,
        ArbitrumExternal,
        CeloSettlement
    }

    enum ModuleDependency {
        GardenToken,
        HatsModule,
        ActionRegistry,
        CommitmentRegistry,
        WorkApprovalResolver,
        EAS
    }

    enum ModuleSchemaKind {
        Work,
        WorkApproval,
        LegacyAssessment,
        AssessmentV3
    }

    /// @notice Allocation-class snapshot for Hypercert cut-over. Must sum to
    ///         exactly 10_000 bps (Yield.sol InvalidSplitRatio precedent).
    struct AllocationBps {
        uint16 gardeners;
        uint16 treasury;
        uint16 operator;
        uint16 evaluator;
        uint16 community;
        uint16 funder;
    }

    /// @notice Within the gardeners allocation class. The protocol preset is
    ///         2_000 / 8_000; values snapshot at cycle open and sum to 10_000.
    struct RecognitionPolicy {
        uint16 equalParticipationBps;
        uint16 verifiedContributionBps;
    }

    struct Pool {
        address garden; // ERC-6551 garden account
        PoolType poolType;
        PoolState state;
        bool proofEnabled; // capability flag; true for MVP pools
        bool settlementEnabled; // RESERVED: always false in MVP
        string charterCID; // policy/charter metadata (IPFS)
        uint256 openSeasonCycleId; // 0 = none; Campaigns may overlap and are indexed from events
        address settlementAdapter; // RESERVED: always zero in MVP (transferable-voucher layer)
        uint32 liveCommitmentCount; // every non-terminal pool commitment, including cycle-less
        uint32 nonTerminalCycleCount; // Seeded/Open/Reconciled cycles; must be zero before close
    }

    struct Cycle {
        uint256 poolId;
        CycleType cycleType;
        CycleState state;
        uint64 startTime;
        uint64 endTime;
        string metadataCID;
        AllocationBps allocation; // snapshot emitted in CycleOpened
        RecognitionPolicy recognitionPolicy;
        uint32 liveCommitmentCount; // non-terminal cycle commitments; must be zero before close
    }

    /// @notice Declared consideration is a reference, never custody (register #18). Direction is
    ///         implied by `Commitment.payerGarden`, never by this struct (register #90).
    struct DeclaredConsideration {
        ConsiderationRail rail;
        address source; // ArbitrumExternal payer; zero sentinel for CeloSettlement (payerGarden's Safe)
        address token; // ArbitrumExternal token; zero sentinel for CeloSettlement
        uint256 amount; // 0 = free; the commitment carries no consideration
    }

    struct CommitmentRequirement {
        uint256 actionUID;
        uint8 domain; // derived from ActionRegistry, never caller-authored
        uint32 requiredCount;
        uint32 approvedCount;
    }

    struct CommitmentRequirementInput {
        uint256 actionUID;
        uint32 requiredCount;
    }

    enum CommitmentSeriesState {
        None,
        Active,
        Resting,
        Retired
    }

    struct CommitmentSeries {
        uint256 poolId;
        address createdBy;
        address currentHolder;
        CommitmentSeriesState state;
        string metadataCID;
        bytes32 creationPayloadHash; // immutable poolId + initial metadataCID hash for replay conflict detection
    }

    struct Commitment {
        uint256 poolId;
        uint256 cycleId; // 0 = not cycle-scoped
        uint256 commitmentSeriesId; // 0 = one-shot; otherwise validated module-owned series
        address creator; // social source (StewardCaptured: the gardener, not the recorder)
        bytes32 creationRequestKey; // sender-safe offline/restart identity
        bytes32 creationPayloadHash; // immutable full creation payload hash for replay conflict detection
        address counterparty; // provider (Request) or engager (Offer); zero until Accepted
        address leadProvider; // Offer creator; Individual Request counterparty; Garden Request authenticated requester
            // (Open caller or stored ApprovalGated requestedBy)
        ClaimType counterpartyKind;
        CommitmentDirection direction;
        CommitmentType commitmentType;
        CommitmentState state;
        ClaimType claimType; // eligibility class set at seeding
        ClaimMode claimMode;
        ContributorPolicy contributorPolicy;
        uint8[] domains; // derived unique tags; not a requirement-count bound
        CommitmentRequirement[] requirements; // DomainImpact: 1..MAX_REQUIREMENTS
        uint64 dueDate; // 0 = cycle endTime governs
        string unitLabel; // hours, tasks, meals, rides, plants...
        uint256 targetUnits;
        uint32 contributorCount;
        uint32 eligibleContributorCount; // contributors with pre-freeze credit; recognition additionally requires Fulfilled
        uint64 totalVerifiedCredits; // approved Work + at most one evidence participation credit per contributor
        uint32 evidenceCount;
        bool contributorsFrozen;
        uint32 confirmationThreshold; // N of the named group; 1 under the counterparty default
        uint32 confirmationCount;
        bool protocolFallbackEnabled; // explicit pre-acceptance Green Goods team fallback selection
        bool requiresAssessment;
        bytes32 assessmentUID; // attached v2/v3 assessment; zero until attached
        bytes32 needUID; // community Need this commitment addresses; 0 = none (amendment 2026-07-04)
        uint256 counterCommitmentId; // same-pool commitment this one is made in exchange for; 0 = none; one-way, immutable
            // (amendment 2026-08-01)
        string metadataCID; // terms/description payload (IPFS)
        DeclaredConsideration consideration;
        uint256 declaredUnitValue; // relative value of one unit against declaredValueBasis; 0 = undeclared (amendment
            // 2026-08-01)
        string declaredValueBasis; // exact-label basis ("G$", "USD"); empty = undeclared; pair-bound with declaredUnitValue
        bool considerationPaid;
        CommitmentState preDisputeState; // exact state captured by raiseDispute
        address providerGarden; // EAS recipient and provider-role scope; never the settlement payer
        // The asking side, and the only Safe settlement may spend (register #90). Request: the pool
        // garden, stored at creation. Offer: the claiming gardenContext, stored at acceptance.
        // Garden-internal commitments resolve this to providerGarden.
        address payerGarden;
        // RESERVED post-MVP garden-to-garden (L3); never written in MVP:
        uint256 counterpartyPoolId;
        address counterpartyGardenAccount;
    }

    struct PendingClaim {
        address claimant; // canonical key: individual caller or GardenAccount
        address requestedBy; // authenticated caller; differs for Garden claims
        ClaimType kind;
        address gardenContext;
        uint64 requestedAt;
        bool active;
    }

    struct CreateCommitmentParams {
        uint256 poolId;
        uint256 cycleId;
        bytes32 creationRequestKey; // non-zero, creator-scoped, persisted before first send
        uint256 commitmentSeriesId; // 0 = one-shot; non-zero is Active, same-pool, direct-holder Offer only
        CommitmentDirection direction;
        CommitmentType commitmentType;
        ClaimType claimType;
        ClaimMode claimMode;
        ContributorPolicy contributorPolicy;
        address onBehalfOf; // StewardCaptured only: the gardener who made the promise
        uint8[] domainTags; // non-DomainImpact optional tags; DomainImpact derives tags
        CommitmentRequirementInput[] requirements; // caller supplies only immutable requirement facts
        string unitLabel;
        uint256 targetUnits;
        bool requiresAssessment;
        uint64 dueDate;
        string metadataCID;
        bytes32 needUID; // 0 = none; stored as-is, module never reads EAS (amendment 2026-07-04)
        uint256 counterCommitmentId; // 0 = none; must exist in the same pool; immutable one-way reference (amendment
            // 2026-08-01)
        address[] confirmers; // empty = Offer recipient / Request creator default
        uint32 confirmationThreshold; // ignored (forced 1) when confirmers is empty
        bool protocolFallbackEnabled; // explicit structural fallback through registered protocol-pool Hats
        DeclaredConsideration consideration; // amount 0 = free
        uint256 declaredUnitValue; // 0 = undeclared; pair-bound with declaredValueBasis (amendment 2026-08-01)
        string declaredValueBasis; // empty = undeclared; exact-label identity like unitLabel
    }

    struct ContributorRecord {
        bool active;
        uint32 uncountedLinkedWorkCount;
        uint32 approvedWorkCredits;
        uint32 evidenceCredits; // canonical 0-or-1 recognition credit; evidence provenance remains repeatable
    }

    struct RecognitionEntry {
        address contributor;
        uint16 recognitionWeightBps;
    }

    // ═════════════════════════════ Events ════════════════════════════
    // One event per hard transition (spec section 5), plus unit-count and
    // linkage events. All indexed on poolId/commitmentId for Envio.

    event PoolRegistered(uint256 indexed poolId, address indexed garden, PoolType poolType);
    event PoolCharterUpdated(uint256 indexed poolId, string charterCID);
    event PoolReady(uint256 indexed poolId);
    event PoolOpened(uint256 indexed poolId);
    event PoolPaused(uint256 indexed poolId, string reasonCID);
    event PoolResumed(uint256 indexed poolId);
    event PoolClosed(uint256 indexed poolId);
    event PoolComposted(uint256 indexed poolId);
    event PoolReopened(uint256 indexed poolId, bool toOpen);

    event CycleSeeded(
        uint256 indexed cycleId,
        uint256 indexed poolId,
        CycleType cycleType,
        uint64 startTime,
        uint64 endTime,
        string metadataCID
    );
    /// @notice Allocation-class bps ride in the open event (register #12).
    event CycleOpened(
        uint256 indexed cycleId,
        uint256 indexed poolId,
        uint16 gardenersBps,
        uint16 treasuryBps,
        uint16 operatorBps,
        uint16 evaluatorBps,
        uint16 communityBps,
        uint16 funderBps,
        uint16 equalParticipationBps,
        uint16 verifiedContributionBps
    );
    event CycleClosed(uint256 indexed cycleId, uint256 indexed poolId);
    event CycleComposted(uint256 indexed cycleId, uint256 indexed poolId);
    event CycleCancelled(uint256 indexed cycleId, uint256 indexed poolId, string reasonCID);

    event CommitmentSeriesCreated(
        uint256 indexed seriesId, uint256 indexed poolId, address indexed holder, string metadataCID
    );
    event CommitmentSeriesMetadataUpdated(uint256 indexed seriesId, string metadataCID);
    event CommitmentSeriesRested(uint256 indexed seriesId);
    event CommitmentSeriesResumed(uint256 indexed seriesId);
    event CommitmentSeriesRetired(uint256 indexed seriesId);

    // creator-scoped sender-safe replay identity
    // the exact stored §6.1 creation preimage hash (amendment 2026-08-05)
    // msg.sender; differs from creator for StewardCaptured
    // 0 = none; non-indexed (3-indexed budget spent); Envio reads params regardless (amendment 2026-07-04)
    // 0 = none; same-pool exchange reference (amendment 2026-08-01)
    // 0 = undeclared (amendment 2026-08-01)
    // empty = undeclared; exact-label basis
    event CommitmentCreated( // 0 = one-shot; non-indexed (3-indexed budget spent)
        uint256 indexed commitmentId,
        uint256 indexed poolId,
        uint256 indexed cycleId,
        uint256 commitmentSeriesId,
        bytes32 creationRequestKey,
        bytes32 creationPayloadHash,
        address creator,
        address recordedBy,
        CommitmentDirection direction,
        CommitmentType commitmentType,
        ClaimType claimType,
        ClaimMode claimMode,
        ContributorPolicy contributorPolicy,
        uint8[] domains,
        uint256[] requirementActionUIDs,
        uint8[] requirementDomains,
        uint32[] requirementRequiredCounts,
        string unitLabel,
        uint256 targetUnits,
        bool requiresAssessment,
        uint64 dueDate,
        string metadataCID,
        bytes32 needUID,
        uint256 counterCommitmentId,
        uint256 declaredUnitValue,
        string declaredValueBasis,
        // Zero for an Offer until acceptance resolves the claiming garden. Emitted rather than
        // derived because reverse delivery may project this event before PoolRegistered, leaving
        // no pool garden to read and no bounded reverse index to backfill from (register #90).
        address payerGarden
    );
    event ConsiderationDeclared(
        uint256 indexed commitmentId, ConsiderationRail rail, address source, address token, uint256 amount
    );
    /// @notice Pre-acceptance valuation update (amendment 2026-08-01); mirrors ConsiderationDeclared.
    event ValueDeclared(uint256 indexed commitmentId, uint256 declaredUnitValue, string declaredValueBasis);
    event ConfirmerRuleSet(
        uint256 indexed commitmentId, address[] confirmers, uint32 threshold, bool protocolFallbackEnabled
    );
    event ClaimRequested(
        uint256 indexed commitmentId,
        address indexed claimant,
        address indexed requestedBy,
        ClaimType kind,
        address gardenContext,
        uint64 requestedAt
    );
    event ClaimDeclined(uint256 indexed commitmentId, address indexed claimant, string reasonCID);
    event CommitmentAccepted(
        uint256 indexed commitmentId,
        address indexed claimant,
        address indexed counterparty,
        ClaimType kind,
        address gardenContext,
        address leadProvider,
        address providerGarden,
        address payerGarden
    );
    event ExchangeAccepted(
        uint256 indexed commitmentIdA,
        uint256 indexed commitmentIdB,
        uint256 poolId,
        address indexed acceptorA,
        address acceptorB
    );
    event ContributorAdded(uint256 indexed commitmentId, address indexed contributor, address indexed addedBy);
    event ContributorRemoved(uint256 indexed commitmentId, address indexed contributor, address indexed removedBy);
    event ContributorRequirementAssigned(
        uint256 indexed commitmentId, address indexed contributor, uint16 indexed requirementIndex, bool assigned
    );
    event ContributorRosterFrozen(uint256 indexed commitmentId, uint32 contributorCount);
    event WorkLinked(
        uint256 indexed commitmentId,
        bytes32 indexed workUID,
        address indexed contributor,
        uint16 requirementIndex,
        address linker,
        bytes32 operationKey
    );
    event WorkUnlinked(uint256 indexed commitmentId, bytes32 indexed workUID, address unlinker);
    /// @notice Unit-count change event. requirementIndex is the matched
    ///         requirement and contributor is the active Work attester.
    ///         approvedUnits is the new cumulative integer floor over the
    ///         requirement rows; newlyApprovedUnits is its delta.
    event ApprovedWorkCounted(
        uint256 indexed commitmentId,
        bytes32 indexed workUID,
        address indexed contributor,
        bytes32 approvalUID,
        uint64 decisionSequence,
        uint16 requirementIndex,
        uint32 approvedWorkCount,
        uint256 approvedUnits,
        uint256 newlyApprovedUnits
    );
    event ApprovedWorkReversed(
        uint256 indexed commitmentId,
        bytes32 indexed workUID,
        address indexed contributor,
        bytes32 decisionUID,
        uint64 decisionSequence,
        uint16 requirementIndex,
        uint32 approvedWorkCount,
        uint256 approvedUnits,
        uint256 removedApprovedUnits
    );
    /// @notice Lightweight evidence (register #20); offline-queueable write.
    event EvidenceAttached(
        uint256 indexed commitmentId, string cid, address indexed attacher, address[] creditedContributors
    );
    event AssessmentAttached(uint256 indexed commitmentId, bytes32 indexed assessmentUID, address attacher);
    event CommitmentReadyForConfirmation(uint256 indexed commitmentId, bool overridden, string reason);
    event ConfirmationRecorded(
        uint256 indexed commitmentId, address indexed confirmer, uint32 confirmationCount, uint32 threshold
    );
    event CommitmentFulfilled(
        uint256 indexed commitmentId, address indexed confirmer, ConfirmationPath confirmationPath, string reason
    );
    event CommitmentCancelled(uint256 indexed commitmentId, address indexed canceller, string reasonCID);
    event CommitmentExpired(uint256 indexed commitmentId, address indexed caller);
    event CommitmentDisputed(
        uint256 indexed commitmentId, address indexed raiser, CommitmentState previousState, string reasonCID
    );
    event DisputeResolved(
        uint256 indexed commitmentId, DisputeResolution resolution, CommitmentState finalState, string reasonCID
    );
    /// @notice Payout executed on existing rails and recorded here (register #18).
    event ConsiderationPaid(
        uint256 indexed commitmentId,
        address indexed source,
        address indexed recipient,
        address token,
        uint256 amount,
        bytes32 payoutRef,
        address recordedBy
    );
    event ModuleDependencyUpdated(
        ModuleDependency indexed dependency, address indexed previousAddress, address indexed newAddress
    );
    event ModuleSchemaUIDUpdated(ModuleSchemaKind indexed schemaKind, bytes32 previousUID, bytes32 newUID);
    event ModulePauseStatusChanged(bool previousPaused, bool paused);

    // ═════════════════════════════ Errors ════════════════════════════

    error UnauthorizedCaller(address caller);
    error NotPoolSteward(address caller, uint256 poolId);
    error ModulePaused();
    error ModuleMustBePaused();
    error ModuleNotReady();
    error ZeroAddress();
    error RootGardenRequired();
    error ProtocolGardenMismatch(address expectedRootGarden, address suppliedGarden);
    error SchemaUIDRequired(ModuleSchemaKind schemaKind);
    error SchemaUIDCollision(bytes32 uid);
    error PoolExists(address garden);
    error UnknownPool(uint256 poolId);
    error PoolNotInState(uint256 poolId, PoolState actual);
    error CharterRequired(uint256 poolId);
    error PoolHasLiveCommitments(uint256 poolId, uint32 liveCommitmentCount);
    error PoolHasNonTerminalCycles(uint256 poolId, uint32 nonTerminalCycleCount);
    error UnknownCycle(uint256 cycleId);
    error CycleNotInState(uint256 cycleId, CycleState actual);
    error CyclePoolMismatch(uint256 cycleId, uint256 expectedPoolId, uint256 actualPoolId);
    error CycleNotAcceptingCommitments(uint256 cycleId, CycleState actual);
    error CycleHasLiveCommitments(uint256 cycleId, uint32 liveCommitmentCount);
    error InvalidAllocation(); // bps sum != 10_000 (Yield.sol InvalidSplitRatio precedent)
    error InvalidTimeWindow(uint64 startTime, uint64 endTime);
    error SeasonAlreadyOpen(uint256 poolId, uint256 cycleId);
    error UnknownCommitmentSeries(uint256 seriesId);
    error CommitmentSeriesPoolMismatch(uint256 seriesId, uint256 expectedPoolId, uint256 actualPoolId);
    error CommitmentSeriesNotActive(uint256 seriesId);
    error CommitmentSeriesHolderOnly(uint256 seriesId, address caller);
    error CommitmentSeriesOfferOnly(uint256 seriesId);
    error CommitmentSeriesIndividualOnly(uint256 seriesId);
    error InvalidCommitmentSeriesState(uint256 seriesId, CommitmentSeriesState state);
    error InvalidSeriesCreationRequestKey();
    error SeriesCreationRequestConflict(bytes32 creationRequestKey, uint256 existingSeriesId);
    error InvalidCommitmentCreationRequestKey();
    error CommitmentCreationRequestConflict(bytes32 creationRequestKey, uint256 existingCommitmentId);
    error InvalidWorkLinkOperationKey();
    error WorkLinkOperationConflict(bytes32 operationKey);
    error UnknownCommitment(uint256 commitmentId);
    error CommitmentNotInState(uint256 commitmentId, CommitmentState actual);
    error NotEligibleClaimant(address claimant);
    error ClaimModeMismatch(uint256 commitmentId);
    error ClaimTypeMismatch(uint256 commitmentId, ClaimType expected, ClaimType actual);
    error SelfCounterparty(); // creator cannot be the canonical claimant or authenticated Garden requester
    error SelfConfirmation(); // provider cannot confirm own fulfillment (WorkApproval SelfAttestation precedent)
    error NotConfirmer(address caller);
    error AlreadyConfirmed(address confirmer);
    error InvalidConfirmerRule();
    error TooManyConfirmers(uint256 supplied, uint256 maximum);
    error InvalidWorkAttestation(bytes32 workUID);
    error InvalidApprovalAttestation(bytes32 approvalUID);
    error InvalidAssessmentAttestation(bytes32 assessmentUID);
    error AssessmentAlreadyAttached(uint256 commitmentId, bytes32 assessmentUID);
    error WorkAlreadyLinked(bytes32 workUID);
    error ApprovalAlreadyCounted(bytes32 approvalUID);
    error IncompleteDecisionHistory(bytes32 workUID, uint64 expectedSequence, uint64 suppliedSequence);
    error WorkNotLinkedToCommitment(bytes32 workUID, uint256 commitmentId);
    error EvidenceRequired(uint256 commitmentId);
    error EvidenceCIDRequired();
    error EvidenceAlreadyAttached(uint256 commitmentId, bytes32 cidHash);
    error EvidenceContributorsRequired();
    error TooManyEvidenceContributors(uint256 supplied, uint256 maximum);
    error TooManyContributors(uint256 supplied, uint256 maximum);
    error TooManyLinkedWorks(uint256 supplied, uint256 maximum);
    error AssessmentRequired(uint256 commitmentId);
    error WorkApprovalRequired(uint256 commitmentId);
    error OpenCommitmentCapRequired(uint256 poolId);
    error NotDue(uint256 commitmentId);
    error ConsiderationAlreadyRecorded(uint256 commitmentId);
    error ConsiderationNotDeclared(uint256 commitmentId);
    error ConsiderationRailMismatch(uint256 commitmentId, ConsiderationRail expected, ConsiderationRail actual);
    error InvalidConsiderationConfiguration();
    error InvalidValueDeclaration(); // declaredUnitValue/declaredValueBasis pair rule violated (amendment 2026-08-01)
    error UnknownCounterCommitment(uint256 counterCommitmentId);
    error CounterCommitmentPoolMismatch(uint256 poolId, uint256 counterCommitmentId);
    error SelfCounterCommitment();
    error ExchangeCounterpartMismatch(uint256 exchangeCommitmentId);
    error ExchangeDirectionInvalid(
        uint256 commitmentIdA, uint256 commitmentIdB, CommitmentDirection directionA, CommitmentDirection directionB
    );
    error ExchangeStateInvalid(uint256 commitmentId, CommitmentState actual);
    error SelfExchange(address creator);
    /// @notice A Garden claim resolves the claimant to `gardenContext`, which in a garden pool is
    ///         forced to that pool's own garden — making payer, provider, and the register #91
    ///         recipient the same account. Cross-garden reach is a protocol-pool capability.
    error GardenClaimRequiresProtocolPool(uint256 poolId);
    /// @notice A protocol-pool Garden claim must name a registered garden other than the
    ///         protocol garden itself. Otherwise a Garden-scoped Request would settle from the
    ///         protocol Safe back to that same Safe instead of creating cross-garden circulation.
    error GardenClaimMustBeExternal(uint256 poolId, address garden);
    /// @notice Only a steward may commit a garden to pay for an Offer that carries a price.
    /// @dev Free Offers stay claimable by any member (Decision Log #61).
    error PricedOfferClaimRequiresSteward(address garden, address claimant);
    error ExchangeClaimTypeUnsupported(uint256 commitmentId, ClaimType actual);
    /// @notice Paired acceptance is barter: both sides must be free (register #90). One
    ///         `gardenContext` covers both acceptances, so a priced side would record that single
    ///         garden as payer for a bilateral trade between two individuals.
    error ExchangeConsiderationUnsupported(uint256 commitmentId, uint256 amount);
    error ExchangeCreatorConsentRequired(uint256 exchangeCommitmentId);
    error ReasonRequired();
    error UnitLabelRequired();
    error TargetUnitsRequired();
    error InvalidDomains();
    error InvalidRequirementCount(uint256 requirementIndex);
    error TooManyRequirements(uint256 supplied, uint256 maximum);
    error ContributorAlreadyActive(address contributor);
    error ContributorNotActive(address contributor);
    error NotEligibleContributor(address contributor);
    error RosterAlreadyFrozen(uint256 commitmentId); // NOT ContributorRosterFrozen: Solidity gives events and errors one
        // declaration namespace, so the event name above cannot be reused here
    error ContributorPolicyMismatch(uint256 commitmentId);
    error LeadContributorCannotLeave(uint256 commitmentId);
    error ContributorHasCredit(address contributor);
    error NoEligibleContributors(uint256 commitmentId);
    error RecognitionPolicyUnavailable(uint256 cycleId);
    error InvalidRequirementAssignment(uint256 requirementIndex, address contributor);
    error ConfirmationThresholdUnreachable(uint256 commitmentId);
    error OrdinaryConfirmationStillReachable(uint256 commitmentId);
    error UnknownAction(uint256 actionUID);
    error ClaimNotPending(uint256 commitmentId, address claimant);
    error ProviderMismatch(address attester, address providerGarden);
    error WorkActionMismatch(uint256 actionUID);
    error InvalidDisputeResolution(uint256 commitmentId, DisputeResolution resolution);

    // ══════════════════════ Pool lifecycle ═══════════════════════════

    /// @notice GardenToken mint callback. Idempotent; registers a Garden-type
    ///         pool in NotReady. Gating: gardenToken only (CookieJar onlyGardenToken pattern).
    function onGardenMinted(address garden) external returns (uint256 poolId);

    /// @notice Backfill for pre-upgrade gardens and the protocol pool.
    ///         Gating: PoolType.Protocol requires module owner, requires
    ///         garden == rootGarden before any pool write, sets the write-once
    ///         protocolPoolId, and rejects a second Protocol pool with
    ///         PoolExists(existingProtocolGarden). PoolType.Garden requires
    ///         garden operator/owner or module owner.
    function registerPool(address garden, PoolType poolType) external returns (uint256 poolId);

    /// @notice Gating for the pool lifecycle functions below: pool steward (garden operator/owner
    ///         via hatsModule, module owner fallback). Protocol pool resolves
    ///         to root-garden hats.
    function setPoolCharter(uint256 poolId, string calldata charterCID) external;
    function markPoolReady(uint256 poolId) external;
    function openPool(uint256 poolId) external;
    function pausePool(uint256 poolId, string calldata reasonCID) external;
    function resumePool(uint256 poolId) external;
    /// @notice Closes only after every pool commitment is terminal and every
    ///         seeded cycle is Cancelled or Composted. A paused pool must be
    ///         safely wound down through the same zero-live boundary.
    /// @dev Reverts PoolHasLiveCommitments or PoolHasNonTerminalCycles before
    ///      changing state.
    function closePool(uint256 poolId) external;
    function compostPool(uint256 poolId) external;
    function reopenPool(uint256 poolId, bool toOpen) external;

    // ══════════════════════ Cycle lifecycle ══════════════════════════

    /// @notice Gating: pool steward. Pool must be Ready or Open to seed;
    ///         Open to open a cycle. The allocation is supplied atomically at
    ///         open and must sum to 10_000.
    function seedCycle(
        uint256 poolId,
        CycleType cycleType,
        uint64 startTime,
        uint64 endTime,
        string calldata metadataCID
    )
        external
        returns (uint256 cycleId);
    function openCycle(
        uint256 cycleId,
        AllocationBps calldata allocation,
        RecognitionPolicy calldata recognitionPolicy
    )
        external;
    /// @notice Reconciliation is O(1): the cycle must be Open and its
    ///         liveCommitmentCount must be zero. Creation increments the count
    ///         for a non-zero cycle; Fulfilled, Cancelled, or Expired decrements
    ///         it exactly once. ReadyForConfirmation and Disputed remain live.
    function closeCycle(uint256 cycleId) external;
    function compostCycle(uint256 cycleId) external;
    /// @dev Requires liveCommitmentCount == 0 so cancellation cannot strand commitments.
    function cancelCycle(uint256 cycleId, string calldata reasonCID) external;

    // ══════════════════════ Commitment series ═════════════════════

    /// @notice Direct-holder creation. Caller must be a current member of the
    ///         pool garden; pool must be Ready or Open. Exact replay of the
    ///         same holder-scoped key and payload returns the original ID
    ///         without a second state mutation or event.
    function createCommitmentSeries(
        uint256 poolId,
        bytes32 creationRequestKey,
        string calldata metadataCID
    )
        external
        returns (uint256 seriesId);
    function updateCommitmentSeriesMetadata(uint256 seriesId, string calldata metadataCID) external;
    function restCommitmentSeries(uint256 seriesId) external;
    function resumeCommitmentSeries(uint256 seriesId) external;
    function retireCommitmentSeries(uint256 seriesId) external;

    // ══════════════════════ Commitments ══════════════════════════════

    /// @notice Gating by commitment type (creation authority, locked):
    ///         gardeners create own offers/requests (any of the six garden role
    ///         hats in the pool garden, IHatsModule.GardenRole);
    ///         SeasonCampaign and StewardCaptured require pool steward;
    ///         protocol-pool commitments require root-garden steward or module owner.
    ///         StewardCaptured must set onBehalfOf (the gardener stays the
    ///         social source; msg.sender is recorded as recordedBy in the event).
    ///         For a non-zero counterCommitmentId on Offer B, this transaction
    ///         rejects StewardCaptured/onBehalfOf creation and, before allocating
    ///         or storing B or registering its class, revalidates A as a
    ///         same-pool Offered Individual Offer with a distinct creator and an
    ///         exact full reservation still Committed to A's creator.
    ///         creationRequestKey is non-zero and scoped to the direct creator.
    ///         First use stores the exact frozen creation preimage hash defined
    ///         in §6.1 "Creation payload hash (frozen preimage)" and emits it in
    ///         CommitmentCreated. Exact replay
    ///         returns the original commitmentId without a second event,
    ///         capacity reservation, class commit, or pool-live increment;
    ///         reuse with a different payload reverts.
    function createCommitment(CreateCommitmentParams calldata params) external returns (uint256 commitmentId);

    /// @notice Sender-safe read-through for an interrupted commitment send.
    function getCommitmentIdByCreationRequest(
        address creator,
        bytes32 creationRequestKey
    )
        external
        view
        returns (uint256 commitmentId);

    /// @notice Forwards to the module-only register setter. Gating: pool
    ///         steward; cap is a non-zero concurrent commitment count and is
    ///         required before markPoolReady.
    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external;

    /// @notice Gating: pool steward, pre-acceptance only.
    function setDeclaredConsideration(uint256 commitmentId, DeclaredConsideration calldata consideration) external;
    /// @notice Gating: pool steward, pre-acceptance only. Records-only valuation
    ///         term (decision 16); pair rule enforced, nothing derived on-chain.
    function setDeclaredValue(
        uint256 commitmentId,
        uint256 declaredUnitValue,
        string calldata declaredValueBasis
    )
        external;
    function setConfirmerRule(
        uint256 commitmentId,
        address[] calldata confirmers,
        uint32 threshold,
        bool protocolFallbackEnabled
    )
        external;

    /// @notice Claim eligibility (register #7, register #8):
    ///         Garden pools: caller must hold any role hat in the pool garden
    ///         (gardenContext must equal the pool garden).
    ///         Runtime kind must equal the immutable creation-time claimType.
    ///         Protocol pool, ClaimType.Garden: gardenContext must be a
    ///         registered garden (gardenPool != 0) and caller its operator/owner;
    ///         canonical claimant and counterparty = gardenContext, requestedBy = caller.
    ///         Protocol pool, ClaimType.Individual: caller must hold any role
    ///         hat in gardenContext; claimant = requestedBy = counterparty = caller.
    ///         ClaimMode.Open transitions to Accepted; ApprovalGated only emits
    ///         ClaimRequested and persists one pending request per canonical claimant.
    ///         Creator cannot be the canonical claimant or, for a Garden
    ///         claim, its authenticated requestedBy caller.
    function claimCommitment(uint256 commitmentId, ClaimType kind, address gardenContext) external;

    /// @notice Gating: pool steward. ApprovalGated acceptance path; validates
    ///         the terms persisted by claimCommitment. The accepter cannot
    ///         substitute a different kind or gardenContext.
    function acceptClaim(uint256 commitmentId, address claimant) external;

    /// @notice Atomic bilateral Offer x Offer acceptance. The argument is B,
    ///         whose immutable counterCommitmentId resolves A. Only A's creator
    ///         calls. B's creator becomes A's claimant and A's creator becomes
    ///         B's claimant. Cycle and identity predicates run per side, and
    ///         B must have been created directly, not through StewardCaptured
    ///         onBehalfOf; both full immutable-quota reservations must still
    ///         belong to their creators; the ApprovalGated operator path is not
    ///         consulted. Both Offer classes already reserve their providers'
    ///         slots, so no second registry commit or provider-cap headroom
    ///         check occurs. Both CommitmentAccepted events, one
    ///         ContributorAdded lead event per side, and the ExchangeAccepted
    ///         marker commit or revert together.
    function acceptExchange(uint256 exchangeCommitmentId) external;

    /// @notice Gating: pool steward. ApprovalGated decline path; reason is
    ///         mandatory. Clears the claimant's pending flag so a later request
    ///         is possible and emits ClaimDeclined for the audit trail.
    function declineClaim(uint256 commitmentId, address claimant, string calldata reasonCID) external;

    /// @notice Open-policy self-join. The caller must satisfy the same
    ///         garden-membership/provider-garden gate as a Work author.
    function joinCommitment(uint256 commitmentId) external;

    /// @notice Open-policy self-exit. Only an active non-lead contributor with
    ///         zero linked Work and zero approved Work/evidence credit may leave
    ///         before freeze.
    function leaveCommitment(uint256 commitmentId) external;

    /// @notice LeadManaged-only roster mutation. The lead provider or pool steward
    ///         may add/remove contributors before the roster freezes. An added
    ///         contributor must satisfy the same resolved providerGarden
    ///         membership gate as self-join and a Work author. A contributor
    ///         with linked Work or credit cannot be removed through roster
    ///         editing.
    function addContributor(uint256 commitmentId, address contributor) external;
    function removeContributor(uint256 commitmentId, address contributor) external;

    /// @notice Optional planning signal; assignment is not recognition credit.
    function setContributorRequirement(
        uint256 commitmentId,
        address contributor,
        uint16 requirementIndex,
        bool assigned
    )
        external;

    // ─────────────── Work linkage + EAS bridge (register #5) ─────────

    /// @notice Link a Work attestation to a commitment before or after its
    ///         approval. Verifies via eas.getAttestation: schema == workSchemaUID,
    ///         recipient == providerGarden. DomainImpact additionally requires
    ///         decoded Work.actionUID in the explicitly selected stored requirement. The Work
    ///         attester must be an active contributor and satisfy the
    ///         providerGarden role scope. One work maps to at most one
    ///         commitment; one commitment maps to many works.
    ///         Gating: active contributor, lead provider, or pool steward;
    ///         on-chain state Accepted and contributorsFrozen == false.
    ///         operationKey is non-zero and caller-scoped. Exact payload replay
    ///         is a no-op even after a later unlink; conflicting reuse reverts.
    function linkWork(uint256 commitmentId, bytes32 workUID, uint16 requirementIndex, bytes32 operationKey) external;

    /// @notice Read-through for an interrupted offline Work-link send.
    function getWorkLinkOperationPayloadHash(
        address caller,
        bytes32 operationKey
    )
        external
        view
        returns (bytes32 payloadHash);

    /// @notice Gating: pool steward; on-chain state Accepted, roster/credit
    ///         ledger unfrozen, and the Work's current effective credit inactive.
    ///         Historical approvals do not block unlink after a newer rejection.
    function unlinkWork(bytes32 workUID) external;

    /// @notice Called by WorkApprovalResolver inside try/catch after every fully
    ///         validated approval or rejection decision. The module loads the
    ///         attestation and accepts a decision as effective only when the
    ///         resolver-assigned sequence is greater than the stored sequence.
    ///         An effective approval activates credit; an effective rejection
    ///         reverses it. Unlinked, duplicate, older, or frozen-ledger decisions
    ///         are observed without changing requirements, units, or recognition.
    ///         Never reverts on state it does not recognize: the Work decision
    ///         attestation must stand regardless.
    ///         Gating: workApprovalResolver only.
    function onWorkDecision(
        bytes32 workUID,
        bytes32 approvalUID,
        uint64 decisionSequence,
        address garden,
        bool approved
    )
        external;

    /// @notice Steward-callable catch-up when resolver hooks were missed.
    ///         Verifies every decision UID through EAS and loads its non-zero,
    ///         resolver-owned sequence. Before any mutation, a bounded first
    ///         pass proves that the greatest supplied sequence for each Work
    ///         equals WorkApprovalResolver.latestDecisionSequence(workUID).
    ///         A second pass applies only that current decision per Work. Before
    ///         Ready can be evaluated, the module enumerates the commitment's
    ///         complete bounded active Work set and proves every stored sequence
    ///         equals the resolver's current sequence. Omitting any stale linked
    ///         Work therefore reverts the whole catch-up before freeze.
    ///         Pre-upgrade decisions with no sequence are rejected and require
    ///         the operator to attest the current decision again.
    ///         Gating: pool steward.
    function syncWorkDecisions(uint256 commitmentId, bytes32[] calldata decisionUIDs) external;

    /// @notice Canonical recognition validator shared by Hypercert composition
    ///         and SettlementModule. Recomputes the complete sorted vector from
    ///         the frozen on-chain roster, credit counters, and either the
    ///         opened cycle policy or immutable cycle-less 20/80 protocol
    ///         policy; rejects zero eligible rows, unavailable policy,
    ///         omissions, caller-selected weights, and hash mismatch.
    ///         The canonical domain-separated preimage is exactly
    ///         `recognitionSnapshotHash = keccak256(abi.encode(block.chainid,
    ///         commitmentId, recognitionEntries))`. Every off-chain caller —
    ///         SettlementModule payout-plan creation and Hypercert
    ///         composition — must reproduce that encoding byte-for-byte.
    function validateRecognitionSnapshot(
        uint256 commitmentId,
        RecognitionEntry[] calldata entries,
        bytes32 suppliedHash
    )
        external
        view
        returns (bytes32 canonicalHash);

    // ─────────────── Evidence, assessment, confirmation ──────────────

    /// @notice Gating: active contributor, lead provider, or pool steward; the
    ///         commitment must still be Accepted and its roster/credit ledger
    ///         unfrozen. The non-empty exact CID may be attached only once per
    ///         commitment. The credited list is non-empty, unique, bounded,
    ///         and every address must be active. The first evidence attribution
    ///         for a contributor sets their recognition credit from 0 to 1;
    ///         later distinct evidence remains provenance and adds no weight.
    ///         The credit becomes recognition-eligible only after Fulfilled.
    ///         Offline-queueable; a job that lands after freeze fails visibly
    ///         and never changes credit.
    function attachEvidence(uint256 commitmentId, string calldata cid, address[] calldata creditedContributors) external;

    /// @notice Verifies via eas.getAttestation: schema is legacyAssessmentSchemaUID
    ///         or assessmentV3SchemaUID, recipient == providerGarden.
    ///         Gating: Accepted, contributor roster and credit accounting
    ///         unfrozen, no assessment previously attached, and caller is the
    ///         pool steward or garden evaluator. The UID is write-once.
    function attachAssessment(uint256 commitmentId, bytes32 assessmentUID) external;

    /// @notice Path (b) to ReadyForConfirmation: SupportService,
    ///         StewardCaptured, or SeasonCampaign commitments with no work
    ///         requirement (requirements is empty);
    ///         requires >= 1 pre-freeze evidence record,
    ///         totalVerifiedCredits > 0, and any declared assessment.
    ///         DomainImpact always reverts WorkApprovalRequired. Gating:
    ///         counterparty, creator, accountable lead provider, or steward.
    ///         The lead is included so a Garden-claimed Request — whose
    ///         counterparty is an uncallable GardenAccount — is still
    ///         submittable by the human who did the work; submitting is not
    ///         confirming, and the lead stays excluded from every
    ///         confirmation path.
    function submitForConfirmation(uint256 commitmentId) external;

    /// @notice Path (c): steward override with visible reason.
    function markReadyForConfirmation(uint256 commitmentId, string calldata reason) external;

    /// @notice Gating: a named confirmer, or Offer counterparty / Request creator
    ///         under the direction-aware default. When that default resolves to
    ///         a GardenAccount (a Garden-claimed commitment), the module
    ///         resolves it to that garden's operator/owner Hat wearers and
    ///         accepts those addresses directly; confirmation is never routed
    ///         through ERC-6551 `execute`. No frozen contributor can
    ///         confirm the team's fulfillment.
    function confirmFulfillment(uint256 commitmentId) external;

    /// @notice Gating: current commitment-pool steward/owner Hat wearer, or,
    ///         only when protocolFallbackEnabled, current registered protocol-
    ///         pool steward/owner Hat wearer. Local authority is tested first,
    ///         so a dual-role caller records PoolFallback. Module ownership
    ///         alone is not confirmer authority. The current ordinary
    ///         named/default path must be unreachable after contributor
    ///         exclusion or OrdinaryConfirmationStillReachable reverts.
    ///         Reason is mandatory and SelfConfirmation excludes every
    ///         contributor on both paths.
    function confirmFulfillmentAsFallback(uint256 commitmentId, string calldata reason) external;

    // ─────────────── Exits, disputes, considerations ────────────────────────

    /// @notice Gating: creator from Offered/Requested; pool steward from Accepted.
    function cancelCommitment(uint256 commitmentId, string calldata reasonCID) external;

    /// @notice Permissionless once past due (dueDate, or cycle endTime when 0).
    function expireCommitment(uint256 commitmentId) external;

    /// @notice Gating: creator, counterparty, named confirmer, or pool steward.
    function raiseDispute(uint256 commitmentId, string calldata reasonCID) external;

    /// @notice Gating: pool steward. RestorePrevious uses preDisputeState;
    ///         an Expired prior state can never resolve Fulfilled.
    function resolveDispute(uint256 commitmentId, DisputeResolution resolution, string calldata reasonCID) external;

    /// @notice Records an already-executed payout (no custody). Requires state
    ///         Fulfilled and a non-zero declared source/token/amount; single record
    ///         per commitment in MVP. Source, recipient, token, and amount are
    ///         derived from the commitment and cannot be supplied by the caller.
    ///         Gating: pool steward.
    function recordConsiderationPaid(uint256 commitmentId, bytes32 payoutRef) external;

    // ══════════════════════ Views ════════════════════════════════════

    function getPool(uint256 poolId) external view returns (Pool memory);
    function getPoolByGarden(address garden) external view returns (uint256 poolId, Pool memory pool);
    function getCycle(uint256 cycleId) external view returns (Cycle memory);
    function getCommitmentSeries(uint256 seriesId) external view returns (CommitmentSeries memory);
    function getCommitmentSeriesIdByCreationRequest(
        address holder,
        bytes32 creationRequestKey
    )
        external
        view
        returns (uint256 seriesId);
    function getCommitment(uint256 commitmentId) external view returns (Commitment memory);
    function getRequirement(
        uint256 commitmentId,
        uint16 requirementIndex
    )
        external
        view
        returns (CommitmentRequirement memory);
    function getContributor(uint256 commitmentId, address contributor) external view returns (ContributorRecord memory);
    function isContributor(uint256 commitmentId, address contributor) external view returns (bool);
    function isEligibleContributor(uint256 commitmentId, address contributor) external view returns (bool); // Fulfilled +
        // frozen active roster + Work/evidence credit
    function getPendingClaim(uint256 commitmentId, address claimant) external view returns (PendingClaim memory);
    function getConfirmers(uint256 commitmentId) external view returns (address[] memory);
    function protocolPoolId() external view returns (uint256);
    function rootGarden() external view returns (address);
    function workCommitmentOf(bytes32 workUID) external view returns (uint256 commitmentId);
    function getLinkedWorkUIDs(uint256 commitmentId) external view returns (bytes32[] memory);
    function isApprovalCounted(bytes32 approvalUID) external view returns (bool);
    function isEvidenceAttached(uint256 commitmentId, bytes32 cidHash) external view returns (bool);
    /// @dev The five bounds below and `cyclelessRecognitionPolicy()` must be
    ///      implemented as explicit `pure` functions returning the constants.
    ///      A `public constant` state variable generates a `view` getter, not a
    ///      `pure` one, so the natural auto-getter implementation does not
    ///      satisfy this interface and fails the ABI/interface proof.
    function MAX_CONFIRMERS() external pure returns (uint256);
    function MAX_REQUIREMENTS() external pure returns (uint256);
    function MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT() external pure returns (uint256);
    function MAX_CONTRIBUTORS_PER_COMMITMENT() external pure returns (uint256);
    function MAX_LINKED_WORKS_PER_COMMITMENT() external pure returns (uint256);
    function cyclelessRecognitionPolicy() external pure returns (RecognitionPolicy memory);
    function paused() external view returns (bool);

    // ══════════════════════ Admin (module owner) ═════════════════════

    /// @notice Initializes with paused == true and a non-zero canonical root
    ///         GardenAccount. Configuration is completed through the
    ///         paused-only setters before the first unpause.
    function initialize(address owner_, address rootGarden_) external;
    function setGardenToken(address gardenToken) external;
    function setHatsModule(address hatsModule) external;
    function setActionRegistry(address actionRegistry) external;
    function setCommitmentRegistry(address registry) external;
    function setWorkApprovalResolver(address resolver) external;
    function setEAS(address eas) external;
    function setSchemaUIDs(
        bytes32 workUID,
        bytes32 workApprovalUID,
        bytes32 legacyAssessmentUID,
        bytes32 assessmentV3UID
    )
        external;
    /// @notice Pausing is always available to the owner. Unpause requires all
    ///         six dependencies plus four non-zero, pairwise-distinct schema
    ///         UIDs and otherwise reverts ModuleNotReady.
    function setPaused(bool paused) external;
}
