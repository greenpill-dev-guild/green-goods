// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

import { PoolingConfiguration } from "./lib/PoolingConfiguration.sol";

/// @title ConfigurePooling
/// @notice Runs the three resolver calls that make a deployed Commitment Pooling module live.
/// @dev Runs after `commitment-schemas` (which deploys the testimony resolver and registers
///      AssessmentV3) and `pooling`. Everything before this deploys contracts; this connects them.
///      NOT the last step of the lane: `commitment-schemas --finalize-community-testimony` is,
///      because activating the testimony resolver must happen after its record is proven exact.
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
        // Declared, never inferred. `pooling-configure.ts` sets this from --sender after proving it
        // equals every live owner(); a missing value must stop the run rather than guess.
        address expectedOwner = vm.envAddress("POOLING_CONFIGURE_EXPECTED_OWNER");

        console.log("Configuring Commitment Pooling resolvers");
        console.log("  assessmentResolver:      ", targets.assessmentResolver);
        console.log("  workApprovalResolver:    ", targets.workApprovalResolver);
        console.log("  commitmentPoolingModule: ", targets.commitmentPoolingModule);
        console.log("  expected owner:          ", expectedOwner);

        vm.startBroadcast();
        written = targets.configure(expectedOwner);
        vm.stopBroadcast();

        // A zero here is the re-run contract holding, not a failure: every step was already
        // satisfied on chain.
        console.log("Configuration calls sent:", written);
        require(targets.isConfigured(), "pooling configuration did not reach the configured state");
        console.log("All configuration steps satisfied; the work-approval bridge is live");
    }

    function _readTargets() private view returns (PoolingConfiguration.Targets memory targets) {
        string memory json = _readDeployment();

        targets.assessmentResolver = _address(json, ".assessmentResolver");
        targets.workApprovalResolver = _address(json, ".workApprovalResolver");
        targets.commitmentPoolingModule = _address(json, ".commitmentPoolingModule");
        targets.assessmentSchemaUID = _uid(json, ".schemas.assessmentSchemaUID");
        targets.assessmentV3SchemaUID = _uid(json, ".schemas.assessmentV3SchemaUID");
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
