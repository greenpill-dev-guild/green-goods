// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { DeployHelper } from "./DeployHelper.sol";
import { console } from "forge-std/console.sol";
import { ISchemaRegistry } from "@eas/ISchemaRegistry.sol";
import { ISchemaResolver } from "@eas/resolver/ISchemaResolver.sol";
import { SchemaRecord } from "@eas/ISchemaRegistry.sol";

import { CommitmentSchemaRecovery } from "./lib/CommitmentSchemaRecovery.sol";
import { TestimonyResolverDeployment } from "./lib/TestimonyResolverDeployment.sol";

interface ITestimonyResolverLifecycle {
    function schemaUID() external view returns (bytes32);
    function commitmentModule() external view returns (address);
    function owner() external view returns (address);
    function setSchemaUID(bytes32 uid) external;
    function setCommitmentModule(address module) external;
}

interface IModuleBoundary {
    function owner() external view returns (address);
    function paused() external view returns (bool);
}

/// @title DeployCommitmentSchemas
/// @notice Registers the two additive Commitment Pooling EAS schemas, resumably.
/// @dev Both registrations are idempotent by construction. Each UID is derived exactly as
///      SchemaRegistry does — keccak256(abi.encodePacked(schema, resolver, revocable)) — so a run
///      interrupted after a successful `register` but before its artifact was written reads the
///      same UID back and reconciles instead of re-registering. A UID that already holds a
///      different record fails closed: EAS schemas are immutable, so that is an operator conflict.
contract DeployCommitmentSchemas is DeployHelper {
    error MissingSchemaRegistry();
    error ModuleNotDeployed(address module);
    error ModuleOwnerMismatch(address resolverOwner, address moduleOwner);
    error PinnedUIDMismatch(bytes32 pinned, bytes32 expected);
    error ResolverOwnerMismatch(address assessmentOwner, address workApprovalOwner);
    error MissingResolver(string name);
    error SchemaRecordConflict(bytes32 uid);

    string internal constant ASSESSMENT_V3_SCHEMA = "string title,string description,string assessmentConfigCID,"
        "uint8 domain,uint256 startDate,uint256 endDate,string location,uint8 assessmentKind,uint256 cycleId,"
        "bytes32 baselineUID";
    string internal constant COMMUNITY_TESTIMONY_SCHEMA = "uint256 commitmentId,string title,string testimonyCID";

    /// @dev Every Green Goods schema is non-revocable; the GreenWill badge schema is the sole
    ///      deliberate exception and is registered elsewhere.
    bool internal constant REVOCABLE = false;

    /// @notice PREPARATION (default mode). Registers AssessmentV3 and pins the Community
    ///         Testimony UID, leaving the testimony resolver deliberately inert.
    /// @dev Per `contract-spec.md` §6.4.4 this mode never calls `SchemaRegistry.register` for
    ///      Community Testimony. Registration is permissionless, so the record is not ours to
    ///      control — what is ours is the resolver's `schemaUID`, and pinning it while
    ///      `commitmentModule` is still zero makes the resolver provably inactive no matter who
    ///      registers. Activation is finalization's job, after the record has been proven exact.
    function run() public {
        string memory json = _readDeployment();
        ISchemaRegistry registry = _schemaRegistry(json);
        address assessmentResolver = _requireAddress(json, ".assessmentResolver", "assessmentResolver");
        address eas = _requireAddress(json, ".eas.address", "eas.address");
        address owner = _resolverOwner(json, assessmentResolver);
        (, address factory,) = getDeploymentDefaults();

        // §6.4.4: preparation deploys/reconciles the resolver itself. Predicted before anything is
        // sent so an operator can compare against the runbook.
        (address predictedImpl, address predictedProxy) = TestimonyResolverDeployment.predictAddresses(eas, owner, factory);
        console.log("TestimonyResolver predicted implementation:", predictedImpl);
        console.log("TestimonyResolver predicted proxy:", predictedProxy);
        console.log("TestimonyResolver owner (from sibling resolvers):", owner);

        address testimonyResolver = predictedProxy;
        bytes32 expectedTestimonyUID = keccak256(abi.encodePacked(COMMUNITY_TESTIMONY_SCHEMA, testimonyResolver, REVOCABLE));

        vm.startBroadcast();
        TestimonyResolverDeployment.Deployment memory resolver =
            TestimonyResolverDeployment.deployOrReuse(eas, owner, factory);
        if (!resolver.deployedSomething) {
            console.log("Resolver already at both predicted addresses (recovery rerun); nothing deployed");
        }

        // Classified only now: the resolver has to exist before its state can be read, and a
        // fresh deployment is trivially Unprepared.
        CommitmentSchemaRecovery.State state = CommitmentSchemaRecovery.assertPreparable(
            _observe(registry, testimonyResolver, expectedTestimonyUID, address(0))
        );
        console.log("Community Testimony recovery state on entry:", uint256(state));

        bytes32 assessmentV3UID = _registerOrReconcile(registry, ASSESSMENT_V3_SCHEMA, assessmentResolver);

        // Read-before-set: zero pins the expected UID, the exact value skips the transaction, and
        // any other non-zero value already failed closed in assertPreparable above.
        if (ITestimonyResolverLifecycle(testimonyResolver).schemaUID() == bytes32(0)) {
            ITestimonyResolverLifecycle(testimonyResolver).setSchemaUID(expectedTestimonyUID);
            console.log("Pinned Community Testimony UID (resolver still inert):");
            console.logBytes32(expectedTestimonyUID);
        }
        vm.stopBroadcast();

        require(
            ITestimonyResolverLifecycle(testimonyResolver).commitmentModule() == address(0),
            "preparation must leave the testimony resolver inactive"
        );
        _savePreparation(resolver, assessmentV3UID, expectedTestimonyUID);
    }

    /// @notice FINALIZATION. Registers the exact Community Testimony record, then activates the
    ///         resolver against the module — the last action in the lane.
    /// @dev The module is read from the deployment artifact only; there is deliberately no
    ///      caller-supplied override, because a wrong module here is what an attacker would want.
    ///      Accepts exactly the three ordered recovery states and re-runs as a no-op once finalized.
    function finalizeCommunityTestimony() public {
        string memory json = _readDeployment();
        ISchemaRegistry registry = _schemaRegistry(json);
        address testimonyResolver = _requireAddress(json, ".testimonyResolver", "testimonyResolver");
        address module = _requireAddress(json, ".commitmentPoolingModule", "commitmentPoolingModule");
        _assertModuleBoundary(testimonyResolver, module);

        bytes32 expectedUID = keccak256(abi.encodePacked(COMMUNITY_TESTIMONY_SCHEMA, testimonyResolver, REVOCABLE));
        CommitmentSchemaRecovery.State state =
            CommitmentSchemaRecovery.assertFinalizable(_observe(registry, testimonyResolver, expectedUID, module));
        console.log("Community Testimony recovery state on entry:", uint256(state));

        // Belt and braces: assertFinalizable already rejects any other pin, but this is the value
        // the record and the activation both commit to.
        bytes32 pinned = ITestimonyResolverLifecycle(testimonyResolver).schemaUID();
        if (pinned != expectedUID) revert PinnedUIDMismatch(pinned, expectedUID);

        vm.startBroadcast();
        if (CommitmentSchemaRecovery.needsRecord(state)) {
            _registerOrReconcile(registry, COMMUNITY_TESTIMONY_SCHEMA, testimonyResolver);
        }
        if (CommitmentSchemaRecovery.needsActivation(state)) {
            ITestimonyResolverLifecycle(testimonyResolver).setCommitmentModule(module);
            console.log("Community Testimony resolver ACTIVATED against module:", module);
        } else {
            console.log("Already finalized; no transaction sent");
        }
        vm.stopBroadcast();

        require(
            ITestimonyResolverLifecycle(testimonyResolver).commitmentModule() == module,
            "finalization did not reach the activated state"
        );
        _saveFinalization(expectedUID);
    }

    /// @dev Owner comes from the resolvers already on chain, not the artifact's `guardian`. On
    ///      Arbitrum One those diverge — both live resolvers are owned by the deployer while
    ///      `guardian` is a different address — and initializing under `guardian` would split the
    ///      lane across two signers. Deriving from a sibling makes "one owner across every
    ///      resolver" true by construction; the mismatch check makes divergence loud.
    function _resolverOwner(string memory json, address assessmentResolver) private view returns (address owner) {
        address workApprovalResolver = _requireAddress(json, ".workApprovalResolver", "workApprovalResolver");

        owner = ITestimonyResolverLifecycle(assessmentResolver).owner();
        address workApprovalOwner = ITestimonyResolverLifecycle(workApprovalResolver).owner();
        if (owner != workApprovalOwner) revert ResolverOwnerMismatch(owner, workApprovalOwner);
        if (owner == address(0)) revert MissingResolver("assessmentResolver.owner()");
    }

    /// @dev The module must exist, be a real contract, and share the resolver's owner. A module
    ///      whose owner differs is one this operator cannot govern, which is not a bridge worth
    ///      activating.
    function _assertModuleBoundary(address testimonyResolver, address module) private view {
        if (module.code.length == 0) revert ModuleNotDeployed(module);

        address resolverOwner = ITestimonyResolverLifecycle(testimonyResolver).owner();
        address moduleOwner = IModuleBoundary(module).owner();
        if (resolverOwner != moduleOwner) revert ModuleOwnerMismatch(resolverOwner, moduleOwner);
    }

    function _observe(
        ISchemaRegistry registry,
        address testimonyResolver,
        bytes32 expectedUID,
        address expectedModule
    )
        private
        view
        returns (CommitmentSchemaRecovery.Observation memory observation)
    {
        SchemaRecord memory record = registry.getSchema(expectedUID);

        observation.pinnedUID = ITestimonyResolverLifecycle(testimonyResolver).schemaUID();
        observation.expectedUID = expectedUID;
        observation.recordExists = record.uid != bytes32(0);
        // The UID commits to (schema, resolver, revocable), so a record found under it always
        // matches by construction. Compared anyway: this is the value the activation trusts.
        observation.recordMatches = record.uid == expectedUID && address(record.resolver) == testimonyResolver
            && record.revocable == REVOCABLE && keccak256(bytes(record.schema)) == keccak256(bytes(COMMUNITY_TESTIMONY_SCHEMA));
        observation.module = ITestimonyResolverLifecycle(testimonyResolver).commitmentModule();
        observation.expectedModule = expectedModule;
    }

    function _schemaRegistry(string memory json) private pure returns (ISchemaRegistry) {
        address schemaRegistry = abi.decode(vm.parseJson(json, ".eas.schemaRegistry"), (address));
        if (schemaRegistry == address(0)) revert MissingSchemaRegistry();
        return ISchemaRegistry(schemaRegistry);
    }

    function _registerOrReconcile(
        ISchemaRegistry registry,
        string memory schema,
        address resolver
    )
        private
        returns (bytes32 uid)
    {
        uid = keccak256(abi.encodePacked(schema, resolver, REVOCABLE));
        SchemaRecord memory existing = registry.getSchema(uid);

        if (existing.uid == uid) {
            // Same UID means the same (schema, resolver, revocable) triple by construction, so a
            // populated record here is always this exact schema already registered.
            console.log("Reconciled existing schema:");
            console.logBytes32(uid);
            return uid;
        }
        if (existing.uid != bytes32(0)) revert SchemaRecordConflict(uid);

        bytes32 registered = registry.register(schema, ISchemaResolver(resolver), REVOCABLE);
        if (registered != uid) revert SchemaRecordConflict(registered);
        console.log("Registered schema:");
        console.logBytes32(uid);
    }

    function _readDeployment() private view returns (string memory) {
        string memory deploymentPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-latest.json");
        return vm.readFile(deploymentPath);
    }

    function _requireAddress(
        string memory json,
        string memory jsonPath,
        string memory name
    )
        private
        pure
        returns (address value)
    {
        value = abi.decode(vm.parseJson(json, jsonPath), (address));
        if (value == address(0)) revert MissingResolver(name);
    }

    /// @dev Preparation exposes the AssessmentV3 UID (its record IS registered here) and the
    ///      Community Testimony UID only as recovery metadata under a distinct key. Per §6.4.4 the
    ///      canonical artifact must not carry the Community Testimony schema keys until the record
    ///      is reconciled and the resolver activated, so the CLI promotes them from the
    ///      finalization side file, never this one.
    function _savePreparation(
        TestimonyResolverDeployment.Deployment memory resolver,
        bytes32 assessmentV3UID,
        bytes32 predictedTestimonyUID
    )
        private
    {
        string memory output = "commitmentSchemasPreparation";
        vm.serializeAddress(output, "testimonyResolver", resolver.testimonyResolver);
        vm.serializeAddress(output, "testimonyResolverImpl", resolver.testimonyResolverImpl);
        vm.serializeBytes32(output, "assessmentV3SchemaUID", assessmentV3UID);
        string memory serialized =
            vm.serializeBytes32(output, "predictedCommunityTestimonySchemaUID", predictedTestimonyUID);

        string memory outputPath = string.concat(
            vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-commitment-schemas-prepared.json"
        );
        vm.writeJson(serialized, outputPath);
        console.log("Preparation result written to:", outputPath);
    }

    /// @dev Only this file carries the canonical Community Testimony key, and it is only written
    ///      once the resolver is live against the verified module.
    function _saveFinalization(bytes32 testimonyUID) private {
        string memory output = "commitmentSchemasFinal";
        string memory serialized = vm.serializeBytes32(output, "communityTestimonySchemaUID", testimonyUID);

        string memory outputPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-commitment-schemas-final.json");
        vm.writeJson(serialized, outputPath);
        console.log("Finalization result written to:", outputPath);
    }
}
