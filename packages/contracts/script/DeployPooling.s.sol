// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { CommitmentPoolingModule } from "../src/modules/CommitmentPooling.sol";
import { CommitmentRegistry } from "../src/registries/Commitment.sol";

/// @title DeployCommitmentPooling
/// @notice Deploys the Commitment Pooling control plane and its register as one unit.
/// @dev The module initializes paused, so this script can wire every dependency and both schema
///      UIDs before anything is callable. Unpausing is a separate, deliberate operator act — it
///      is the moment the module becomes live, and it never happens implicitly here.
contract DeployCommitmentPooling is Script {
    error MissingDependency(string name);

    struct PoolingDeployment {
        address commitmentPoolingModule;
        address commitmentRegistry;
    }

    function run() public returns (PoolingDeployment memory deployment) {
        string memory json = _readDeployment();
        address owner = _requireAddress(json, ".guardian", "guardian");
        address rootGarden = _requireAddress(json, ".rootGardenAddress", "rootGardenAddress");

        vm.startBroadcast();

        CommitmentPoolingModule moduleImplementation = new CommitmentPoolingModule();
        deployment.commitmentPoolingModule = address(
            new ERC1967Proxy(
                address(moduleImplementation),
                abi.encodeWithSelector(CommitmentPoolingModule.initialize.selector, owner, rootGarden)
            )
        );
        console.log("CommitmentPoolingModule implementation:", address(moduleImplementation));
        console.log("CommitmentPoolingModule proxy:", deployment.commitmentPoolingModule);

        CommitmentRegistry registryImplementation = new CommitmentRegistry();
        deployment.commitmentRegistry = address(
            new ERC1967Proxy(
                address(registryImplementation),
                abi.encodeWithSelector(CommitmentRegistry.initialize.selector, owner, deployment.commitmentPoolingModule)
            )
        );
        console.log("CommitmentRegistry implementation:", address(registryImplementation));
        console.log("CommitmentRegistry proxy:", deployment.commitmentRegistry);

        _wireModule(deployment, json);

        vm.stopBroadcast();

        _saveDeployment(deployment);
    }

    /// @dev Every dependency setter is `onlyWhilePaused`, which is exactly the state a freshly
    ///      initialized module is in. Schema UIDs are read from the deployment artifact so the
    ///      module can never point at a schema this chain has not actually registered.
    function _wireModule(PoolingDeployment memory deployment, string memory json) private {
        CommitmentPoolingModule module = CommitmentPoolingModule(deployment.commitmentPoolingModule);

        module.setGardenToken(_requireAddress(json, ".gardenToken", "gardenToken"));
        module.setHatsModule(_requireAddress(json, ".hatsModule", "hatsModule"));
        module.setActionRegistry(_requireAddress(json, ".actionRegistry", "actionRegistry"));
        module.setCommitmentRegistry(deployment.commitmentRegistry);
        module.setWorkApprovalResolver(_requireAddress(json, ".workApprovalResolver", "workApprovalResolver"));
        module.setEAS(_requireAddress(json, ".eas.address", "eas.address"));
        module.setSchemaUIDs(
            _requireSchemaUID(json, ".schemas.workSchemaUID", "schemas.workSchemaUID"),
            _requireSchemaUID(json, ".schemas.workApprovalSchemaUID", "schemas.workApprovalSchemaUID"),
            _requireSchemaUID(json, ".schemas.assessmentSchemaUID", "schemas.assessmentSchemaUID"),
            _requireSchemaUID(json, ".schemas.assessmentV3SchemaUID", "schemas.assessmentV3SchemaUID")
        );

        console.log("CommitmentPoolingModule wired; still paused pending explicit activation");
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
        if (value == address(0)) revert MissingDependency(name);
    }

    function _requireSchemaUID(
        string memory json,
        string memory jsonPath,
        string memory name
    )
        private
        pure
        returns (bytes32 value)
    {
        value = abi.decode(vm.parseJson(json, jsonPath), (bytes32));
        if (value == bytes32(0)) revert MissingDependency(name);
    }

    /// @dev Written to a side file; the CLI merges it into `{chainId}-latest.json` so a failed
    ///      merge never leaves the canonical artifact half-written.
    function _saveDeployment(PoolingDeployment memory deployment) private {
        string memory output = "pooling";
        vm.serializeAddress(output, "commitmentPoolingModule", deployment.commitmentPoolingModule);
        string memory serialized = vm.serializeAddress(output, "commitmentRegistry", deployment.commitmentRegistry);

        string memory outputPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-pooling.json");
        vm.writeJson(serialized, outputPath);
        console.log("Pooling deployment written to:", outputPath);
    }
}
