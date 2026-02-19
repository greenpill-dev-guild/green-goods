// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.25;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// TokenizedStrategy interface used for internal view delegateCalls.
import { ITokenizedStrategy } from "@octant/core/interfaces/ITokenizedStrategy.sol";

/**
 * @title Octant Base Strategy
 * @author [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @notice BaseStrategy implements all of the required functionality to
 *  seamlessly integrate with the `TokenizedStrategy` implementation contract
 *  allowing anyone to easily build a fully permissionless ERC-4626 compliant
 *  Vault by inheriting this contract and overriding three simple functions.
 *
 *  It utilizes an immutable proxy pattern that allows the BaseStrategy
 *  to remain simple and small. All standard logic is held within the
 *  `TokenizedStrategy` and is reused over any n strategies all using the
 *  `fallback` function to delegatecall the implementation so that strategists
 *  can only be concerned with writing their strategy specific code.
 *
 *  This contract should be inherited and the three main abstract methods
 *  `_deployFunds`, `_freeFunds` and `_harvestAndReport` implemented to adapt
 *  the Strategy to the particular needs it has to generate yield. There are
 *  other optional methods that can be implemented to further customize
 *  the strategy if desired.
 *
 *  All default storage for the strategy is controlled and updated by the
 *  `TokenizedStrategy`. The implementation holds a storage struct that
 *  contains all needed global variables in a manual storage slot. This
 *  means strategists can feel free to implement their own custom storage
 *  variables as they need with no concern of collisions. All global variables
 *  can be viewed within the Strategy by a simple call using the
 *  `TokenizedStrategy` variable. IE: TokenizedStrategy.globalVariable();.
 */
abstract contract BaseStrategy {
    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotSelf();

    // ============================================
    // MODIFIERS
    // ============================================

    /**
     * @notice Ensures function is called via delegatecall from this contract
     * @dev Used on TokenizedStrategy callbacks to verify delegatecall context
     *      Prevents external calls to internal hook functions
     */
    modifier onlySelf() {
        _onlySelf();
        _;
    }

    /**
     * @notice Restricts function to management address only
     * @dev Calls TokenizedStrategy.requireManagement to validate
     */
    modifier onlyManagement() {
        TokenizedStrategy.requireManagement(msg.sender);
        _;
    }

    /**
     * @notice Restricts function to keeper or management
     * @dev Calls TokenizedStrategy.requireKeeperOrManagement to validate
     *      Used for report() and tend() operations
     */
    modifier onlyKeepers() {
        TokenizedStrategy.requireKeeperOrManagement(msg.sender);
        _;
    }

    /**
     * @notice Restricts function to emergencyAdmin or management
     * @dev Calls TokenizedStrategy.requireEmergencyAuthorized to validate
     *      Used for emergency shutdown and withdrawal operations
     */
    modifier onlyEmergencyAuthorized() {
        TokenizedStrategy.requireEmergencyAuthorized(msg.sender);
        _;
    }

    /**
     * @dev Require that the msg.sender is this address.
     */
    function _onlySelf() internal view {
        if (msg.sender != address(this)) {
            revert NotSelf();
        }
    }

    /*//////////////////////////////////////////////////////////////
                            IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev This is the address of the TokenizedStrategy implementation
     * contract that will be used by all strategies to handle the
     * accounting, logic, storage etc.
     *
     * Any external calls to the that don't hit one of the functions
     * defined in this base or the strategy will end up being forwarded
     * through the fallback function, which will delegateCall this address.
     *
     * This address should be the same for every strategy, never be adjusted
     * and always be checked before any integration with the Strategy.
     */
    address public immutable TOKENIZED_STRATEGY_ADDRESS;

    /// @notice Underlying ERC20 asset the strategy earns yield on
    /// @dev Immutable, set during construction. Stored here for gas-efficient access
    ///      Strategies deposit this asset into yield sources
    ERC20 internal immutable asset;

    /// @notice Internal interface to TokenizedStrategy implementation
    /// @dev Set to address(this) during initialization
    ///
    ///      USAGE:
    ///      Any call to TokenizedStrategy.xxx() will:
    ///      1. Call address(this).xxx()
    ///      2. Hit the fallback function
    ///      3. Delegatecall to TOKENIZED_STRATEGY_ADDRESS
    ///
    ///      This pattern allows strategies to access TokenizedStrategy storage
    ///      as if it were a linked library
    ITokenizedStrategy internal immutable TokenizedStrategy;

    /**
     * @notice Used to initialize the strategy on deployment.
     *
     * This will set the `TokenizedStrategy` variable for easy
     * internal view calls to the implementation. As well as
     * initializing the default storage variables based on the
     * parameters and using the deployer for the permissioned roles.
     *
     * @param _asset Address of the underlying asset.
     * @param _name Name the strategy will use.
     * @param _symbol Symbol the strategy will use.
     * @param _management Address with management permissions
     * @param _keeper Address with keeper permissions
     * @param _emergencyAdmin Address with emergency admin permissions
     * @param _donationAddress Address that will receive donations for this specific strategy
     * @param _enableBurning Whether to enable burning shares from dragon router during loss protection
     * @param _tokenizedStrategyAddress Address of the TokenizedStrategy implementation
     */
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
    ) {
        asset = ERC20(_asset);
        TOKENIZED_STRATEGY_ADDRESS = _tokenizedStrategyAddress;

        // Set instance of the implementation for internal use.
        TokenizedStrategy = ITokenizedStrategy(address(this));

        // Initialize the strategy's storage variables.
        _delegateCall(
            abi.encodeCall(
                ITokenizedStrategy.initialize,
                (_asset, _name, _symbol, _management, _keeper, _emergencyAdmin, _donationAddress, _enableBurning)
            )
        );

        // Store the tokenizedStrategyAddress at the standard implementation
        // address storage slot so etherscan picks up the interface. This gets
        // stored on initialization and never updated.
        assembly {
            sstore(
                // keccak256('eip1967.proxy.implementation' - 1)
                0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc,
                _tokenizedStrategyAddress
            )
        }
    }

    /*//////////////////////////////////////////////////////////////
                NEEDED TO BE OVERRIDDEN BY STRATEGIST
    //////////////////////////////////////////////////////////////*/

    // ============================================
    // REQUIRED OVERRIDES - STRATEGIST MUST IMPLEMENT
    // ============================================

    /**
     * @notice REQUIRED: Deploys assets into the yield source
     * @dev Called automatically after deposits/mints to put idle assets to work
     *
     *      WHEN CALLED:
     *      - After deposit() or mint() completes
     *      - Via deployFunds() hook from TokenizedStrategy
     *      - msg.sender == address(this) (via delegatecall)
     *
     *      IMPLEMENTATION GUIDANCE:
     *      1. Transfer _amount of asset from this contract to yield source
     *      2. Receive yield-bearing tokens (e.g., aTokens, LP tokens)
     *      3. Store any necessary state for tracking
     *      4. Consider gas costs - don't deploy dust amounts
     *
     *      SECURITY CONSIDERATIONS:
     *      - PERMISSIONLESS: Can be called by anyone via deposit
     *      - MEV RISK: May be sandwichable - consider slippage protection
     *      - VALIDATION: Verify yield source addresses/parameters
     *      - FAILURE: Revert on critical errors, idle funds stay in strategy
     *
     * @param _amount Amount of asset to deploy
     */
    function _deployFunds(uint256 _amount) internal virtual;

    /**
     * @notice REQUIRED: Frees assets from the yield source for withdrawal
     * @dev Called during withdraw/redeem to liquidate positions and return assets
     *
     *      WHEN CALLED:
     *      - During withdraw() or redeem() operations
     *      - Via freeFunds() hook from TokenizedStrategy
     *      - msg.sender == address(this) (via delegatecall)
     *      - Idle assets already accounted for (only called if needed)
     *
     *      IMPLEMENTATION GUIDANCE:
     *      1. Withdraw _amount from yield source to this contract
     *      2. DO NOT rely on asset.balanceOf(this) except for diff accounting
     *      3. Any shortfall is counted as loss and passed to withdrawer
     *      4. Consider reverting if illiquid rather than realizing losses
     *
     *      LOSS HANDLING:
     *      - Freed amount < _amount: Shortfall = realized loss for user
     *      - Loss must be within maxLoss tolerance or withdrawal reverts
     *      - CAREFUL: Temporary illiquidity ≠ permanent loss
     *
     *      SECURITY CONSIDERATIONS:
     *      - PERMISSIONLESS: Can be called by anyone via withdraw
     *      - MEV RISK: May be sandwichable - consider slippage protection
     *      - ILLIQUIDITY: Revert if withdrawal would realize unfair losses
     *      - PRECISION: Track actual amounts freed, not estimates
     *
     * @param _amount Amount of asset needed
     */
    function _freeFunds(uint256 _amount) internal virtual;

    /**
     * @notice REQUIRED: Harvests rewards and reports accurate asset accounting
     * @dev Called by report() to update strategy's total assets and realize profits/losses
     *
     *      WHEN CALLED:
     *      - Via report() by keeper or management
     *      - Via harvestAndReport() hook from TokenizedStrategy
     *      - Can be called even after shutdown
     *
     *      CRITICAL RESPONSIBILITIES:
     *      1. Harvest all pending rewards from yield source
     *      2. Sell/swap rewards to base asset (if applicable)
     *      3. Compound rewards back into position (if desired)
     *      4. Account for ALL assets: deployed + idle + pending rewards
     *      5. Return accurate total (profit/loss calculated from this)
     *
     *      ACCOUNTING RULES:
     *      - Return value MUST include: deposited assets + idle assets + accrued rewards
     *      - Return value determines profit/loss since last report
     *      - Profit = (currentTotal - lastReportedTotal) > 0
     *      - Loss = (currentTotal - lastReportedTotal) < 0
     *      - BE PRECISE: All PnL accounting depends on this number
     *
     *      POST-SHUTDOWN BEHAVIOR:
     *      - Check TokenizedStrategy.isShutdown()
     *      - If shutdown: Don't redeploy, just harvest and account
     *      - Allow final report to realize remaining positions
     *
     *      SECURITY CONSIDERATIONS:
     *      - ORACLE RISK: Prefer actual balances over oracle values
     *      - MANIPULATION: Ensure returned value reflects real assets
     *      - PRECISION: Rounding errors accumulate - be conservative
     *      - TIMING: MEV risk when harvesting - use protected mempools
     *
     * @return _totalAssets CRITICAL: Accurate total of all strategy assets (deployed + idle)
     * @custom:security Return value determines profit/loss - must be manipulation-resistant
     */
    function _harvestAndReport() internal virtual returns (uint256 _totalAssets);

    /*//////////////////////////////////////////////////////////////
                    OPTIONAL TO OVERRIDE BY STRATEGIST
    //////////////////////////////////////////////////////////////*/

    // ============================================
    // OPTIONAL OVERRIDES - ADVANCED STRATEGIST FEATURES
    // ============================================

    /**
     * @notice OPTIONAL: Performs maintenance between reports without updating PPS
     * @dev Called by tend() between reports for position maintenance
     *
     *      USE CASES:
     *      - Harvest and compound rewards without full report
     *      - Deploy idle funds when threshold reached
     *      - Rebalance positions
     *      - Update protocol-specific parameters
     *
     *      WHEN TO USE:
     *      - Strategy has idle funds but depositing is MEV-risky
     *      - Rewards need compounding more frequently than reports
     *      - Position requires periodic maintenance
     *
     *      IMPORTANT:
     *      - Does NOT update strategy PPS (no profit/loss recorded)
     *      - Only affects internal positions
     *      - Must also override _tendTrigger() to activate
     *
     * @param _totalIdle Current idle funds available to deploy
     */
    function _tend(uint256 _totalIdle) internal virtual { }

    /**
     * @notice OPTIONAL: Determines if tend() should be called
     * @dev MUST be overridden if _tend() is implemented
     *
     * @return shouldTend True if tend() should be called by keeper
     */
    function _tendTrigger() internal view virtual returns (bool) {
        return false;
    }

    /**
     * @notice Returns if tend() should be called by a keeper.
     *
     * @return shouldTend True if tend() should be called by a keeper.
     * @return tendCalldata Calldata for the tend call.
     */
    function tendTrigger() external view virtual returns (bool, bytes memory) {
        return (
            // Return the status of the tend trigger.
            _tendTrigger(),
            // And the needed calldata either way.
            abi.encodeWithSelector(ITokenizedStrategy.tend.selector)
        );
    }

    /**
     * @notice Gets the max amount of `asset` that an address can deposit.
     * @dev Defaults to an unlimited amount for any address. But can
     * be overridden by strategists.
     *
     * This function will be called before any deposit or mints to enforce
     * any limits desired by the strategist. This can be used for either a
     * traditional deposit limit or for implementing an allowset etc.
     *
     * This does not need to take into account any conversion rates
     * from shares to assets. But should know that any non max uint256
     * amounts may be converted to shares. So it is recommended to keep
     * custom amounts low enough as not to cause overflow when multiplied
     * by `totalSupply`.
     *
     * The address that is depositing into the strategy can be used by overrides to enforce custom limits.
     * @return Available amount owner can deposit
     */
    function availableDepositLimit(address /* _owner */ ) public view virtual returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @notice Gets the max amount of `asset` that can be withdrawn.
     * @dev Defaults to an unlimited amount for any address. But can
     * be overridden by strategists.
     *
     * This function will be called before any withdraw or redeem to enforce
     * any limits desired by the strategist. This can be used for illiquid
     * or sandwichable strategies. It should never be lower than `totalIdle`.
     *
     * This does not need to take into account the `_owner`'s share balance
     * or conversion rates from shares to assets.
     *
     * The address that is withdrawing from the strategy can be used by overrides to enforce custom limits.
     * @return Available amount that can be withdrawn
     */
    function availableWithdrawLimit(address /* _owner */ ) public view virtual returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @notice OPTIONAL: Manually withdraws funds after shutdown
     * @dev Allows management to recover funds from yield source post-shutdown
     *
     *      WHEN CALLED:
     *      - Only after strategy is shutdown
     *      - Via emergencyWithdraw() by management or emergencyAdmin
     *
     *      IMPORTANT:
     *      - Does NOT realize profit/loss (need separate report() for that)
     *      - _amount may exceed currently deployed amount
     *      - In _harvestAndReport(), check isShutdown() to avoid redeploying
     *
     * @param _amount Amount of asset to attempt to free
     */
    function _emergencyWithdraw(uint256 _amount) internal virtual { }

    /*//////////////////////////////////////////////////////////////
                        TokenizedStrategy HOOKS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Can deploy up to '_amount' of 'asset' in yield source.
     * @dev Callback for the TokenizedStrategy to call during a {deposit}
     * or {mint} to tell the strategy it can deploy funds.
     *
     * Since this can only be called after a {deposit} or {mint}
     * delegateCall to the TokenizedStrategy msg.sender == address(this).
     *
     * Unless an allowset is implemented this will be entirely permissionless
     * and thus can be sandwiched or otherwise manipulated.
     *
     * @param _amount Amount of asset strategy can deploy
     */
    function deployFunds(uint256 _amount) external virtual onlySelf {
        _deployFunds(_amount);
    }

    /**
     * @notice Should attempt to free the '_amount' of 'asset'.
     * @dev Callback for the TokenizedStrategy to call during a withdraw
     * or redeem to free the needed funds to service the withdraw.
     *
     * This can only be called after a 'withdraw' or 'redeem' delegateCall
     * to the TokenizedStrategy so msg.sender == address(this).
     *
     * @param _amount Amount of asset strategy should attempt to free up
     */
    function freeFunds(uint256 _amount) external virtual onlySelf {
        _freeFunds(_amount);
    }

    /**
     * @notice Returns the accurate amount of all funds currently
     * held by the Strategy.
     * @dev Callback for the TokenizedStrategy to call during a report to
     * get an accurate accounting of assets the strategy controls.
     *
     * This can only be called after a report() delegateCall to the
     * TokenizedStrategy so msg.sender == address(this).
     *
     * @return A trusted and accurate account for the total amount
     * of 'asset' the strategy currently holds including idle funds
     */
    function harvestAndReport() external virtual onlySelf returns (uint256) {
        return _harvestAndReport();
    }

    /**
     * @notice Will call the internal '_tend' when a keeper tends the strategy.
     * @dev Callback for the TokenizedStrategy to initiate a _tend call in the strategy.
     *
     * This can only be called after a tend() delegateCall to the TokenizedStrategy
     * so msg.sender == address(this).
     *
     * We name the function `tendThis` so that `tend` calls are forwarded to
     * the TokenizedStrategy.
     *
     * @param _totalIdle Amount of current idle funds available to be deployed during the tend
     */
    function tendThis(uint256 _totalIdle) external virtual onlySelf {
        _tend(_totalIdle);
    }

    /**
     * @notice Will call the internal '_emergencyWithdraw' function.
     * @dev Callback for the TokenizedStrategy during an emergency withdraw.
     *
     * This can only be called after a emergencyWithdraw() delegateCall to
     * the TokenizedStrategy so msg.sender == address(this).
     *
     * We name the function `shutdownWithdraw` so that `emergencyWithdraw`
     * calls are forwarded to the TokenizedStrategy.
     *
     * @param _amount Amount of asset to attempt to free
     */
    function shutdownWithdraw(uint256 _amount) external virtual onlySelf {
        _emergencyWithdraw(_amount);
    }

    /**
     * @dev Function used to delegate call the TokenizedStrategy with
     * certain `_calldata` and return any return values.
     *
     * This is used to setup the initial storage of the strategy, and
     * can be used by strategist to forward any other call to the
     * TokenizedStrategy implementation.
     *
     * @param _calldata ABI encoded calldata to use in delegatecall
     * @return returndata Return value if call was successful in bytes
     */
    function _delegateCall(bytes memory _calldata) internal returns (bytes memory returndata) {
        // Delegate call the tokenized strategy with provided calldata.
        (bool success, bytes memory result) = TOKENIZED_STRATEGY_ADDRESS.delegatecall(_calldata);

        // If the call reverted. Return the error.
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }

        // Return the result.
        return result;
    }

    /**
     * @dev Execute a function on the TokenizedStrategy and return any value.
     *
     * This fallback function will be executed when any of the standard functions
     * defined in the TokenizedStrategy are called since they wont be defined in
     * this contract.
     *
     * It will delegatecall the TokenizedStrategy implementation with the exact
     * calldata and return any relevant values.
     *
     */
    fallback() external {
        // load our target address
        address _tokenizedStrategyAddress = TOKENIZED_STRATEGY_ADDRESS;
        // Execute external function using delegatecall and return any value.
        assembly {
            // Copy function selector and any arguments.
            calldatacopy(0, 0, calldatasize())
            // Execute function delegatecall.
            let result := delegatecall(gas(), _tokenizedStrategyAddress, 0, calldatasize(), 0, 0)
            // Get any return value
            returndatacopy(0, 0, returndatasize())
            // Return any return value or error back to the caller
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
