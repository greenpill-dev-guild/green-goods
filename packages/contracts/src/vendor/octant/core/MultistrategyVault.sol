/* solhint-disable code-complexity */
// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { IMultistrategyVault } from "@octant/core/interfaces/IMultistrategyVault.sol";
import { IDepositLimitModule } from "@octant/core/interfaces/IDepositLimitModule.sol";
import { IWithdrawLimitModule } from "@octant/core/interfaces/IWithdrawLimitModule.sol";
import { IERC4626Payable } from "@octant/core/interfaces/IERC4626Payable.sol";
import { IAccountant } from "@octant/interfaces/IAccountant.sol";
import { IMultistrategyVaultFactory } from "@octant/factories/interfaces/IMultistrategyVaultFactory.sol";
import { DebtManagementLib } from "@octant/core/libs/DebtManagementLib.sol";

/**
 * @title MultistrategyVault
 * @author yearn.finance; port maintained by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @custom:ported-from https://github.com/yearn/yearn-vaults-v3/blob/master/contracts/VaultV3.vy
 * @notice This MultistrategyVault is based on the original VaultV3.vy Vyper implementation
 *   that has been ported to Solidity. It is designed as a non-opinionated system
 *   to distribute funds of depositors for a specific `asset` into different
 *   opportunities (aka Strategies) and manage accounting in a robust way.
 *
 *   Depositors receive shares (aka vaults tokens) proportional to their deposit amount.
 *   Vault tokens are yield-bearing and can be redeemed at any time to get back deposit
 *   plus any yield generated.
 *
 *   Addresses that are given different permissioned roles by the `roleManager`
 *   are then able to allocate funds as they best see fit to different strategies
 *   and adjust the strategies and allocations as needed, as well as reporting realized
 *   profits or losses.
 *
 *   Strategies are any ERC-4626 compliant contracts that use the same underlying `asset`
 *   as the vault. The vault provides no assurances as to the safety of any strategy
 *   and it is the responsibility of those that hold the corresponding roles to choose
 *   and fund strategies that best fit their desired specifications.
 *
 *   Those holding vault tokens are able to redeem the tokens for the corresponding
 *   amount of underlying asset based on any reported profits or losses since their
 *   initial deposit.
 *
 *   The vault is built to be customized by the management to be able to fit their
 *   specific desired needs. Including the customization of strategies, accountants,
 *   ownership etc.
 *
 * @dev Security considerations (summary):
 *  - Roles: privileged functions gated via `Roles`; improper assignment can lead to fund mismanagement.
 *  - Reentrancy: mutating flows guarded by `nonReentrant`.
 *  - Precision/rounding: use preview/convert helpers; PPS exposed has limited precision.
 *  - Withdrawal queue: incorrect ordering/duplicates can distort maxWithdraw/maxRedeem views.
 *  - Strategy trust: vault does not attest to strategy safety; management must curate strategies.
 */
contract MultistrategyVault is IMultistrategyVault {
    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice Maximum number of strategies allowed in the withdrawal queue
    /// @dev Prevents excessive gas costs during withdrawal iterations and queue management
    uint256 public constant MAX_QUEUE = 10;

    /// @notice Maximum basis points representing 100%
    /// @dev Used for all percentage calculations (fees, losses, etc.)
    ///      10,000 basis points = 100%
    uint256 public constant MAX_BPS = 10_000;

    /// @notice Extended precision for profit unlocking rate calculations
    /// @dev Used to maintain precision when calculating per-second profit unlock rates
    ///      1,000,000,000,000 = 1e12 for high precision time-weighted calculations
    uint256 public constant MAX_BPS_EXTENDED = 1_000_000_000_000;

    /// @notice API version of this vault implementation
    /// @dev Based on Yearn V3 vault version
    string public constant API_VERSION = "3.0.4";

    /// @notice EIP-712 domain type hash for signature verification
    /// @dev Used in permit() function for gasless approvals
    bytes32 private constant DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @notice EIP-712 permit type hash for signature verification
    /// @dev Used in permit() function for gasless approvals
    bytes32 private constant PERMIT_TYPE_HASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    // ============================================
    // STATE VARIABLES - CORE
    // ============================================

    /// @notice Address of the underlying ERC20 asset token
    /// @dev Must be ERC20-compliant. Set during initialization and cannot be changed
    address public override asset;

    /// @notice Decimal places for vault shares, matching the underlying asset
    /// @dev Inherited from the asset token to maintain 1:1 precision
    uint8 public override decimals;

    /// @notice Address of the factory contract that deployed this vault
    /// @dev Used to retrieve protocol fee configuration and maintain vault registry
    address private _factory;

    // ============================================
    // STATE VARIABLES - STRATEGY MANAGEMENT
    // ============================================

    /// @notice Mapping of strategy addresses to their parameters and accounting
    /// @dev Only strategies with activation != 0 are considered active
    ///      Stores: activation timestamp, lastReport, currentDebt, maxDebt
    mapping(address => StrategyParams) internal _strategies;

    /// @notice Array of strategy addresses used as the default withdrawal queue
    /// @dev Governance-managed via QUEUE_MANAGER role; strategies in this queue are trusted.
    ///      Maximum length of MAX_QUEUE (10). Order determines withdrawal priority.
    ///      Strategies are attempted in array order during withdrawals.
    address[] internal _defaultQueue;

    /// @notice Whether to force use of default queue for all withdrawals
    /// @dev When true, custom withdrawal queues passed to withdraw/redeem are ignored
    bool public useDefaultQueue;

    /// @notice Whether to automatically allocate deposited funds to strategies
    /// @dev When true, deposits are automatically sent to _defaultQueue[0] if queue is not empty
    ///      Requires a non-empty default queue or deposits will fail
    bool public autoAllocate;

    // ============================================
    // STATE VARIABLES - ACCOUNTING
    // ============================================

    /// @notice Mapping of account addresses to their vault share balances
    /// @dev ERC20-compliant balance tracking
    mapping(address => uint256) private _balanceOf;

    /// @notice Nested mapping of owner to spender to approved share amounts
    /// @dev ERC20-compliant allowance tracking for transferFrom operations
    mapping(address => mapping(address => uint256)) public override allowance;

    /// @notice Total supply of vault shares including locked shares
    /// @dev Includes both circulating shares and shares locked for profit unlocking
    ///      Actual circulating supply = _totalSupplyValue - _unlockedShares()
    uint256 private _totalSupplyValue;

    /// @notice Total amount of assets currently deployed across all strategies
    /// @dev In asset base units (typically 18 decimals). Updated via updateDebt() and processReport()
    ///      Invariant: _totalAssets = _totalIdle + _totalDebt
    uint256 private _totalDebt;

    /// @notice Amount of underlying asset held idle in the vault contract
    /// @dev In asset base units. Used instead of balanceOf(this) to prevent PPS manipulation via direct transfers
    ///      Acts as buffer for cheap withdrawals without touching strategies
    uint256 private _totalIdle;

    /// @notice Minimum amount of assets to maintain idle in the vault
    /// @dev In asset base units. Set by MINIMUM_IDLE_MANAGER role
    ///      Helps ensure gas-efficient withdrawals by maintaining a buffer
    ///      Value of 0 means no minimum is enforced
    uint256 public override minimumTotalIdle;

    /// @notice Maximum total assets the vault can hold
    /// @dev In asset base units. When totalAssets >= depositLimit, deposits revert
    ///      Can be overridden by depositLimitModule if set to type(uint256).max
    uint256 public override depositLimit;

    // ============================================
    // STATE VARIABLES - PERIPHERY CONTRACTS
    // ============================================

    /// @notice Address of accountant contract for fee assessment
    /// @dev Charges fees on profits and can issue refunds. Set to address(0) to disable fees
    ///      Called during processReport() to calculate fees and refunds
    address public override accountant;

    /// @notice Address of deposit limit module contract
    /// @dev When set (non-zero), overrides the standard depositLimit
    ///      Must implement IDepositLimitModule.availableDepositLimit()
    address public override depositLimitModule;

    /// @notice Address of withdraw limit module contract
    /// @dev When set (non-zero), overrides the standard maxWithdraw calculation
    ///      Must implement IWithdrawLimitModule.availableWithdrawLimit()
    address public override withdrawLimitModule;

    // ============================================
    // STATE VARIABLES - ACCESS CONTROL
    // ============================================

    /// @notice Mapping of addresses to their role bitmasks
    /// @dev Each bit represents a different role (see Roles enum)
    ///      Multiple roles can be assigned by combining bits with OR
    mapping(address => uint256) public roles;

    /// @notice Address with authority to manage all role assignments
    /// @dev Can add/remove roles for any address including itself
    ///      Transfer requires two-step process via transferRoleManager() and acceptRoleManager()
    address public override roleManager;

    /// @notice Pending role manager address during transfer
    /// @dev Set by transferRoleManager(), cleared after acceptRoleManager()
    ///      Two-step process prevents accidental transfer to wrong address
    address public override futureRoleManager;

    // ============================================
    // STATE VARIABLES - ERC20 METADATA
    // ============================================

    /// @notice Human-readable name of the vault token
    /// @dev ERC20 standard. Can be updated by roleManager via set_name()
    string public override name;

    /// @notice Symbol ticker of the vault token
    /// @dev ERC20 standard. Can be updated by roleManager via setSymbol()
    string public override symbol;

    /// @notice Cached EIP-712 domain separator
    /// @dev Computed in initialize and updated when name changes
    bytes32 private _cachedDomainSeparator;

    /// @notice Chain ID at initialization time
    /// @dev Used to detect chain forks and trigger domain separator rebuild
    uint256 private _cachedChainId;

    // ============================================
    // STATE VARIABLES - VAULT STATE
    // ============================================

    /// @notice Whether the vault has been shutdown
    /// @dev When true, only withdrawals are allowed. Cannot be reversed once set
    ///      Triggered by EMERGENCY_MANAGER role via shutdownVault()
    bool private _shutdown;

    // ============================================
    // STATE VARIABLES - PROFIT LOCKING
    // ============================================

    /// @notice Duration over which profits are gradually unlocked
    /// @dev In seconds. Maximum 31,556,952 (1 year)
    ///      Set to 0 to disable profit locking (profits unlock immediately)
    ///      Prevents PPS manipulation by locking profits as vault shares
    uint256 private _profitMaxUnlockTime;

    /// @notice Timestamp when all currently locked profits will be fully unlocked
    /// @dev Unix timestamp in seconds. Set to 0 when no profits are locked
    ///      Updated after each profitable report
    uint256 private _fullProfitUnlockDate;

    /// @notice Rate at which locked profit shares unlock per second
    /// @dev In MAX_BPS_EXTENDED precision (1e12)
    ///      Formula: (totalLockedShares * MAX_BPS_EXTENDED) / unlockingPeriod
    uint256 private _profitUnlockingRate;

    /// @notice Timestamp of the last update to profit locking state
    /// @dev Unix timestamp in seconds. Used to calculate _unlockedShares()
    ///      Updated whenever shares are locked (during processReport)
    uint256 private _lastProfitUpdate;

    /// @notice Mapping of addresses to their current nonce for EIP-2612 permit
    /// @dev Incremented each time permit() is successfully called
    ///      Prevents replay attacks on signed approvals
    mapping(address => uint256) public override nonces;

    // ============================================
    // REENTRANCY GUARD
    // ============================================

    /// @notice Reentrancy guard lock state
    /// @dev True when a nonReentrant function is executing
    bool private _locked;

    /**
     * @notice Prevents reentrancy attacks on state-changing functions
     * @dev Uses simple lock flag. Applied to deposit, withdraw, redeem, updateDebt, and processReport
     *      Reverts with Reentrancy() error if reentrant call is detected
     */
    modifier nonReentrant() {
        require(!_locked, Reentrancy());
        _locked = true;
        _;
        _locked = false;
    }

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /**
     * @notice Constructor that prevents reinitialization
     * @dev Sets asset to a non-zero value (this contract address) to prevent initialize() from being called
     *      Actual initialization happens via initialize() when deployed through factory
     */
    constructor() {
        // Set `asset` so it cannot be re-initialized.
        asset = address(this);
    }

    /**
     * @notice Initialize a new vault with core parameters
     * @dev Can only be called once per deployment (checked via asset == address(0))
     *      Called by factory immediately after deployment. Sets all critical vault parameters
     * @param asset_ Address of the underlying ERC20 asset token (cannot be zero address)
     * @param name_ Human-readable name for the vault token (e.g., "Octant ETH Vault")
     * @param symbol_ Token symbol for the vault token (e.g., "ovETH")
     * @param roleManager_ Address that can manage role assignments (cannot be zero address)
     * @param profitMaxUnlockTime_ Duration for profit unlocking in seconds (0-31556952, max 1 year)
     * @custom:security Only callable once due to asset check. All parameters are immutable except profitMaxUnlockTime
     */
    function initialize(
        address asset_,
        string memory name_,
        string memory symbol_,
        address roleManager_,
        uint256 profitMaxUnlockTime_
    )
        public
        virtual
        override
    {
        require(asset == address(0), AlreadyInitialized());
        require(asset_ != address(0), ZeroAddress());
        require(roleManager_ != address(0), ZeroAddress());

        asset = asset_;
        // Get the decimals for the vault to use.
        decimals = IERC20Metadata(asset_).decimals();

        // Set the factory as the deployer address.
        _factory = msg.sender;

        // Must be less than one year for report cycles
        require(profitMaxUnlockTime_ <= 31_556_952, ProfitUnlockTimeTooLong());
        _profitMaxUnlockTime = profitMaxUnlockTime_;

        name = name_;
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
        symbol = symbol_;
        roleManager = roleManager_;
    }

    // ============================================
    // VAULT CONFIGURATION SETTERS
    // ============================================

    /**
     * @notice Updates the vault token name
     * @dev ERC20 metadata update. Also updates the EIP-712 domain separator,
     *      which invalidates any previously signed but unused permits.
     * @param name_ New name for the vault token
     * @custom:security Only callable by roleManager
     */
    function set_name(string memory name_) external override {
        require(msg.sender == roleManager, NotAllowed());
        name = name_;
        _cachedDomainSeparator = _buildDomainSeparator();
        emit UpdateName(name_);
    }

    /**
     * @notice Updates the vault token symbol
     * @dev ERC20 metadata update. Does not affect existing approvals or balances
     * @param symbol_ New symbol ticker for the vault token
     * @custom:security Only callable by roleManager
     */
    function set_symbol(string memory symbol_) external override {
        require(msg.sender == roleManager, NotAllowed());
        symbol = symbol_;
    }

    /**
     * @notice Sets the accountant contract for fee assessment
     * @dev Accountant is called during processReport() to calculate fees and refunds
     *      Set to address(0) to disable fee assessment
     * @param newAccountant_ Address of the new accountant contract (or address(0) to disable)
     * @custom:security Only callable by ACCOUNTANT_MANAGER role
     */
    function set_accountant(address newAccountant_) external override {
        _enforceRole(msg.sender, Roles.ACCOUNTANT_MANAGER);
        accountant = newAccountant_;

        emit UpdateAccountant(newAccountant_);
    }

    /**
     * @notice Sets the default withdrawal queue
     * @dev Validates that all strategies are active but does NOT check for duplicates
     *      WARNING: Adding the same strategy twice will cause incorrect maxRedeem/maxWithdraw values
     *      Queue order determines withdrawal priority (index 0 = highest priority)
     * @param newDefaultQueue_ Array of strategy addresses (maximum length MAX_QUEUE = 10)
     * @custom:security Only callable by QUEUE_MANAGER role
     */
    function set_default_queue(address[] memory newDefaultQueue_) external override {
        _enforceRole(msg.sender, Roles.QUEUE_MANAGER);
        require(newDefaultQueue_.length <= MAX_QUEUE, MaxQueueLengthReached());

        // Make sure every strategy in the new queue is active.
        for (uint256 i = 0; i < newDefaultQueue_.length; i++) {
            require(_strategies[newDefaultQueue_[i]].activation != 0, InactiveStrategy());
        }

        // Save the new queue.
        _defaultQueue = newDefaultQueue_;

        emit UpdateDefaultQueue(newDefaultQueue_);
    }

    /**
     * @notice Sets whether to force use of default withdrawal queue
     * @dev When true, custom withdrawal queues passed to withdraw/redeem are ignored
     *      Useful for ensuring consistent withdrawal behavior across all users
     * @param useDefaultQueue_ True to force default queue, false to allow custom queues
     * @custom:security Only callable by QUEUE_MANAGER role
     */
    function set_use_default_queue(bool useDefaultQueue_) external override {
        _enforceRole(msg.sender, Roles.QUEUE_MANAGER);
        useDefaultQueue = useDefaultQueue_;

        emit UpdateUseDefaultQueue(useDefaultQueue_);
    }

    /**
     * @notice Sets whether to automatically allocate deposits to strategies
     * @dev When true, deposits are automatically sent to _defaultQueue[0] via updateDebt()
     *      WARNING: Requires non-empty default queue or all deposits will fail
     *      Deposits become atomic (deposit + allocation) which increases gas cost
     * @param autoAllocate_ True to enable auto-allocation, false to keep deposits idle
     * @custom:security Only callable by DEBT_MANAGER role
     */
    function set_auto_allocate(bool autoAllocate_) external override {
        _enforceRole(msg.sender, Roles.DEBT_MANAGER);
        autoAllocate = autoAllocate_;

        emit UpdateAutoAllocate(autoAllocate_);
    }

    /**
     * @notice Sets the maximum total assets the vault can hold
     * @dev Cannot be changed if depositLimitModule is set unless shouldOverride_ is true
     *      Reverts if vault is shutdown
     * @param depositLimit_ New maximum total assets (use type(uint256).max for unlimited)
     * @param shouldOverride_ If true, clears depositLimitModule to allow setting depositLimit
     * @custom:security Only callable by DEPOSIT_LIMIT_MANAGER role
     * @custom:security Reverts if vault is shutdown
     */
    function set_deposit_limit(uint256 depositLimit_, bool shouldOverride_) public override {
        require(_shutdown == false, VaultShutdown());
        _enforceRole(msg.sender, Roles.DEPOSIT_LIMIT_MANAGER);

        // If we are overriding the deposit limit module.
        if (shouldOverride_) {
            // Make sure it is set to address 0 if not already.
            if (depositLimitModule != address(0)) {
                depositLimitModule = address(0);
                emit UpdateDepositLimitModule(address(0));
            }
        } else {
            // Make sure the depositLimitModule has been set to address(0).
            require(depositLimitModule == address(0), UsingModule());
        }

        depositLimit = depositLimit_;

        emit UpdateDepositLimit(depositLimit_);
    }

    /**
     * @notice Sets a module contract to dynamically control deposit limits
     * @dev Module overrides static depositLimit. Requires depositLimit = type(uint256).max
     *      or shouldOverride_ = true. Reverts if vault is shutdown
     * @param depositLimitModule_ Address of IDepositLimitModule contract (or address(0) to disable)
     * @param shouldOverride_ If true, automatically sets depositLimit to type(uint256).max
     * @custom:security Only callable by DEPOSIT_LIMIT_MANAGER role
     * @custom:security Reverts if vault is shutdown
     */
    function set_deposit_limit_module(address depositLimitModule_, bool shouldOverride_) external override {
        require(_shutdown == false, VaultShutdown());
        _enforceRole(msg.sender, Roles.DEPOSIT_LIMIT_MANAGER);

        // If we are overriding the deposit limit
        if (shouldOverride_) {
            // Make sure it is max uint256 if not already.
            if (depositLimit != type(uint256).max) {
                depositLimit = type(uint256).max;
                emit UpdateDepositLimit(type(uint256).max);
            }
        } else {
            // Make sure the deposit_limit has been set to uint max.
            require(depositLimit == type(uint256).max, UsingDepositLimit());
        }

        depositLimitModule = depositLimitModule_;

        emit UpdateDepositLimitModule(depositLimitModule_);
    }

    /**
     * @notice Sets a module contract to dynamically control withdraw limits
     * @dev Module overrides standard maxWithdraw() calculation
     *      Module must implement IWithdrawLimitModule.availableWithdrawLimit()
     * @param withdrawLimitModule_ Address of IWithdrawLimitModule contract (or address(0) to disable)
     * @custom:security Only callable by WITHDRAW_LIMIT_MANAGER role
     */
    function set_withdraw_limit_module(address withdrawLimitModule_) external override {
        _enforceRole(msg.sender, Roles.WITHDRAW_LIMIT_MANAGER);

        withdrawLimitModule = withdrawLimitModule_;

        emit UpdateWithdrawLimitModule(withdrawLimitModule_);
    }

    /**
     * @notice Sets the minimum amount of assets to keep idle in the vault
     * @dev Acts as buffer for cheap withdrawals. updateDebt() maintains this minimum
     *      Set to 0 to disable minimum idle requirement
     * @param minimumTotalIdle_ Minimum idle assets (0 = no minimum)
     * @custom:security Only callable by MINIMUM_IDLE_MANAGER role
     */
    function set_minimum_total_idle(uint256 minimumTotalIdle_) external override {
        _enforceRole(msg.sender, Roles.MINIMUM_IDLE_MANAGER);
        minimumTotalIdle = minimumTotalIdle_;

        emit UpdateMinimumTotalIdle(minimumTotalIdle_);
    }

    /**
     * @notice Sets the duration over which profits are gradually unlocked
     * @dev Prevents PPS manipulation by time-locking profit shares
     *
     *      IMPORTANT BEHAVIORS:
     *      - Setting to 0: Instantly unlocks all locked profits (immediate PPS increase)
     *      - Setting to non-zero: Next report will use new duration, current lock continues with old rate
     *
     *      CONSTRAINTS:
     *      - Maximum value: 31,556,952 seconds (1 year)
     *      - When set to 0, burns all locked shares and resets unlocking variables
     *
     * @param newProfitMaxUnlockTime_ New unlock duration in seconds (0-31556952)
     * @custom:security Only callable by PROFIT_UNLOCK_MANAGER role
     * @custom:security Setting to 0 causes immediate PPS change
     */
    function setProfitMaxUnlockTime(uint256 newProfitMaxUnlockTime_) external override {
        _enforceRole(msg.sender, Roles.PROFIT_UNLOCK_MANAGER);
        // Must be less than one year for report cycles
        require(newProfitMaxUnlockTime_ <= 31_556_952, ProfitUnlockTimeTooLong());

        // If setting to 0 we need to reset any locked values.
        if (newProfitMaxUnlockTime_ == 0) {
            uint256 shareBalance = _balanceOf[address(this)];
            if (shareBalance > 0) {
                // Burn any shares the vault still has.
                _burnShares(shareBalance, address(this));
            }

            // Reset unlocking variables to 0.
            _profitUnlockingRate = 0;
            _fullProfitUnlockDate = 0;
        }

        _profitMaxUnlockTime = newProfitMaxUnlockTime_;

        emit UpdateProfitMaxUnlockTime(newProfitMaxUnlockTime_);
    }

    // ============================================
    // ACCESS CONTROL - ROLE MANAGEMENT
    // ============================================

    /**
     * @dev Enforces that an account has the required role
     * @param account_ Address to check role for
     * @param role_ Required role enum value
     * @custom:security Reverts with NotAllowed() if account lacks the role
     */
    function _enforceRole(address account_, Roles role_) internal view {
        uint256 mask = 1 << uint256(role_);
        require((roles[account_] & mask) == mask, NotAllowed());
    }

    /**
     * @notice Sets the complete role bitmask for an account
     * @dev OVERWRITES all existing roles - must include all desired roles in bitmask
     *      Use addRole() or removeRole() to modify individual roles
     *      Bitmask calculated as: (1 << role1) | (1 << role2) | ...
     * @param account_ Address to set roles for
     * @param rolesBitmask_ Complete role bitmask (overwrites existing)
     * @custom:security Only callable by roleManager
     */
    function set_role(address account_, uint256 rolesBitmask_) external override {
        require(msg.sender == roleManager, NotAllowed());
        // Store the enum value directly
        roles[account_] = rolesBitmask_;
        emit RoleSet(account_, rolesBitmask_);
    }

    /**
     * @notice Adds a role to an account without affecting existing roles
     * @dev Uses bitwise OR to add role while preserving others
     *      Account can hold multiple roles simultaneously
     * @param account_ Address to grant role to
     * @param role_ Role enum value to add (single role only)
     * @custom:security Only callable by roleManager
     */
    function add_role(address account_, Roles role_) external override {
        require(msg.sender == roleManager, NotAllowed());
        // Add the role with a bitwise OR
        roles[account_] = roles[account_] | (1 << uint256(role_));
        emit RoleSet(account_, roles[account_]);
    }

    /**
     * @notice Removes a role from an account without affecting other roles
     * @dev Uses bitwise AND with NOT to remove role while preserving others
     *      Does not revert if account doesn't have the role
     * @param account_ Address to revoke role from
     * @param role_ Role enum value to remove (single role only)
     * @custom:security Only callable by roleManager
     */
    function remove_role(address account_, Roles role_) external override {
        require(msg.sender == roleManager, NotAllowed());

        // Bitwise AND with NOT to remove the role
        roles[account_] = roles[account_] & ~(1 << uint256(role_));
        emit RoleSet(account_, roles[account_]);
    }

    /**
     * @notice Initiates role manager transfer (step 1 of 2)
     * @dev Two-step process prevents accidental transfer to wrong/inaccessible address
     *      Sets futureRoleManager which must then call acceptRoleManager()
     * @param roleManager_ Address of the new role manager
     * @custom:security Only callable by current roleManager
     */
    function transfer_role_manager(address roleManager_) external override {
        require(msg.sender == roleManager, NotAllowed());
        futureRoleManager = roleManager_;

        emit UpdateFutureRoleManager(roleManager_);
    }

    /**
     * @notice Completes role manager transfer (step 2 of 2)
     * @dev Caller must be the futureRoleManager set by transferRoleManager()
     *      Clears futureRoleManager and updates roleManager to caller
     * @custom:security Only callable by futureRoleManager address
     */
    function accept_role_manager() external override {
        require(msg.sender == futureRoleManager, NotFutureRoleManager());
        roleManager = msg.sender;
        futureRoleManager = address(0);

        emit UpdateRoleManager(msg.sender);
    }

    // ============================================
    // VAULT STATUS VIEWS
    // ============================================

    /**
     * @notice Returns whether the vault has been shutdown
     * @dev Shutdown is permanent and cannot be reversed
     *      When shutdown, only withdrawals are allowed
     * @return True if vault is shutdown, false otherwise
     */
    function isShutdown() external view override returns (bool) {
        return _shutdown;
    }

    /**
     * @notice Returns the amount of profit shares that have unlocked since last update
     * @dev Calculates time-weighted unlocking based on _profitUnlockingRate and elapsed time
     *      Returns total locked shares if unlock period has ended
     * @return Amount of shares unlocked,  typically 18 decimals)
     */
    function unlockedShares() external view override returns (uint256) {
        return _unlockedShares();
    }

    /**
     * @notice Returns the current price per share (PPS)
     * @dev PRECISION WARNING: Limited precision due to division. For exact calculations
     *      use convertToAssets() or convertToShares() instead
     *      Formula: (10^decimals * totalAssets) / totalSupply
     *      Returns 10^decimals when totalSupply = 0 (1:1 initial ratio)
     * @return Price per share (e.g., 1.05e18 = 1.05 assets per share)
     */
    function pricePerShare() external view override returns (uint256) {
        return _convertToAssets(10 ** uint256(decimals), Rounding.ROUND_DOWN);
    }

    /**
     * @notice Returns the default withdrawal queue array
     * @dev Array of strategy addresses in withdrawal priority order
     *      Maximum length is MAX_QUEUE (10)
     * @return Array of strategy addresses
     */
    function get_default_queue() external view returns (address[] memory) {
        return _defaultQueue;
    }

    // ============================================
    // REPORTING MANAGEMENT
    // ============================================

    /**
     * @notice Processes a strategy's performance report and updates vault accounting
     * @dev CRITICAL FUNCTION for vault accounting. Updates gains/losses, assesses fees, and locks profits
     *
     *      PROCESS OVERVIEW:
     *      1. Calculate gain/loss by comparing strategy assets vs recorded debt
     *      2. Assess fees and refunds via accountant (if set)
     *      3. Calculate shares to burn (for losses/fees) and shares to lock (for profits)
     *      4. Update share supply and locked shares accordingly
     *      5. Pull refunds from accountant if any
     *      6. Update strategy debt tracking
     *      7. Issue fee shares to accountant and protocol
     *      8. Update profit unlocking rate and schedule
     *
     *      IMPORTANT NOTES:
     *      - Strategy's convertToAssets() MUST NOT be manipulable or vault reports incorrect gains/losses
     *      - Pass address(this) as strategy_ to accrue airdrops into totalIdle
     *      - Profit locking prevents PPS manipulation by gradually releasing profits over time
     *      - Fees are taken as shares, reducing profit for existing shareholders
     *
     *      ACCOUNTING INVARIANTS:
     *      - totalAssets = totalIdle + totalDebt
     *      - totalSupply = circulating shares + locked shares
     *
     * @param strategy_ Address of strategy to report (or address(this) to report vault airdrops)
     * @return gain Amount of profit generated since last report
     * @return loss Amount of loss incurred since last report
     * @custom:security Only callable by REPORTING_MANAGER role
     * @custom:security Reentrancy protected
     * @custom:security Strategy convertToAssets() must be manipulation-resistant
     */
    function process_report(address strategy_) external nonReentrant returns (uint256, uint256) {
        _enforceRole(msg.sender, Roles.REPORTING_MANAGER);

        // slither-disable-next-line uninitialized-local
        ProcessReportLocalVars memory vars;

        // ============================================
        // STEP 1: Determine Current Strategy Position
        // ============================================

        if (strategy_ != address(this)) {
            // Processing a strategy report
            // Ensure strategy is active (activation timestamp != 0)
            require(_strategies[strategy_].activation != 0, InactiveStrategy());

            // SECURITY CRITICAL: Query strategy's current asset value
            // The strategy's convertToAssets() MUST be manipulation-resistant
            // Any manipulation here will cause incorrect gain/loss accounting
            uint256 strategyShares = IERC4626Payable(strategy_).balanceOf(address(this));

            // Calculate the current value of our position in the strategy
            vars.strategyTotalAssets = IERC4626Payable(strategy_).convertToAssets(strategyShares);

            // Retrieve the debt we previously recorded for this strategy
            vars.currentDebt = _strategies[strategy_].currentDebt;
        } else {
            // Processing vault idle assets (for airdrop accounting)
            // This accrues any tokens directly transferred to vault into totalIdle
            vars.strategyTotalAssets = IERC20(asset).balanceOf(address(this));
            vars.currentDebt = _totalIdle;
        }

        // ============================================
        // STEP 2: Calculate Gain or Loss
        // ============================================

        // Compare current asset value against expected debt
        if (vars.strategyTotalAssets > vars.currentDebt) {
            // Strategy gained value - profit!
            vars.gain = vars.strategyTotalAssets - vars.currentDebt;
        } else {
            // Strategy lost value or stayed flat
            vars.loss = vars.currentDebt - vars.strategyTotalAssets;
        }

        // ============================================
        // STEP 3: Assess Fees and Refunds
        // ============================================

        // Check if accountant is configured for fee assessment
        vars.accountant = accountant;
        if (vars.accountant != address(0)) {
            // Call accountant to calculate fees and potential refunds
            // Fees are charged on gains, refunds may be given for losses
            (vars.totalFees, vars.totalRefunds) = IAccountant(vars.accountant).report(strategy_, vars.gain, vars.loss);

            if (vars.totalRefunds > 0) {
                // Cap refunds to what's actually available
                // Check both accountant's balance and allowance to vault
                vars.totalRefunds = Math.min(
                    vars.totalRefunds,
                    Math.min(
                        IERC20(asset).balanceOf(vars.accountant), IERC20(asset).allowance(vars.accountant, address(this))
                    )
                );
            }
        }
        // If no accountant, fees and refunds remain 0 (initialized values)

        // ============================================
        // STEP 4: Calculate Shares to Burn (Losses/Fees)
        // ============================================

        // We burn shares to offset losses and to take fees from shareholders
        if (vars.loss + vars.totalFees > 0) {
            // Convert the total loss + fees amount to shares
            // ROUND_UP ensures we burn enough shares to cover the full amount
            vars.sharesToBurn = _convertToShares(vars.loss + vars.totalFees, Rounding.ROUND_UP);

            // If we have fees, calculate the portion of burned shares to reissue as fees
            if (vars.totalFees > 0) {
                // Calculate what proportion of burned shares represent fees (vs losses)
                // These shares will be reissued to accountant and protocol
                vars.totalFeesShares = (vars.sharesToBurn * vars.totalFees) / (vars.loss + vars.totalFees);

                // Query protocol fee configuration from factory
                (vars.protocolFeeBps, vars.protocolFeeRecipient) =
                    IMultistrategyVaultFactory(_factory).protocolFeeConfig(address(this));

                // Calculate protocol's share of the fees
                if (vars.protocolFeeBps > 0) {
                    // Protocol fee is a percentage of total fees
                    vars.protocolFeesShares = (vars.totalFeesShares * uint256(vars.protocolFeeBps)) / MAX_BPS;
                }
            }
        }

        // ============================================
        // STEP 5: Calculate Shares to Lock (Profits)
        // ============================================

        // Profit locking prevents PPS manipulation by gradually releasing profits
        vars.profitMaxUnlockTimeVar = _profitMaxUnlockTime;

        // Only lock shares if we have profits and locking is enabled
        if (vars.gain + vars.totalRefunds > 0 && vars.profitMaxUnlockTimeVar != 0) {
            // Convert profit amount to shares that will be locked
            // ROUND_DOWN is conservative (locks slightly less)
            vars.sharesToLock = _convertToShares(vars.gain + vars.totalRefunds, Rounding.ROUND_DOWN);
        }

        // ============================================
        // STEP 6: Adjust Total Share Supply
        // ============================================

        // Cache current values for calculation
        vars.currentTotalSupply = _totalSupplyValue; // Includes locked shares
        vars.totalLockedShares = _balanceOf[address(this)]; // Current vault balance (locked shares)

        // Calculate the target total supply after accounting for:
        // + new shares to lock (profits)
        // - shares to burn (losses + fees)
        // - shares that have unlocked since last report
        vars.endingSupply = vars.currentTotalSupply + vars.sharesToLock - vars.sharesToBurn - _unlockedShares();

        // Adjust total supply to reach target
        if (vars.endingSupply > vars.currentTotalSupply) {
            // Need to mint new shares to the vault for locking
            _issueShares(vars.endingSupply - vars.currentTotalSupply, address(this));
        } else if (vars.currentTotalSupply > vars.endingSupply) {
            // Need to burn shares from vault's locked balance
            // Can't burn more than vault currently owns
            vars.toBurn = Math.min(vars.currentTotalSupply - vars.endingSupply, vars.totalLockedShares);
            _burnShares(vars.toBurn, address(this));
        }

        // Calculate net shares to lock this period
        // If we burned more than we're locking (loss > profit), net lock is 0
        if (vars.sharesToLock > vars.sharesToBurn) {
            // Only lock the net profit shares (don't relock burned shares)
            vars.sharesToLock = vars.sharesToLock - vars.sharesToBurn;
        } else {
            vars.sharesToLock = 0;
        }

        // ============================================
        // STEP 7: Pull Refunds from Accountant
        // ============================================

        if (vars.totalRefunds > 0) {
            // Transfer refunded assets from accountant to vault
            _safeTransferFrom(asset, vars.accountant, address(this), vars.totalRefunds);
            // Increase idle assets by refund amount
            _totalIdle += vars.totalRefunds;
        }

        // ============================================
        // STEP 8: Update Strategy Debt Tracking
        // ============================================

        // Record gains or losses to update debt tracking
        if (vars.gain > 0) {
            // Increase debt by gain amount
            vars.currentDebt = vars.currentDebt + vars.gain;

            if (strategy_ != address(this)) {
                // Update strategy's recorded debt
                _strategies[strategy_].currentDebt = vars.currentDebt;
                // Increase global debt tracker
                _totalDebt += vars.gain;
            } else {
                // Vault idle report: add refunds to the current debt
                vars.currentDebt = vars.currentDebt + vars.totalRefunds;
                // Update idle with final amount
                _totalIdle = vars.currentDebt;
            }
        } else if (vars.loss > 0) {
            // Decrease debt by loss amount
            vars.currentDebt = vars.currentDebt - vars.loss;

            if (strategy_ != address(this)) {
                // Update strategy's recorded debt (reduced by loss)
                _strategies[strategy_].currentDebt = vars.currentDebt;
                // Decrease global debt tracker
                _totalDebt -= vars.loss;
            } else {
                // Vault idle report: add refunds to the current debt
                vars.currentDebt = vars.currentDebt + vars.totalRefunds;
                // Update idle with final amount
                _totalIdle = vars.currentDebt;
            }
        }

        // ============================================
        // STEP 9: Issue Fee Shares
        // ============================================

        if (vars.totalFeesShares > 0) {
            // Issue shares to accountant (total fees minus protocol portion)
            _issueShares(vars.totalFeesShares - vars.protocolFeesShares, vars.accountant);

            // Issue protocol fee shares if applicable
            if (vars.protocolFeesShares > 0) {
                _issueShares(vars.protocolFeesShares, vars.protocolFeeRecipient);
            }
        }

        // ============================================
        // STEP 10: Update Profit Unlocking Schedule
        // ============================================

        // Recalculate total locked shares after all operations
        vars.totalLockedShares = _balanceOf[address(this)];

        if (vars.totalLockedShares > 0) {
            // We have shares to lock - need to calculate unlocking schedule
            vars.fullProfitUnlockDateVar = _fullProfitUnlockDate;

            // Check if there are previously locked shares still unlocking
            if (vars.fullProfitUnlockDateVar > block.timestamp) {
                // Calculate the "time-weight" of previously locked shares
                // Formula: (shares still locked) * (time remaining)
                // This represents the total "share-seconds" still locked
                vars.previouslyLockedTime =
                    (vars.totalLockedShares - vars.sharesToLock) * (vars.fullProfitUnlockDateVar - block.timestamp);
            }

            // Calculate new unlocking period as weighted average:
            // - Previously locked shares: weighted by their remaining time
            // - Newly locked shares: weighted by profitMaxUnlockTime
            // This ensures smooth unlocking across multiple reports
            vars.newProfitLockingPeriod =
                (vars.previouslyLockedTime + vars.sharesToLock * vars.profitMaxUnlockTimeVar) / vars.totalLockedShares;

            // Calculate per-second unlock rate
            // Uses MAX_BPS_EXTENDED (1e12) for high precision
            _profitUnlockingRate = (vars.totalLockedShares * MAX_BPS_EXTENDED) / vars.newProfitLockingPeriod;

            // Set the timestamp when all shares will be fully unlocked
            _fullProfitUnlockDate = block.timestamp + vars.newProfitLockingPeriod;

            // Record when this unlocking started
            _lastProfitUpdate = block.timestamp;
        } else {
            // No shares locked - reset unlocking state
            // Setting fullProfitUnlockDate to 0 indicates no active unlocking
            // No need to reset profitUnlockingRate as it won't be used
            _fullProfitUnlockDate = 0;
        }

        // ============================================
        // STEP 11: Finalize Report
        // ============================================

        // Update strategy's last report timestamp
        _strategies[strategy_].lastReport = block.timestamp;

        // We have to recalculate the fees paid for cases with an overall loss or no profit locking
        if (vars.loss + vars.totalFees > vars.gain + vars.totalRefunds || vars.profitMaxUnlockTimeVar == 0) {
            vars.totalFees = _convertToAssets(vars.totalFeesShares, Rounding.ROUND_DOWN);
        }

        emit StrategyReported(
            strategy_,
            vars.gain,
            vars.loss,
            vars.currentDebt,
            (vars.totalFees * uint256(vars.protocolFeeBps)) / MAX_BPS, // Protocol Fees
            vars.totalFees,
            vars.totalRefunds
        );

        return (vars.gain, vars.loss);
    }

    /**
     * @notice Emergency function to purchase bad debt from a strategy
     * @dev EMERGENCY USE ONLY: Alternative to force revoking to avoid reporting losses
     *
     *      MECHANISM:
     *      - Transfers assets from caller to vault
     *      - Transfers proportional strategy shares from vault to caller
     *      - Reduces strategy debt and converts to idle assets
     *
     *      USE CASES:
     *      - Strategy is underwater but shares still have value
     *      - Governance wants to absorb loss without affecting vault PPS
     *      - Allows time to recover or liquidate strategy position separately
     *
     *      WARNINGS:
     *      - Does not rely on strategy's conversion rates (assumes issues)
     *      - Caller receives strategy shares at recorded debt ratio
     *      - Caller assumes all risk of strategy position
     *
     * @param strategy_ Address of the strategy to buy debt from (must be active)
     * @param amount_ Amount of debt to purchase (capped at current debt)
     * @custom:security Only callable by DEBT_PURCHASER role
     * @custom:security Reentrancy protected
     */
    function buy_debt(address strategy_, uint256 amount_) external override nonReentrant {
        _enforceRole(msg.sender, Roles.DEBT_PURCHASER);
        require(_strategies[strategy_].activation != 0, InactiveStrategy());

        // Cache the current debt.
        uint256 currentDebt = _strategies[strategy_].currentDebt;
        uint256 _amount = amount_;

        require(currentDebt > 0, NothingToBuy());
        require(_amount > 0, NothingToBuyWith());

        if (_amount > currentDebt) {
            _amount = currentDebt;
        }

        // We get the proportion of the debt that is being bought and
        // transfer the equivalent shares. We assume this is being used
        // due to strategy issues so won't rely on its conversion rates.
        uint256 shares = (IERC4626Payable(strategy_).balanceOf(address(this)) * _amount) / currentDebt;

        require(shares > 0, CannotBuyZero());

        _safeTransferFrom(asset, msg.sender, address(this), _amount);

        // Lower strategy debt
        uint256 newDebt = currentDebt - _amount;
        _strategies[strategy_].currentDebt = newDebt;

        _totalDebt -= _amount;
        _totalIdle += _amount;

        // log debt change
        emit DebtUpdated(strategy_, currentDebt, newDebt);

        // Transfer the strategies shares out.
        _safeTransfer(strategy_, msg.sender, shares);

        emit DebtPurchased(strategy_, _amount);
    }

    // ============================================
    // STRATEGY MANAGEMENT
    // ============================================

    /**
     * @notice Adds a new strategy to the vault
     * @dev Validates strategy compatibility and initializes tracking
     *      Strategy MUST be ERC4626-compliant with matching asset
     *
     *      REQUIREMENTS:
     *      - Strategy address cannot be zero or vault address
     *      - Strategy asset must match vault asset
     *      - Strategy cannot already be active
     *
     *      INITIALIZATION:
     *      - Sets activation timestamp to current block
     *      - Initializes currentDebt and maxDebt to 0
     *      - Optionally adds to default queue if space available (max 10)
     *
     * @param newStrategy_ Address of the ERC4626 strategy to add
     * @param addToQueue_ If true, adds to default queue (if queue has space)
     * @custom:security Only callable by ADD_STRATEGY_MANAGER role
     */
    function add_strategy(address newStrategy_, bool addToQueue_) public override {
        _enforceRole(msg.sender, Roles.ADD_STRATEGY_MANAGER);
        _addStrategy(newStrategy_, addToQueue_);
    }

    /**
     * @notice Revokes a strategy (soft revoke)
     * @dev Removes strategy from vault. REQUIRES strategy to have zero debt
     *      Use updateDebt() to withdraw all funds before revoking
     *      Strategy is removed from default queue if present
     *      Strategy can be re-added later if needed
     *
     * @param strategy_ Address of the strategy to revoke (must have currentDebt = 0)
     * @custom:security Only callable by REVOKE_STRATEGY_MANAGER role
     */
    function revoke_strategy(address strategy_) external override {
        _enforceRole(msg.sender, Roles.REVOKE_STRATEGY_MANAGER);
        _revokeStrategy(strategy_, false);
    }

    /**
     * @notice Force revokes a strategy and realizes any outstanding debt as loss
     * @dev DANGEROUS OPERATION: Immediately writes off all strategy debt as vault loss
     *
     *      WARNING: Use as last resort only!
     *      - Reduces totalDebt by strategy's currentDebt
     *      - Does NOT attempt to withdraw funds
     *      - Loss affects all vault shareholders
     *      - Strategy is permanently removed from vault
     *
     *      BEFORE USING:
     *      1. Try updateDebt() to withdraw all possible funds
     *      2. Consider buyDebt() if strategy shares have value
     *      3. Only force revoke if strategy is completely unrecoverable
     *
     *      RECOVERY:
     *      - If removed erroneously, strategy can be re-added
     *      - Any recovered funds will be credited as profit (with fees)
     *
     * @param strategy_ Address of the strategy to force revoke
     * @custom:security Only callable by FORCE_REVOKE_MANAGER role
     * @custom:security Realizes immediate loss for all shareholders
     */
    function force_revoke_strategy(address strategy_) external override {
        _enforceRole(msg.sender, Roles.FORCE_REVOKE_MANAGER);
        _revokeStrategy(strategy_, true);
    }

    /**
     * @notice Sets the maximum debt allowed for a strategy
     * @dev Controls how much of vault's assets can be allocated to this strategy
     *      updateDebt() will respect this cap when allocating funds
     *      Set to 0 to prevent new allocations (existing debt remains)
     *
     * @param strategy_ Address of the strategy (must be active)
     * @param newMaxDebt_ Maximum debt (0 = no new allocations)
     * @custom:security Only callable by MAX_DEBT_MANAGER role
     */
    function update_max_debt_for_strategy(address strategy_, uint256 newMaxDebt_) external override {
        _enforceRole(msg.sender, Roles.MAX_DEBT_MANAGER);
        require(_strategies[strategy_].activation != 0, InactiveStrategy());
        _strategies[strategy_].maxDebt = newMaxDebt_;

        emit UpdatedMaxDebtForStrategy(msg.sender, strategy_, newMaxDebt_);
    }

    // ============================================
    // DEBT MANAGEMENT
    // ============================================

    /**
     * @notice Rebalances the debt allocation for a strategy
     * @dev Moves funds between vault and strategy to reach target debt level
     *
     *      OPERATIONS:
     *      - If targetDebt_ > currentDebt: Deposits idle assets to strategy
     *      - If targetDebt_ < currentDebt: Withdraws assets from strategy
     *      - Respects strategy's maxDebt limit
     *      - Maintains vault's minimumTotalIdle if configured
     *
     *      SPECIAL VALUES:
     *      - targetDebt_ = type(uint256).max: Deposit all available idle (up to maxDebt)
     *      - targetDebt_ = 0: Withdraw all assets from strategy
     *
     *      LOSS HANDLING:
     *      - maxLoss_ parameter caps acceptable loss in basis points (0-10000)
     *      - Reverts if realized loss exceeds maxLoss_
     *      - Common values: 0 (no loss), 100 (1%), 10000 (100% - accept any loss)
     *
     * @param strategy_ Address of the strategy to rebalance (must be active)
     * @param targetDebt_ Target debt (or type(uint256).max for max allocation)
     * @param maxLoss_ Maximum acceptable loss in basis points (0-10000, where 10000 = 100%)
     * @return newDebt The new current debt after rebalancing
     * @custom:security Only callable by DEBT_MANAGER role
     * @custom:security Reentrancy protected
     */
    function update_debt(
        address strategy_,
        uint256 targetDebt_,
        uint256 maxLoss_
    )
        external
        override
        nonReentrant
        returns (uint256)
    {
        _enforceRole(msg.sender, Roles.DEBT_MANAGER);
        return _updateDebt(strategy_, targetDebt_, maxLoss_);
    }

    function _updateDebt(address strategy_, uint256 targetDebt_, uint256 maxLoss_) internal returns (uint256) {
        // Store the old debt before calling library
        uint256 oldDebt = _strategies[strategy_].currentDebt;

        // Call the library to handle all debt management logic
        DebtManagementLib.UpdateDebtResult memory result = DebtManagementLib.updateDebt(
            _strategies, _totalIdle, _totalDebt, strategy_, targetDebt_, maxLoss_, minimumTotalIdle, asset, _shutdown
        );

        // Update vault storage with results from library
        _totalIdle = result.newTotalIdle;
        _totalDebt = result.newTotalDebt;

        // Emit debt updated event
        emit DebtUpdated(strategy_, oldDebt, result.newDebt);

        return result.newDebt;
    }

    // ============================================
    // EMERGENCY MANAGEMENT
    // ============================================

    /**
     * @notice Permanently shuts down the vault
     * @dev IRREVERSIBLE OPERATION - cannot be undone
     *
     *      EFFECTS:
     *      - Sets _shutdown = true permanently
     *      - Disables all deposits (depositLimit = 0)
     *      - Clears depositLimitModule
     *      - Grants DEBT_MANAGER role to caller for emergency withdrawals
     *      - Withdrawals remain available
     *
     *      USE CASES:
     *      - Critical vulnerability discovered
     *      - Strategy failures requiring user protection
     *      - Planned vault migration/deprecation
     *
     *      POST-SHUTDOWN:
     *      - Users can withdraw funds
     *      - No new deposits accepted
     *      - Debt manager can rebalance strategies
     *      - Vault continues operating in withdrawal-only mode
     *
     * @custom:security Only callable by EMERGENCY_MANAGER role
     * @custom:security IRREVERSIBLE - use with extreme caution
     */
    function shutdown_vault() external override {
        _enforceRole(msg.sender, Roles.EMERGENCY_MANAGER);
        require(_shutdown == false, AlreadyShutdown());

        // Shutdown the vault.
        _shutdown = true;

        // Set deposit limit to 0.
        if (depositLimitModule != address(0)) {
            depositLimitModule = address(0);
            emit UpdateDepositLimitModule(address(0));
        }

        depositLimit = 0;
        emit UpdateDepositLimit(0);

        // Add debt manager role to the sender
        roles[msg.sender] = roles[msg.sender] | (1 << uint256(Roles.DEBT_MANAGER));
        emit RoleSet(msg.sender, roles[msg.sender]);

        emit Shutdown();
    }

    // ============================================
    // SHARE MANAGEMENT - ERC4626 DEPOSIT/WITHDRAW
    // ============================================

    /**
     * @notice Deposits assets into the vault and mints shares to receiver
     * @dev ERC4626-compliant deposit function. Converts assets to shares using current PPS
     *
     *      CONVERSION:
     *      - Uses ROUND_DOWN when calculating shares (favors vault)
     *      - shares = (assets * totalSupply) / totalAssets
     *      - First deposit: 1:1 ratio (1 asset = 1 share)
     *
     *      SPECIAL VALUES:
     *      - assets_ = type(uint256).max: Deposits caller's full asset balance
     *
     *      BEHAVIOR:
     *      - Transfers assets from msg.sender to vault
     *      - Increases totalIdle
     *      - Mints shares to receiver
     *      - If autoAllocate is true, automatically allocates to defaultQueue[0]
     *
     *      REQUIREMENTS:
     *      - Vault not shutdown
     *      - Amount > 0
     *      - Amount <= maxDeposit(receiver)
     *      - If autoAllocate, defaultQueue must not be empty
     *
     * @param assets_ Amount of assets to deposit (or type(uint256).max for full balance)
     * @param receiver_ Address to receive the minted vault shares
     * @return shares Amount of shares minted to receiver
     * @custom:security Reentrancy protected
     */
    function deposit(uint256 assets_, address receiver_) external virtual nonReentrant returns (uint256) {
        uint256 amount = assets_;
        // Deposit all if sent with max uint
        if (amount == type(uint256).max) {
            amount = IERC20(asset).balanceOf(msg.sender);
        }

        uint256 shares = _convertToShares(amount, Rounding.ROUND_DOWN);
        _deposit(receiver_, amount, shares);
        return shares;
    }

    /**
     * @notice Mints exact amount of shares by depositing required assets
     * @dev ERC4626-compliant mint function. Calculates assets needed for exact share amount
     *
     *      CONVERSION:
     *      - Uses ROUND_UP when calculating assets (favors vault)
     *      - assets = (shares * totalAssets) / totalSupply + 1
     *      - First deposit: 1:1 ratio (1 share = 1 asset)
     *
     *      BEHAVIOR:
     *      - Calculates assets required for shares amount
     *      - Transfers calculated assets from msg.sender
     *      - Mints exact shares_ amount to receiver
     *      - If autoAllocate is true, automatically allocates to defaultQueue[0]
     *
     * @param shares_ Exact amount of shares to mint
     * @param receiver_ Address to receive the minted vault shares
     * @return assets Amount of assets deposited from caller
     * @custom:security Reentrancy protected
     */
    function mint(uint256 shares_, address receiver_) external virtual nonReentrant returns (uint256) {
        uint256 assets = _convertToAssets(shares_, Rounding.ROUND_UP);
        _deposit(receiver_, assets, shares_);
        return assets;
    }

    /**
     * @notice Withdraws assets from the vault by burning owner's shares
     * @dev ERC4626-extended withdraw function with loss tolerance and custom queue
     *
     *      CONVERSION:
     *      - Uses ROUND_UP when calculating shares to burn (favors vault)
     *      - shares = (assets * totalSupply) / totalAssets + 1
     *
     *      WITHDRAWAL FLOW:
     *      1. Burns calculated shares from owner
     *      2. Pulls from idle assets first
     *      3. If insufficient idle, withdraws from strategies in queue order
     *      4. Handles unrealized losses according to maxLoss parameter
     *      5. Transfers assets to receiver
     *
     *      QUEUE BEHAVIOR:
     *      - Empty array + useDefaultQueue=false: Uses default queue
     *      - Empty array + useDefaultQueue=true: Uses default queue
     *      - Custom array + useDefaultQueue=false: Uses custom queue
     *      - Custom array + useDefaultQueue=true: Ignores custom, uses default
     *
     *      LOSS HANDLING:
     *      - maxLoss_ = 0: No loss accepted (default, reverts on any loss)
     *      - maxLoss_ = 100: Accept up to 1% loss
     *      - maxLoss_ = 10000: Accept any loss (100%)
     *      - Users receive proportional share of unrealized losses
     *
     *      ALLOWANCE:
     *      - If msg.sender != owner, requires sufficient allowance
     *      - Spends allowance (unless type(uint256).max)
     *
     * @param assets_ Amount of assets to withdraw
     * @param receiver_ Address to receive the withdrawn assets
     * @param owner_ Address whose shares will be burned
     * @param maxLoss_ Maximum acceptable loss in basis points (0-10000, default 0 = no loss)
     * @param strategiesArray_ Optional custom withdrawal queue (empty = use default)
     * @return shares Amount of shares actually burned from owner
     * @custom:security Reentrancy protected
     */
    function withdraw(
        uint256 assets_,
        address receiver_,
        address owner_,
        uint256 maxLoss_,
        address[] calldata strategiesArray_
    )
        public
        virtual
        override
        nonReentrant
        returns (uint256)
    {
        uint256 shares = _convertToShares(assets_, Rounding.ROUND_UP);
        _redeem(msg.sender, receiver_, owner_, assets_, shares, maxLoss_, strategiesArray_);
        return shares;
    }

    /**
     * @notice Redeems exact amount of shares for assets
     * @dev ERC4626-extended redeem function with loss tolerance and custom queue
     *
     *      CONVERSION:
     *      - Uses ROUND_DOWN when calculating assets (favors vault)
     *      - assets = (shares * totalAssets) / totalSupply
     *
     *      BEHAVIOR:
     *      - Burns exact shares_ amount from owner
     *      - Calculates assets to withdraw based on shares
     *      - Follows same withdrawal flow as withdraw()
     *      - May return less assets than expected if losses occur
     *
     *      DIFFERENCE FROM WITHDRAW:
     *      - withdraw(): User specifies assets, function calculates shares
     *      - redeem(): User specifies shares, function calculates assets
     *      - redeem() may return less assets than preview if losses occur
     *
     * @param shares_ Exact amount of shares to burn
     * @param receiver_ Address to receive the withdrawn assets
     * @param owner_ Address whose shares will be burned
     * @param maxLoss_ Maximum acceptable loss in basis points (0-10000, default 10000 = accept all)
     * @param strategiesArray_ Optional custom withdrawal queue (empty = use default)
     * @return assets Amount of assets actually withdrawn and sent to receiver
     * @custom:security Reentrancy protected
     */
    function redeem(
        uint256 shares_,
        address receiver_,
        address owner_,
        uint256 maxLoss_,
        address[] calldata strategiesArray_
    )
        public
        virtual
        override
        nonReentrant
        returns (uint256)
    {
        uint256 assets = _convertToAssets(shares_, Rounding.ROUND_DOWN);
        // Always return the actual amount of assets withdrawn.
        return _redeem(msg.sender, receiver_, owner_, assets, shares_, maxLoss_, strategiesArray_);
    }

    // ============================================
    // ERC20 FUNCTIONS
    // ============================================

    /**
     * @notice Approves spender to transfer shares on behalf of caller
     * @dev ERC20-compliant approve function
     * @param spender_ Address authorized to spend shares
     * @param amount_ Amount of shares to approve (type(uint256).max for unlimited)
     * @return success True (reverts on failure)
     */
    function approve(address spender_, uint256 amount_) external override returns (bool) {
        return _approve(msg.sender, spender_, amount_);
    }

    /**
     * @notice Transfers shares from caller to receiver
     * @dev ERC20-compliant transfer function
     *      Prevents transfers to vault address or zero address
     * @param receiver_ Address to receive shares (cannot be vault or zero address)
     * @param amount_ Amount of shares to transfer
     * @return success True (reverts on failure)
     */
    function transfer(address receiver_, uint256 amount_) external override returns (bool) {
        require(receiver_ != address(this) && receiver_ != address(0), InvalidReceiver());
        _transfer(msg.sender, receiver_, amount_);
        return true;
    }

    /**
     * @notice Transfers shares from sender to receiver using allowance
     * @dev ERC20-compliant transferFrom function
     *      Requires sufficient allowance from sender to caller
     *      Prevents transfers to vault address or zero address
     * @param sender_ Address to transfer shares from (requires allowance)
     * @param receiver_ Address to receive shares (cannot be vault or zero address)
     * @param amount_ Amount of shares to transfer
     * @return success True (reverts on failure)
     */
    function transferFrom(address sender_, address receiver_, uint256 amount_) external override returns (bool) {
        require(receiver_ != address(this) && receiver_ != address(0), InvalidReceiver());
        _spendAllowance(sender_, msg.sender, amount_);
        _transfer(sender_, receiver_, amount_);
        return true;
    }

    /**
     * @notice Approves spender using EIP-2612 signature (gasless approval)
     * @dev Allows approval without on-chain transaction from owner
     *      Uses EIP-712 structured data signing
     *      Increments nonce to prevent replay attacks
     * @param owner_ Address of the share owner granting approval
     * @param spender_ Address authorized to spend shares
     * @param amount_ Amount of shares to approve
     * @param deadline_ Unix timestamp after which signature expires
     * @param v_ ECDSA signature v component
     * @param r_ ECDSA signature r component
     * @param s_ ECDSA signature s component
     * @return success True (reverts if signature invalid or expired)
     * @custom:security Validates signature against owner and increments nonce
     */
    function permit(
        address owner_,
        address spender_,
        uint256 amount_,
        uint256 deadline_,
        uint8 v_,
        bytes32 r_,
        bytes32 s_
    )
        external
        override
        returns (bool)
    {
        return _permit(owner_, spender_, amount_, deadline_, v_, r_, s_);
    }

    // ============================================
    // VIEW FUNCTIONS - ERC20
    // ============================================

    /**
     * @notice Returns the share balance of an account
     * @dev For vault address, excludes shares that have unlocked from profit locking
     *      For all other addresses, returns full balance
     * @param addr_ Address to query balance for
     * @return balance Share balance,  typically 18 decimals)
     */
    function balanceOf(address addr_) public view override returns (uint256) {
        if (addr_ == address(this)) {
            // If the address is the vault, account for locked shares.
            return _balanceOf[addr_] - _unlockedShares();
        }

        return _balanceOf[addr_];
    }

    /**
     * @notice Returns the circulating supply of vault shares
     * @dev Excludes locked shares that haven't unlocked yet
     *      Formula: _totalSupplyValue - _unlockedShares()
     * @return supply Total circulating shares
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply();
    }

    // ============================================
    // VIEW FUNCTIONS - ERC4626
    // ============================================

    /**
     * @notice Returns total assets under management
     * @dev Formula: totalIdle + totalDebt
     *      Includes both idle assets and assets deployed to strategies
     * @return assets Total assets
     * @custom:invariant totalAssets = totalIdle + totalDebt
     */
    function totalAssets() external view override returns (uint256) {
        return _totalAssets();
    }

    /**
     * @notice Returns amount of assets held idle in the vault
     * @dev Assets available for immediate withdrawal without touching strategies
     * @return idle Idle assets
     */
    function totalIdle() external view override returns (uint256) {
        return _totalIdle;
    }

    /**
     * @notice Returns total assets deployed across all strategies
     * @dev Sum of currentDebt for all active strategies
     * @return debt Total debt
     */
    function totalDebt() external view override returns (uint256) {
        return _totalDebt;
    }

    /**
     * @notice Converts asset amount to equivalent shares
     * @dev Uses ROUND_DOWN (favors vault)
     *      Formula: (assets * totalSupply) / totalAssets
     * @param assets_ Amount of assets to convert
     * @return shares Equivalent amount of shares
     */
    function convertToShares(uint256 assets_) external view override returns (uint256) {
        return _convertToShares(assets_, Rounding.ROUND_DOWN);
    }

    /**
     * @notice Previews shares that would be minted for a deposit
     * @dev Identical to convertToShares() for this implementation
     * @param assets_ Amount of assets to deposit
     * @return shares Amount of shares that would be minted
     */
    function previewDeposit(uint256 assets_) external view override returns (uint256) {
        return _convertToShares(assets_, Rounding.ROUND_DOWN);
    }

    /**
     * @notice Previews assets required to mint exact share amount
     * @dev Uses ROUND_UP (favors vault)
     * @param shares_ Amount of shares to mint
     * @return assets Amount of assets required
     */
    function previewMint(uint256 shares_) external view override returns (uint256) {
        return _convertToAssets(shares_, Rounding.ROUND_UP);
    }

    /**
     * @notice Converts share amount to equivalent assets
     * @dev Uses ROUND_DOWN (favors vault)
     *      Formula: (shares * totalAssets) / totalSupply
     * @param shares_ Amount of shares to convert
     * @return assets Equivalent amount of assets
     */
    function convertToAssets(uint256 shares_) external view override returns (uint256) {
        return _convertToAssets(shares_, Rounding.ROUND_DOWN);
    }

    /**
     * @notice Returns the default withdrawal queue
     * @dev Same as getDefaultQueue()
     * @return queue Array of strategy addresses in withdrawal priority order
     */
    function defaultQueue() external view override returns (address[] memory) {
        return _defaultQueue;
    }

    /**
     * @notice Returns maximum assets that can be deposited for a receiver
     * @dev Checks against depositLimit or depositLimitModule (if set)
     *      Returns 0 if receiver is vault address or zero address
     * @param receiver_ Address that would receive the shares
     * @return max Maximum deposit amount (0 if deposits disabled)
     */
    function maxDeposit(address receiver_) external view override returns (uint256) {
        return _maxDeposit(receiver_);
    }

    /**
     * @notice Returns maximum shares that can be minted for a receiver
     * @dev Converts maxDeposit to shares using current PPS
     * @param receiver_ Address that would receive the shares
     * @return max Maximum mint amount (0 if deposits disabled)
     */
    function maxMint(address receiver_) external view override returns (uint256) {
        uint256 maxDepositAmount = _maxDeposit(receiver_);
        return _convertToShares(maxDepositAmount, Rounding.ROUND_DOWN);
    }

    /**
     * @notice Returns maximum assets that owner can withdraw
     * @dev ERC4626-extended with custom loss tolerance and withdrawal queue
     *
     *      CALCULATION:
     *      1. Calculates owner's share value in assets
     *      2. Checks idle assets availability
     *      3. Simulates withdrawal through strategy queue
     *      4. Accounts for unrealized losses per maxLoss tolerance
     *      5. Checks withdrawLimitModule if set
     *
     *      WARNING: Incorrect queue ordering may return inaccurate values
     *      Use default queue or ensure custom queue is properly ordered
     *
     * @param owner_ Address that owns the shares
     * @param maxLoss_ Maximum acceptable loss in basis points (0-10000)
     * @param strategiesArray_ Custom withdrawal queue (empty = use default)
     * @return max Maximum withdrawable assets
     */
    function maxWithdraw(
        address owner_,
        uint256 maxLoss_,
        address[] memory strategiesArray_
    )
        external
        view
        virtual
        override
        returns (uint256)
    {
        return _max_withdraw(owner_, maxLoss_, strategiesArray_);
    }

    /**
     * @notice Returns maximum shares that owner can redeem
     * @dev ERC4626-extended with custom loss tolerance and withdrawal queue
     *      Returns minimum of:
     *      - Shares equivalent of maxWithdraw
     *      - Owner's full share balance
     *
     *      WARNING: Incorrect queue ordering may return inaccurate values
     *
     * @param owner_ Address that owns the shares
     * @param maxLoss_ Maximum acceptable loss in basis points (0-10000)
     * @param strategiesArray_ Custom withdrawal queue (empty = use default)
     * @return max Maximum redeemable shares
     */
    function maxRedeem(
        address owner_,
        uint256 maxLoss_,
        address[] memory strategiesArray_
    )
        external
        view
        virtual
        override
        returns (uint256)
    {
        return Math.min(
            // Min of the shares equivalent of max_withdraw or the full balance
            _convertToShares(_max_withdraw(owner_, maxLoss_, strategiesArray_), Rounding.ROUND_DOWN),
            _balanceOf[owner_]
        );
    }

    /**
     * @notice Previews shares that would be burned for an asset withdrawal
     * @dev Uses ROUND_UP (favors vault, user burns slightly more shares)
     * @param assets_ Amount of assets to withdraw
     * @return shares Amount of shares that would be burned
     */
    function previewWithdraw(uint256 assets_) external view override returns (uint256) {
        return _convertToShares(assets_, Rounding.ROUND_UP);
    }

    /**
     * @notice Previews assets that would be withdrawn for a share redemption
     * @dev Uses ROUND_DOWN (favors vault, user receives slightly less assets)
     *      Actual withdrawal may be less if losses occur
     * @param shares_ Amount of shares to redeem
     * @return assets Amount of assets that would be withdrawn
     */
    function previewRedeem(uint256 shares_) external view override returns (uint256) {
        return _convertToAssets(shares_, Rounding.ROUND_DOWN);
    }

    // ============================================
    // VIEW FUNCTIONS - VAULT METADATA
    // ============================================

    /**
     * @notice Returns the factory address that deployed this vault
     * @dev Used to query protocol fee configuration
     * @return factory Address of MultistrategyVaultFactory
     */
    function FACTORY() external view override returns (address) {
        return _factory;
    }

    /**
     * @notice Returns the API version of this vault implementation
     * @dev Based on Yearn V3 vault versioning
     * @return version API version string (e.g., "3.0.4")
     */
    function apiVersion() external pure override returns (string memory) {
        return API_VERSION;
    }

    // ============================================
    // VIEW FUNCTIONS - STRATEGY QUERIES
    // ============================================

    /**
     * @notice Calculates the unrealized losses for a withdrawal from strategy
     * @dev Compares strategy's actual asset value vs recorded debt
     *      If strategy is underwater, user takes proportional share of loss
     *
     *      Formula: loss = assetsNeeded - (assetsNeeded * strategyAssets / currentDebt)
     *
     * @param strategy_ Address of the strategy
     * @param assetsNeeded_ Amount of assets to withdraw from strategy
     * @return loss User's share of unrealized losses
     */
    function assess_share_of_unrealised_losses(address strategy_, uint256 assetsNeeded_) external view returns (uint256) {
        uint256 currentDebt = _strategies[strategy_].currentDebt;
        require(currentDebt >= assetsNeeded_, NotEnoughDebt());

        return _assess_share_of_unrealised_losses(strategy_, currentDebt, assetsNeeded_);
    }

    // ============================================
    // VIEW FUNCTIONS - PROFIT LOCKING
    // ============================================

    /**
     * @notice Returns the configured profit unlocking duration
     * @dev Time period over which new profits are gradually released
     * @return duration Unlock duration in seconds (0-31556952, max 1 year)
     */
    function profitMaxUnlockTime() external view override returns (uint256) {
        return _profitMaxUnlockTime;
    }

    /**
     * @notice Returns when all currently locked profits will be fully unlocked
     * @dev Unix timestamp. Returns 0 if no profits are locked
     * @return timestamp Unix timestamp in seconds (0 = no active unlocking)
     */
    function fullProfitUnlockDate() external view override returns (uint256) {
        return _fullProfitUnlockDate;
    }

    /**
     * @notice Returns the per-second profit unlock rate
     * @dev Denominated in MAX_BPS_EXTENDED precision (1e12)
     *      Rate = (totalLockedShares * MAX_BPS_EXTENDED) / unlockPeriod
     * @return rate Shares unlocked per second (in 1e12 precision)
     */
    function profitUnlockingRate() external view override returns (uint256) {
        return _profitUnlockingRate;
    }

    /**
     * @notice Returns when profit unlocking was last updated
     * @dev Updated whenever shares are locked (during processReport)
     * @return timestamp Unix timestamp in seconds
     */
    function lastProfitUpdate() external view override returns (uint256) {
        return _lastProfitUpdate;
    }

    /**
     * @notice Assess the share of unrealised losses that a strategy has.
     * @param strategy The address of the strategy.
     * @param currentDebt The current debt of the strategy
     * @param assetsNeeded The amount of assets needed to be withdrawn
     * @return The share of unrealised losses that the strategy has
     */
    function assess_share_of_unrealised_losses(
        address strategy,
        uint256 currentDebt,
        uint256 assetsNeeded
    )
        external
        view
        returns (uint256)
    {
        require(currentDebt >= assetsNeeded, NotEnoughDebt());
        return _assess_share_of_unrealised_losses(strategy, currentDebt, assetsNeeded);
    }

    /**
     * @dev Builds the EIP-712 domain separator.
     */
    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPE_HASH, keccak256(bytes(name)), keccak256(bytes(API_VERSION)), block.chainid, address(this)
            )
        );
    }

    /**
     * @notice Get the domain separator for EIP-712.
     * @dev Returns cached separator if chain ID unchanged.
     *      Rebuilds on chain fork to prevent cross-chain replay.
     * @return The domain separator.
     */
    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        if (block.chainid == _cachedChainId) {
            return _cachedDomainSeparator;
        }
        return _buildDomainSeparator();
    }

    /**
     * @notice Returns the parameters for a specific strategy
     * @dev Returns full StrategyParams struct including activation, lastReport, currentDebt, maxDebt
     * @param strategy_ Address of the strategy to query
     * @return params Strategy parameters struct
     */
    function strategies(address strategy_) external view returns (StrategyParams memory) {
        return _strategies[strategy_];
    }

    // ============================================
    // INTERNAL FUNCTIONS - ERC20
    // ============================================

    /**
     * @dev Spends allowance from owner to spender
     * @param owner_ Owner of the shares
     * @param spender_ Address spending the shares
     * @param amount_ Amount of allowance to spend
     */
    function _spendAllowance(address owner_, address spender_, uint256 amount_) internal {
        // Unlimited approval does nothing (saves an SSTORE)
        uint256 currentAllowance = allowance[owner_][spender_];
        if (currentAllowance < type(uint256).max) {
            require(currentAllowance >= amount_, InsufficientAllowance());
            _approve(owner_, spender_, currentAllowance - amount_);
        }
    }

    /**
     * @dev Transfers shares from sender to receiver
     * @param sender_ Address sending shares
     * @param receiver_ Address receiving shares
     * @param amount_ Amount of shares to transfer
     */
    function _transfer(address sender_, address receiver_, uint256 amount_) internal virtual {
        uint256 senderBalance = _balanceOf[sender_];
        require(senderBalance >= amount_, InsufficientFunds());
        _balanceOf[sender_] = senderBalance - amount_;
        _balanceOf[receiver_] += amount_;
        emit Transfer(sender_, receiver_, amount_);
    }

    /**
     * @dev Sets approval of spender for owner's shares
     * @param owner_ Owner granting approval
     * @param spender_ Address being approved
     * @param amount_ Amount of shares approved
     * @return success True on success
     */
    function _approve(address owner_, address spender_, uint256 amount_) internal returns (bool) {
        allowance[owner_][spender_] = amount_;
        emit Approval(owner_, spender_, amount_);
        return true;
    }

    /**
     * @dev Implementation of the permit function (EIP-2612)
     * @param owner_ Owner granting approval
     * @param spender_ Address being approved
     * @param amount_ Amount of shares approved
     * @param deadline_ Expiration timestamp
     * @param v_ Signature v component
     * @param r_ Signature r component
     * @param s_ Signature s component
     * @return success True on success
     */
    function _permit(
        address owner_,
        address spender_,
        uint256 amount_,
        uint256 deadline_,
        uint8 v_,
        bytes32 r_,
        bytes32 s_
    )
        internal
        returns (bool)
    {
        require(owner_ != address(0), InvalidOwner());
        require(deadline_ >= block.timestamp, PermitExpired());
        uint256 nonce = nonces[owner_];
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                keccak256(abi.encode(PERMIT_TYPE_HASH, owner_, spender_, amount_, nonce, deadline_))
            )
        );
        (address recoveredAddress,) = ECDSA.tryRecover(digest, v_, r_, s_);
        require(recoveredAddress == owner_, InvalidSignature());

        allowance[owner_][spender_] = amount_;
        nonces[owner_] = nonce + 1;
        emit Approval(owner_, spender_, amount_);
        return true;
    }

    /**
     * @dev Burns shares from an account
     * @param shares_ Amount of shares to burn
     * @param owner_ Address to burn shares from
     */
    function _burnShares(uint256 shares_, address owner_) internal {
        _balanceOf[owner_] -= shares_;
        _totalSupplyValue -= shares_;
        emit Transfer(owner_, address(0), shares_);
    }

    /**
     * @dev Calculates amount of profit shares that have unlocked since last update
     * @return unlockedSharesAmount Amount of shares unlocked
     */
    function _unlockedShares() internal view returns (uint256) {
        uint256 fullProfitUnlockDateVar = _fullProfitUnlockDate;
        uint256 unlockedSharesAmount = 0;

        if (fullProfitUnlockDateVar > block.timestamp) {
            // If we have not fully unlocked, we need to calculate how much has been.
            unlockedSharesAmount = (_profitUnlockingRate * (block.timestamp - _lastProfitUpdate)) / MAX_BPS_EXTENDED;
        } else if (fullProfitUnlockDateVar != 0) {
            // All shares have been unlocked
            unlockedSharesAmount = _balanceOf[address(this)];
        }

        return unlockedSharesAmount;
    }

    /**
     * @dev Returns circulating supply excluding locked shares
     * @return supply Total supply minus unlocked shares
     */
    function _totalSupply() internal view returns (uint256) {
        // Need to account for the shares issued to the vault that have unlocked.
        return _totalSupplyValue - _unlockedShares();
    }

    /**
     * @dev Returns total assets under management
     * @return assets Sum of idle and debt
     */
    function _totalAssets() internal view returns (uint256) {
        return _totalIdle + _totalDebt;
    }

    /**
     * @dev Converts shares to assets with rounding control
     * @param shares_ Amount of shares to convert
     * @param rounding_ Rounding direction (ROUND_UP or ROUND_DOWN)
     * @return assets Equivalent amount of assets
     */
    function _convertToAssets(uint256 shares_, Rounding rounding_) internal view returns (uint256) {
        if (shares_ == type(uint256).max || shares_ == 0) {
            return shares_;
        }

        uint256 supply = _totalSupply();
        // if totalSupply is 0, price_per_share is 1
        if (supply == 0) {
            return shares_;
        }

        uint256 numerator = shares_ * _totalAssets();
        uint256 amount = numerator / supply;
        // slither-disable-next-line weak-prng
        if (rounding_ == Rounding.ROUND_UP && numerator % supply != 0) {
            amount += 1;
        }

        return amount;
    }

    /**
     * @dev Converts assets to shares with rounding control
     * @param assets_ Amount of assets to convert
     * @param rounding_ Rounding direction (ROUND_UP or ROUND_DOWN)
     * @return shares Equivalent amount of shares
     */
    function _convertToShares(uint256 assets_, Rounding rounding_) internal view returns (uint256) {
        if (assets_ == type(uint256).max || assets_ == 0) {
            return assets_;
        }

        uint256 supply = _totalSupply();

        // if total_supply is 0, price_per_share is 1
        if (supply == 0) {
            return assets_;
        }

        uint256 totalAssetsAmount = _totalAssets();

        // if totalSupply > 0 but totalAssets == 0, price_per_share = 0
        if (totalAssetsAmount == 0) {
            return 0;
        }

        uint256 numerator = assets_ * supply;
        uint256 sharesAmount = numerator / totalAssetsAmount;
        // slither-disable-next-line weak-prng
        if (rounding_ == Rounding.ROUND_UP && numerator % totalAssetsAmount != 0) {
            sharesAmount += 1;
        }

        return sharesAmount;
    }

    /**
     * @dev Mints shares to a recipient
     * @param shares_ Amount of shares to mint
     * @param recipient_ Address to receive shares
     */
    function _issueShares(uint256 shares_, address recipient_) internal {
        _balanceOf[recipient_] += shares_;
        _totalSupplyValue += shares_;
        emit Transfer(address(0), recipient_, shares_);
    }

    // ============================================
    // INTERNAL FUNCTIONS - ERC4626
    // ============================================

    /**
     * @dev Calculates maximum deposit possible for a receiver
     * @param receiver_ Address that would receive shares
     * @return max Maximum deposit amount
     */
    function _maxDeposit(address receiver_) internal view returns (uint256) {
        if (receiver_ == address(0) || receiver_ == address(this)) {
            return 0;
        }

        // If there is a deposit limit module set use that.
        address _depositLimitModule = depositLimitModule;

        if (_depositLimitModule != address(0)) {
            return IDepositLimitModule(_depositLimitModule).availableDepositLimit(receiver_);
        }

        // Else use the standard flow.
        uint256 _depositLimit = depositLimit;
        if (_depositLimit == type(uint256).max) {
            return _depositLimit;
        }

        uint256 _totalAssetsAmount = _totalAssets();
        if (_totalAssetsAmount >= _depositLimit) {
            return 0;
        }

        return _depositLimit - _totalAssetsAmount;
    }

    /**
     * @dev Calculates maximum withdrawal possible for an owner
     * @param owner_ Address that owns shares
     * @param maxLoss_ Maximum acceptable loss in basis points
     * @param strategiesParam_ Custom withdrawal queue
     * @return max Maximum withdrawable assets
     */
    function _max_withdraw(
        address owner_,
        uint256 maxLoss_,
        address[] memory strategiesParam_
    )
        internal
        view
        returns (uint256)
    {
        // slither-disable-next-line uninitialized-local
        MaxWithdrawVars memory vars;

        // Get the max amount for the owner if fully liquid
        vars.maxAssets = _convertToAssets(_balanceOf[owner_], Rounding.ROUND_DOWN);

        // If there is a withdraw limit module use that
        address _withdrawLimitModule = withdrawLimitModule;
        if (_withdrawLimitModule != address(0)) {
            return Math.min(
                IWithdrawLimitModule(_withdrawLimitModule).availableWithdrawLimit(owner_, maxLoss_, strategiesParam_),
                vars.maxAssets
            );
        }

        // See if we have enough idle to service the withdraw
        vars.currentIdle = _totalIdle;
        if (vars.maxAssets > vars.currentIdle) {
            // Track how much we can pull
            vars.have = vars.currentIdle;
            vars.loss = 0;

            // Determine which strategy queue to use
            vars.withdrawalStrategies = strategiesParam_.length != 0 && !useDefaultQueue ? strategiesParam_ : _defaultQueue;

            // Process each strategy in the queue
            for (uint256 i = 0; i < vars.withdrawalStrategies.length; i++) {
                address strategy = vars.withdrawalStrategies[i];
                require(_strategies[strategy].activation != 0, InactiveStrategy());

                uint256 currentDebt = _strategies[strategy].currentDebt;
                // Get the maximum amount the vault would withdraw from the strategy
                uint256 toWithdraw = Math.min(vars.maxAssets - vars.have, currentDebt);

                // Get any unrealized loss for the strategy
                uint256 unrealizedLoss = _assess_share_of_unrealised_losses(strategy, currentDebt, toWithdraw);

                // See if any limit is enforced by the strategy
                uint256 strategyLimit =
                    IERC4626Payable(strategy).convertToAssets(IERC4626Payable(strategy).maxRedeem(address(this)));

                // Adjust accordingly if there is a max withdraw limit
                uint256 realizableWithdraw = toWithdraw - unrealizedLoss;
                if (strategyLimit < realizableWithdraw) {
                    if (unrealizedLoss != 0) {
                        // Lower unrealized loss proportional to the limit
                        unrealizedLoss = (unrealizedLoss * strategyLimit) / realizableWithdraw;
                    }
                    // Still count the unrealized loss as withdrawable
                    toWithdraw = strategyLimit + unrealizedLoss;
                }

                // If 0 move on to the next strategy
                if (toWithdraw == 0) {
                    continue;
                }

                // If there would be a loss with a non-maximum `maxLoss` value
                if (unrealizedLoss > 0 && maxLoss_ < MAX_BPS) {
                    // Check if the loss is greater than the allowed range
                    if (vars.loss + unrealizedLoss > ((vars.have + toWithdraw) * maxLoss_) / MAX_BPS) {
                        // If so use the amounts up till now
                        break;
                    }
                }

                // Add to what we can pull
                vars.have += toWithdraw;

                // If we have all we need break
                if (vars.have >= vars.maxAssets) {
                    break;
                }

                // Add any unrealized loss to the total
                vars.loss += unrealizedLoss;
            }

            // Update the max after going through the queue
            vars.maxAssets = vars.have;
        }

        return vars.maxAssets;
    }

    /**
     * @dev Handles deposit logic with idle tracking and auto-allocation
     * @param recipient_ Address to receive shares
     * @param assets_ Amount of assets to deposit
     * @param shares_ Amount of shares to mint
     */
    function _deposit(address recipient_, uint256 assets_, uint256 shares_) internal {
        require(assets_ <= _maxDeposit(recipient_), ExceedDepositLimit());
        require(assets_ > 0, CannotDepositZero());
        require(shares_ > 0, CannotMintZero());

        // Transfer the tokens to the vault first.
        _safeTransferFrom(asset, msg.sender, address(this), assets_);

        // Record the change in total assets.
        _totalIdle += assets_;

        // Issue the corresponding shares for assets.
        _issueShares(shares_, recipient_);

        emit Deposit(msg.sender, recipient_, assets_, shares_);

        // cache the default queue length
        uint256 defaultQueueLength = _defaultQueue.length;

        if (autoAllocate && defaultQueueLength > 0) {
            _updateDebt(_defaultQueue[0], type(uint256).max, 0);
        }
    }

    /**
     * @dev Calculates user's share of unrealized losses from a strategy
     * @param strategy_ Strategy address
     * @param strategyCurrentDebt_ Strategy's recorded debt
     * @param assetsNeeded_ Amount to withdraw
     * @return loss User's proportional share of losses
     */
    function _assess_share_of_unrealised_losses(
        address strategy_,
        uint256 strategyCurrentDebt_,
        uint256 assetsNeeded_
    )
        internal
        view
        returns (uint256)
    {
        // The actual amount that the debt is currently worth.
        uint256 vaultShares = IERC4626Payable(strategy_).balanceOf(address(this));
        uint256 strategyAssets = IERC4626Payable(strategy_).convertToAssets(vaultShares);

        // If no losses, return 0
        if (strategyAssets >= strategyCurrentDebt_ || strategyCurrentDebt_ == 0) {
            return 0;
        }

        // Users will withdraw assetsNeeded divided by loss ratio (strategyAssets / strategyCurrentDebt - 1).
        // NOTE: If there are unrealised losses, the user will take his share.
        uint256 numerator = assetsNeeded_ * strategyAssets;
        uint256 usersShareOfLoss = assetsNeeded_ - numerator / strategyCurrentDebt_;

        return usersShareOfLoss;
    }

    // ============================================
    // INTERNAL FUNCTIONS - STRATEGY MANAGEMENT
    // ============================================

    /**
     * @dev Adds and initializes a new strategy
     * @param newStrategy_ Strategy address to add
     * @param addToQueue_ Whether to add to default queue
     */
    function _addStrategy(address newStrategy_, bool addToQueue_) internal {
        // Validate the strategy
        require(newStrategy_ != address(0) && newStrategy_ != address(this), StrategyCannotBeZeroAddress());

        // Verify the strategy asset matches the vault's asset
        require(IERC4626Payable(newStrategy_).asset() == asset, InvalidAsset());

        // Check the strategy is not already active
        require(_strategies[newStrategy_].activation == 0, StrategyAlreadyActive());

        // Add the new strategy to the mapping with initialization parameters
        _strategies[newStrategy_] =
            StrategyParams({ activation: block.timestamp, lastReport: block.timestamp, currentDebt: 0, maxDebt: 0 });

        // If requested and there's room, add to the default queue
        if (addToQueue_ && _defaultQueue.length < MAX_QUEUE) {
            _defaultQueue.push(newStrategy_);
        }

        // Emit the strategy changed event
        emit StrategyChanged(newStrategy_, StrategyChangeType.ADDED);
    }

    /**
     * @dev Handles redemption logic including strategy withdrawals
     * @param sender_ Caller initiating redemption
     * @param receiver_ Address to receive assets
     * @param owner_ Address whose shares are burned
     * @param assets_ Target amount of assets
     * @param shares_ Amount of shares to burn
     * @param maxLoss_ Maximum acceptable loss in basis points
     * @param strategiesParam_ Custom withdrawal queue
     * @return withdrawn Actual amount of assets withdrawn
     */
    function _redeem(
        address sender_,
        address receiver_,
        address owner_,
        uint256 assets_,
        uint256 shares_,
        uint256 maxLoss_,
        address[] memory strategiesParam_
    )
        internal
        returns (uint256)
    {
        require(receiver_ != address(0), ZeroAddress());
        require(shares_ > 0, NoSharesToRedeem());
        require(assets_ > 0, NoAssetsToWithdraw());
        require(maxLoss_ <= MAX_BPS, MaxLossExceeded());

        // If there is a withdraw limit module, check the max.
        address _withdrawLimitModule = withdrawLimitModule;
        if (_withdrawLimitModule != address(0)) {
            require(
                assets_
                    <= IWithdrawLimitModule(_withdrawLimitModule).availableWithdrawLimit(owner_, maxLoss_, strategiesParam_),
                ExceedWithdrawLimit()
            );
        }

        require(_balanceOf[owner_] >= shares_, InsufficientSharesToRedeem());

        if (sender_ != owner_) {
            _spendAllowance(owner_, sender_, shares_);
        }

        // Initialize our redemption state
        // slither-disable-next-line uninitialized-local
        RedeemState memory state;
        state.requestedAssets = assets_;
        state.currentTotalIdle = _totalIdle;
        state.asset = asset;
        state.currentTotalDebt = _totalDebt;

        // If there are not enough assets in the Vault contract, we try to free
        // funds from strategies.
        if (state.requestedAssets > state.currentTotalIdle) {
            // Determine which strategies to use
            if (strategiesParam_.length != 0 && !useDefaultQueue) {
                state.withdrawalStrategies = strategiesParam_;
            } else {
                state.withdrawalStrategies = _defaultQueue;
            }

            // Calculate how much we need to withdraw from strategies
            state.assetsNeeded = state.requestedAssets - state.currentTotalIdle;

            // Track the previous balance to calculate actual withdrawn amounts
            state.previousBalance = IERC20(state.asset).balanceOf(address(this));

            // Withdraw from each strategy until we have enough
            for (uint256 i = 0; i < state.withdrawalStrategies.length; i++) {
                address strategy = state.withdrawalStrategies[i];

                // Make sure we have a valid strategy
                require(_strategies[strategy].activation != 0, InactiveStrategy());

                // How much the strategy should have
                uint256 currentDebt = _strategies[strategy].currentDebt;

                // What is the max amount to withdraw from this strategy
                uint256 assetsToWithdraw = Math.min(state.assetsNeeded, currentDebt);

                // Cache max withdraw for use if unrealized loss > 0
                uint256 maxWithdrawAmount =
                    IERC4626Payable(strategy).convertToAssets(IERC4626Payable(strategy).maxRedeem(address(this)));

                // Check for unrealized losses
                uint256 unrealisedLossesShare = _assess_share_of_unrealised_losses(strategy, currentDebt, assetsToWithdraw);

                // Handle unrealized losses if any
                if (unrealisedLossesShare > 0) {
                    // If max withdraw is limiting the amount to pull, adjust the portion of
                    // unrealized loss the user should take
                    if (maxWithdrawAmount < assetsToWithdraw - unrealisedLossesShare) {
                        // How much we would want to withdraw
                        uint256 wanted = assetsToWithdraw - unrealisedLossesShare;
                        // Get the proportion of unrealized comparing what we want vs what we can get
                        unrealisedLossesShare = (unrealisedLossesShare * maxWithdrawAmount) / wanted;
                        // Adjust assetsToWithdraw so all future calculations work correctly
                        assetsToWithdraw = maxWithdrawAmount + unrealisedLossesShare;
                    }

                    // User now "needs" less assets to be unlocked (as they took some as losses)
                    assetsToWithdraw -= unrealisedLossesShare;
                    state.requestedAssets -= unrealisedLossesShare;
                    state.assetsNeeded -= unrealisedLossesShare;
                    state.currentTotalDebt -= unrealisedLossesShare;

                    // If max withdraw is 0 and unrealized loss is still > 0, the strategy
                    // likely realized a 100% loss and we need to realize it before moving on
                    if (maxWithdrawAmount == 0 && unrealisedLossesShare > 0) {
                        // Adjust the strategy debt accordingly
                        uint256 newDebt = currentDebt - unrealisedLossesShare;
                        // Update strategies storage
                        _strategies[strategy].currentDebt = newDebt;
                        // Log the debt update
                        emit DebtUpdated(strategy, currentDebt, newDebt);
                    }
                }

                // Adjust based on max withdraw of the strategy
                assetsToWithdraw = Math.min(assetsToWithdraw, maxWithdrawAmount);

                // Can't withdraw 0
                if (assetsToWithdraw == 0) {
                    continue;
                }

                // Withdraw from strategy
                // Need to get shares since we use redeem to be able to take on losses
                uint256 sharesToRedeem = Math.min(
                    // Use previewWithdraw since it should round up
                    IERC4626Payable(strategy).previewWithdraw(assetsToWithdraw),
                    // And check against our actual balance
                    IERC4626Payable(strategy).balanceOf(address(this))
                );

                IERC4626Payable(strategy).redeem(sharesToRedeem, address(this), address(this));
                uint256 postBalance = IERC20(state.asset).balanceOf(address(this));

                // Always check against the real amounts
                uint256 withdrawn = postBalance - state.previousBalance;
                uint256 loss = 0;

                // Check if we redeemed too much
                if (withdrawn > assetsToWithdraw) {
                    // Make sure we don't underflow in debt updates
                    if (withdrawn > currentDebt) {
                        // Can't withdraw more than our debt
                        assetsToWithdraw = currentDebt;
                    } else {
                        // Add the extra to how much we withdrew
                        assetsToWithdraw += (withdrawn - assetsToWithdraw);
                    }
                }
                // If we have not received what we expected, consider the difference a loss
                else if (withdrawn < assetsToWithdraw) {
                    loss = assetsToWithdraw - withdrawn;
                }

                // Strategy's debt decreases by the full amount but total idle increases
                // by the actual amount only (as the difference is considered lost)
                state.currentTotalIdle += (assetsToWithdraw - loss);
                state.requestedAssets -= loss;
                state.currentTotalDebt -= assetsToWithdraw;

                // Vault will reduce debt because the unrealized loss has been taken by user
                uint256 newDebtAmount = currentDebt - (assetsToWithdraw + unrealisedLossesShare);

                // Update strategies storage
                _strategies[strategy].currentDebt = newDebtAmount;
                // Log the debt update
                emit DebtUpdated(strategy, currentDebt, newDebtAmount);

                // Break if we have enough total idle to serve initial request
                if (state.requestedAssets <= state.currentTotalIdle) {
                    break;
                }

                // Update previous balance for next iteration
                state.previousBalance = postBalance;

                // Reduce what we still need
                state.assetsNeeded -= assetsToWithdraw;
            }

            // If we exhaust the queue and still have insufficient total idle, revert
            require(state.currentTotalIdle >= state.requestedAssets, InsufficientAssetsInVault());
        }

        // Check if there is a loss and a non-default value was set
        if (assets_ > state.requestedAssets && maxLoss_ < MAX_BPS) {
            // Assure the loss is within the allowed range
            require(assets_ - state.requestedAssets <= (assets_ * maxLoss_) / MAX_BPS, TooMuchLoss());
        }

        // First burn the corresponding shares from the redeemer
        _burnShares(shares_, owner_);

        // Commit memory to storage
        _totalIdle = state.currentTotalIdle - state.requestedAssets;
        _totalDebt = state.currentTotalDebt;

        // Transfer the requested amount to the receiver
        _safeTransfer(state.asset, receiver_, state.requestedAssets);

        emit Withdraw(sender_, receiver_, owner_, state.requestedAssets, shares_);
        return state.requestedAssets;
    }

    /**
     * @dev Revokes a strategy and handles loss accounting if forced
     * @param strategy Strategy address to revoke
     * @param force Whether to force revoke with debt
     */
    function _revokeStrategy(address strategy, bool force) internal {
        require(_strategies[strategy].activation != 0, StrategyNotActive());

        uint256 currentDebt = _strategies[strategy].currentDebt;
        uint256 lossAmount = 0;

        if (currentDebt != 0) {
            require(force, StrategyHasDebt());
            // If force is true, we realize the full loss of outstanding debt
            lossAmount = currentDebt;
        }

        // Set strategy params all back to 0 (WARNING: it can be re-added)
        _strategies[strategy] = StrategyParams({ activation: 0, lastReport: 0, currentDebt: 0, maxDebt: 0 });

        // Remove strategy from the default queue if it exists
        // Create a new dynamic array and add all strategies except the one being revoked
        address[] memory newQueue = new address[](_defaultQueue.length);
        uint256 newQueueLength = 0;
        uint256 defaultQueueLength = _defaultQueue.length;

        for (uint256 i = 0; i < defaultQueueLength; i++) {
            // Add all strategies to the new queue besides the one revoked
            if (_defaultQueue[i] != strategy) {
                newQueue[newQueueLength] = _defaultQueue[i];
                newQueueLength++;
            }
        }

        // Replace the default queue with our updated queue
        // First clear the existing queue
        while (_defaultQueue.length > 0) {
            _defaultQueue.pop();
        }

        // Then add all items from the new queue
        for (uint256 i = 0; i < newQueueLength; i++) {
            _defaultQueue.push(newQueue[i]);
        }

        // If there was a loss (force revoke with debt), update total vault debt
        if (lossAmount > 0) {
            _totalDebt -= lossAmount;
            emit StrategyReported(strategy, 0, lossAmount, 0, 0, 0, 0);
        }

        emit StrategyChanged(strategy, StrategyChangeType.REVOKED);
    }

    // ============================================
    // INTERNAL FUNCTIONS - SAFE ERC20 OPERATIONS
    // ============================================

    /**
     * @dev Safely transfers ERC20 tokens handling non-standard implementations
     * @dev Handles tokens that don't return bool (e.g., USDT)
     * @param token Token address
     * @param sender Address to transfer from
     * @param receiver Address to transfer to
     * @param amount Amount to transfer
     */
    function _safeTransferFrom(address token, address sender, address receiver, uint256 amount) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, sender, receiver, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), TransferFailed());
    }

    /**
     * @dev Safely transfers ERC20 tokens handling non-standard implementations
     * @dev Handles tokens that don't return bool (e.g., USDT)
     * @param token Token address
     * @param receiver Address to transfer to
     * @param amount Amount to transfer
     */
    function _safeTransfer(address token, address receiver, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), TransferFailed());
    }
}
