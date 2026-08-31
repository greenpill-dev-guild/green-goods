// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { TestimonyResolver } from "../../src/resolvers/Testimony.sol";

interface ITestimonyOwner {
    function owner() external view returns (address);
}

/// @title TestimonyResolverDeployment
/// @notice Deterministic, recovery-safe CREATE2 deployment of the community testimony resolver.
/// @dev A library rather than a script so `DeployCommitmentSchemas`' preparation mode owns the
///      deployment — `contract-spec.md` §6.4.4 puts it there — while the Arbitrum fork rehearsal
///      drives the same code rather than a copy.
///
///      **Why CREATE2.** An earlier revision used plain `CREATE`, which made the step neither
///      deterministic nor retry-safe: if the transaction mined but artifact persistence or the
///      append-only merge then failed, the canonical artifact still read zero, so a retry deployed
///      a *second* implementation and proxy at fresh nonce-derived addresses and orphaned the
///      first — along with any schema already registered against it, since the Community Testimony
///      UID commits to the resolver address.
///
///      CREATE2 removes that by construction: a retry predicts the same two addresses, finds them
///      occupied, sends no deployment transaction, and simply rewrites the result artifact. That is
///      §6.4.4's "reconstructs the missing result artifact without another deployment transaction",
///      and it is why existing code is *reused* rather than merely tolerated — an address only
///      holds this bytecode if it was deployed from this exact creation code.
library TestimonyResolverDeployment {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error PredictedAddressMismatch(string name, address predicted, address deployed);
    error ExistingProxyMismatch(string field, address expected, address actual);
    error Create2DeploymentFailed(string name);

    /// @dev Bump to intentionally claim a fresh address pair. Never bump to work around a failed
    ///      run — that is precisely the case CREATE2 exists to make recoverable.
    string internal constant DEPLOY_VERSION = "v1";

    /// @dev This lane's own salt namespace. Deliberately NOT `getDeploymentDefaults()`, which
    ///      honours the ambient `DEPLOYMENT_SALT` env var: that would make the recovery address
    ///      depend on the operator's shell, so a retry from a clean environment would predict a
    ///      different pair and deploy over the top of a run that had already mined. An identity
    ///      that survives a crashed run cannot be movable by an env var.
    string internal constant DEPLOY_SALT_NAMESPACE = "green-goods:testimony-resolver";

    bytes32 internal constant ERC1967_IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    struct Deployment {
        address testimonyResolver;
        address testimonyResolverImpl;
        /// @dev False on a recovery rerun. This is the property that makes an interrupted run safe,
        ///      so it is returned rather than merely logged, and asserted by the fork rehearsal.
        bool deployedSomething;
    }

    /// @notice The two CREATE2 salts this lane uses.
    /// @dev Pure functions of namespace, version, and label — independent of compiled bytecode, so
    ///      a regression test can pin them without breaking on every legitimate recompile. That is
    ///      what makes a change to the derivation loud rather than merely self-consistent: dropping
    ///      `DEPLOY_VERSION` still deploys and still agrees with itself.
    function deploymentSalts() internal pure returns (bytes32 implSalt, bytes32 proxySalt) {
        return (_versionedSalt("TestimonyResolverImpl"), _versionedSalt("TestimonyResolverProxy"));
    }

    /// @notice The two addresses this lane always produces for a given (eas, owner).
    function predictAddresses(
        address eas,
        address owner,
        address factory
    )
        internal
        pure
        returns (address impl, address proxy)
    {
        impl = Create2.computeAddress(_versionedSalt("TestimonyResolverImpl"), keccak256(_implementationCode(eas)), factory);
        proxy =
            Create2.computeAddress(_versionedSalt("TestimonyResolverProxy"), keccak256(_proxyCode(impl, owner)), factory);
    }

    /// @notice Deploy whatever is missing and verify whatever already exists.
    /// @dev Idempotent by construction: on a rerun both addresses are occupied, nothing is sent,
    ///      and `deployedSomething` comes back false.
    function deployOrReuse(address eas, address owner, address factory) internal returns (Deployment memory deployment) {
        (deployment.testimonyResolverImpl, deployment.testimonyResolver) = predictAddresses(eas, owner, factory);

        bool deployedImpl = _deployImplementation(
            deployment.testimonyResolverImpl, _implementationCode(eas), _versionedSalt("TestimonyResolverImpl"), factory
        );
        bool deployedProxy = _deployProxy(deployment, _proxyCode(deployment.testimonyResolverImpl, owner), factory, owner);
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
        if (predicted.code.length > 0) return false;

        address created = _create2(code, salt, factory, "implementation");
        if (created != predicted) revert PredictedAddressMismatch("implementation", predicted, created);
        return true;
    }

    /// @dev The proxy's address commits to its creation code, which includes the implementation and
    ///      the `initialize(owner)` call. The two reads below confirm it was not upgraded or
    ///      re-owned since — the states CREATE2 alone cannot rule out.
    function _deployProxy(
        Deployment memory deployment,
        bytes memory code,
        address factory,
        address owner
    )
        private
        returns (bool deployed)
    {
        if (deployment.testimonyResolver.code.length == 0) {
            address created = _create2(code, _versionedSalt("TestimonyResolverProxy"), factory, "proxy");
            if (created != deployment.testimonyResolver) {
                revert PredictedAddressMismatch("proxy", deployment.testimonyResolver, created);
            }
            return true;
        }

        address currentImplementation =
            address(uint160(uint256(VM.load(deployment.testimonyResolver, ERC1967_IMPLEMENTATION_SLOT))));
        if (currentImplementation != deployment.testimonyResolverImpl) {
            revert ExistingProxyMismatch("implementation", deployment.testimonyResolverImpl, currentImplementation);
        }

        // A zero owner would mean the proxy exists but its initializer never ran.
        address currentOwner = ITestimonyOwner(deployment.testimonyResolver).owner();
        if (currentOwner != owner) revert ExistingProxyMismatch("owner", owner, currentOwner);
        return false;
    }

    function _create2(bytes memory bytecode, bytes32 salt, address factory, string memory name) private returns (address) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory data) = factory.call(abi.encodePacked(salt, bytecode));
        if (!success || data.length < 20) revert Create2DeploymentFailed(name);
        return address(bytes20(data));
    }
}
