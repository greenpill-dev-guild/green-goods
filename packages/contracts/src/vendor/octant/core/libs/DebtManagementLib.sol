// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626Payable } from "@octant/core/interfaces/IERC4626Payable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IMultistrategyVault } from "@octant/core/interfaces/IMultistrategyVault.sol";
import { ERC20SafeApproveLib } from "@octant/core/libs/ERC20SafeApproveLib.sol";

/**
 * @title DebtManagementLib
 * @author yearn.finance; extracted as library by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @custom:ported-from https://github.com/yearn/yearn-vaults-v3/blob/master/contracts/VaultV3.vy
 * @notice Library for managing debt allocation and rebalancing between a multistrategy vault and its strategies
 * @dev This library handles the complex logic of moving assets between the vault's idle reserves and
 *      individual strategies to maintain target debt levels. It ensures proper accounting, respects
 *      minimum idle requirements, and handles loss scenarios during withdrawals.
 *
 * Key Features:
 * - Debt rebalancing: Moves assets to/from strategies to match target debt allocations
 * - Loss protection: Enforces maximum acceptable loss thresholds during withdrawals
 * - Idle management: Maintains minimum idle reserves in the vault for liquidity
 * - Strategy constraints: Respects individual strategy deposit/withdrawal limits
 * - Shutdown handling: Ensures controlled wind-down when vault is in shutdown mode
 *
 * The library follows the ERC4626 standard for strategy interactions and implements
 * robust error handling for edge cases like insufficient liquidity or unrealized losses.
 *
 * Originally part of Yearn V3 Multistrategy Vault (Vyper), extracted to separate library
 * due to Solidity contract size limitations.
 * https://github.com/yearn/yearn-vaults-v3
 */
library DebtManagementLib {
    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice Maximum basis points (100%)
    /// @dev Used for loss tolerance calculations
    uint256 public constant MAX_BPS = 10_000;

    // ============================================
    // STRUCTS
    // ============================================

    /**
     * @notice Return values from updateDebt operation
     * @dev Returned to vault to update storage after debt operation
     */
    struct UpdateDebtResult {
        /// @notice New debt amount for the strategy
        uint256 newDebt;
        /// @notice New total idle amount for the vault
        uint256 newTotalIdle;
        /// @notice New total debt across all strategies
        uint256 newTotalDebt;
    }

    /**
     * @notice Working variables for updateDebt calculation
     * @dev Follows Vyper implementation structure to avoid stack-too-deep errors
     */
    struct UpdateDebtVars {
        /// @notice Target debt we want strategy to have
        uint256 newDebt;
        /// @notice Current debt strategy has
        uint256 currentDebt;
        /// @notice Amount to withdraw if reducing debt
        uint256 assetsToWithdraw;
        /// @notice Amount to deposit if increasing debt
        uint256 assetsToDeposit;
        /// @notice Minimum amount vault must keep idle
        uint256 minimumTotalIdle;
        /// @notice Current idle in vault
        uint256 totalIdle;
        /// @notice Available idle after reserving minimum
        uint256 availableIdle;
        /// @notice Max withdrawable from strategy per maxRedeem
        uint256 withdrawable;
        /// @notice Max deposit to strategy per maxDeposit
        uint256 maxDeposit;
        /// @notice Strategy's maximum debt limit
        uint256 maxDebt;
        /// @notice Vault's asset token address
        address asset;
        /// @notice Asset balance before operation (for diff accounting)
        uint256 preBalance;
        /// @notice Asset balance after operation (for diff accounting)
        uint256 postBalance;
        /// @notice Actual amount withdrawn (may differ from requested)
        uint256 withdrawn;
        /// @notice Actual amount deposited (may differ from requested)
        uint256 actualDeposit;
    }

    /**
     * @notice Rebalances strategy debt allocation by depositing or withdrawing assets
     * @dev Core debt management function handling bidirectional asset movement
     *
     *      OPERATION MODES:
     *      ═══════════════════════════════════
     *      1. REDUCE DEBT (targetDebt < currentDebt):
     *         - Withdraws assets from strategy back to vault
     *         - Increases totalIdle, decreases totalDebt
     *         - Respects strategy's maxRedeem limit
     *         - Validates loss within maxLoss tolerance
     *         - Ensures minimumTotalIdle is maintained
     *
     *      2. INCREASE DEBT (targetDebt > currentDebt):
     *         - Deposits idle assets from vault to strategy
     *         - Decreases totalIdle, increases totalDebt
     *         - Respects strategy's maxDeposit limit
     *         - Respects strategy's maxDebt cap
     *         - Ensures minimumTotalIdle is preserved
     *
     *      SPECIAL VALUES:
     *      - targetDebt = type(uint256).max: Deposit all available idle (up to maxDebt)
     *      - targetDebt = 0: Withdraw all assets from strategy
     *
     *      SAFETY CHECKS:
     *      - Prevents withdrawals if unrealized losses exist
     *      - Uses actual balance diff for precise accounting
     *      - Validates losses within maxLoss tolerance
     *      - Maintains minimumTotalIdle buffer
     *      - Auto-shutdown: Forces targetDebt = 0 if vault shutdown
     *
     *      LOSS HANDLING:
     *      - maxLoss in basis points (0-10000)
     *      - Loss = (assetsToWithdraw - actuallyWithdrawn)
     *      - Reverts if loss exceeds tolerance
     *      - Common values: 0 (no loss), 100 (1%), 10000 (100%)
     *
     * @param strategies Storage mapping of strategy parameters
     * @param totalIdle Current vault idle assets
     * @param totalDebt Current total debt across all strategies
     * @param strategy Strategy address to rebalance
     * @param targetDebt Target debt for strategy,  or type(uint256).max for max)
     * @param maxLoss Maximum acceptable loss in basis points (0-10000)
     * @param minimumTotalIdle Minimum idle to maintain in vault
     * @param asset Vault's asset token address
     * @param isShutdown Whether vault is shutdown (forces withdrawals)
     * @return result Updated debt, totalIdle, and totalDebt values
     */
    /* solhint-disable code-complexity */
    function updateDebt(
        mapping(address => IMultistrategyVault.StrategyParams) storage strategies,
        uint256 totalIdle,
        uint256 totalDebt,
        address strategy,
        uint256 targetDebt,
        uint256 maxLoss,
        uint256 minimumTotalIdle,
        address asset,
        bool isShutdown
    )
        external
        returns (UpdateDebtResult memory result)
    {
        // slither-disable-next-line uninitialized-local
        UpdateDebtVars memory vars;

        // Initialize result with current values
        result.newTotalIdle = totalIdle;
        result.newTotalDebt = totalDebt;

        // How much we want the strategy to have.
        vars.newDebt = targetDebt;
        // How much the strategy currently has.
        vars.currentDebt = strategies[strategy].currentDebt;
        vars.asset = asset;
        vars.minimumTotalIdle = minimumTotalIdle;
        vars.totalIdle = totalIdle;

        // If the vault is shutdown we can only pull funds.
        if (isShutdown) {
            vars.newDebt = 0;
        }

        // assert new_debt != current_debt, "new debt equals current debt"
        if (vars.newDebt == vars.currentDebt) {
            revert IMultistrategyVault.NewDebtEqualsCurrentDebt();
        }

        if (vars.currentDebt > vars.newDebt) {
            // Reduce debt.
            vars.assetsToWithdraw = vars.currentDebt - vars.newDebt;

            // Ensure we always have minimum_total_idle when updating debt.
            // Respect minimum total idle in vault
            if (vars.totalIdle + vars.assetsToWithdraw < vars.minimumTotalIdle) {
                vars.assetsToWithdraw = vars.minimumTotalIdle - vars.totalIdle;
                // Cant withdraw more than the strategy has.
                if (vars.assetsToWithdraw > vars.currentDebt) {
                    vars.assetsToWithdraw = vars.currentDebt;
                }
            }

            // Check how much we are able to withdraw.
            // Use maxRedeem and convert since we use redeem.
            vars.withdrawable =
                IERC4626Payable(strategy).convertToAssets(IERC4626Payable(strategy).maxRedeem(address(this)));

            // If insufficient withdrawable, withdraw what we can.
            if (vars.withdrawable < vars.assetsToWithdraw) {
                vars.assetsToWithdraw = vars.withdrawable;
            }

            if (vars.assetsToWithdraw == 0) {
                result.newDebt = vars.currentDebt;
                return result;
            }

            // If there are unrealised losses we don't let the vault reduce its debt until there is a new report
            uint256 unrealisedLossesShare = IMultistrategyVault(address(this)).assess_share_of_unrealised_losses(
                strategy, vars.currentDebt, vars.assetsToWithdraw
            );
            if (unrealisedLossesShare != 0) {
                revert IMultistrategyVault.StrategyHasUnrealisedLosses();
            }

            // Always check the actual amount withdrawn.
            vars.preBalance = IERC20(vars.asset).balanceOf(address(this));
            _withdrawFromStrategy(strategy, vars.assetsToWithdraw);
            vars.postBalance = IERC20(vars.asset).balanceOf(address(this));

            // making sure we are changing idle according to the real result no matter what.
            // We pull funds with {redeem} so there can be losses or rounding differences.
            vars.withdrawn = Math.min(vars.postBalance - vars.preBalance, vars.currentDebt);

            // If we didn't get the amount we asked for and there is a max loss.
            if (vars.withdrawn < vars.assetsToWithdraw && maxLoss < MAX_BPS) {
                // Make sure the loss is within the allowed range.
                if (vars.assetsToWithdraw - vars.withdrawn > (vars.assetsToWithdraw * maxLoss) / MAX_BPS) {
                    revert IMultistrategyVault.TooMuchLoss();
                }
            }
            // If we got too much make sure not to increase PPS.
            else if (vars.withdrawn > vars.assetsToWithdraw) {
                vars.assetsToWithdraw = vars.withdrawn;
            }

            // Update storage.
            vars.totalIdle += vars.withdrawn; // actual amount we got.
            // Amount we tried to withdraw in case of losses
            result.newTotalDebt = totalDebt - vars.assetsToWithdraw;

            vars.newDebt = vars.currentDebt - vars.assetsToWithdraw;
        } else {
            // We are increasing the strategies debt

            // Respect the maximum amount allowed.
            vars.maxDebt = strategies[strategy].maxDebt;
            if (vars.newDebt > vars.maxDebt) {
                vars.newDebt = vars.maxDebt;
                // Possible for current to be greater than max from reports.
                if (vars.newDebt < vars.currentDebt) {
                    result.newDebt = vars.currentDebt;
                    return result;
                }
            }

            // Vault is increasing debt with the strategy by sending more funds.
            // NOTE: For strategies that deposit into meta-vaults (e.g., MorphoCompounderStrategy → Morpho Steakhouse →
            // SteakHouse USDC),
            // maxDeposit may be inflated if underlying vaults have duplicate markets in their supplyQueue.
            // This could cause deposit attempts to fail if the actual capacity is lower than reported.
            vars.maxDeposit = IERC4626Payable(strategy).maxDeposit(address(this));
            if (vars.maxDeposit == 0) {
                result.newDebt = vars.currentDebt;
                return result;
            }

            // Deposit the difference between desired and current.
            vars.assetsToDeposit = vars.newDebt - vars.currentDebt;
            if (vars.assetsToDeposit > vars.maxDeposit) {
                // Deposit as much as possible.
                vars.assetsToDeposit = vars.maxDeposit;
            }

            // Ensure we always have minimum_total_idle when updating debt.
            if (vars.totalIdle <= vars.minimumTotalIdle) {
                result.newDebt = vars.currentDebt;
                return result;
            }

            vars.availableIdle = vars.totalIdle - vars.minimumTotalIdle;

            // If insufficient funds to deposit, transfer only what is free.
            if (vars.assetsToDeposit > vars.availableIdle) {
                vars.assetsToDeposit = vars.availableIdle;
            }

            // Can't Deposit 0.
            if (vars.assetsToDeposit > 0) {
                // Approve the strategy to pull only what we are giving it.
                ERC20SafeApproveLib.safeApprove(vars.asset, strategy, vars.assetsToDeposit);

                // Always update based on actual amounts deposited.
                vars.preBalance = IERC20(vars.asset).balanceOf(address(this));
                IERC4626Payable(strategy).deposit(vars.assetsToDeposit, address(this));
                vars.postBalance = IERC20(vars.asset).balanceOf(address(this));

                // Make sure our approval is always back to 0.
                ERC20SafeApproveLib.safeApprove(vars.asset, strategy, 0);

                // Making sure we are changing according to the real result no
                // matter what. This will spend more gas but makes it more robust.
                vars.actualDeposit = vars.preBalance - vars.postBalance;

                // Update storage.
                vars.totalIdle -= vars.actualDeposit;
                result.newTotalDebt = totalDebt + vars.actualDeposit;
            }

            vars.newDebt = vars.currentDebt + vars.actualDeposit;
        }

        // Commit memory to storage.
        strategies[strategy].currentDebt = vars.newDebt;
        result.newTotalIdle = vars.totalIdle;
        result.newDebt = vars.newDebt;

        return result;
    }

    /**
     * @notice Internal function to withdraw from strategy
     * @param strategy Strategy to withdraw from
     * @param assetsToWithdraw Amount to withdraw
     */
    function _withdrawFromStrategy(address strategy, uint256 assetsToWithdraw) internal {
        // Need to get shares since we use redeem to be able to take on losses.
        uint256 sharesToRedeem = Math.min(
            // Use previewWithdraw since it should round up.
            IERC4626Payable(strategy).previewWithdraw(assetsToWithdraw),
            // And check against our actual balance.
            IERC4626Payable(strategy).balanceOf(address(this))
        );

        // Redeem the shares.
        IERC4626Payable(strategy).redeem(sharesToRedeem, address(this), address(this));
    }
}
