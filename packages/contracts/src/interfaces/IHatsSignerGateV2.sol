// SPDX-License-Identifier: LGPL-3.0
pragma solidity ^0.8.25;

/// @notice Narrow ABI for published hats-zodiac v2.0.0 (commit 2c0172e).
interface IHatsSignerGateV2 {
    struct ThresholdConfig {
        uint8 thresholdType;
        uint120 min;
        uint120 target;
    }

    struct SetupParams {
        uint256 ownerHat;
        uint256[] signerHats;
        address safe;
        ThresholdConfig thresholdConfig;
        bool locked;
        bool claimableFor;
        address implementation;
        address hsgGuard;
        address[] hsgModules;
    }
    function safe() external view returns (address);
    function claimSignerFor(uint256 hat, address signer) external;
    function removeSigner(address signer) external;
    function registeredSignerHats(address signer) external view returns (uint256);
    function isValidSigner(address signer) external view returns (bool);
    function validSignerCount() external view returns (uint256);
    function thresholdConfig() external view returns (ThresholdConfig memory);
    function locked() external view returns (bool);
    function disableDelegatecallTarget(address target) external;
    function lock() external;
}

interface IModuleProxyFactory {
    function deployModule(address implementation, bytes calldata initializer, uint256 salt) external returns (address);
}

interface IStewardSafe {
    function isOwner(address account) external view returns (bool);
    function getThreshold() external view returns (uint256);
    function getOwners() external view returns (address[] memory);
    function getModulesPaginated(address start, uint256 pageSize) external view returns (address[] memory, address);
}
