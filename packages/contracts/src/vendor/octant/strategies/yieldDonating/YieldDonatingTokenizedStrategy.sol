// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.25;

import { TokenizedStrategy, Math } from "@octant/core/TokenizedStrategy.sol";
import { IBaseStrategy } from "@octant/core/interfaces/IBaseStrategy.sol";
/**
 * @title YieldDonatingTokenizedStrategy
 * @author [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @notice Specialized TokenizedStrategy for productive assets with discrete harvesting; profits are donated by minting
 * shares to the dragon router.
 * @dev Behavior overview:
 *      - On report(), harvests the underlying position via BaseStrategy.harvestAndReport()
 *      - If newTotalAssets > oldTotalAssets, mints shares equal to the profit (asset value) to the dragon router
 *      - If losses occur and burning is enabled, burns dragon router shares (up to its balance) using rounding-down
 * shares-to-burn
 *      - No tracked-loss bucket exists; any loss not covered by dragon router burning reduces totalAssets and affects PPS
 * for all holders
 *
 * Economic notes:
 *      - Profit donations are realized via share mints at the time of report
 *      - Losses first attempt dragon share burning when enabled; residual losses decrease PPS
 *      - Dragon router change follows TokenizedStrategy cooldown and two-step finalization
 */

contract YieldDonatingTokenizedStrategy is TokenizedStrategy {
    using Math for uint256;

    /// @notice Emitted when profit shares are minted to dragon router
    /// @param dragonRouter Address receiving minted donation shares
    /// @param amount Amount of shares minted in share base units
    event DonationMinted(address indexed dragonRouter, uint256 amount);

    /// @notice Emitted when dragon shares are burned to cover losses
    /// @param dragonRouter Address whose shares are burned
    /// @param amount Amount of shares burned in share base units
    event DonationBurned(address indexed dragonRouter, uint256 amount);
    /**
     * @notice Reports strategy performance and distributes profits as donations
     * @dev Mints profit-derived shares to dragon router when newTotalAssets > oldTotalAssets; on loss, attempts
     *      dragon share burning if enabled. Residual loss reduces PPS (no tracked-loss bucket).
     */

    function report()
        public
        virtual
        override(TokenizedStrategy)
        nonReentrant
        onlyKeepers
        returns (uint256 profit, uint256 loss)
    {
        // Cache storage pointer since its used repeatedly.
        StrategyData storage S = super._strategyStorage();

        uint256 newTotalAssets = IBaseStrategy(address(this)).harvestAndReport();
        uint256 oldTotalAssets = _totalAssets(S);
        address _dragonRouter = S.dragonRouter;

        if (newTotalAssets > oldTotalAssets) {
            unchecked {
                profit = newTotalAssets - oldTotalAssets;
            }
            uint256 sharesToMint = _convertToShares(S, profit, Math.Rounding.Down);

            // mint the shares to the dragon router
            _mint(S, _dragonRouter, sharesToMint);
            emit DonationMinted(_dragonRouter, sharesToMint);
        } else {
            unchecked {
                loss = oldTotalAssets - newTotalAssets;
            }

            if (loss != 0) {
                // Handle loss protection
                _handleDragonLossProtection(S, loss);
            }
        }

        // Update the new total assets value
        S.totalAssets = newTotalAssets;
        S.lastReport = uint96(block.timestamp);

        emit Reported(profit, loss);
    }

    /**
     * @dev Internal function to handle loss protection for dragon principal
     * @param S Storage struct pointer to access strategy's storage variables
     * @param loss Amount of loss to protect against in asset base units
     *
     * If burning is enabled, this function will try to burn shares from the dragon router
     * equivalent to the loss amount.
     */
    function _handleDragonLossProtection(StrategyData storage S, uint256 loss) internal {
        if (S.enableBurning) {
            // Convert loss to shares that should be burned.
            // Floor rounding: any sub-wei remainder is socialized via PPS reduction
            // rather than over-burning dragon shares. This avoids systematically
            // extracting value from dragon in favor of depositors.
            uint256 sharesToBurn = _convertToShares(S, loss, Math.Rounding.Down);

            // Can only burn up to available shares from dragon router
            uint256 sharesBurned = Math.min(sharesToBurn, S.balances[S.dragonRouter]);

            if (sharesBurned > 0) {
                // Burn shares from dragon router
                _burn(S, S.dragonRouter, sharesBurned);
                emit DonationBurned(S.dragonRouter, sharesBurned);
            }
        }
    }
}
