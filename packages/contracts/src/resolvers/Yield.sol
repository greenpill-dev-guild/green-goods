// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IHypercertMarketplace } from "../interfaces/IHypercertMarketplace.sol";
import { ICVStrategy } from "../interfaces/ICVStrategy.sol";
import { IOctantVault } from "../interfaces/IOctantFactory.sol";
import { IJBMultiTerminal } from "../interfaces/IJuicebox.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { ICookieJarModule } from "../interfaces/ICookieJarModule.sol";
import { IAccountant } from "@octant/interfaces/IAccountant.sol";

/// @title YieldResolver
/// @notice Splits yield from Octant ERC-4626 vaults into three configurable destinations:
///         1. Cookie Jar (gardener operational compensation)
///         2. Hypercert fractions (conviction-weighted purchases)
///         3. Juicebox treasury (grows GOODS token backing)
/// @dev Receives ERC-4626 vault shares as donation address from OctantModule.
///      Permissionless splitYield() — anyone can trigger allocation.
///      All external calls wrapped in try/catch for graceful degradation.
contract YieldResolver is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable, IAccountant {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Three-way split configuration (basis points, must sum to 10000)
    struct SplitConfig {
        uint256 cookieJarBps;
        uint256 fractionsBps;
        uint256 juiceboxBps;
    }

    /// @notice Record of a fraction purchase
    struct FractionPurchase {
        uint256 hypercertId;
        uint256 amount;
        uint256 fractionId;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event YieldSplit(
        address indexed garden,
        address indexed asset,
        uint256 cookieJarAmount,
        uint256 fractionsAmount,
        uint256 juiceboxAmount,
        uint256 totalYield
    );

    event YieldAccumulated(address indexed garden, address indexed asset, uint256 amount, uint256 totalPending);

    event YieldToCookieJar(address indexed garden, address indexed asset, uint256 amount, address indexed jar);

    event YieldToJuicebox(address indexed garden, address indexed asset, uint256 amount, uint256 projectId);

    event FractionPurchased(
        address indexed garden, uint256 indexed hypercertId, uint256 amount, uint256 fractionId, address treasury
    );

    event SplitRatioUpdated(address indexed garden, uint256 cookieJarBps, uint256 fractionsBps, uint256 juiceboxBps);

    event MinYieldThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    event MinAllocationAmountUpdated(uint256 oldAmount, uint256 newAmount);

    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    event YieldStranded(address indexed garden, address indexed asset, uint256 amount, string destination);

    event EscrowedFractionsWithdrawn(address indexed garden, address indexed asset, uint256 amount, address indexed to);

    event ConvictionRouted(address indexed garden, address indexed asset, uint256 proposalCount, uint256 totalConviction);

    event ConvictionCapReached(address indexed garden, uint256 proposalCount, uint256 maxProcessed);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error InvalidSplitRatio();
    error UnauthorizedCaller(address caller);
    error NoVaultShares(address garden, address asset);
    error InvalidVault(address garden, address asset, address expected, address provided);
    error NoEscrowedFractions(address garden, address asset);

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// @notice Default split allocates 48.65% to gardener operations (Cookie Jar)
    /// @dev 4865 bps = 48.65%. Kept symmetric with fractions to balance near-term ops and long-term impact.
    uint256 public constant DEFAULT_COOKIE_JAR_BPS = 4865;

    /// @notice Default split allocates 48.65% to conviction-routed hypercert fractions
    /// @dev 4865 bps = 48.65%. If fractions routing is unavailable this portion is escrowed for later withdrawal.
    uint256 public constant DEFAULT_FRACTIONS_BPS = 4865;

    /// @notice Default split allocates 2.7% to Juicebox GOODS backing
    /// @dev 270 bps = 2.7%. Using the remainder keeps rounding deterministic (sum always equals 10_000 bps).
    uint256 public constant DEFAULT_JUICEBOX_BPS = 270;

    /// @notice Maximum proposals processed per split to prevent gas DoS
    /// @dev At 500+ proposals with 2 external calls each, unbounded iteration exceeds block gas limit,
    ///      permanently bricking splitYield() for that garden. 200 is safely within gas limits.
    uint256 public constant MAX_PROPOSALS_PER_SPLIT = 200;

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The OctantModule address (to resolve vaults)
    address public octantModule;

    /// @notice Hypercert marketplace address
    IHypercertMarketplace public hypercertMarketplace;

    /// @notice Juicebox multi-terminal for payments
    IJBMultiTerminal public jbMultiTerminal;

    /// @notice Juicebox project ID for GOODS token
    uint256 public juiceboxProjectId;

    /// @notice Minimum yield threshold in asset terms (e.g., $7 equivalent)
    /// @dev IMPORTANT: This is denominated in raw token units (18 decimals). A value of 7e18
    ///      equals ~$7 for stablecoins (DAI/USDC) but ~$21,000 for WETH. Operators deploying
    ///      with non-stablecoin assets should set an appropriate threshold via setMinYieldThreshold().
    uint256 public minYieldThreshold;

    /// @notice Minimum allocation for a single fraction purchase (dust threshold)
    uint256 public minAllocationAmount;

    /// @notice HatsModule for operator access control
    IHatsModule public hatsModule;

    /// @notice Three-way split config per garden
    mapping(address garden => SplitConfig config) public gardenSplitConfig;

    /// @notice Cookie Jar address per garden
    mapping(address garden => address jar) public gardenCookieJars;

    /// @notice Garden treasury (Safe) address per garden
    mapping(address garden => address treasury) public gardenTreasuries;

    /// @notice Accumulated sub-threshold yield per garden per asset
    mapping(address garden => mapping(address asset => uint256 pending)) public pendingYield;

    /// @notice Vault address per garden per asset (cached from OctantModule)
    mapping(address garden => mapping(address asset => address vault)) public gardenVaults;

    /// @notice Per-garden vault share balance tracking
    /// @dev Prevents cross-garden share drainage when multiple gardens share the same vault.
    ///      Incremented on share receipt (via registerShares), decremented on splitYield redemption.
    mapping(address garden => mapping(address vault => uint256 shares)) public gardenShares;

    /// @notice CookieJarModule for per-asset jar lookups
    ICookieJarModule public cookieJarModule;

    /// @notice Escrowed fractions yield per garden per asset (separate from pendingYield)
    /// @dev Accumulated until fraction purchasing is enabled. NOT merged into splitYield totals
    ///      to prevent geometric decay — if merged, each cycle would re-split the fractions
    ///      portion across all three destinations, leaking ~51% per cycle.
    mapping(address garden => mapping(address asset => uint256 escrowed)) public escrowedFractions;

    /// @notice Total registered shares across all gardens per vault
    /// @dev Prevents cross-garden share inflation: sum of all gardenShares[*][vault] must not exceed actual balance
    mapping(address vault => uint256 totalShares) public totalRegisteredShares;

    /// @notice HypercertSignalPool (CVStrategy) address per garden for conviction-weighted fraction purchases
    /// @dev Set post-mint by owner when a garden's signal pool is created. Zero address = escrow mode.
    mapping(address garden => address pool) public gardenHypercertPools;

    /// @notice Per-asset minimum yield threshold override (0 = use global minYieldThreshold)
    mapping(address asset => uint256 threshold) public assetYieldThresholds;

    /// @notice Storage gap for future upgrades
    /// @dev 18 storage vars + 32 gap = 50 slots total
    ///      Vars: octantModule, hypercertMarketplace, jbMultiTerminal, juiceboxProjectId,
    ///            minYieldThreshold, minAllocationAmount, hatsModule,
    ///            gardenSplitConfig, gardenCookieJars, gardenTreasuries, pendingYield, gardenVaults,
    ///            gardenShares, cookieJarModule, escrowedFractions, totalRegisteredShares,
    ///            gardenHypercertPools, assetYieldThresholds
    uint256[32] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the YieldResolver
    /// @param _owner The owner address
    /// @param _octantModule OctantModule address
    /// @param _hatsModule HatsModule address for access control
    /// @param _minYieldThreshold Minimum yield to trigger a split
    function initialize(
        address _owner,
        address _octantModule,
        address _hatsModule,
        uint256 _minYieldThreshold
    )
        external
        initializer
    {
        if (_owner == address(0)) revert ZeroAddress();

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(_owner);

        octantModule = _octantModule;
        hatsModule = IHatsModule(_hatsModule);
        minYieldThreshold = _minYieldThreshold;
        minAllocationAmount = 1e15; // 0.001 in 18-decimal terms
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Yield Split — Permissionless
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Split yield from a garden's vault for a given asset
    /// @dev Permissionless — anyone can trigger. Redeems vault shares, applies three-way split.
    ///      Timing risk is intentional: callers can trigger immediately after harvest and before
    ///      additional yield accrues. This cannot redirect funds (fixed split ratios + fixed
    ///      destinations), but can make distributions occur earlier than garden operators prefer.
    ///      Mitigations: minYieldThreshold batching, operator-controlled split config, and owner
    ///      emergency override of split config/destinations.
    /// @param garden The garden address
    /// @param asset The underlying asset (WETH/DAI)
    /// @param vault The ERC-4626 vault holding shares for this garden+asset
    function splitYield(address garden, address asset, address vault) external nonReentrant {
        if (garden == address(0) || asset == address(0) || vault == address(0)) revert ZeroAddress();

        // Validate vault is pre-registered and matches expected vault for this garden+asset
        address registeredVault = gardenVaults[garden][asset];
        if (registeredVault != vault) revert InvalidVault(garden, asset, registeredVault, vault);

        // Step 1-2: Redeem shares and compute total yield (including any pending)
        uint256 totalYield = _redeemAndAccumulate(garden, asset, vault);

        // Step 3: Minimum threshold check (per-asset if set, else global)
        if (totalYield < _getYieldThreshold(asset)) {
            pendingYield[garden][asset] = totalYield;
            emit YieldAccumulated(garden, asset, totalYield, totalYield);
            return;
        }

        // Clear pending (merged into totalYield)
        pendingYield[garden][asset] = 0;

        // Step 4: Read split configuration and calculate portions
        SplitConfig memory split = _getSplitConfig(garden);
        uint256 cookieJarAmount = (totalYield * split.cookieJarBps) / BPS_DENOMINATOR;
        uint256 fractionsAmount = (totalYield * split.fractionsBps) / BPS_DENOMINATOR;
        uint256 juiceboxAmount = totalYield - cookieJarAmount - fractionsAmount; // remainder to avoid rounding dust

        // Step 5: Route each portion to its destination
        _routePortions(garden, asset, vault, cookieJarAmount, fractionsAmount, juiceboxAmount);

        emit YieldSplit(garden, asset, cookieJarAmount, fractionsAmount, juiceboxAmount, totalYield);
    }

    /// @dev Redeem this garden's vault shares and return total yield (redeemed + pending)
    function _redeemAndAccumulate(address garden, address asset, address vault) private returns (uint256) {
        uint256 shares = gardenShares[garden][vault];
        if (shares == 0 && pendingYield[garden][asset] == 0) revert NoVaultShares(garden, asset);

        uint256 redeemed = 0;
        if (shares > 0) {
            uint256 redeemableShares = shares;
            uint256 maxWithdrawAssets = IOctantVault(vault).maxWithdraw(address(this), 1, new address[](0));

            // Some ERC-4626 implementations cap withdrawals during strategy illiquidity.
            // Redeem only the currently withdrawable portion to avoid full-call reverts.
            uint256 sharesFromMaxWithdraw = IOctantVault(vault).convertToShares(maxWithdrawAssets);
            if (sharesFromMaxWithdraw < redeemableShares) {
                redeemableShares = sharesFromMaxWithdraw;
            }

            // maxLoss=1 (1 bps) allows up to 0.01% rounding loss during redemption.
            // ERC-4626 vaults may return slightly fewer assets than expected due to
            // integer division in share→asset conversion. The vault reverts if loss
            // exceeds this threshold, preventing material share drain.
            redeemed = IOctantVault(vault).redeem(redeemableShares, address(this), address(this), 1, new address[](0));
            if (redeemed > 0) {
                gardenShares[garden][vault] = shares - redeemableShares;
                totalRegisteredShares[vault] -= redeemableShares;
            }
        }
        return redeemed + pendingYield[garden][asset];
    }

    /// @dev Route split portions to Cookie Jar, Fractions, and Juicebox
    function _routePortions(
        address garden,
        address asset,
        address vault,
        uint256 cookieJarAmount,
        uint256 fractionsAmount,
        uint256 juiceboxAmount
    )
        private
    {
        if (cookieJarAmount > 0) {
            _routeToCookieJar(garden, asset, cookieJarAmount);
        }
        if (fractionsAmount > 0) {
            _routeToFractions(garden, asset, fractionsAmount, vault);
        }
        if (juiceboxAmount > 0) {
            _routeToJuicebox(garden, asset, juiceboxAmount);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Split Ratio Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set the three-way split ratio for a garden
    /// @dev Access control: garden operator (via HatsModule) OR protocol owner.
    ///      The protocol owner (multisig) always has override authority regardless of
    ///      HatsModule state. This is an intentional emergency escalation path — if a
    ///      garden's operator misconfigures the split (e.g., 100% to Cookie Jar), the
    ///      protocol owner can correct it without requiring garden-level cooperation.
    ///
    ///      Configurability: callers can set any valid basis-point tuple that sums to 10_000,
    ///      including disabling a destination entirely (e.g., 5000/5000/0 or 0/0/10000).
    /// @param garden The garden address
    /// @param cookieJarBps Cookie Jar portion in basis points
    /// @param fractionsBps Fractions portion in basis points
    /// @param juiceboxBps Juicebox portion in basis points
    function setSplitRatio(address garden, uint256 cookieJarBps, uint256 fractionsBps, uint256 juiceboxBps) external {
        // Access control: operator or protocol owner
        // Protocol owner always passes (emergency override) — see NatSpec above
        if (msg.sender != owner()) {
            _requireOperatorOrOwner(garden);
        }

        if (cookieJarBps + fractionsBps + juiceboxBps != BPS_DENOMINATOR) revert InvalidSplitRatio();

        gardenSplitConfig[garden] =
            SplitConfig({ cookieJarBps: cookieJarBps, fractionsBps: fractionsBps, juiceboxBps: juiceboxBps });

        emit SplitRatioUpdated(garden, cookieJarBps, fractionsBps, juiceboxBps);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Configuration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set Cookie Jar address for a garden
    function setCookieJar(address garden, address jar) external onlyOwner {
        gardenCookieJars[garden] = jar;
    }

    /// @notice Set treasury (Safe) address for a garden
    function setGardenTreasury(address garden, address treasury) external onlyOwner {
        gardenTreasuries[garden] = treasury;
    }

    /// @notice Set vault address for a garden+asset pair
    /// @dev Callable by OctantModule (during vault creation) or protocol owner
    function setGardenVault(address garden, address asset, address vault) external {
        if (msg.sender != octantModule && msg.sender != owner()) revert UnauthorizedCaller(msg.sender);
        gardenVaults[garden][asset] = vault;
    }

    /// @notice Register vault shares received for a specific garden
    /// @dev Called by OctantModule when shares are minted to YieldResolver as donation address.
    ///      Tracks per-garden balances to prevent cross-garden share drainage.
    ///      Validates that shares don't exceed this contract's actual vault balance to prevent
    ///      phantom share inflation from a compromised OctantModule.
    /// @param garden The garden the shares belong to
    /// @param vault The vault that minted the shares
    /// @param shares The number of shares to register
    function registerShares(address garden, address vault, uint256 shares) external {
        if (msg.sender != octantModule && msg.sender != owner()) revert UnauthorizedCaller(msg.sender);
        if (garden == address(0) || vault == address(0)) revert ZeroAddress();
        if (shares == 0) return; // No-op for zero shares

        // Validate that registered shares don't exceed actual vault balance held by this contract
        uint256 actualBalance = IOctantVault(vault).balanceOf(address(this));
        uint256 newTotal = gardenShares[garden][vault] + shares;
        if (newTotal > actualBalance) revert NoVaultShares(garden, vault);

        // Validate aggregate shares across all gardens don't exceed actual vault balance
        uint256 newAggregate = totalRegisteredShares[vault] + shares;
        if (newAggregate > actualBalance) revert NoVaultShares(garden, vault);
        totalRegisteredShares[vault] = newAggregate;

        gardenShares[garden][vault] = newTotal;
    }

    /// @notice IAccountant callback — routes 100% of strategy gain as fees to this resolver.
    /// @dev The vault calls report() during process_report() to determine fee allocation.
    ///      Returning (gain, 0) means all profit shares are minted to this contract (the accountant).
    ///      Loss is handled internally by the vault — the loss parameter is informational only.
    ///      OctantModule.harvest() then calls registerShares() to attribute these shares to the garden.
    ///      DESIGN: Kept pure for gas efficiency (~200 gas vs ~5000 for state-mutating).
    ///      Per-strategy gain data is available via vault's StrategyReported events. If on-chain
    ///      audit trail is needed, upgrade to non-pure and emit an event.
    function report(address, uint256 gain, uint256) external pure override returns (uint256 fees, uint256 refunds) {
        return (gain, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function setOctantModule(address _octantModule) external onlyOwner {
        octantModule = _octantModule;
    }

    function setHypercertMarketplace(address _marketplace) external onlyOwner {
        hypercertMarketplace = IHypercertMarketplace(_marketplace);
    }

    function setJBMultiTerminal(address _terminal) external onlyOwner {
        jbMultiTerminal = IJBMultiTerminal(_terminal);
    }

    function setJuiceboxProjectId(uint256 _projectId) external onlyOwner {
        juiceboxProjectId = _projectId;
    }

    function setMinYieldThreshold(uint256 _threshold) external onlyOwner {
        uint256 oldThreshold = minYieldThreshold;
        minYieldThreshold = _threshold;
        emit MinYieldThresholdUpdated(oldThreshold, _threshold);
    }

    function setMinAllocationAmount(uint256 _amount) external onlyOwner {
        uint256 oldAmount = minAllocationAmount;
        minAllocationAmount = _amount;
        emit MinAllocationAmountUpdated(oldAmount, _amount);
    }

    function setHatsModule(address _hatsModule) external onlyOwner {
        hatsModule = IHatsModule(_hatsModule);
    }

    function setCookieJarModule(address _cookieJarModule) external onlyOwner {
        cookieJarModule = ICookieJarModule(_cookieJarModule);
    }

    /// @notice Set the HypercertSignalPool (CVStrategy) address for a garden
    /// @dev Pool addresses are only known after gardens are minted and signal pools are created.
    ///      Set to address(0) to revert to escrow mode for a garden.
    function setGardenHypercertPool(address garden, address pool) external onlyOwner {
        gardenHypercertPools[garden] = pool;
    }

    /// @notice Set per-asset minimum yield threshold (0 to use global default)
    function setAssetYieldThreshold(address asset, uint256 threshold) external onlyOwner {
        assetYieldThresholds[asset] = threshold;
    }

    /// @notice Withdraw escrowed fractions yield to a garden's treasury
    /// @dev Escrowed fractions accumulate until conviction-weighted purchasing is implemented.
    ///      This function allows the owner to redirect escrowed funds to the garden treasury
    ///      rather than leaving them permanently locked. Partial withdrawals are supported.
    /// @param garden The garden whose escrowed fractions to withdraw
    /// @param asset The ERC-20 asset to withdraw
    /// @param amount The amount to withdraw (must be <= escrowed balance)
    /// @param to The recipient address (typically the garden treasury)
    function withdrawEscrowedFractions(address garden, address asset, uint256 amount, address to) external onlyOwner {
        if (garden == address(0) || asset == address(0) || to == address(0)) revert ZeroAddress();

        uint256 escrowed = escrowedFractions[garden][asset];
        if (escrowed == 0 || amount > escrowed) revert NoEscrowedFractions(garden, asset);

        escrowedFractions[garden][asset] = escrowed - amount;
        IERC20(asset).safeTransfer(to, amount);
        emit EscrowedFractionsWithdrawn(garden, asset, amount, to);
    }

    /// @notice Rescue ERC-20 tokens stranded in this contract
    /// @dev Primary recovery mechanism for stranded funds. Tokens can become stranded when:
    ///      1. Neither Cookie Jar nor treasury is configured (YieldStranded events emitted)
    ///      2. A fraction purchase fails and tokens remain in this contract
    ///      3. A Juicebox payment fails and treasury fallback is also unconfigured
    ///      Off-chain monitoring should alert on YieldStranded events; the owner then calls
    ///      rescueTokens() to redirect the stranded balance to the correct destination.
    /// @param token The ERC-20 token address to rescue
    /// @param to The recipient address
    /// @param amount The amount to rescue
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the split config for a garden (returns defaults if not set)
    function getSplitConfig(address garden) external view returns (SplitConfig memory) {
        return _getSplitConfig(garden);
    }

    /// @notice Get pending (sub-threshold) yield for a garden+asset
    function getPendingYield(address garden, address asset) external view returns (uint256) {
        return pendingYield[garden][asset];
    }

    /// @notice Get escrowed fractions yield for a garden+asset (awaiting fraction purchasing)
    function getEscrowedFractions(address garden, address asset) external view returns (uint256) {
        return escrowedFractions[garden][asset];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Route to Cookie Jar
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deposit yield into the garden's Cookie Jar (ERC-20 transfer)
    /// @dev Uses raw ERC-20 safeTransfer rather than ICookieJar.deposit() since Cookie Jars
    ///      may be plain multisigs, Safes, or future contract implementations. The raw transfer
    ///      is universally compatible. If a Cookie Jar contract with a deposit() function is
    ///      adopted, this should be updated to call that interface.
    ///
    ///      **Stranded funds:** If neither gardenCookieJars[garden] nor gardenTreasuries[garden]
    ///      is configured, the ERC-20 tokens remain in this contract and a YieldStranded event is
    ///      emitted. The protocol owner can recover stranded tokens via rescueTokens(). Off-chain
    ///      monitoring should alert on YieldStranded events so configuration can be corrected
    ///      before the next yield split.
    function _routeToCookieJar(address garden, address asset, uint256 amount) internal {
        // Try per-asset jar from CookieJarModule first, fall back to legacy mapping
        address jar = address(0);
        if (address(cookieJarModule) != address(0)) {
            // solhint-disable-next-line no-empty-blocks
            try cookieJarModule.getGardenJar(garden, asset) returns (address _jar) {
                jar = _jar;
            } catch { }
        }
        if (jar == address(0)) {
            jar = gardenCookieJars[garden];
        }
        if (jar == address(0)) {
            // No Cookie Jar configured — send to garden treasury as fallback
            address treasury = gardenTreasuries[garden];
            if (treasury != address(0)) {
                IERC20(asset).safeTransfer(treasury, amount);
                emit YieldToCookieJar(garden, asset, amount, treasury);
            } else {
                emit YieldStranded(garden, asset, amount, "cookieJar");
            }
            return;
        }

        // Transfer ERC-20 to Cookie Jar (decision 28: WETH/DAI, not native ETH)
        IERC20(asset).safeTransfer(jar, amount);
        emit YieldToCookieJar(garden, asset, amount, jar);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Route to Fractions (Conviction-Weighted)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Route yield portion to hypercert fraction purchases (conviction-weighted)
    /// @dev Reads conviction weights from the garden's HypercertSignalPool (CVStrategy) and
    ///      distributes yield proportionally to each active proposal's conviction score.
    ///      Graceful degradation: if no pool is configured, no marketplace is set, the pool
    ///      has no proposals, all proposals have zero conviction, or the pool reverts, the
    ///      entire amount is escrowed in escrowedFractions for later processing.
    ///      Rounding dust (from integer division) goes to escrowedFractions to avoid loss.
    /// @param garden The garden whose yield is being routed
    /// @param asset The ERC-20 asset being routed (e.g., WETH)
    /// @param amount The amount of asset to route to fractions
    /// @param vault The vault (unused, kept for interface consistency)
    function _routeToFractions(address garden, address asset, uint256 amount, address vault) internal {
        (vault); // Suppress unused parameter warning

        // Guard 1: No pool configured — escrow
        address pool = gardenHypercertPools[garden];
        if (pool == address(0) || address(hypercertMarketplace) == address(0)) {
            _escrowFractions(garden, asset, amount);
            return;
        }

        // Read proposal count — wrap in try/catch for graceful degradation
        uint256 proposalCount;
        // solhint-disable-next-line no-empty-blocks
        try ICVStrategy(pool).proposalCounter() returns (uint256 count) {
            proposalCount = count;
        } catch {
            _escrowFractions(garden, asset, amount);
            return;
        }

        if (proposalCount == 0) {
            _escrowFractions(garden, asset, amount);
            return;
        }

        // Cap iteration to prevent gas DoS with high proposal counts
        uint256 maxIter = proposalCount > MAX_PROPOSALS_PER_SPLIT ? MAX_PROPOSALS_PER_SPLIT : proposalCount;

        // Read conviction values for active proposals (up to cap)
        (uint256[] memory convictions, uint256 totalConviction, uint256 activeCount) = _readConvictionWeights(pool, maxIter);

        if (proposalCount > MAX_PROPOSALS_PER_SPLIT) {
            emit ConvictionCapReached(garden, proposalCount, MAX_PROPOSALS_PER_SPLIT);
        }

        if (totalConviction == 0) {
            _escrowFractions(garden, asset, amount);
            return;
        }

        // Distribute proportionally based on conviction weights
        uint256 distributed = _distributeFractions(garden, asset, amount, convictions, maxIter, totalConviction);

        // Rounding dust goes to escrow (prevents wei loss)
        if (amount > distributed) {
            escrowedFractions[garden][asset] += amount - distributed;
        }

        emit ConvictionRouted(garden, asset, activeCount, totalConviction);
    }

    /// @notice Escrow fractions yield for later processing
    /// @dev Extracted helper to reduce cyclomatic complexity of _routeToFractions
    function _escrowFractions(address garden, address asset, uint256 amount) private {
        escrowedFractions[garden][asset] += amount;
        emit YieldAccumulated(garden, asset, amount, escrowedFractions[garden][asset]);
    }

    /// @notice Read conviction weights from a CVStrategy pool for active proposals (bounded)
    /// @dev Returns per-proposal convictions (1-indexed, stored at [i-1]), total conviction, and active count.
    ///      Proposals that are not Active (status != 1) or whose calls revert are skipped.
    ///      Only processes up to `maxIter` proposals to bound gas usage.
    /// @param pool The CVStrategy pool address
    /// @param maxIter The maximum number of proposals to iterate (capped by caller)
    /// @return convictions Array of conviction values per proposal (0 for skipped)
    /// @return totalConviction Sum of all active conviction values
    /// @return activeCount Number of proposals with non-zero conviction
    function _readConvictionWeights(
        address pool,
        uint256 maxIter
    )
        private
        view
        returns (uint256[] memory convictions, uint256 totalConviction, uint256 activeCount)
    {
        convictions = new uint256[](maxIter);

        for (uint256 i = 1; i <= maxIter; i++) {
            // Check proposal status — only Active (status == 1) proposals participate
            // solhint-disable-next-line no-empty-blocks
            try ICVStrategy(pool).getProposal(i) returns (
                address,
                address,
                address,
                uint256,
                uint256,
                uint8 proposalStatus,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256
            ) {
                if (proposalStatus != 1) continue; // Skip non-Active proposals
            } catch {
                continue; // Skip proposals that revert
            }

            // Read fresh conviction
            try ICVStrategy(pool).calculateProposalConviction(i) returns (uint256 conviction) {
                convictions[i - 1] = conviction;
                totalConviction += conviction;
                if (conviction > 0) activeCount++;
                // solhint-disable-next-line no-empty-blocks
            } catch { }
        }
    }

    /// @notice Distribute yield to fraction purchases based on conviction weights
    /// @param garden The garden address
    /// @param asset The ERC-20 asset
    /// @param amount Total amount to distribute
    /// @param convictions Per-proposal conviction values
    /// @param proposalCount Total proposals
    /// @param totalConviction Sum of all conviction values
    /// @return distributed Total amount actually distributed to purchases
    function _distributeFractions(
        address garden,
        address asset,
        uint256 amount,
        uint256[] memory convictions,
        uint256 proposalCount,
        uint256 totalConviction
    )
        private
        returns (uint256 distributed)
    {
        for (uint256 i = 1; i <= proposalCount; i++) {
            uint256 conviction = convictions[i - 1];
            if (conviction == 0) continue;

            uint256 allocation = (conviction * amount) / totalConviction;
            if (allocation > 0) {
                _purchaseFraction(garden, asset, i, allocation);
                distributed += allocation;
            }
        }
    }

    /// @notice Purchase a single hypercert fraction via marketplace
    /// @dev Skips purchase if amount is below minAllocationAmount (dust threshold).
    function _purchaseFraction(
        address garden,
        address asset,
        uint256 hypercertId,
        uint256 amount
    )
        internal
        returns (uint256 fractionId)
    {
        if (amount < minAllocationAmount) return 0;

        address treasury = gardenTreasuries[garden];
        if (treasury == address(0)) treasury = garden; // Fallback to garden TBA

        IERC20(asset).forceApprove(address(hypercertMarketplace), amount);

        // solhint-disable-next-line no-empty-blocks
        try hypercertMarketplace.buyFraction(hypercertId, amount, asset, treasury) returns (uint256 _fractionId) {
            fractionId = _fractionId;
            emit FractionPurchased(garden, hypercertId, amount, fractionId, treasury);
        } catch {
            // Reset dangling allowance from the failed purchase
            IERC20(asset).forceApprove(address(hypercertMarketplace), 0);
            // Purchase failed — escrow funds back for retry (NOT pendingYield to avoid decay)
            escrowedFractions[garden][asset] += amount;
            emit YieldAccumulated(garden, asset, amount, escrowedFractions[garden][asset]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Route to Juicebox
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Pay into Juicebox project to grow GOODS treasury backing
    function _routeToJuicebox(address garden, address asset, uint256 amount) internal {
        if (address(jbMultiTerminal) == address(0) || juiceboxProjectId == 0) {
            // No Juicebox configured — send to garden treasury as fallback
            address treasury = gardenTreasuries[garden];
            if (treasury != address(0)) {
                IERC20(asset).safeTransfer(treasury, amount);
            } else {
                emit YieldStranded(garden, asset, amount, "juicebox");
            }
            return;
        }

        IERC20(asset).forceApprove(address(jbMultiTerminal), amount);

        // solhint-disable-next-line no-empty-blocks
        try jbMultiTerminal.pay(
            juiceboxProjectId,
            asset,
            amount,
            garden, // beneficiary = garden (receives GOODS)
            0, // minReturnedTokens
            "Green Goods yield allocation",
            bytes("")
        ) returns (uint256) {
            emit YieldToJuicebox(garden, asset, amount, juiceboxProjectId);
        } catch {
            // Reset dangling allowance from the failed JB payment
            IERC20(asset).forceApprove(address(jbMultiTerminal), 0);
            // JB payment failed — send to treasury as fallback
            address treasury = gardenTreasuries[garden];
            if (treasury != address(0)) {
                IERC20(asset).safeTransfer(treasury, amount);
            } else {
                emit YieldStranded(garden, asset, amount, "juicebox");
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get split config with defaults if not configured
    function _getSplitConfig(address garden) internal view returns (SplitConfig memory) {
        SplitConfig memory config = gardenSplitConfig[garden];
        if (config.cookieJarBps + config.fractionsBps + config.juiceboxBps == 0) {
            return SplitConfig({
                cookieJarBps: DEFAULT_COOKIE_JAR_BPS,
                fractionsBps: DEFAULT_FRACTIONS_BPS,
                juiceboxBps: DEFAULT_JUICEBOX_BPS
            });
        }
        return config;
    }

    /// @notice Check if caller is garden operator or garden owner via HatsModule
    /// @dev Uses type-safe IHatsModule interface calls instead of raw staticcall.
    ///      If HatsModule reverts (e.g., garden not configured), the revert propagates
    ///      which is correct — unconfigured gardens should not allow split ratio changes.
    function _requireOperatorOrOwner(address garden) internal view {
        if (address(hatsModule) == address(0)) revert UnauthorizedCaller(msg.sender);

        if (hatsModule.isOperatorOf(garden, msg.sender)) return;
        if (hatsModule.isOwnerOf(garden, msg.sender)) return;

        revert UnauthorizedCaller(msg.sender);
    }

    /// @notice Get the yield threshold for an asset (per-asset if set, else global)
    function _getYieldThreshold(address asset) internal view returns (uint256) {
        uint256 assetThreshold = assetYieldThresholds[asset];
        return assetThreshold > 0 ? assetThreshold : minYieldThreshold;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
