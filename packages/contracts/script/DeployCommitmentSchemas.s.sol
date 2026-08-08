// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { DeployHelper } from "./DeployHelper.sol";
import { console } from "forge-std/console.sol";
import { ISchemaRegistry } from "@eas/ISchemaRegistry.sol";
import { ISchemaResolver } from "@eas/resolver/ISchemaResolver.sol";
import { SchemaRecord } from "@eas/ISchemaRegistry.sol";

import { CommitmentSchemaLane } from "./lib/CommitmentSchemaLane.sol";
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
        CommitmentSchemaLane.PreparationInputs memory inputs = CommitmentSchemaLane.PreparationInputs({
            schemaRegistry: _schemaRegistry(json),
            assessmentResolver: _requireAddress(json, ".assessmentResolver", "assessmentResolver"),
            workApprovalResolver: _requireAddress(json, ".workApprovalResolver", "workApprovalResolver"),
            eas: _requireAddress(json, ".eas.address", "eas.address"),
            create2Factory: _create2Factory(),
            assessmentV3Schema: ASSESSMENT_V3_SCHEMA,
            communityTestimonySchema: COMMUNITY_TESTIMONY_SCHEMA
        });

        // Predicted before anything is sent so an operator can compare against the runbook.
        address owner = CommitmentSchemaLane.resolverOwner(inputs.assessmentResolver, inputs.workApprovalResolver);
        (address predictedImpl, address predictedProxy) =
            TestimonyResolverDeployment.predictAddresses(inputs.eas, owner, inputs.create2Factory);
        console.log("TestimonyResolver predicted implementation:", predictedImpl);
        console.log("TestimonyResolver predicted proxy:", predictedProxy);
        console.log("TestimonyResolver owner (from sibling resolvers):", owner);

        vm.startBroadcast();
        CommitmentSchemaLane.PreparationResult memory result = CommitmentSchemaLane.prepare(inputs);
        vm.stopBroadcast();

        console.log("Community Testimony recovery state on entry:", uint256(result.stateOnEntry));
        if (!result.deployedSomething) {
            console.log("Resolver already at both predicted addresses (recovery rerun); nothing deployed");
        }
        console.log("Pinned Community Testimony UID (resolver still inert):");
        console.logBytes32(result.communityTestimonyUID);

        _savePreparation(result);
    }

    /// @notice FINALIZATION. Registers the exact Community Testimony record, then activates the
    ///         resolver against the module — the last action in the lane.
    /// @dev The module is read from the deployment artifact only; there is deliberately no
    ///      caller-supplied override, because a wrong module here is what an attacker would want.
    function finalizeCommunityTestimony() public {
        string memory json = _readDeployment();
        CommitmentSchemaLane.FinalizationInputs memory inputs = CommitmentSchemaLane.FinalizationInputs({
            schemaRegistry: _schemaRegistry(json),
            testimonyResolver: _requireAddress(json, ".testimonyResolver", "testimonyResolver"),
            module: _requireAddress(json, ".commitmentPoolingModule", "commitmentPoolingModule"),
            communityTestimonySchema: COMMUNITY_TESTIMONY_SCHEMA
        });

        vm.startBroadcast();
        CommitmentSchemaLane.FinalizationResult memory result = CommitmentSchemaLane.finalize(inputs);
        vm.stopBroadcast();

        console.log("Community Testimony recovery state on entry:", uint256(result.stateOnEntry));
        if (result.activated) {
            console.log("Community Testimony resolver ACTIVATED against module:", inputs.module);
        } else {
            console.log("Already finalized; no transaction sent");
        }

        _saveFinalization(result.communityTestimonyUID);
    }

    /// @dev The canonical deterministic-deployment factory from the shared network config. The
    ///      SALT is deliberately not taken from there (see TestimonyResolverDeployment), but the
    ///      factory address is chain infrastructure, not a lane identity.
    function _create2Factory() private view returns (address factory) {
        (, factory,) = getDeploymentDefaults();
    }

    function _schemaRegistry(string memory json) private pure returns (address) {
        address schemaRegistry = abi.decode(vm.parseJson(json, ".eas.schemaRegistry"), (address));
        if (schemaRegistry == address(0)) revert MissingSchemaRegistry();
        return schemaRegistry;
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
    function _savePreparation(CommitmentSchemaLane.PreparationResult memory result) private {
        string memory output = "commitmentSchemasPreparation";
        vm.serializeAddress(output, "testimonyResolver", result.testimonyResolver);
        vm.serializeAddress(output, "testimonyResolverImpl", result.testimonyResolverImpl);
        vm.serializeBytes32(output, "assessmentV3SchemaUID", result.assessmentV3UID);
        string memory serialized =
            vm.serializeBytes32(output, "predictedCommunityTestimonySchemaUID", result.communityTestimonyUID);

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
