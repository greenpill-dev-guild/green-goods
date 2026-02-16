// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.18;

/**
 * @title Yearn V3 Base Strategy Interface
 * @author yearn.finance; adapted by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @custom:origin https://github.com/yearn/tokenized-strategy/blob/master/src/interfaces/IBaseStrategy.sol
 * @notice This interface defines the functions that a BaseStrategy must implement
 *  to be compatible with the TokenizedStrategy contract.
 *
 *  These are primarily the callback functions that the TokenizedStrategy
 *  will call on the Strategy during various operations like deposits,
 *  withdrawals and reporting.
 */
interface IBaseStrategy {
    /*//////////////////////////////////////////////////////////////
                           TEND TRIGGER AND HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Returns if tend() should be called by a keeper
     * @dev For strategists to override if a strategy needs tending
     * @return shouldTend True if tend() should be called by keeper
     * @return tendCalldata Calldata for the tend call
     */
    function tendTrigger() external view returns (bool, bytes memory);

    /*//////////////////////////////////////////////////////////////
                        CALLBACKS FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Callback for the Strategy to deploy funds during deposit
     * @dev Part of FR-2. Invoked after deposit/mint so implementations should consider
     *      sandwich resistance and market impact; can be permissionless unless in allowset
     * @param _amount Amount of asset the strategy can deploy
     */
    function deployFunds(uint256 _amount) external;

    /**
     * @notice Callback for the Strategy to free funds during withdrawal
     * @dev Part of FR-2. Invoked during withdraw/redeem; implementation should avoid
     *      relying on on-chain prices for final accounting and respect illiquidity scenarios
     * @param _amount Amount of asset that the strategy should free up
     */
    function freeFunds(uint256 _amount) external;

    /**
     * @notice Callback for the Strategy to report the value of all assets
     * @dev Part of FR-2. Called by TokenizedStrategy during report() via delegatecall
     *      (msg.sender == address(this)). Should include all loose and deployed assets,
     *      and avoid oracle-only valuations where possible
     * @return Total value of all assets the strategy holds in asset base units
     */
    function harvestAndReport() external returns (uint256);

    /**
     * @notice Callback for the TokenizedStrategy to initiate a tend call
     * @dev Called by the TokenizedStrategy during tend
     * @param _totalIdle Amount of idle funds available to deploy
     */
    function tendThis(uint256 _totalIdle) external;

    /*//////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAW LIMITS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice View function to check the deposit limit for an address
     * @dev Should be overridden by strategists if specific limits are desired
     * @param _owner Address that is depositing into the strategy
     * @return Maximum amount that owner can deposit in asset base units
     */
    function availableDepositLimit(address _owner) external view returns (uint256);

    /**
     * @notice View function to check the withdraw limit for an address
     * @dev Should be overridden by strategists if specific limits are desired
     * @param _owner Address that is withdrawing from the strategy
     * @return Maximum amount that can be withdrawn in asset base units
     */
    function availableWithdrawLimit(address _owner) external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                            EMERGENCY
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Gives the strategist a way to manually withdraw funds in case of emergency
     * @dev Can only be called by governance or the strategist
     * @param _amount Amount of asset to attempt to free
     */
    function shutdownWithdraw(uint256 _amount) external;
}
