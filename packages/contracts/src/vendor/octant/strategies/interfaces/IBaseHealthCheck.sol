// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.25;

/**
 * @title IBaseHealthCheck Interface
 * @author Yearn.finance; adapted by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @notice Interface for health checking strategy profit/loss reporting
 * @custom:origin https://github.com/yearn/tokenized-strategy-periphery/blob/master/src/HealthCheck/BaseHealthCheck.sol
 */
interface IBaseHealthCheck {
    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Returns whether the health check is currently enabled
     * @return True if health check is enabled
     */
    function doHealthCheck() external view returns (bool);

    /**
     * @notice Returns the profit limit ratio
     * @return Profit limit ratio in basis points
     */
    function profitLimitRatio() external view returns (uint256);

    /**
     * @notice Returns the loss limit ratio
     * @return Loss limit ratio in basis points
     */
    function lossLimitRatio() external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                          MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Set the profit limit ratio
     * @param _newProfitLimitRatio New profit limit ratio in basis points
     */
    function setProfitLimitRatio(uint256 _newProfitLimitRatio) external;

    /**
     * @notice Set the loss limit ratio
     * @param _newLossLimitRatio New loss limit ratio in basis points
     */
    function setLossLimitRatio(uint256 _newLossLimitRatio) external;

    /**
     * @notice Enable or disable health check
     * @dev If disabled, next report will re-enable it
     * @param _doHealthCheck Whether health check should be performed
     */
    function setDoHealthCheck(bool _doHealthCheck) external;
}
