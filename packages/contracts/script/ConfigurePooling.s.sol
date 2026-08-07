// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

import { PoolingConfiguration } from "./lib/PoolingConfiguration.sol";

/// @title ConfigurePooling
/// @notice Runs the five resolver calls that make a deployed Commitment Pooling module live.
/// @dev The last step of the pooling lane, after `testimony-resolver`, `commitment-schemas`, and
///      `pooling`. Everything before this deploys contracts; this is what connects them.
///
///      Until `workApprovalResolver.setCommitmentModule` lands, the resolver never calls
///      `onWorkDecision`, so approved work earns no commitment credit and the module — deployed,
///      wired, and unpaused — is still inert.
///
///      The ordered sequence lives in `PoolingConfiguration` so this script and
///      `test/fork/ArbitrumCommitmentPooling.t.sol` drive the same code rather than two copies of
///      it. Re-running is safe: satisfied steps are skipped, and any divergence reverts
///      `ConfigurationConflict` rather than overwriting live state.
contract ConfigurePooling is Script {
    using PoolingConfiguration for PoolingConfiguration.Targets;

    function run() public returns (uint256 written) {
        PoolingConfiguration.Targets memory targets = _readTargets();

        console.log("Configuring Commitment Pooling resolvers");
        console.log("  assessmentResolver:      ", targets.assessmentResolver);
        console.log("  testimonyResolver:       ", targets.testimonyResolver);
        console.log("  workApprovalResolver:    ", targets.workApprovalResolver);
        console.log("  commitmentPoolingModule: ", targets.commitmentPoolingModule);

        vm.startBroadcast();
        written = targets.configure();
        vm.stopBroadcast();

        // A zero here is the re-run contract holding, not a failure: every step was already
        // satisfied on chain.
        console.log("Configuration calls sent:", written);
        require(targets.isConfigured(), "pooling configuration did not reach the configured state");
        console.log("All five configuration steps satisfied; the work-approval bridge is live");
    }

    function _readTargets() private view returns (PoolingConfiguration.Targets memory targets) {
        string memory json = _readDeployment();

        targets.assessmentResolver = _address(json, ".assessmentResolver");
        targets.testimonyResolver = _address(json, ".testimonyResolver");
        targets.workApprovalResolver = _address(json, ".workApprovalResolver");
        targets.commitmentPoolingModule = _address(json, ".commitmentPoolingModule");
        targets.assessmentSchemaUID = _uid(json, ".schemas.assessmentSchemaUID");
        targets.assessmentV3SchemaUID = _uid(json, ".schemas.assessmentV3SchemaUID");
        targets.communityTestimonySchemaUID = _uid(json, ".schemas.communityTestimonySchemaUID");
    }

    function _readDeployment() private view returns (string memory) {
        string memory deploymentPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-latest.json");
        return vm.readFile(deploymentPath);
    }

    /// @dev Zero and missing values fall through to `PoolingConfiguration._requireTargets`, which
    ///      names the offending field. Decoding here stays deliberately dumb so there is exactly
    ///      one place that decides what "missing" means.
    function _address(string memory json, string memory jsonPath) private pure returns (address) {
        return abi.decode(vm.parseJson(json, jsonPath), (address));
    }

    function _uid(string memory json, string memory jsonPath) private pure returns (bytes32) {
        return abi.decode(vm.parseJson(json, jsonPath), (bytes32));
    }
}
