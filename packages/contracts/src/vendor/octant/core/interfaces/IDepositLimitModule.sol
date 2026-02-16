// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.25;

/**
 * @title Deposit Limit Module Interface
 * @author [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @notice Interface for dynamic deposit limit control modules
 * @dev Allows vaults to delegate deposit limit logic to external contracts
 *      enabling complex deposit control strategies beyond static limits
 *
 *      USE CASES:
 *      - Per-user deposit caps
 *      - Time-based deposit windows
 *      - Tiered deposit limits based on user attributes
 *      - KYC-gated deposits
 *      - Dynamic limits based on market conditions
 */
interface IDepositLimitModule {
    /**
     * @notice Returns the available deposit limit for a receiver
     * @dev Called by vault before deposits to enforce dynamic limits
     *      Should return 0 if deposits not allowed
     * @param receiver Address that would receive the shares
     * @return available Maximum deposit amount (0 = deposits blocked)
     */
    function availableDepositLimit(address receiver) external view returns (uint256);
}
