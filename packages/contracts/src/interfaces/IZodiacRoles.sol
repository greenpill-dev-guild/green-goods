// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Narrow Zodiac Roles v2 surface used by Celo settlement.
/// @dev The deployed Roles modifier must use the SettlementExecutor as an
/// enabled module with a non-zero default role scoped to canonical G$ transfer.
enum SafeOperation {
    Call,
    DelegateCall
}

interface IZodiacRoles {
    function avatar() external view returns (address);
    function target() external view returns (address);
    function isModuleEnabled(address module) external view returns (bool);
    function defaultRoles(address module) external view returns (bytes32);

    function execTransactionWithRoleReturnData(
        address to,
        uint256 value,
        bytes calldata data,
        SafeOperation operation,
        bytes32 roleKey,
        bool shouldRevert
    )
        external
        returns (bool success, bytes memory returnData);
}

interface IGoodDollarToken {
    function balanceOf(address account) external view returns (uint256);
    function getFees(uint256 amount, address sender, address recipient) external view returns (uint256 fee, bool senderPays);
}

/// @notice Minimal Safe ownership check used to prove the executor is not an owner.
interface ISafeOwnerView {
    function isOwner(address owner) external view returns (bool);
}
