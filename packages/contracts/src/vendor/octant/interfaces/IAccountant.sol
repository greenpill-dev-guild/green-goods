// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.25;

/**
 * @title IAccountant
 * @author Yearn.finance; adapted by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @notice Interface for fee assessment and refund calculation
 * @dev Called by vaults during processReport() to calculate fees on profits/losses
 * @custom:origin https://github.com/yearn/tokenized-strategy/blob/master/src/interfaces/IAccountant.sol
 */
interface IAccountant {
    /**
     * @notice Calculates fees and refunds for a strategy report
     * @dev Called by vault after determining gain/loss
     * @param strategy Address of the strategy being reported
     * @param gain Profit amount (in asset base units)
     * @param loss Loss amount (in asset base units)
     * @return fees Fees to charge (in asset base units)
     * @return refunds Refunds to provide (in asset base units)
     */
    function report(address strategy, uint256 gain, uint256 loss) external returns (uint256, uint256);
}
