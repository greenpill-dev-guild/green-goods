// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import { BaseStrategy } from "@octant/core/BaseStrategy.sol";
import { IBaseHealthCheck } from "@octant/strategies/interfaces/IBaseHealthCheck.sol";

/**
 *   @title Base Health Check
 *   @author [Golem Foundation](https://golem.foundation)
 *   @custom:security-contact security@golem.foundation
 *   @notice This contract is based on Yearn's BaseHealthCheck from
 *   https://github.com/yearn/tokenized-strategy-periphery/blob/master/src/Bases/HealthCheck/BaseHealthCheck.sol
 *
 *   This contract can be inherited by any strategy wishing to implement a health check during
 *   the `report` function in order to prevent any unexpected behavior from being permanently
 *   recorded as well as the `checkHealth` modifier.
 *
 *   A strategist simply needs to inherit this contract. Set
 *   the limit ratios to the desired amounts and then
 *   override `_harvestAndReport()` just as they otherwise
 *  would. If the profit or loss that would be recorded is
 *   outside the acceptable bounds the tx will revert.
 *
 *   The healthcheck does not prevent a strategy from reporting
 *   losses, but rather can make sure manual intervention is
 *   needed before reporting an unexpected loss or profit.
 */
abstract contract BaseHealthCheck is BaseStrategy, IBaseHealthCheck {
    // Can be used to determine if a healthcheck should be called.
    // Defaults to true;
    bool public doHealthCheck = true;

    uint256 internal constant MAX_BPS = 10_000;

    // Default profit limit to 100%.
    uint16 private _profitLimitRatio = uint16(MAX_BPS);

    // Defaults loss limit to 0.
    uint16 private _lossLimitRatio;

    /// @notice Emitted when the health check flag is updated
    event HealthCheckUpdated(bool doHealthCheck);

    /// @notice Emitted when the profit limit ratio is updated
    event ProfitLimitRatioUpdated(uint256 newProfitLimitRatio);

    /// @notice Emitted when the loss limit ratio is updated
    event LossLimitRatioUpdated(uint256 newLossLimitRatio);

    constructor(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _management,
        address _keeper,
        address _emergencyAdmin,
        address _donationAddress,
        bool _enableBurning,
        address _tokenizedStrategyAddress
    )
        BaseStrategy(
            _asset,
            _name,
            _symbol,
            _management,
            _keeper,
            _emergencyAdmin,
            _donationAddress,
            _enableBurning,
            _tokenizedStrategyAddress
        )
    { }

    /**
     * @notice Returns the current profit limit ratio.
     * @dev Use a getter function to keep the variable private.
     * @return profitLimitRatio Current profit limit ratio in basis points
     */
    function profitLimitRatio() public view returns (uint256) {
        return _profitLimitRatio;
    }

    /**
     * @notice Returns the current loss limit ratio.
     * @dev Use a getter function to keep the variable private.
     * @return lossLimitRatio Current loss limit ratio in basis points
     */
    function lossLimitRatio() public view returns (uint256) {
        return _lossLimitRatio;
    }

    /**
     * @notice Set the `profitLimitRatio`.
     * @dev Denominated in basis points. I.E. 1_000 == 10%.
     * @param _newProfitLimitRatio New profit limit ratio in basis points
     */
    function setProfitLimitRatio(uint256 _newProfitLimitRatio) external onlyManagement {
        _setProfitLimitRatio(_newProfitLimitRatio);
    }

    /**
     * @dev Internally set the profit limit ratio. Denominated
     * in basis points. I.E. 1_000 == 10%.
     * @param _newProfitLimitRatio New profit limit ratio in basis points
     */
    function _setProfitLimitRatio(uint256 _newProfitLimitRatio) internal {
        require(_newProfitLimitRatio > 0, "!zero profit");
        require(_newProfitLimitRatio <= type(uint16).max, "!too high");
        _profitLimitRatio = uint16(_newProfitLimitRatio);
        emit ProfitLimitRatioUpdated(_newProfitLimitRatio);
    }

    /**
     * @notice Set the `lossLimitRatio`.
     * @dev Denominated in basis points. I.E. 1_000 == 10%.
     * @param _newLossLimitRatio New loss limit ratio in basis points
     */
    function setLossLimitRatio(uint256 _newLossLimitRatio) external onlyManagement {
        _setLossLimitRatio(_newLossLimitRatio);
    }

    /**
     * @dev Internally set the loss limit ratio. Denominated
     * in basis points. I.E. 1_000 == 10%.
     * @param _newLossLimitRatio New loss limit ratio in basis points
     */
    function _setLossLimitRatio(uint256 _newLossLimitRatio) internal {
        require(_newLossLimitRatio < MAX_BPS, "!loss limit");
        _lossLimitRatio = uint16(_newLossLimitRatio);
        emit LossLimitRatioUpdated(_newLossLimitRatio);
    }

    /**
     * @notice Turns the healthcheck on and off.
     * @dev If turned off the next report will auto turn it back on.
     * @param _doHealthCheck Bool if healthCheck should be done.
     */
    function setDoHealthCheck(bool _doHealthCheck) public onlyManagement {
        doHealthCheck = _doHealthCheck;
        emit HealthCheckUpdated(_doHealthCheck);
    }

    /**
     * @notice OVerrides the default {harvestAndReport} to include a healthcheck.
     * @return _totalAssets New totalAssets post report.
     */
    function harvestAndReport() external override onlySelf returns (uint256 _totalAssets) {
        // Let the strategy report.
        _totalAssets = _harvestAndReport();

        // Run the healthcheck on the amount returned.
        _executeHealthCheck(_totalAssets);
    }

    /**
     * @dev To be called during a report to make sure the profit
     * or loss being recorded is within the acceptable bound.
     *
     * @param _newTotalAssets Amount that will be reported in asset base units
     */
    function _executeHealthCheck(uint256 _newTotalAssets) internal virtual {
        if (!doHealthCheck) {
            doHealthCheck = true;
            return;
        }

        // Get the current total assets from the implementation.
        uint256 currentTotalAssets = TokenizedStrategy.totalAssets();

        if (_newTotalAssets > currentTotalAssets) {
            require(
                ((_newTotalAssets - currentTotalAssets) <= (currentTotalAssets * uint256(_profitLimitRatio)) / MAX_BPS),
                "healthCheck"
            );
        } else if (currentTotalAssets > _newTotalAssets) {
            require(
                (currentTotalAssets - _newTotalAssets <= ((currentTotalAssets * uint256(_lossLimitRatio)) / MAX_BPS)),
                "healthCheck"
            );
        }
    }
}
