// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { TestimonyResolver } from "../src/resolvers/Testimony.sol";

interface IOwnable {
    function owner() external view returns (address);
}

/// @title DeployTestimonyResolver
/// @notice Deploys the community testimony resolver behind a UUPS proxy.
/// @dev Deliberately its own target and the first step of the pooling lane. The EAS address is a
///      constructor argument on the implementation, so it is baked into bytecode and cannot be
///      changed by an upgrade — it is read from the deployment artifact rather than passed in, so
///      the resolver can never point at an EAS this chain does not run.
///
///      The resolver deploys unconfigured on purpose: `schemaUID` cannot be pinned until
///      `deploy.ts commitment-schemas` registers the schema, and that registration needs this
///      address to compute the schema's deterministic UID. The cycle resolves in exactly this
///      order — deploy here, register the schema, then `deploy.ts pooling-configure`.
contract DeployTestimonyResolver is Script {
    error MissingDependency(string name);
    error ResolverOwnerMismatch(address assessmentOwner, address workApprovalOwner);

    struct TestimonyDeployment {
        address testimonyResolver;
        address testimonyResolverImpl;
    }

    function run() public returns (TestimonyDeployment memory deployment) {
        string memory json = _readDeployment();
        address owner = _resolverOwner(json);
        address eas = _requireAddress(json, ".eas.address", "eas.address");

        vm.startBroadcast();

        deployment.testimonyResolverImpl = address(new TestimonyResolver(eas));
        deployment.testimonyResolver = address(
            new ERC1967Proxy(
                deployment.testimonyResolverImpl, abi.encodeWithSelector(TestimonyResolver.initialize.selector, owner)
            )
        );

        vm.stopBroadcast();

        console.log("TestimonyResolver implementation:", deployment.testimonyResolverImpl);
        console.log("TestimonyResolver proxy:", deployment.testimonyResolver);
        console.log("TestimonyResolver EAS:", eas);
        console.log("TestimonyResolver owner:", owner);
        console.log("Unconfigured: schemaUID and commitmentModule are set by deploy.ts pooling-configure");

        _saveDeployment(deployment);
    }

    /// @dev Owner is taken from the resolvers already on chain, not from the artifact's
    ///      `guardian`. On Arbitrum One those diverge — both live resolvers are owned by the
    ///      deployer while `guardian` is a different address — and initializing this resolver
    ///      under `guardian` would split `pooling-configure` across two signers, since its five
    ///      calls are `onlyOwner` on all three proxies. Deriving the owner from a sibling makes
    ///      "one owner across every resolver" true by construction; the mismatch check makes it
    ///      loud if the two siblings have already diverged.
    function _resolverOwner(string memory json) private view returns (address owner) {
        address assessmentResolver = _requireAddress(json, ".assessmentResolver", "assessmentResolver");
        address workApprovalResolver = _requireAddress(json, ".workApprovalResolver", "workApprovalResolver");

        owner = IOwnable(assessmentResolver).owner();
        address workApprovalOwner = IOwnable(workApprovalResolver).owner();
        if (owner != workApprovalOwner) revert ResolverOwnerMismatch(owner, workApprovalOwner);
        if (owner == address(0)) revert MissingDependency("assessmentResolver.owner()");
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

    /// @dev Side file only; the CLI promotes both addresses into the canonical artifact, so a
    ///      crash between broadcast and merge leaves a recoverable record rather than a
    ///      half-written deployment.
    function _saveDeployment(TestimonyDeployment memory deployment) private {
        string memory output = "testimonyResolver";
        vm.serializeAddress(output, "testimonyResolver", deployment.testimonyResolver);
        string memory serialized = vm.serializeAddress(output, "testimonyResolverImpl", deployment.testimonyResolverImpl);

        string memory outputPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-testimony-resolver.json");
        vm.writeJson(serialized, outputPath);
        console.log("Testimony resolver deployment written to:", outputPath);
    }
}
