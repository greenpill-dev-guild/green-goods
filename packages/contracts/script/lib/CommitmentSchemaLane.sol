// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISchemaRegistry, SchemaRecord } from "@eas/ISchemaRegistry.sol";
import { ISchemaResolver } from "@eas/resolver/ISchemaResolver.sol";

import { CommitmentSchemaRecovery } from "./CommitmentSchemaRecovery.sol";
import { TestimonyResolverDeployment } from "./TestimonyResolverDeployment.sol";

interface ITestimonyResolverLifecycle {
    function schemaUID() external view returns (bytes32);
    function commitmentModule() external view returns (address);
    function owner() external view returns (address);
    function setSchemaUID(bytes32 uid) external;
    function setCommitmentModule(address module) external;
}

interface IModuleBoundary {
    function owner() external view returns (address);
}

/// @dev The post-upgrade state preparation compares against the artifact's evidence. Separate from
///      the capability probe, which must observe a MISSING function and so cannot be typed.
interface IAssessmentResolverState {
    function schemaUID() external view returns (bytes32);
    function karmaGAPModule() external view returns (address);
}

/// @title CommitmentSchemaLane
/// @notice The two ordered modes of `contract-spec.md` §6.4.4, as callable logic.
/// @dev Extracted from `DeployCommitmentSchemas.s.sol` so the Arbitrum fork rehearsal drives the
///      real sequence instead of a hand-rolled copy. That mattered: the first review's headline
///      objection was that the rehearsal never ran the deploy script, and re-introducing the same
///      shape one level up — a rehearsal that pins and activates inline while the script does it
///      differently — would have left the ordering, owner derivation, and module-boundary checks
///      unproven against a live chain.
///
///      The script keeps only what a library cannot own: reading the deployment artifact, writing
///      the result side files, and `vm.startBroadcast`. Everything that decides *what happens and
///      in what order* lives here, which is the same split `PoolingConfiguration` uses.
library CommitmentSchemaLane {
    /// @dev Every Green Goods schema is non-revocable; the GreenWill badge schema is the sole
    ///      deliberate exception and is registered elsewhere.
    bool internal constant REVOCABLE = false;

    error ModuleNotDeployed(address module);
    error ModuleOwnerMismatch(address resolverOwner, address moduleOwner);
    error PinnedUIDMismatch(bytes32 pinned, bytes32 expected);
    error ResolverOwnerMismatch(address assessmentOwner, address workApprovalOwner);
    error ResolverOwnerRequired();
    error SchemaRecordConflict(bytes32 uid);
    error AssessmentResolverNotDeployed(address resolver);
    error AssessmentResolverNotV3Capable(address resolver);
    error AssessmentOwnerMismatch(address laneOwner, address assessmentOwner);
    error AssessmentEvidenceMismatch(string field, bytes32 expected, bytes32 actual);
    error PreparationDidNotPin(bytes32 expected, bytes32 actual);
    error PreparationLeftResolverActive(address module);
    error FinalizationDidNotActivate(address expected, address actual);

    /// @notice The post-upgrade evidence §6.4.4 requires preparation to check the live proxy against.
    /// @dev `recorded` is an explicit flag rather than a zero sentinel because `address(0)` is a
    ///      legitimate KarmaGAP state — `setKarmaGAPModule(0)` deliberately disables the module — so
    ///      zero cannot distinguish "the artifact does not record this" from "recorded as disabled".
    struct AssessmentEvidence {
        bool recorded;
        bytes32 assessmentSchemaUID;
        address karmaGAPModule;
    }

    struct PreparationInputs {
        address schemaRegistry;
        address assessmentResolver;
        address workApprovalResolver;
        address eas;
        address create2Factory;
        string assessmentV3Schema;
        string communityTestimonySchema;
        AssessmentEvidence assessmentEvidence;
    }

    struct PreparationResult {
        address testimonyResolver;
        address testimonyResolverImpl;
        bool deployedSomething;
        address owner;
        bytes32 assessmentV3UID;
        bytes32 communityTestimonyUID;
        CommitmentSchemaRecovery.State stateOnEntry;
    }

    struct FinalizationInputs {
        address schemaRegistry;
        address testimonyResolver;
        address module;
        string communityTestimonySchema;
    }

    struct FinalizationResult {
        bytes32 communityTestimonyUID;
        CommitmentSchemaRecovery.State stateOnEntry;
        bool registeredRecord;
        bool activated;
    }

    /// @notice PREPARATION: deploy the resolver, register AssessmentV3, pin the Community Testimony
    ///         UID, and leave the resolver inert.
    /// @dev Deliberately does NOT call `SchemaRegistry.register` for Community Testimony.
    ///      Registration is permissionless, so the record is not ours to control; the resolver's
    ///      `schemaUID` is, and pinning it while `commitmentModule` stays zero makes the resolver
    ///      provably inactive no matter who registers.
    function prepare(PreparationInputs memory inputs) internal returns (PreparationResult memory result) {
        ISchemaRegistry registry = ISchemaRegistry(inputs.schemaRegistry);
        result.owner = resolverOwner(inputs.assessmentResolver, inputs.workApprovalResolver);

        // §6.4.4 puts this gate at preparation, before anything is deployed or registered. Running
        // this lane before the assessment-resolver upgrade is the ordering mistake it catches, and
        // without it the violation only surfaces two broadcasts later, when `pooling-configure`
        // calls `setAssessmentV3SchemaUID` on an implementation that does not have it.
        assertAssessmentProxyReady(inputs.assessmentResolver, result.owner, inputs.assessmentEvidence);

        TestimonyResolverDeployment.Deployment memory resolver =
            TestimonyResolverDeployment.deployOrReuse(inputs.eas, result.owner, inputs.create2Factory);
        result.testimonyResolver = resolver.testimonyResolver;
        result.testimonyResolverImpl = resolver.testimonyResolverImpl;
        result.deployedSomething = resolver.deployedSomething;

        result.communityTestimonyUID =
            keccak256(abi.encodePacked(inputs.communityTestimonySchema, result.testimonyResolver, REVOCABLE));

        // Classified only now: a state cannot be read from an address with no code, and a fresh
        // deployment is trivially Unprepared.
        result.stateOnEntry = CommitmentSchemaRecovery.assertPreparable(
            observe(
                registry,
                result.testimonyResolver,
                inputs.communityTestimonySchema,
                result.communityTestimonyUID,
                address(0)
            )
        );

        result.assessmentV3UID = registerOrReconcile(registry, inputs.assessmentV3Schema, inputs.assessmentResolver);

        // Read-before-set: zero pins the expected UID, the exact value skips the transaction, and
        // any other non-zero value already failed closed in assertPreparable above.
        if (ITestimonyResolverLifecycle(result.testimonyResolver).schemaUID() == bytes32(0)) {
            ITestimonyResolverLifecycle(result.testimonyResolver).setSchemaUID(result.communityTestimonyUID);
        }

        // Preparation's whole product is the pin, so it proves the pin stuck — the mirror of
        // finalization proving its activation stuck. A setter that silently no-ops (a proxy moved
        // to an implementation whose `setSchemaUID` does nothing) would otherwise report a
        // successful preparation and leave finalization to fail two broadcasts later.
        bytes32 pinned = ITestimonyResolverLifecycle(result.testimonyResolver).schemaUID();
        if (pinned != result.communityTestimonyUID) revert PreparationDidNotPin(result.communityTestimonyUID, pinned);

        // Classifier-dominated: `assertPreparable` already refused every module-nonzero state, and
        // nothing between there and here can activate a resolver. Kept as the cheapest statement of
        // preparation's contract, which is why it has no negative test — the state it guards is
        // unreachable rather than untested.
        address module = ITestimonyResolverLifecycle(result.testimonyResolver).commitmentModule();
        if (module != address(0)) revert PreparationLeftResolverActive(module);
    }

    /// @notice FINALIZATION: register the exact record, then activate the resolver against the
    ///         module — the last action in the lane.
    /// @dev Accepts exactly the three ordered recovery states and re-runs as a no-op once finalized.
    function finalize(FinalizationInputs memory inputs) internal returns (FinalizationResult memory result) {
        ISchemaRegistry registry = ISchemaRegistry(inputs.schemaRegistry);
        assertModuleBoundary(inputs.testimonyResolver, inputs.module);

        result.communityTestimonyUID =
            keccak256(abi.encodePacked(inputs.communityTestimonySchema, inputs.testimonyResolver, REVOCABLE));
        result.stateOnEntry = CommitmentSchemaRecovery.assertFinalizable(
            observe(
                registry,
                inputs.testimonyResolver,
                inputs.communityTestimonySchema,
                result.communityTestimonyUID,
                inputs.module
            )
        );

        // Belt and braces: assertFinalizable already rejects any other pin, but this is the value
        // both the record and the activation commit to.
        bytes32 pinned = ITestimonyResolverLifecycle(inputs.testimonyResolver).schemaUID();
        if (pinned != result.communityTestimonyUID) revert PinnedUIDMismatch(pinned, result.communityTestimonyUID);

        if (CommitmentSchemaRecovery.needsRecord(result.stateOnEntry)) {
            registerOrReconcile(registry, inputs.communityTestimonySchema, inputs.testimonyResolver);
            result.registeredRecord = true;
        }
        if (CommitmentSchemaRecovery.needsActivation(result.stateOnEntry)) {
            ITestimonyResolverLifecycle(inputs.testimonyResolver).setCommitmentModule(inputs.module);
            result.activated = true;
        }

        address actual = ITestimonyResolverLifecycle(inputs.testimonyResolver).commitmentModule();
        if (actual != inputs.module) revert FinalizationDidNotActivate(inputs.module, actual);
    }

    /// @dev Owner comes from the resolvers already on chain, not the artifact's `guardian`. On
    ///      Arbitrum One those diverge — both live resolvers are owned by the deployer while
    ///      `guardian` is a different address — and initializing under `guardian` would split the
    ///      lane across two signers. Deriving from a sibling makes "one owner across every
    ///      resolver" true by construction; the mismatch check makes divergence loud.
    function resolverOwner(address assessmentResolver, address workApprovalResolver) internal view returns (address) {
        address owner = IModuleBoundary(assessmentResolver).owner();
        address workApprovalOwner = IModuleBoundary(workApprovalResolver).owner();

        if (owner != workApprovalOwner) revert ResolverOwnerMismatch(owner, workApprovalOwner);
        if (owner == address(0)) revert ResolverOwnerRequired();
        return owner;
    }

    /// @notice Prove the live Assessment proxy is already the upgraded one this lane assumes.
    /// @dev Three separate claims, in the order that fails most usefully:
    ///
    ///      1. **Deployed.** A zero-code address means the artifact points at nothing.
    ///      2. **v3-capable.** `assessmentV3SchemaUID()` exists only on the upgraded implementation,
    ///         so a successful staticcall IS the capability proof — this is the check that refuses
    ///         to run the lane before `upgrade.ts assessment-resolver`. Probed by low-level call
    ///         rather than a typed one because a v2 implementation has no such function, and the
    ///         point is to observe that absence rather than revert on it.
    ///      3. **Matches the post-upgrade evidence.** The owner must be the same account the whole
    ///         lane runs as, and the v2 UID and KarmaGAP module must still read what the artifact
    ///         recorded after the upgrade — the observable half of "the upgrade preserved state".
    function assertAssessmentProxyReady(
        address assessmentResolver,
        address laneOwner,
        AssessmentEvidence memory evidence
    )
        internal
        view
    {
        if (assessmentResolver.code.length == 0) revert AssessmentResolverNotDeployed(assessmentResolver);

        (bool ok, bytes memory data) = assessmentResolver.staticcall(abi.encodeWithSignature("assessmentV3SchemaUID()"));
        if (!ok || data.length != 32) revert AssessmentResolverNotV3Capable(assessmentResolver);

        address assessmentOwner = IModuleBoundary(assessmentResolver).owner();
        if (assessmentOwner != laneOwner) revert AssessmentOwnerMismatch(laneOwner, assessmentOwner);

        if (!evidence.recorded) return;

        bytes32 liveAssessmentUID = IAssessmentResolverState(assessmentResolver).schemaUID();
        if (liveAssessmentUID != evidence.assessmentSchemaUID) {
            revert AssessmentEvidenceMismatch("assessmentSchemaUID", evidence.assessmentSchemaUID, liveAssessmentUID);
        }

        address liveKarmaGAP = IAssessmentResolverState(assessmentResolver).karmaGAPModule();
        if (liveKarmaGAP != evidence.karmaGAPModule) {
            revert AssessmentEvidenceMismatch(
                "karmaGAPModule",
                bytes32(uint256(uint160(evidence.karmaGAPModule))),
                bytes32(uint256(uint160(liveKarmaGAP)))
            );
        }
    }

    /// @dev The module must exist, be a real contract, and share the resolver's owner. A module
    ///      whose owner differs is one this operator cannot govern, which is not a bridge worth
    ///      activating.
    function assertModuleBoundary(address testimonyResolver, address module) internal view {
        if (module.code.length == 0) revert ModuleNotDeployed(module);

        address resolverOwner_ = ITestimonyResolverLifecycle(testimonyResolver).owner();
        address moduleOwner = IModuleBoundary(module).owner();
        if (resolverOwner_ != moduleOwner) revert ModuleOwnerMismatch(resolverOwner_, moduleOwner);
    }

    /// @dev The observation the recovery classifier consumes, built from live reads.
    function observe(
        ISchemaRegistry registry,
        address testimonyResolver,
        string memory communityTestimonySchema,
        bytes32 expectedUID,
        address expectedModule
    )
        internal
        view
        returns (CommitmentSchemaRecovery.Observation memory observation)
    {
        SchemaRecord memory record = registry.getSchema(expectedUID);

        observation.pinnedUID = ITestimonyResolverLifecycle(testimonyResolver).schemaUID();
        observation.expectedUID = expectedUID;
        observation.recordExists = record.uid != bytes32(0);
        // The UID commits to (schema, resolver, revocable), so a record found under it matches by
        // construction. Compared anyway: this is the value the activation trusts.
        observation.recordMatches = record.uid == expectedUID && address(record.resolver) == testimonyResolver
            && record.revocable == REVOCABLE
            && keccak256(bytes(record.schema)) == keccak256(bytes(communityTestimonySchema));
        observation.module = ITestimonyResolverLifecycle(testimonyResolver).commitmentModule();
        observation.expectedModule = expectedModule;
    }

    /// @dev Registration is idempotent by construction: the UID is derived exactly as
    ///      SchemaRegistry does, so a run interrupted after a successful `register` reads the same
    ///      UID back and reconciles instead of reverting `AlreadyExists`.
    function registerOrReconcile(
        ISchemaRegistry registry,
        string memory schema,
        address resolver
    )
        internal
        returns (bytes32 uid)
    {
        uid = keccak256(abi.encodePacked(schema, resolver, REVOCABLE));
        SchemaRecord memory existing = registry.getSchema(uid);

        // Same UID means the same (schema, resolver, revocable) triple by construction, so a
        // populated record here is always this exact schema already registered.
        if (existing.uid == uid) return uid;
        if (existing.uid != bytes32(0)) revert SchemaRecordConflict(uid);

        bytes32 registered = registry.register(schema, ISchemaResolver(resolver), REVOCABLE);
        if (registered != uid) revert SchemaRecordConflict(registered);
    }
}
