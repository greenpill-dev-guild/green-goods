// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { ISchemaRegistry } from "@eas/ISchemaRegistry.sol";
import { ISchemaResolver } from "@eas/resolver/ISchemaResolver.sol";
import { SchemaRecord } from "@eas/ISchemaRegistry.sol";

/// @title DeployCommitmentSchemas
/// @notice Registers the two additive Commitment Pooling EAS schemas, resumably.
/// @dev Both registrations are idempotent by construction. Each UID is derived exactly as
///      SchemaRegistry does — keccak256(abi.encodePacked(schema, resolver, revocable)) — so a run
///      interrupted after a successful `register` but before its artifact was written reads the
///      same UID back and reconciles instead of re-registering. A UID that already holds a
///      different record fails closed: EAS schemas are immutable, so that is an operator conflict.
contract DeployCommitmentSchemas is Script {
    error MissingSchemaRegistry();
    error MissingResolver(string name);
    error SchemaRecordConflict(bytes32 uid);

    string internal constant ASSESSMENT_V3_SCHEMA = "string title,string description,string assessmentConfigCID,"
        "uint8 domain,uint256 startDate,uint256 endDate,string location,uint8 assessmentKind,uint256 cycleId,"
        "bytes32 baselineUID";
    string internal constant COMMUNITY_TESTIMONY_SCHEMA = "uint256 commitmentId,string title,string testimonyCID";

    /// @dev Every Green Goods schema is non-revocable; the GreenWill badge schema is the sole
    ///      deliberate exception and is registered elsewhere.
    bool internal constant REVOCABLE = false;

    function run() public {
        string memory json = _readDeployment();
        address schemaRegistry = abi.decode(vm.parseJson(json, ".eas.schemaRegistry"), (address));
        if (schemaRegistry == address(0)) revert MissingSchemaRegistry();
        ISchemaRegistry registry = ISchemaRegistry(schemaRegistry);
        address assessmentResolver = _requireAddress(json, ".assessmentResolver", "assessmentResolver");
        address testimonyResolver = _requireAddress(json, ".testimonyResolver", "testimonyResolver");

        vm.startBroadcast();
        bytes32 assessmentV3UID = _registerOrReconcile(registry, ASSESSMENT_V3_SCHEMA, assessmentResolver);
        bytes32 testimonyUID = _registerOrReconcile(registry, COMMUNITY_TESTIMONY_SCHEMA, testimonyResolver);
        vm.stopBroadcast();

        _saveSchemas(assessmentV3UID, testimonyUID);
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

    /// @dev Side file only; the CLI promotes both UIDs into the canonical artifact.
    function _saveSchemas(bytes32 assessmentV3UID, bytes32 testimonyUID) private {
        string memory output = "commitmentSchemas";
        vm.serializeBytes32(output, "assessmentV3SchemaUID", assessmentV3UID);
        string memory serialized = vm.serializeBytes32(output, "communityTestimonySchemaUID", testimonyUID);

        string memory outputPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-commitment-schemas.json");
        vm.writeJson(serialized, outputPath);
        console.log("Commitment schema UIDs written to:", outputPath);
    }
}
