// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.18;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { TokenizedStrategy__InvalidSigner } from "@octant/errors.sol";

import { IBaseStrategy } from "@octant/core/interfaces/IBaseStrategy.sol";

/**
 * @title Tokenized Strategy (Octant V2 Fork)
 * @author yearn.finance; forked and modified by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @custom:origin https://github.com/yearn/tokenized-strategy/blob/master/src/TokenizedStrategy.sol
 * @notice This TokenizedStrategy is a fork of Yearn's TokenizedStrategy that has been
 *  modified by Octant to support donation functionality and other security enhancements.
 *
 *  The original contract can be used by anyone wishing to easily build
 *  and deploy their own custom ERC4626 compliant single strategy Vault.
 *
 *  The TokenizedStrategy contract is meant to be used as the proxy
 *  implementation contract that will handle all logic, storage and
 *  management for a custom strategy that inherits the `BaseStrategy`.
 *  Any function calls to the strategy that are not defined within that
 *  strategy will be forwarded through a delegateCall to this contract.
 *
 *  A strategist only needs to override a few simple functions that are
 *  focused entirely on the strategy specific needs to easily and cheaply
 *  deploy their own permissionless 4626 compliant vault.
 *
 *  @dev Changes from Yearn V3:
 *  - Added dragonRouter to the StrategyData struct to enable yield distribution
 *  - Added getter and setter for dragonRouter
 *  - Added validation checks for all critical addresses (management, keeper, emergencyAdmin, dragonRouter)
 *  - Enhanced initialize function to include emergencyAdmin and dragonRouter parameters
 *  - Standardized error messages for zero-address checks
 *  - Removed the yield/profit unlocking mechanism (profits are immediately realized)
 *  - Made the report() function virtual to enable specialized implementations
 *  - Made this contract abstract as a base for specialized strategy implementations
 *
 *  Two specialized implementations are provided:
 *  - YieldDonatingTokenizedStrategy: Mints profits as new shares and sends them to a specified dragon router
 *  - YieldSkimmingTokenizedStrategy: Skims the appreciation of asset and dilutes the original shares by minting new ones to
 * the dragon router
 *
 *  Trust Minimization (design goals):
 *  - No protocol performance/management fees at the strategy level; yield flows directly to the configured donation
 * destination
 *  - Dragon router changes are subject to a mandatory cooldown (see setDragonRouter/finalizeDragonRouterChange)
 *  - Clear role separation: management, keeper, emergencyAdmin; keepers focus on report/tend cadence
 *
 *  Security Model (trusted roles and expectations):
 *  - Management: updates roles, initiates dragon router changes, may shutdown in emergencies
 *  - Keeper: calls report/tend at appropriate intervals; use MEV-protected mempools when possible
 *  - Emergency Admin: can shutdown and perform emergency withdrawals
 *
 *  Threat Model Boundaries (non-exhaustive):
 *  - In scope: precision/rounding issues, price-per-share manipulation via airdrops (mitigated by tracked totalAssets),
 *    reentrancy (guarded), misuse of roles
 *  - Out of scope: malicious management/keeper/emergency admin; complete compromise of external yield sources
 *
 *  Functional Requirements mapping (high-level):
 *  - FR-1 Initialization: initialize() parameters include asset, name and roles, plus donation routing settings
 *  - FR-2 Asset management: BaseStrategy overrides (_deployFunds/_freeFunds/_harvestAndReport) power the yield logic
 *  - FR-3 Roles: requireManagement/requireKeeperOrManagement/requireEmergencyAuthorized helpers enforce permissions
 *  - FR-4 Donation management: dragon router cooldown and two-step change via setDragonRouter/finalize/cancel
 *  - FR-5 Emergency: shutdownStrategy/emergencyWithdraw hooks in specialized implementations
 *  - FR-6 ERC-4626: full ERC-4626 surface for deposits/withdrawals and previews is implemented
 *
 *  WARNING: When creating custom strategies, DO NOT declare state variables outside
 *  the StrategyData struct. Doing so risks storage collisions if the implementation
 *  contract changes. Either extend the StrategyData struct or use a custom storage slot.
 */
abstract contract TokenizedStrategy {
    using Math for uint256;
    using SafeERC20 for ERC20;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Emitted when a strategy is shutdown.
     */
    event StrategyShutdown();

    /**
     * @notice Emitted on the initialization of any new `strategy` that uses `asset`
     * with this specific `apiVersion`.
     */
    event NewTokenizedStrategy(address indexed strategy, address indexed asset, string apiVersion);

    /**
     * @notice Emitted when the strategy reports `profit` or `loss`.
     * @param profit Profit amount
     * @param loss Loss amount
     */
    event Reported(uint256 profit, uint256 loss);

    /**
     * @notice Emitted when the 'keeper' address is updated to 'newKeeper'.
     * @param newKeeper Address authorized to call report/tend
     */
    event UpdateKeeper(address indexed newKeeper);

    /**
     * @notice Emitted when the 'management' address is updated to 'newManagement'.
     * @param newManagement Address with management permissions
     */
    event UpdateManagement(address indexed newManagement);

    /**
     * @notice Emitted when the 'emergencyAdmin' address is updated to 'newEmergencyAdmin'.
     * @param newEmergencyAdmin Address authorized for emergency operations
     */
    event UpdateEmergencyAdmin(address indexed newEmergencyAdmin);

    /**
     * @notice Emitted when the `pendingManagement` address is updated.
     * @param newPendingManagement Address pending to become management
     */
    event UpdatePendingManagement(address indexed newPendingManagement);

    /**
     * @notice Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @notice Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @notice Emitted when the `caller` has exchanged `assets` for `shares`,
     * and transferred those `shares` to `owner`.
     */
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);

    /**
     * @notice Emitted when the `caller` has exchanged `owner`s `shares` for `assets`,
     * and transferred those `assets` to `receiver`.
     */
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);

    /**
     * @notice Emitted when the dragon router address is updated.
     * @param newDragonRouter Address receiving minted profit shares
     */
    event UpdateDragonRouter(address indexed newDragonRouter);

    /**
     * @notice Emitted when a pending dragon router change is initiated.
     * @param newDragonRouter Address proposed to receive profit shares
     * @param effectiveTimestamp Timestamp when change can be finalized in seconds
     */
    event PendingDragonRouterChange(address indexed newDragonRouter, uint256 effectiveTimestamp);

    /**
     * @notice Emitted when the burning mechanism is enabled or disabled.
     */
    event UpdateBurningMechanism(bool enableBurning);

    /**
     * @notice Emitted when the strategy name is updated.
     * @param newName The new name of the strategy
     */
    event UpdateName(string newName);

    /*//////////////////////////////////////////////////////////////
                        STORAGE STRUCT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Core storage struct for all strategy state
     * @dev All strategy state is stored in this single struct to enable the proxy pattern
     *      and avoid storage collisions between implementation and proxy contracts
     *
     *      CRITICAL: This struct uses a custom storage slot (BASE_STRATEGY_STORAGE) following
     *      ERC-7201 namespaced storage pattern to ensure no collisions when using delegatecall
     *      from strategies. When extending strategies, NEVER add state variables outside this
     *      struct - extend the struct or use custom slots.
     *
     *      STORAGE EFFICIENCY:
     *      - Loading the struct slot does NOT load struct contents into memory
     *      - Accessing individual fields only loads those specific storage slots
     *      - Packing is disabled for clarity (see solhint-disable comment)
     *
     *      GAS OPTIMIZATION:
     *      - Multiple variables combined to reduce storage slot loads
     *      - uint96 used for timestamps (sufficient until year 2^96/31556952 ≈ 2.5 billion years)
     *      - uint8 used for flags where range is sufficient
     */
    // prettier-ignore
    // solhint-disable gas-struct-packing, gas-small-strings
    struct StrategyData {
        // ============================================
        // ERC20 STATE
        // ============================================

        /// @notice Mapping of addresses to their permit nonces for EIP-2612 gasless approvals
        /// @dev Incremented on each permit() call to prevent replay attacks
        mapping(address => uint256) nonces;
        /// @notice Mapping of addresses to their strategy share balances
        /// @dev In share base units (typically 18 decimals, matches asset decimals)
        mapping(address => uint256) balances;
        /// @notice Nested mapping of owner to spender to approved share amounts
        /// @dev ERC20-compliant allowance tracking for transferFrom operations
        mapping(address => mapping(address => uint256)) allowances;
        // ============================================
        // ERC4626 / VAULT STATE
        // ============================================

        /// @notice The underlying ERC20 asset token
        /// @dev Must be ERC20-compliant. Set once during initialize() and never changes
        ///      Strategy deposits/withdraws this token to/from yield sources
        ERC20 asset;
        /// @notice Human-readable name of the strategy share token
        /// @dev ERC20 metadata. Set during initialize() and never changes
        string name;
        /// @notice Symbol of the strategy share token
        /// @dev ERC20 metadata. Set during initialize() and never changes
        string symbol;
        /// @notice Cached EIP-712 domain separator
        /// @dev Computed in initialize and updated when name changes
        bytes32 cachedDomainSeparator;
        /// @notice Chain ID at initialization time
        /// @dev Used to detect chain forks and trigger domain separator rebuild
        uint256 cachedChainId;
        /// @notice Total supply of strategy shares currently minted
        /// @dev In share base units. Increases on deposits, decreases on withdrawals
        ///      Includes shares held by all users AND dragon router
        uint256 totalSupply;
        /// @notice Total assets under management (idle + deployed)
        /// @dev CRITICAL: Manually tracked to prevent PPS manipulation via direct asset transfers
        ///      Updated during deposits, withdrawals, and report() calls
        ///      Formula: totalAssets = idle assets + deployed assets in yield sources
        ///      In asset base units (typically 18 decimals)
        uint256 totalAssets;
        // ============================================
        // REPORTING & KEEPER STATE
        // ============================================

        /// @notice Address authorized to call report() and tend()
        /// @dev Typically an automated keeper bot. Can be updated by management
        ///      Keeper should use MEV-protected mempools to prevent sandwich attacks during harvest
        address keeper;
        /// @notice Timestamp of the last report() call
        /// @dev uint96 saves gas (fits in same slot as keeper address)
        ///      Used to calculate time-based metrics. Unix timestamp in seconds
        uint96 lastReport;
        // ============================================
        // ACCESS CONTROL STATE
        // ============================================

        /// @notice Primary admin address with full control over strategy
        /// @dev Can update all roles, change dragon router, shutdown strategy
        ///      Transfer requires two-step process via pendingManagement
        address management;
        /// @notice Address pending to become new management
        /// @dev Set by management via setManagement(), cleared after acceptManagement()
        ///      Two-step transfer prevents accidental loss of control
        address pendingManagement;
        /// @notice Address authorized for emergency actions
        /// @dev Can shutdown strategy and perform emergency withdrawals alongside management
        ///      Provides additional security layer for rapid response to threats
        address emergencyAdmin;
        /// @notice Address that receives minted profit shares in yield donation strategies
        /// @dev OCTANT-SPECIFIC: Receives shares minted from profits in YieldDonatingTokenizedStrategy
        ///      Can only be changed via two-step process with DRAGON_ROUTER_COOLDOWN (14 days)
        address dragonRouter;
        /// @notice Address pending to become new dragon router
        /// @dev Set by setDragonRouter(), cleared after finalizeDragonRouterChange()
        ///      Subject to mandatory 14-day cooldown before finalization
        address pendingDragonRouter;
        /// @notice Timestamp when dragon router change can be finalized
        /// @dev uint96 saves gas. Unix timestamp in seconds
        ///      Must be >= current block.timestamp to call finalizeDragonRouterChange()
        ///      Set to block.timestamp + DRAGON_ROUTER_COOLDOWN (14 days) when change initiated
        uint96 dragonRouterChangeTimestamp;
        // ============================================
        // STRATEGY STATUS FLAGS
        // ============================================

        /// @notice Number of decimals for strategy shares (inherited from asset)
        /// @dev uint8 since token decimals are always 0-255. Typically 18
        ///      Set once during initialize() based on asset.decimals()
        uint8 decimals;
        /// @notice Reentrancy guard flag
        /// @dev uint8 for gas savings. Values: NOT_ENTERED (1) or ENTERED (2)
        ///      Prevents reentrancy on all state-changing functions
        uint8 entered;
        /// @notice Whether the strategy has been permanently shut down
        /// @dev When true, blocks all deposits. Withdrawals remain available
        ///      Set by shutdownStrategy(), cannot be reversed
        bool shutdown;
        // ============================================
        // OCTANT-SPECIFIC: LOSS PROTECTION STATE
        // ============================================

        /// @notice Whether to burn dragon router shares during loss protection
        /// @dev OCTANT-SPECIFIC: When true and losses occur, burns dragon shares first
        ///      If false, losses affect all shareholders proportionally
        ///      Set during initialize() and can be updated by management
        bool enableBurning;
    }

    /*//////////////////////////////////////////////////////////////
                            DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Constructor prevents direct initialization of implementation contract
     * @dev Sets asset to address(1) to make this contract unusable as a standalone strategy
     *      This contract is meant to be used ONLY as an implementation for proxy contracts
     *      Each proxy gets its own storage via the custom BASE_STRATEGY_STORAGE slot
     */
    constructor() {
        _strategyStorage().asset = ERC20(address(1));
    }

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    // ============================================
    // MODIFIERS
    // ============================================

    /**
     * @notice Restricts function access to management address only
     * @dev Reverts with "!management" if caller is not management
     */
    modifier onlyManagement() {
        requireManagement(msg.sender);
        _;
    }

    /**
     * @notice Restricts function access to keeper or management
     * @dev Reverts with "!keeper" if caller is neither keeper nor management
     *      Used for report() and tend() functions
     */
    modifier onlyKeepers() {
        requireKeeperOrManagement(msg.sender);
        _;
    }

    /**
     * @notice Restricts function access to emergencyAdmin or management
     * @dev Reverts with "!emergency authorized" if caller is neither
     *      Used for emergency shutdown and withdrawal functions
     */
    modifier onlyEmergencyAuthorized() {
        requireEmergencyAuthorized(msg.sender);
        _;
    }

    /**
     * @notice Prevents reentrancy on state-changing functions
     * @dev Uses entered flag (ENTERED=2, NOT_ENTERED=1) instead of bool for gas optimization
     *      Applied to all deposit, withdraw, and reporting functions
     *      Reverts with "ReentrancyGuard: reentrant call" if reentrant call detected
     */
    modifier nonReentrant() {
        StrategyData storage S = _strategyStorage();
        // On the first call to nonReentrant, `entered` will be NOT_ENTERED (1)
        require(S.entered != ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        S.entered = ENTERED;

        _;

        // Reset to NOT_ENTERED (1) once call has finished
        S.entered = NOT_ENTERED;
    }

    /**
     * @notice Validates that an address is the management address
     * @dev Public so it can be used by both modifiers and strategy implementations
     *      When called from strategy via delegatecall, msg.sender is the strategy address,
     *      so we pass the actual sender as a parameter
     * @param _sender Address to validate (typically msg.sender)
     * @custom:security Reverts with "!management" if sender is not management
     */
    function requireManagement(address _sender) public view {
        require(_sender == _strategyStorage().management, "!management");
    }

    /**
     * @notice Validates that an address is either keeper or management
     * @dev Public so it can be used by both modifiers and strategy implementations
     *      Used to gate report() and tend() functions
     * @param _sender Address to validate (typically msg.sender)
     * @custom:security Reverts with "!keeper" if sender is neither keeper nor management
     */
    function requireKeeperOrManagement(address _sender) public view {
        StrategyData storage S = _strategyStorage();
        require(_sender == S.keeper || _sender == S.management, "!keeper");
    }

    /**
     * @notice Validates that an address is either emergencyAdmin or management
     * @dev Public so it can be used by both modifiers and strategy implementations
     *      Used to gate emergency shutdown and withdrawal functions
     * @param _sender Address to validate (typically msg.sender)
     * @custom:security Reverts with "!emergency authorized" if sender is neither
     */
    function requireEmergencyAuthorized(address _sender) public view {
        StrategyData storage S = _strategyStorage();
        require(_sender == S.emergencyAdmin || _sender == S.management, "!emergency authorized");
    }

    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice API version identifier for this TokenizedStrategy implementation
    /// @dev Used for tracking strategy versions and compatibility
    string internal constant API_VERSION = "1.0.0";

    /// @notice Reentrancy guard flag value during function execution
    /// @dev Set to 2 when a protected function is executing
    uint8 internal constant ENTERED = 2;

    /// @notice Reentrancy guard flag value when not executing
    /// @dev Set to 1 when no protected function is executing (default state)
    uint8 internal constant NOT_ENTERED = 1;

    /// @notice Maximum basis points (100%)
    /// @dev Used for percentage calculations (loss tolerance, fees, etc.)
    ///      10,000 basis points = 100%
    uint256 internal constant MAX_BPS = 10_000;

    /// @notice Mandatory cooldown period for dragon router changes
    /// @dev 14 days in seconds. Prevents rapid changes that could enable attacks
    ///      OCTANT-SPECIFIC security feature to protect yield distribution
    uint256 internal constant DRAGON_ROUTER_COOLDOWN = 14 days;

    /// @notice EIP-2612 Permit type hash for gasless approvals
    /// @dev Used to validate permit signatures
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    /// @notice EIP-712 domain type hash for structured data signing
    /// @dev Used in DOMAIN_SEPARATOR calculation
    bytes32 internal constant EIP712DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @notice Precomputed hash of API version for EIP-712 domain
    /// @dev Saves gas by computing once
    bytes32 internal constant VERSION_HASH = keccak256(bytes(API_VERSION));

    /// @notice Custom storage slot for StrategyData struct
    /// @dev CRITICAL: This custom slot prevents storage collisions in the proxy pattern
    ///
    ///      STORAGE PATTERN:
    ///      - Strategy contracts delegatecall to this implementation
    ///      - Delegatecall executes in the context of the calling contract's storage
    ///      - Without a custom slot, storage variables would collide
    ///      - This slot is deterministically generated from "octant.tokenized.strategy.storage"
    ///
    ///      CALCULATION (ERC-7201):
    ///      keccak256(abi.encode(uint256(keccak256("octant.tokenized.strategy.storage")) - 1)) & ~bytes32(uint256(0xff))
    ///      See: https://eips.ethereum.org/EIPS/eip-7201
    ///
    ///      SAFETY:
    ///      Strategists can use any storage in their strategy contract without
    ///      worrying about colliding with TokenizedStrategy's storage
    bytes32 internal constant BASE_STRATEGY_STORAGE =
        keccak256(abi.encode(uint256(keccak256("octant.tokenized.strategy.storage")) - 1)) & ~bytes32(uint256(0xff));

    /*//////////////////////////////////////////////////////////////
                            STORAGE GETTER
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns a storage pointer to the StrategyData struct
     * @return S Storage reference to the strategy's data at the custom slot
     *
     * GAS OPTIMIZATION:
     * - Only loads the storage slot pointer, not the actual struct contents
     * - Struct fields are loaded lazily when accessed
     * - Multiple calls in same function reuse same storage pointer
     *
     * ASSEMBLY USAGE:
     * - Required because Solidity doesn't support direct storage slot assignment
     * - Loads BASE_STRATEGY_STORAGE into S.slot
     * - Safe because we're just setting a storage location
     */
    function _strategyStorage() internal pure returns (StrategyData storage S) {
        // Since STORAGE_SLOT is a constant, we have to put a variable
        // on the stack to access it from an inline assembly block.
        bytes32 slot = BASE_STRATEGY_STORAGE;
        assembly {
            S.slot := slot
        }
    }

    /*//////////////////////////////////////////////////////////////
                          INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * @notice Initializes a new strategy with all required parameters
     * @dev CRITICAL: Can only be called ONCE per strategy (checked via asset == address(0))
     *      Should be called atomically right after strategy deployment
     *
     *      INITIALIZATION SEQUENCE:
     *      1. Validates not already initialized
     *      2. Sets asset and derives decimals
     *      3. Sets strategy name
     *      4. Initializes lastReport to current timestamp
     *      5. Sets all role addresses (with zero-address validation)
     *      6. Configures burning mechanism
     *      7. Emits NewTokenizedStrategy event for indexers
     *
     *      OCTANT CHANGES FROM YEARN:
     *      - Added emergencyAdmin parameter for enhanced security
     *      - Added dragonRouter parameter for yield distribution
     *      - Added enableBurning parameter for loss protection configuration
     *      - Enhanced zero-address validation for all critical addresses
     *
     *      POST-INITIALIZATION:
     *      All parameters can be updated via management functions except:
     *      - asset (immutable)
     *      - name (immutable after initialization)
     *      - symbol (immutable after initialization)
     *      - decimals (immutable, derived from asset)
     *
     * @param _asset Address of the underlying ERC20 asset (cannot be zero)
     * @param _name Human-readable name for strategy shares (e.g., \"Octant Lido ETH Strategy\")
     * @param _symbol Symbol for strategy shares (e.g., \"osWSTETH\")
     * @param _management Address for primary admin (cannot be zero)
     * @param _keeper Address authorized to call report/tend (cannot be zero)
     * @param _emergencyAdmin Address authorized for emergency actions (cannot be zero)
     * @param _dragonRouter Address to receive minted profit shares (cannot be zero, OCTANT-specific)
     * @param _enableBurning Whether to burn dragon shares during losses (OCTANT-specific)
     * @custom:security Can only be called once - no re-initialization possible
     * @custom:security All addresses validated as non-zero
     */
    function initialize(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _management,
        address _keeper,
        address _emergencyAdmin,
        address _dragonRouter,
        bool _enableBurning
    )
        public
        virtual
    {
        // Cache storage pointer.
        StrategyData storage S = _strategyStorage();

        // Make sure we aren't initialized.
        require(address(S.asset) == address(0), "initialized");

        // Set the strategy's underlying asset.
        S.asset = ERC20(_asset);
        // Set the Strategy Tokens name.
        S.name = _name;
        // Set the Strategy Tokens symbol.
        S.symbol = _symbol;
        // Set decimals based off the `asset`.
        S.decimals = ERC20(_asset).decimals();

        // Set last report to this block.
        S.lastReport = uint96(block.timestamp);

        // Set the default management address. Can't be 0.
        require(_management != address(0), "ZERO ADDRESS");
        S.management = _management;

        // Set the keeper address, can't be 0
        require(_keeper != address(0), "ZERO ADDRESS");
        S.keeper = _keeper;

        // Set the emergency admin address, can't be 0
        require(_emergencyAdmin != address(0), "ZERO ADDRESS");
        S.emergencyAdmin = _emergencyAdmin;

        // Set the dragon router address, can't be 0
        require(_dragonRouter != address(0), "ZERO ADDRESS");
        S.dragonRouter = _dragonRouter;

        // Set the burning mechanism flag
        S.enableBurning = _enableBurning;

        // Cache domain separator for EIP-712 permit
        S.cachedChainId = block.chainid;
        S.cachedDomainSeparator = _buildDomainSeparator(S);

        // Emit event to signal a new strategy has been initialized.
        emit NewTokenizedStrategy(address(this), _asset, API_VERSION);
    }

    /*//////////////////////////////////////////////////////////////
                      ERC4626 WRITE METHODS
    //////////////////////////////////////////////////////////////*/

    // ============================================
    // ERC4626 DEPOSIT/MINT FUNCTIONS
    // ============================================

    /**
     * @notice Mints proportional shares to receiver according to how the strategy calculates the assets to shares
     * conversion
     * @dev ERC4626-compliant deposit function with reentrancy protection
     * @param assets Amount of assets to deposit (or type(uint256).max for full balance)
     * @param receiver Address to receive the minted shares
     * @return shares Amount of shares minted to receiver
     * @custom:security Reentrancy protected
     */
    function deposit(uint256 assets, address receiver) public virtual nonReentrant returns (uint256 shares) {
        // Get the storage slot for all following calls.
        StrategyData storage S = _strategyStorage();

        // Deposit full balance if using max uint.
        if (assets == type(uint256).max) {
            assets = S.asset.balanceOf(msg.sender);
        }

        // Checking max deposit will also check if shutdown.
        require(assets <= _maxDeposit(S, receiver), "ERC4626: deposit more than max");
        // Check for rounding error.
        require((shares = _convertToShares(S, assets, Math.Rounding.Down)) != 0, "ZERO_SHARES");

        _deposit(S, receiver, assets, shares);
    }

    /**
     * @notice Mints exact shares by depositing calculated asset amount
     * @dev ERC4626-compliant mint function with reentrancy protection
     *
     *      CHECKS:
     *      - Shares <= maxMint (also checks if strategy shutdown)
     *      - Assets != 0 (prevents rounding to zero)
     *
     * @param shares Exact amount of shares to mint
     * @param receiver Address to receive the minted shares
     * @return assets Amount of assets deposited from caller
     * @custom:security Reentrancy protected
     */
    function mint(uint256 shares, address receiver) public virtual nonReentrant returns (uint256 assets) {
        // Get the storage slot for all following calls.
        StrategyData storage S = _strategyStorage();

        // Checking max mint will also check if shutdown.
        require(shares <= _maxMint(S, receiver), "ERC4626: mint more than max");
        // Check for rounding error.
        require((assets = _convertToAssets(S, shares, Math.Rounding.Up)) != 0, "ZERO_ASSETS");

        _deposit(S, receiver, assets, shares);
    }

    // ============================================
    // ERC4626 WITHDRAW/REDEEM FUNCTIONS
    // ============================================

    /**
     * @notice Withdraws assets by burning owner's shares (no loss tolerance)
     * @dev Convenience wrapper that defaults to maxLoss = 0 (no loss accepted)
     *      Calls the overloaded withdraw with maxLoss = 0
     * @param assets Amount of assets to withdraw
     * @param receiver Address to receive the withdrawn assets
     * @param owner Address whose shares will be burned
     * @return shares Amount of shares burned from owner
     */
    function withdraw(uint256 assets, address receiver, address owner) external virtual returns (uint256 shares) {
        return withdraw(assets, receiver, owner, 0);
    }

    /**
     * @notice Withdraws assets by burning owner's shares with loss tolerance
     * @dev ERC4626-extended withdraw with loss parameter and reentrancy protection
     * @param assets Amount of assets to withdraw
     * @param receiver Address to receive the withdrawn assets
     * @param owner Address whose shares are burned
     * @param maxLoss Maximum acceptable loss in basis points (0-10000, where 10000 = 100%)
     * @return shares Amount of shares burned from owner
     * @custom:security Reentrancy protected
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner,
        uint256 maxLoss
    )
        public
        virtual
        nonReentrant
        returns (uint256 shares)
    {
        // Get the storage slot for all following calls.
        StrategyData storage S = _strategyStorage();
        require(assets <= _maxWithdraw(S, owner), "ERC4626: withdraw more than max");
        // Check for rounding error or 0 value.
        require((shares = _convertToShares(S, assets, Math.Rounding.Up)) != 0, "ZERO_SHARES");

        // Withdraw and track the actual amount withdrawn for loss check.
        _withdraw(S, receiver, owner, assets, shares, maxLoss);
    }

    /**
     * @notice Redeems shares for assets (accepts any loss)
     * @dev Convenience wrapper that defaults to maxLoss = MAX_BPS (100%, accepts any loss)
     *      Calls the overloaded redeem with maxLoss = MAX_BPS
     * @param shares Amount of shares to burn
     * @param receiver Address to receive the withdrawn assets
     * @param owner Address whose shares are burned
     * @return assets Actual amount of assets withdrawn (may be less than expected if loss occurs)
     */
    function redeem(uint256 shares, address receiver, address owner) external virtual returns (uint256) {
        // We default to not limiting a potential loss.
        return redeem(shares, receiver, owner, MAX_BPS);
    }

    /**
     * @notice Redeems exactly specified shares for assets with loss tolerance
     * @dev ERC4626-extended redeem with loss parameter and reentrancy protection
     * @param shares Amount of shares to burn
     * @param receiver Address to receive the withdrawn assets
     * @param owner Address whose shares are burned
     * @param maxLoss Maximum acceptable loss in basis points (0-10000, where 10000 = 100%)
     * @return assets Actual amount of assets withdrawn
     * @custom:security Reentrancy protected
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner,
        uint256 maxLoss
    )
        public
        virtual
        nonReentrant
        returns (uint256)
    {
        // Get the storage slot for all following calls.
        StrategyData storage S = _strategyStorage();
        require(shares <= _maxRedeem(S, owner), "ERC4626: redeem more than max");
        // slither-disable-next-line uninitialized-local
        uint256 assets;
        // Check for rounding error or 0 value.
        require((assets = _convertToAssets(S, shares, Math.Rounding.Down)) != 0, "ZERO_ASSETS");

        // We need to return the actual amount withdrawn in case of a loss.
        return _withdraw(S, receiver, owner, assets, shares, maxLoss);
    }

    /*//////////////////////////////////////////////////////////////
                    EXTERNAL 4626 VIEW METHODS
    //////////////////////////////////////////////////////////////*/

    // ============================================
    // VIEW FUNCTIONS - CORE ACCOUNTING
    // ============================================

    /**
     * @notice Returns total assets under management
     * @dev CRITICAL: Manually tracked to prevent PPS manipulation via direct transfers
     *      Updated during deposits, withdrawals, and report() calls
     * @return totalAssets_ Total assets (typically 18 decimals)
     */
    function totalAssets() external view returns (uint256) {
        return _totalAssets(_strategyStorage());
    }

    /**
     * @notice Returns total supply of strategy shares
     * @dev Includes shares held by all users AND dragon router
     * @return totalSupply_ Total shares (typically 18 decimals)
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply(_strategyStorage());
    }

    // ============================================
    // VIEW FUNCTIONS - CONVERSION
    // ============================================

    /**
     * @notice Converts asset amount to equivalent shares
     * @dev Uses Floor rounding (conservative for conversions)
     *      Formula: (assets * totalSupply) / totalAssets
     * @param assets Amount of assets to convert
     * @return shares_ Equivalent amount of shares
     */
    function convertToShares(uint256 assets) external view returns (uint256) {
        return _convertToShares(_strategyStorage(), assets, Math.Rounding.Down);
    }

    /**
     * @notice Converts share amount to equivalent assets
     * @dev Uses Floor rounding (conservative for conversions)
     *      Formula: (shares * totalAssets) / totalSupply
     * @param shares Amount of shares to convert
     * @return assets_ Equivalent amount of assets
     */
    function convertToAssets(uint256 shares) external view returns (uint256) {
        return _convertToAssets(_strategyStorage(), shares, Math.Rounding.Down);
    }

    // ============================================
    // VIEW FUNCTIONS - PREVIEW
    // ============================================

    /**
     * @notice Previews shares that would be minted for a deposit
     * @dev Uses Floor rounding
     * @param assets Amount of assets to deposit
     * @return shares_ Expected shares to be minted
     */
    function previewDeposit(uint256 assets) external view returns (uint256) {
        return _convertToShares(_strategyStorage(), assets, Math.Rounding.Down);
    }

    /**
     * @notice Previews assets required to mint exact shares
     * @dev Uses Ceil rounding
     * @param shares Amount of shares to mint
     * @return assets_ Required assets for mint
     */
    function previewMint(uint256 shares) external view returns (uint256) {
        return _convertToAssets(_strategyStorage(), shares, Math.Rounding.Up);
    }

    /**
     * @notice Previews shares that would be burned for a withdrawal
     * @dev Uses Ceil rounding
     * @param assets Amount of assets to withdraw
     * @return shares_ Expected shares to be burned
     */
    function previewWithdraw(uint256 assets) external view returns (uint256) {
        return _convertToShares(_strategyStorage(), assets, Math.Rounding.Up);
    }

    /**
     * @notice Previews assets that would be returned for redeeming shares
     * @dev Uses Floor rounding
     * @param shares Amount of shares to redeem
     * @return assets_ Expected assets to be returned
     */
    function previewRedeem(uint256 shares) external view returns (uint256) {
        return _convertToAssets(_strategyStorage(), shares, Math.Rounding.Down);
    }

    // ============================================
    // VIEW FUNCTIONS - MAX OPERATIONS
    // ============================================

    /**
     * @notice Returns maximum assets that can be deposited
     * @dev Returns 0 if strategy is shutdown
     *      Returns type(uint256).max if not shutdown (no hard cap)
     * @param receiver Address that would receive the shares
     * @return max Maximum deposit amount
     */
    function maxDeposit(address receiver) public view virtual returns (uint256) {
        return _maxDeposit(_strategyStorage(), receiver);
    }

    /**
     * @notice Total number of shares that can be minted to `receiver`
     * of a {mint} call.
     *
     * @param receiver Address that would receive the shares
     * @return _maxMint Maximum shares that can be minted
     */
    function maxMint(address receiver) public view virtual returns (uint256) {
        return _maxMint(_strategyStorage(), receiver);
    }

    /**
     * @notice Maximum underlying assets that can be withdrawn by `owner`.
     * @param owner Address that owns the shares
     * @return _maxWithdraw Maximum assets that can be withdrawn
     */
    function maxWithdraw(address owner) public view virtual returns (uint256) {
        return _maxWithdraw(_strategyStorage(), owner);
    }

    /**
     * @notice Variable `maxLoss` is ignored.
     * @dev Accepts a `maxLoss` variable in order to match the multi
     * strategy vaults ABI.
     */
    function maxWithdraw(address owner, uint256 /*maxLoss*/ ) external view returns (uint256) {
        return _maxWithdraw(_strategyStorage(), owner);
    }

    /**
     * @notice Maximum number of shares that can be redeemed by `owner`.
     * @param owner Address that owns the shares
     * @return _maxRedeem Maximum shares that can be redeemed
     */
    function maxRedeem(address owner) public view virtual returns (uint256) {
        return _maxRedeem(_strategyStorage(), owner);
    }

    /**
     * @notice Variable `maxLoss` is ignored.
     * @dev Accepts a `maxLoss` variable in order to match the multi
     * strategy vaults ABI.
     */
    function maxRedeem(address owner, uint256 /*maxLoss*/ ) external view returns (uint256) {
        return _maxRedeem(_strategyStorage(), owner);
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL 4626 VIEW METHODS
    //////////////////////////////////////////////////////////////*/

    /// @dev Internal implementation of {totalAssets}.
    function _totalAssets(StrategyData storage S) internal view returns (uint256) {
        return S.totalAssets;
    }

    /// @dev Internal implementation of {totalSupply}.
    function _totalSupply(StrategyData storage S) internal view returns (uint256) {
        return S.totalSupply;
    }

    /// @dev Internal implementation of {convertToShares}.
    function _convertToShares(
        StrategyData storage S,
        uint256 assets,
        Math.Rounding _rounding
    )
        internal
        view
        virtual
        returns (uint256)
    {
        // Saves an extra SLOAD if values are non-zero.
        uint256 totalSupply_ = _totalSupply(S);
        // If supply is 0, PPS = 1.
        if (totalSupply_ == 0) return assets;

        uint256 totalAssets_ = _totalAssets(S);
        // If assets are 0 but supply is not PPS = 0.
        if (totalAssets_ == 0) return 0;

        return assets.mulDiv(totalSupply_, totalAssets_, _rounding);
    }

    /// @dev Internal implementation of {convertToAssets}.
    // WARNING: When deploying donated assets with YieldDonatingTokenizedStrategy,
    // potential losses can be amplified due to the multi-hop donation flow:
    // For example OctantVault → YearnVault → MorphoVault → Morpho
    function _convertToAssets(
        StrategyData storage S,
        uint256 shares,
        Math.Rounding _rounding
    )
        internal
        view
        virtual
        returns (uint256)
    {
        // Saves an extra SLOAD if totalSupply() is non-zero.
        uint256 supply = _totalSupply(S);

        return supply == 0 ? shares : shares.mulDiv(_totalAssets(S), supply, _rounding);
    }

    /// @dev Internal implementation of {maxDeposit}.
    function _maxDeposit(StrategyData storage S, address receiver) internal view returns (uint256) {
        // Cannot deposit when shutdown or to the strategy.
        if (S.shutdown || receiver == address(this)) return 0;

        return IBaseStrategy(address(this)).availableDepositLimit(receiver);
    }

    /// @dev Internal implementation of {maxMint}.
    function _maxMint(StrategyData storage S, address receiver) internal view returns (uint256 maxMint_) {
        // Cannot mint when shutdown or to the strategy.
        if (S.shutdown || receiver == address(this)) return 0;

        maxMint_ = IBaseStrategy(address(this)).availableDepositLimit(receiver);
        if (maxMint_ != type(uint256).max) {
            maxMint_ = _convertToShares(S, maxMint_, Math.Rounding.Down);
        }
    }

    /// @dev Internal implementation of {maxWithdraw}.
    function _maxWithdraw(StrategyData storage S, address owner) internal view returns (uint256 maxWithdraw_) {
        // Get the max the owner could withdraw currently.
        maxWithdraw_ = IBaseStrategy(address(this)).availableWithdrawLimit(owner);

        // If there is no limit enforced.
        if (maxWithdraw_ == type(uint256).max) {
            // Saves a min check if there is no withdrawal limit.
            maxWithdraw_ = _convertToAssets(S, _balanceOf(S, owner), Math.Rounding.Down);
        } else {
            maxWithdraw_ = Math.min(_convertToAssets(S, _balanceOf(S, owner), Math.Rounding.Down), maxWithdraw_);
        }
    }

    /// @dev Internal implementation of {maxRedeem}.
    function _maxRedeem(StrategyData storage S, address owner) internal view returns (uint256 maxRedeem_) {
        // Get the max the owner could withdraw currently.
        maxRedeem_ = IBaseStrategy(address(this)).availableWithdrawLimit(owner);

        // Conversion would overflow and saves a min check if there is no withdrawal limit.
        if (maxRedeem_ == type(uint256).max) {
            maxRedeem_ = _balanceOf(S, owner);
        } else {
            maxRedeem_ = Math.min(
                // Can't redeem more than the balance.
                _convertToShares(S, maxRedeem_, Math.Rounding.Down),
                _balanceOf(S, owner)
            );
        }
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL 4626 WRITE METHODS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Function to be called during {deposit} and {mint}.
     *
     * This function handles all logic including transfers,
     * minting and accounting.
     *
     * We do all external calls before updating any internal
     * values to prevent view reentrancy issues from the token
     * transfers or the _deployFunds() calls.
     */
    function _deposit(StrategyData storage S, address receiver, uint256 assets, uint256 shares) internal virtual {
        // Cache storage variables used more than once.
        ERC20 _asset = S.asset;

        // Need to transfer before minting or ERC777s could reenter.
        _asset.safeTransferFrom(msg.sender, address(this), assets);

        // We can deploy the full loose balance currently held.
        IBaseStrategy(address(this)).deployFunds(_asset.balanceOf(address(this)));

        // Adjust total Assets.
        S.totalAssets += assets;

        // mint shares
        _mint(S, receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /**
     * @dev To be called during {redeem} and {withdraw}.
     *
     * This will handle all logic, transfers and accounting
     * in order to service the withdraw request.
     *
     * If we are not able to withdraw the full amount needed, it will
     * be counted as a loss and passed on to the user.
     */
    function _withdraw(
        StrategyData storage S,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares,
        uint256 maxLoss
    )
        internal
        returns (uint256)
    {
        require(receiver != address(0), "ZERO ADDRESS");
        require(maxLoss <= MAX_BPS, "exceeds MAX_BPS");

        // Spend allowance if applicable.
        if (msg.sender != owner) {
            _spendAllowance(S, owner, msg.sender, shares);
        }

        // Cache `asset` since it is used multiple times..
        ERC20 _asset = S.asset;

        uint256 idle = _asset.balanceOf(address(this));
        // slither-disable-next-line uninitialized-local
        uint256 loss;
        // Check if we need to withdraw funds.
        if (idle < assets) {
            // Tell Strategy to free what we need.
            unchecked {
                IBaseStrategy(address(this)).freeFunds(assets - idle);
            }

            // Return the actual amount withdrawn. Adjust for potential under withdraws.
            idle = _asset.balanceOf(address(this));

            // If we didn't get enough out then we have a loss.
            if (idle < assets) {
                unchecked {
                    loss = assets - idle;
                }
                // If a non-default max loss parameter was set.
                if (maxLoss < MAX_BPS) {
                    // Make sure we are within the acceptable range.
                    require(loss <= (assets * maxLoss) / MAX_BPS, "too much loss");
                }
                // Lower the amount to be withdrawn.
                assets = idle;
            }
        }

        // Update assets based on how much we took.
        S.totalAssets -= (assets + loss);

        _burn(S, owner, shares);

        // Transfer the amount of underlying to the receiver.
        _asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        // Return the actual amount of assets withdrawn.
        return assets;
    }

    /*//////////////////////////////////////////////////////////////
                        PROFIT REPORTING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Function for keepers to call to harvest and record all
     * donations accrued.
     *
     * @dev This will account for any gains/losses since the last report.
     * This function is virtual and meant to be overridden by specialized
     * strategies that implement custom yield handling mechanisms.
     *
     * Two primary implementations are provided in specialized strategies:
     * - YieldDonatingTokenizedStrategy: Mints shares from profits to the dragonRouter
     * - YieldSkimmingTokenizedStrategy: Skims asset appreciation by diluting shares
     *
     * @return profit Notional amount of gain since last report
     * report in terms of `asset`.
     * @return loss Notional amount of loss since last report
     * report in terms of `asset`.
     */
    function report() external virtual returns (uint256 profit, uint256 loss);

    /*//////////////////////////////////////////////////////////////
                            TENDING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice For a 'keeper' to 'tend' the strategy if a custom
     * tendTrigger() is implemented.
     *
     * @dev Both 'tendTrigger' and '_tend' will need to be overridden
     * for this to be used.
     *
     * This will callback the internal '_tend' call in the BaseStrategy
     * with the total current amount available to the strategy to deploy.
     *
     * This is a permissioned function so if desired it could
     * be used for illiquid or manipulatable strategies to compound
     * rewards, perform maintenance or deposit/withdraw funds.
     *
     * This will not cause any change in PPS. Total assets will
     * be the same before and after.
     *
     * A report() call will be needed to record any profits or losses.
     */
    function tend() external nonReentrant onlyKeepers {
        // Tend the strategy with the current loose balance.
        IBaseStrategy(address(this)).tendThis(_strategyStorage().asset.balanceOf(address(this)));
    }

    /*//////////////////////////////////////////////////////////////
                        STRATEGY SHUTDOWN
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Used to shutdown the strategy preventing any further deposits.
     * @dev Can only be called by the current `management` or `emergencyAdmin`.
     *
     * This will stop any new {deposit} or {mint} calls but will
     * not prevent {withdraw} or {redeem}. It will also still allow for
     * {tend} and {report} so that management can report any last losses
     * in an emergency as well as provide any maintenance to allow for full
     * withdraw.
     *
     * This is a one way switch and can never be set back once shutdown.
     */
    function shutdownStrategy() external onlyEmergencyAuthorized {
        _strategyStorage().shutdown = true;

        emit StrategyShutdown();
    }

    /**
     * @notice To manually withdraw funds from the yield source after a
     * strategy has been shutdown.
     * @dev This can only be called post {shutdownStrategy}.
     *
     * This will never cause a change in PPS. Total assets will
     * be the same before and after.
     *
     * A strategist will need to override the {_emergencyWithdraw} function
     * in their strategy for this to work.
     *
     * @param amount Amount of asset to withdraw
     */
    function emergencyWithdraw(uint256 amount) external nonReentrant onlyEmergencyAuthorized {
        // Make sure the strategy has been shutdown.
        require(_strategyStorage().shutdown, "not shutdown");

        // Withdraw from the yield source.
        IBaseStrategy(address(this)).shutdownWithdraw(amount);
    }

    /*//////////////////////////////////////////////////////////////
                        GETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the underlying asset for the strategy.
     * @return asset_ Underlying asset token address
     */
    function asset() external view returns (address) {
        return address(_strategyStorage().asset);
    }

    /**
     * @notice Get the API version for this TokenizedStrategy.
     * @return version API version string
     */
    function apiVersion() external pure returns (string memory) {
        return API_VERSION;
    }

    /**
     * @notice Get the current address that controls the strategy.
     * @return management_ Address of management.
     */
    function management() external view returns (address) {
        return _strategyStorage().management;
    }

    /**
     * @notice Get the current pending management address if any.
     * @return pendingManagement_ Address of pending management.
     */
    function pendingManagement() external view returns (address) {
        return _strategyStorage().pendingManagement;
    }

    /**
     * @notice Get the current address that can call tend and report.
     * @return keeper_ Address of the keeper.
     */
    function keeper() external view returns (address) {
        return _strategyStorage().keeper;
    }

    /**
     * @notice Get the current address that can shutdown and emergency withdraw.
     * @return emergencyAdmin_ Address of the emergency admin.
     */
    function emergencyAdmin() external view returns (address) {
        return _strategyStorage().emergencyAdmin;
    }

    /**
     * @notice Get the current dragon router address that will receive minted shares.
     * @return dragonRouter_ Address of the dragon router.
     */
    function dragonRouter() external view returns (address) {
        return _strategyStorage().dragonRouter;
    }

    /**
     * @notice Get the pending dragon router address if any.
     * @return pendingDragonRouter_ Address of the pending dragon router.
     */
    function pendingDragonRouter() external view returns (address) {
        return _strategyStorage().pendingDragonRouter;
    }

    /**
     * @notice Get the timestamp when dragon router change was initiated.
     * @return changeTimestamp Timestamp when change initiated in seconds (0 if no pending change)
     */
    function dragonRouterChangeTimestamp() external view returns (uint256) {
        return uint256(_strategyStorage().dragonRouterChangeTimestamp);
    }

    /**
     * @notice The timestamp of the last time yield was reported.
     * @return lastReport_ Last report timestamp in seconds
     */
    function lastReport() external view returns (uint256) {
        return uint256(_strategyStorage().lastReport);
    }

    /**
     * @notice Get the price per share.
     * @dev Limited precision; use convertToAssets/convertToShares for exactness.
     * @return pps Price per share
     */
    function pricePerShare() public view returns (uint256) {
        StrategyData storage S = _strategyStorage();
        return _convertToAssets(S, 10 ** S.decimals, Math.Rounding.Down);
    }

    /**
     * @notice Check if the strategy has been shutdown.
     * @return isShutdown_ True if the strategy is shutdown.
     */
    function isShutdown() external view returns (bool) {
        return _strategyStorage().shutdown;
    }

    /**
     * @notice Get whether burning shares from dragon router during loss protection is enabled.
     * @return Whether the burning mechanism is enabled.
     */
    function enableBurning() external view returns (bool) {
        return _strategyStorage().enableBurning;
    }

    /*//////////////////////////////////////////////////////////////
                        SETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Step one of two to set a new address to be in charge of the strategy.
     * @dev Can only be called by the current `management`. The address is
     * set to pending management and will then have to call {acceptManagement}
     * in order for the 'management' to officially change.
     *
     * Cannot set `management` to address(0).
     *
     * @param _management New address to set `pendingManagement` to.
     */
    function setPendingManagement(address _management) external onlyManagement {
        require(_management != address(0), "ZERO ADDRESS");
        _strategyStorage().pendingManagement = _management;

        emit UpdatePendingManagement(_management);
    }

    /**
     * @notice Step two of two to set a new 'management' of the strategy.
     * @dev Can only be called by the current `pendingManagement`.
     */
    function acceptManagement() external {
        StrategyData storage S = _strategyStorage();
        require(msg.sender == S.pendingManagement, "!pending");
        S.management = msg.sender;
        S.pendingManagement = address(0);

        emit UpdateManagement(msg.sender);
    }

    /**
     * @notice Sets a new address to be in charge of tend and reports.
     * @dev Can only be called by the current `management`.
     *
     * @param _keeper New address to set `keeper` to.
     */
    function setKeeper(address _keeper) external onlyManagement {
        require(_keeper != address(0), "ZERO ADDRESS");
        _strategyStorage().keeper = _keeper;

        emit UpdateKeeper(_keeper);
    }

    /**
     * @notice Sets a new address to be able to shutdown the strategy.
     * @dev Can only be called by the current `management`.
     *
     * @param _emergencyAdmin New address to set `emergencyAdmin` to.
     */
    function setEmergencyAdmin(address _emergencyAdmin) external onlyManagement {
        require(_emergencyAdmin != address(0), "ZERO ADDRESS");
        _strategyStorage().emergencyAdmin = _emergencyAdmin;

        emit UpdateEmergencyAdmin(_emergencyAdmin);
    }

    /**
     * @notice Initiates a change to a new dragon router address with a cooldown period.
     * @dev Starts a two-step process to change the donation destination:
     *      1) Emits PendingDragonRouterChange(new, effectiveTimestamp)
     *      2) Enforces a cooldown of DRAGON_ROUTER_COOLDOWN (14 days) before finalization
     *      During the cooldown, users are notified and can exit if they disagree with the change.
     * @param _dragonRouter New address to set as pending `dragonRouter`.
     * @dev Reverts if _dragonRouter equals current dragonRouter (no-op protection)
     */
    function setDragonRouter(address _dragonRouter) external onlyManagement {
        require(_dragonRouter != address(0), "ZERO ADDRESS");
        StrategyData storage S = _strategyStorage();
        require(_dragonRouter != S.dragonRouter, "same dragon router");

        S.pendingDragonRouter = _dragonRouter;
        S.dragonRouterChangeTimestamp = uint96(block.timestamp);

        uint256 effectiveTimestamp = block.timestamp + DRAGON_ROUTER_COOLDOWN;
        emit PendingDragonRouterChange(_dragonRouter, effectiveTimestamp);
    }

    /**
     * @notice Finalizes the dragon router change after the cooldown period.
     * @dev Requires a pending router and that the cooldown has elapsed.
     *      Emits UpdateDragonRouter(newDragonRouter) and clears the pending state.
     * @custom:security Permissionless - anyone can finalize after cooldown (by design)
     */
    function finalizeDragonRouterChange() external virtual {
        StrategyData storage S = _strategyStorage();
        require(S.pendingDragonRouter != address(0), "no pending change");
        require(block.timestamp >= S.dragonRouterChangeTimestamp + DRAGON_ROUTER_COOLDOWN, "cooldown not elapsed");

        S.dragonRouter = S.pendingDragonRouter;
        S.pendingDragonRouter = address(0);
        S.dragonRouterChangeTimestamp = 0;

        emit UpdateDragonRouter(S.dragonRouter);
    }

    /**
     * @notice Cancels a pending dragon router change.
     * @dev Resets pending router and timestamp. Emits PendingDragonRouterChange(address(0), 0).
     */
    function cancelDragonRouterChange() external onlyManagement {
        StrategyData storage S = _strategyStorage();
        require(S.pendingDragonRouter != address(0), "no pending change");

        S.pendingDragonRouter = address(0);
        S.dragonRouterChangeTimestamp = 0;

        emit PendingDragonRouterChange(address(0), 0);
    }

    /**
     * @notice Updates the name for the strategy.
     * @dev Also updates the EIP-712 domain separator via cachedDomainSeparator,
     *      which invalidates any previously signed but unused permits.
     * @param _name New name for the strategy
     */
    function setName(string calldata _name) external onlyManagement {
        StrategyData storage S = _strategyStorage();
        S.name = _name;
        S.cachedDomainSeparator = _buildDomainSeparator(S);
        emit UpdateName(_name);
    }

    /**
     * @notice Sets whether to enable burning shares from dragon router during loss protection.
     * @dev Can only be called by the current `management`.
     * @param _enableBurning Whether to enable the burning mechanism.
     */
    function setEnableBurning(bool _enableBurning) external onlyManagement {
        _strategyStorage().enableBurning = _enableBurning;
        emit UpdateBurningMechanism(_enableBurning);
    }

    /*//////////////////////////////////////////////////////////////
                        ERC20 METHODS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Returns the name of the token.
     * @return name_ Token name
     */
    function name() external view returns (string memory) {
        return _strategyStorage().name;
    }

    /**
     * @notice Returns the symbol of the strategy token.
     * @return symbol_ Token symbol
     */
    function symbol() external view returns (string memory) {
        return _strategyStorage().symbol;
    }

    /**
     * @notice Returns the number of decimals used for user representation.
     * @return decimals_ Decimals used by strategy and asset
     */
    function decimals() external view returns (uint8) {
        return _strategyStorage().decimals;
    }

    /**
     * @notice Returns the current balance for a given account.
     * @param account Address to check balance for
     * @return balance_ Current balance in shares
     */
    function balanceOf(address account) external view returns (uint256) {
        return _balanceOf(_strategyStorage(), account);
    }

    /// @dev Internal implementation of {balanceOf}.
    function _balanceOf(StrategyData storage S, address account) internal view returns (uint256) {
        return S.balances[account];
    }

    /**
     * @notice Transfer `amount` of shares from `msg.sender` to `to`.
     * @dev
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `to` cannot be the address of the strategy.
     * - the caller must have a balance of at least `_amount`.
     *
     * @param to Address receiving the shares
     * @param amount Amount of shares to transfer
     * @return success True if the operation succeeded.
     */
    function transfer(address to, uint256 amount) external virtual returns (bool) {
        _transfer(_strategyStorage(), msg.sender, to, amount);
        return true;
    }

    /**
     * @notice Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     * @param owner Address that owns the shares
     * @param spender Address authorized to move shares
     * @return remaining Remaining shares spender can move
     */
    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowance(_strategyStorage(), owner, spender);
    }

    /// @dev Internal implementation of {allowance}.
    function _allowance(StrategyData storage S, address owner, address spender) internal view returns (uint256) {
        return S.allowances[owner][spender];
    }

    /**
     * @notice Sets `amount` as the allowance of `spender` over the caller's tokens.
     * @dev
     *
     * NOTE: If `amount` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     *
     * @param spender the address to allow the shares to be moved by.
     * @param amount the amount of shares to allow `spender` to move.
     * @return success True if the operation succeeded.
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(_strategyStorage(), msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Transfer `amount` of shares from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * @dev
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `to` cannot be the address of the strategy.
     * - `from` must have a balance of at least `amount`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `amount`.
     *
     * Emits a {Transfer} event.
     *
     * @param from the address to be moving shares from.
     * @param to the address to be moving shares to.
     * @param amount the quantity of shares to move.
     * @return success True if the operation succeeded.
     */
    function transferFrom(address from, address to, uint256 amount) external virtual returns (bool) {
        StrategyData storage S = _strategyStorage();
        _spendAllowance(S, from, msg.sender, amount);
        _transfer(S, from, to, amount);
        return true;
    }

    /**
     * @dev Moves `amount` of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `to` cannot be the strategies address
     * - `from` must have a balance of at least `amount`.
     *
     */
    function _transfer(StrategyData storage S, address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        require(to != address(this), "ERC20 transfer to strategy");

        S.balances[from] -= amount;
        unchecked {
            S.balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    /**
     * @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     *
     */
    function _mint(StrategyData storage S, address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        S.totalSupply += amount;
        unchecked {
            S.balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(StrategyData storage S, address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");

        S.balances[account] -= amount;
        unchecked {
            S.totalSupply -= amount;
        }
        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(StrategyData storage S, address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        S.allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Updates `owner` s allowance for `spender` based on spent `amount`.
     *
     * Does not update the allowance amount in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Might emit an {Approval} event.
     */
    function _spendAllowance(StrategyData storage S, address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = _allowance(S, owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(S, owner, spender, currentAllowance - amount);
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                            EIP-2612 LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Returns the current nonce for `owner`. This value must be
     * included whenever a signature is generated for {permit}.
     *
     * @dev Every successful call to {permit} increases ``owner``'s nonce by one. This
     * prevents a signature from being used multiple times.
     *
     * @param _owner Address to return nonce for
     * @return nonce_ Current nonce for permit operations
     */
    function nonces(address _owner) external view returns (uint256) {
        return _strategyStorage().nonces[_owner];
    }

    /**
     * @notice Sets `value` as the allowance of `spender` over ``owner``'s tokens,
     * given ``owner``'s signed approval.
     *
     * @dev IMPORTANT: The same issues {IERC20-approve} has related to transaction
     * ordering also apply here.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `deadline` must be a timestamp in the future.
     * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the EIP712-formatted function arguments.
     * - the signature must use ``owner``'s current nonce (see {nonces}).
     *
     * For more information on the signature format, see the
     * https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
     * section].
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
    {
        require(deadline >= block.timestamp, "ERC20: PERMIT_DEADLINE_EXPIRED");

        // Unchecked because the only math done is incrementing
        // the owner's nonce which cannot realistically overflow.
        unchecked {
            bytes32 digest = keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR(),
                    keccak256(
                        abi.encode(PERMIT_TYPEHASH, owner, spender, value, _strategyStorage().nonces[owner]++, deadline)
                    )
                )
            );

            (address recoveredAddress,) = ECDSA.tryRecover(digest, v, r, s);
            if (recoveredAddress != owner) {
                revert TokenizedStrategy__InvalidSigner();
            }

            _approve(_strategyStorage(), recoveredAddress, spender, value);
        }
    }

    /**
     * @notice Builds the EIP-712 domain separator using current state.
     * @dev Uses strategy name, API version, chain ID, and contract address.
     * @param S Storage pointer to strategy data
     * @return The computed domain separator.
     */
    function _buildDomainSeparator(StrategyData storage S) private view returns (bytes32) {
        return keccak256(
            abi.encode(EIP712DOMAIN_TYPEHASH, keccak256(bytes(S.name)), VERSION_HASH, block.chainid, address(this))
        );
    }

    /**
     * @notice Returns the EIP-712 domain separator used by {permit}.
     * @dev Returns cached separator if chain ID unchanged, otherwise rebuilds.
     * @return domainSeparator Domain separator for permit calls
     */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        StrategyData storage S = _strategyStorage();
        if (block.chainid == S.cachedChainId) {
            return S.cachedDomainSeparator;
        }
        return _buildDomainSeparator(S);
    }
}
