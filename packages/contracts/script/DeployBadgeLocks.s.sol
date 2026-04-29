// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script, console2 } from "forge-std/Script.sol";

import { IUnlockFactory, IPublicLock } from "../src/interfaces/IUnlock.sol";

/// @title DeployBadgeLocks
/// @notice Deploy the initial GreenWill badge locks via Unlock Protocol
/// @dev Invoked by `bun script/deploy.ts badge-locks --network <chain> --broadcast`
///      Writes deployments/{chainId}-badge-locks.json for the TS wrapper to merge.
contract DeployBadgeLocks is Script {
    error MissingUnlockFactory(string path);
    error UnsupportedChain(uint256 chainId);

    uint256 private constant DISABLED_TRANSFER_FEE_BASIS_POINTS = 10_000;

    function run() external {
        string memory networksJson = vm.readFile(string.concat(vm.projectRoot(), "/deployments/networks.json"));
        string memory networkName = _getNetworkName(block.chainid);
        string memory unlockFactoryPath = string.concat(".networks.", networkName, ".contracts.unlockFactory");
        address unlockFactory = _parseRequiredAddress(networksJson, unlockFactoryPath);
        address[] memory managerDefaults = _resolveManagerDefaults(networksJson);

        vm.startBroadcast();

        uint16 lockVersion = IUnlockFactory(unlockFactory).publicLockLatestVersion();

        address genesis = _deployLock(unlockFactory, lockVersion, "Green Goods Genesis", 0, managerDefaults);
        address firstWork = _deployLock(unlockFactory, lockVersion, "Green Goods First Work", 0, managerDefaults);
        address firstSupport = _deployLock(unlockFactory, lockVersion, "Green Goods First Support", 0, managerDefaults);

        vm.stopBroadcast();

        _saveResult(unlockFactory, lockVersion, managerDefaults.length, genesis, firstWork, firstSupport);
    }

    function _deployLock(
        address unlockFactory,
        uint16 lockVersion,
        string memory lockName,
        uint256 expirationDuration,
        address[] memory managerDefaults
    )
        internal
        returns (address lock)
    {
        bytes memory initializer = abi.encodeWithSelector(
            IPublicLock.initialize.selector, msg.sender, expirationDuration, address(0), 0, type(uint256).max, lockName
        );

        lock = IUnlockFactory(unlockFactory).createLock(initializer, lockVersion);
        IPublicLock(lock).updateTransferFee(DISABLED_TRANSFER_FEE_BASIS_POINTS);

        for (uint256 i = 0; i < managerDefaults.length; i++) {
            address manager = managerDefaults[i];
            if (manager == address(0) || manager == msg.sender) continue;
            if (!IPublicLock(lock).isLockManager(manager)) {
                IPublicLock(lock).addLockManager(manager);
            }
        }

        console2.log("Badge lock deployed:", lockName);
        console2.logAddress(lock);
    }

    function _saveResult(
        address unlockFactory,
        uint16 lockVersion,
        uint256 managerCount,
        address genesis,
        address firstWork,
        address firstSupport
    )
        internal
    {
        string memory obj = "badgeLocks";
        vm.serializeAddress(obj, "factory", unlockFactory);
        vm.serializeUint(obj, "publicLockVersion", lockVersion);
        vm.serializeAddress(obj, "lockCreator", msg.sender);
        vm.serializeUint(obj, "managerCount", managerCount);
        vm.serializeAddress(obj, "genesis", genesis);
        vm.serializeAddress(obj, "firstWork", firstWork);
        string memory finalJson = vm.serializeAddress(obj, "firstSupport", firstSupport);

        string memory outPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-badge-locks.json");
        vm.writeJson(finalJson, outPath);
        console2.log("Saved to:", outPath);
    }

    function _resolveManagerDefaults(string memory networksJson) internal view returns (address[] memory managers) {
        managers = _parseOptionalAddressArray(networksJson, ".deploymentDefaults.badgeLockManagers");
        if (managers.length > 0) {
            return managers;
        }

        address fallbackManager = _parseOptionalAddress(networksJson, ".deploymentDefaults.multisig");
        if (fallbackManager == address(0)) {
            fallbackManager = _parseOptionalAddress(networksJson, ".deploymentDefaults.greenGoodsSafe");
        }

        if (fallbackManager == address(0)) {
            return new address[](0);
        }

        managers = new address[](1);
        managers[0] = fallbackManager;
    }

    function _parseRequiredAddress(string memory json, string memory path) internal view returns (address parsed) {
        try vm.parseJson(json, path) returns (bytes memory data) {
            parsed = abi.decode(data, (address));
        } catch {
            revert MissingUnlockFactory(path);
        }

        if (parsed == address(0)) {
            revert MissingUnlockFactory(path);
        }
    }

    function _parseOptionalAddress(string memory json, string memory path) internal view returns (address parsed) {
        try vm.parseJson(json, path) returns (bytes memory data) {
            return abi.decode(data, (address));
        } catch {
            return address(0);
        }
    }

    function _parseOptionalAddressArray(
        string memory json,
        string memory path
    )
        internal
        view
        returns (address[] memory addresses)
    {
        try vm.parseJson(json, path) returns (bytes memory data) {
            return abi.decode(data, (address[]));
        } catch {
            return new address[](0);
        }
    }

    function _getNetworkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 1) return "mainnet";
        if (chainId == 11_155_111) return "sepolia";
        if (chainId == 31_337) return "localhost";
        if (chainId == 42_161) return "arbitrum";
        if (chainId == 42_220) return "celo";
        revert UnsupportedChain(chainId);
    }
}
