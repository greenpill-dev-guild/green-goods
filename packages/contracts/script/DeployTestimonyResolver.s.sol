// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { console } from "forge-std/console.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { DeployHelper } from "./DeployHelper.sol";
import { TestimonyResolver } from "../src/resolvers/Testimony.sol";

interface IOwnable {
    function owner() external view returns (address);
}

/// @title DeployTestimonyResolver
/// @notice Deploys the community testimony resolver behind a UUPS proxy, deterministically.
/// @dev First step of the pooling lane, and its own target because of an ordering cycle: the
///      community testimony schema's UID is `keccak256(schema, resolver, revocable)`, so the schema
///      cannot be registered before this address exists, and the resolver cannot pin a `schemaUID`
///      before the schema is registered. Deploying unconfigured breaks the cycle.
///
///      **Both deployments use CREATE2 with versioned salts** (`contract-spec.md` §7.1). An earlier
///      revision used plain `CREATE`, which made the target neither deterministic nor retry-safe:
///      if the transaction mined but artifact persistence or the append-only merge then failed, the
///      canonical artifact still read zero, so a retry deployed a *second* implementation and proxy
///      at fresh nonce-derived addresses and orphaned the first — along with any schema already
///      registered against it, since the schema UID commits to the resolver address.
///
///      CREATE2 removes that failure mode by construction. The address is derived from the creation
///      code, so a retry predicts the same two addresses, finds them already occupied, sends no
///      deployment transaction, and simply rewrites the result artifact. That is the
///      "reconstructs the missing result artifact without another deployment transaction"
///      requirement, and it is why existing code can be *reused* rather than merely tolerated: an
///      address only holds this bytecode if it was deployed from this exact creation code.
contract DeployTestimonyResolver is DeployHelper {
    error MissingDependency(string name);
    error ResolverOwnerMismatch(address assessmentOwner, address workApprovalOwner);
    error PredictedAddressMismatch(string name, address predicted, address deployed);
    error ExistingProxyMismatch(string field, address expected, address actual);

    /// @dev Bump to intentionally claim a fresh address pair. Never bump to work around a failed
    ///      run — that is the case CREATE2 exists to make recoverable.
    string internal constant DEPLOY_VERSION = "v1";

    /// @dev This target's own salt namespace. Deliberately NOT `getDeploymentDefaults()`, which
    ///      honours the ambient `DEPLOYMENT_SALT` env var: that would make the recovery address
    ///      depend on the operator's shell, so a retry from a clean environment would predict a
    ///      different pair and deploy a second implementation and proxy over the top of a run that
    ///      had already mined. The whole point of CREATE2 here is an identity that survives a
    ///      crashed run, which it cannot do if an env var can move it.
    string internal constant DEPLOY_SALT_NAMESPACE = "green-goods:testimony-resolver";

    bytes32 internal constant ERC1967_IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    struct TestimonyDeployment {
        address testimonyResolver;
        address testimonyResolverImpl;
        /// @dev False on a recovery rerun. This is the property that makes an interrupted run safe,
        ///      so it is returned rather than merely logged, and asserted by the fork rehearsal.
        bool deployedSomething;
    }

    function run() public returns (TestimonyDeployment memory deployment) {
        string memory json = _readDeployment();
        address owner = _resolverOwner(json);
        address eas = _requireAddress(json, ".eas.address", "eas.address");

        (address predictedImpl, address predictedProxy) = predictAddresses(eas, owner);
        // Predicted before anything is sent, so an operator can compare against the runbook.
        console.log("TestimonyResolver predicted implementation:", predictedImpl);
        console.log("TestimonyResolver predicted proxy:", predictedProxy);
        console.log("TestimonyResolver EAS:", eas);
        console.log("TestimonyResolver owner:", owner);

        vm.startBroadcast();
        deployment = deployOrReuse(eas, owner);
        vm.stopBroadcast();

        if (!deployment.deployedSomething) {
            console.log("Nothing deployed: both addresses already hold this exact code (recovery rerun)");
        }
        console.log("Unconfigured: schemaUID and commitmentModule are set by deploy.ts pooling-configure");
        _saveDeployment(deployment);
    }

    /// @notice The two CREATE2 salts this target uses, exposed so they can be pinned by test.
    /// @dev Pure functions of the namespace, version, and label — independent of compiled bytecode,
    ///      so a regression test can assert them without breaking on every legitimate recompile.
    ///      That is what makes a change to the salt derivation loud rather than merely internally
    ///      consistent: a mutation that drops DEPLOY_VERSION still produces a self-consistent
    ///      deploy, and only a pinned expectation catches it.
    function deploymentSalts() public pure returns (bytes32 implSalt, bytes32 proxySalt) {
        return (_versionedSalt("TestimonyResolverImpl"), _versionedSalt("TestimonyResolverProxy"));
    }

    /// @notice The two addresses this target will always produce for a given (eas, owner).
    /// @dev Public so the Arbitrum fork rehearsal drives the real derivation instead of a copy.
    function predictAddresses(address eas, address owner) public view returns (address impl, address proxy) {
        (, address factory,) = getDeploymentDefaults();

        impl = Create2.computeAddress(_versionedSalt("TestimonyResolverImpl"), keccak256(_implementationCode(eas)), factory);
        proxy =
            Create2.computeAddress(_versionedSalt("TestimonyResolverProxy"), keccak256(_proxyCode(impl, owner)), factory);
    }

    /// @notice Deploy whatever is missing and verify whatever already exists.
    /// @dev Idempotent by construction: on a rerun both addresses are occupied, nothing is sent,
    ///      and `deployedSomething` comes back false.
    function deployOrReuse(address eas, address owner) public returns (TestimonyDeployment memory deployment) {
        (, address factory,) = getDeploymentDefaults();
        (deployment.testimonyResolverImpl, deployment.testimonyResolver) = predictAddresses(eas, owner);

        bool deployedImpl = _deployImplementation(
            deployment.testimonyResolverImpl, _implementationCode(eas), _versionedSalt("TestimonyResolverImpl"), factory
        );
        bool deployedProxy = _deployProxy(
            deployment,
            _proxyCode(deployment.testimonyResolverImpl, owner),
            _versionedSalt("TestimonyResolverProxy"),
            factory,
            owner
        );
        deployment.deployedSomething = deployedImpl || deployedProxy;
    }

    function _implementationCode(address eas) private pure returns (bytes memory) {
        return abi.encodePacked(type(TestimonyResolver).creationCode, abi.encode(eas));
    }

    function _proxyCode(address implementation, address owner) private pure returns (bytes memory) {
        return abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(implementation, abi.encodeWithSelector(TestimonyResolver.initialize.selector, owner))
        );
    }

    /// @dev Versioned so a deliberate re-issue is an explicit code change, never an accident.
    function _versionedSalt(string memory label) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(DEPLOY_SALT_NAMESPACE, DEPLOY_VERSION, label));
    }

    /// @dev Occupied means it was deployed from this exact creation code — the address commits to
    ///      it — so reuse is safe and no further bytecode comparison adds information.
    function _deployImplementation(
        address predicted,
        bytes memory code,
        bytes32 salt,
        address factory
    )
        private
        returns (bool deployed)
    {
        if (predicted.code.length > 0) {
            console.log("Reusing existing implementation (exact creation code):", predicted);
            return false;
        }
        address created = _deployCreate2(code, salt, factory);
        if (created != predicted) revert PredictedAddressMismatch("implementation", predicted, created);
        return true;
    }

    /// @dev The proxy's own address commits to its creation code, which includes the implementation
    ///      and the `initialize(owner)` call. The two reads below therefore confirm the proxy was
    ///      not upgraded or re-owned since — the states CREATE2 alone cannot rule out.
    function _deployProxy(
        TestimonyDeployment memory deployment,
        bytes memory code,
        bytes32 salt,
        address factory,
        address owner
    )
        private
        returns (bool deployed)
    {
        if (deployment.testimonyResolver.code.length == 0) {
            address created = _deployCreate2(code, salt, factory);
            if (created != deployment.testimonyResolver) {
                revert PredictedAddressMismatch("proxy", deployment.testimonyResolver, created);
            }
            return true;
        }

        console.log("Reusing existing proxy; verifying implementation and owner:", deployment.testimonyResolver);

        address currentImplementation =
            address(uint160(uint256(vm.load(deployment.testimonyResolver, ERC1967_IMPLEMENTATION_SLOT))));
        if (currentImplementation != deployment.testimonyResolverImpl) {
            revert ExistingProxyMismatch("implementation", deployment.testimonyResolverImpl, currentImplementation);
        }

        // A zero owner would mean the proxy exists but its initializer never ran.
        address currentOwner = IOwnable(deployment.testimonyResolver).owner();
        if (currentOwner != owner) revert ExistingProxyMismatch("owner", owner, currentOwner);
        return false;
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

    /// @dev Side file only; the CLI promotes both addresses into the canonical artifact. Because
    ///      the addresses are deterministic, a retry after a failed merge rewrites this file with
    ///      identical contents and sends no deployment transaction.
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
