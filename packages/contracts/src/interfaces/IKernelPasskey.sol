// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev ABI matches Kernel v3.3. The checked-in lib/kernel is an older incompatible Kernel and is
/// deliberately not imported.
interface IRecoverableKernel {
    function executeFromExecutor(
        bytes32 execMode,
        bytes calldata executionCalldata
    )
        external
        payable
        returns (bytes[] memory);
    function rootValidator() external view returns (bytes21);
    function isModuleInstalled(
        uint256 moduleType,
        address module,
        bytes calldata additionalContext
    )
        external
        view
        returns (bool);
}

/// @dev The key lifecycle of Kernel's WebAuthn validator, which stores one key per account.
interface IPasskeyValidator {
    function onInstall(bytes calldata data) external payable;
    function onUninstall(bytes calldata data) external payable;
    function isInitialized(address account) external view returns (bool);
    function webAuthnValidatorStorage(address account) external view returns (uint256 pubKeyX, uint256 pubKeyY);
}
