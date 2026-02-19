// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.25;

/**
 * @title Withdraw Limit Module Interface
 * @author [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @notice Interface for dynamic withdrawal limit control modules
 * @dev Allows vaults to delegate withdrawal limit logic to external contracts
 */
interface IWithdrawLimitModule {
    /**
     * @notice Returns the available withdrawal limit for an owner
     * @dev Called by vault before withdrawals to enforce dynamic limits
     * @param owner Address that owns the shares
     * @param maxLoss Maximum acceptable loss in basis points (0-10000)
     * @param strategies Custom withdrawal queue
     * @return available Maximum withdrawal amount (0 = blocked)
     */
    function availableWithdrawLimit(
        address owner,
        uint256 maxLoss,
        address[] calldata strategies
    )
        external
        view
        returns (uint256);
}
