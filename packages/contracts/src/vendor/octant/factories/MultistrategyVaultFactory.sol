/* solhint-disable gas-custom-errors */
// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.25;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { IMultistrategyVaultFactory } from "@octant/factories/interfaces/IMultistrategyVaultFactory.sol";
import { IMultistrategyVault } from "@octant/core/interfaces/IMultistrategyVault.sol";
/**
 * @title MultistrategyVault Factory
 * @author yearn.finance; adapted by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @custom:origin https://github.com/yearn/yearn-vaults-v3/blob/master/contracts/VaultFactory.vy
 * @notice Factory for deploying MultistrategyVault instances with protocol fee management
 * @dev Deploys minimal proxy clones of VAULT_ORIGINAL using CREATE2 for deterministic addresses
 *
 *      DEPLOYMENT MECHANISM:
 *      ═══════════════════════════════════
 *      - Uses OpenZeppelin Clones library for minimal proxy (EIP-1167)
 *      - CREATE2 deployment for deterministic addresses
 *      - Salt = keccak256(deployer, asset, name, symbol)
 *      - Same deployer cannot deploy identical vault twice
 *      - Each vault is a lightweight proxy delegating to VAULT_ORIGINAL
 *
 *      PROTOCOL FEE SYSTEM:
 *      ═══════════════════════════════════
 *      Revenue Share Model:
 *      - Vaults charge total fees during processReport()
 *      - Protocol takes percentage of total fees
 *      - Formula: protocolFees = totalFees * protocolFeeBps / MAX_BPS
 *      - Remainder goes to vault-specific accountant
 *
 *      Example:
 *      - Vault charges 100 assets in fees
 *      - Protocol fee = 10% (1000 bps)
 *      - Protocol receives: 10 assets
 *      - Accountant receives: 90 assets
 *
 *      FEE PACKING OPTIMIZATION:
 *      ═══════════════════════════════════
 *      Protocol fee data packed into single uint256 storage slot:
 *
 *      Bit Layout (256 bits total):
 *      ┌──────────┬─────────────────────┬──────────────┬─────────────┐
 *      │ Bits     │ Content             │ Size         │ Max Value   │
 *      ├──────────┼─────────────────────┼──────────────┼─────────────┤
 *      │ 0-7      │ Custom flag         │ 8 bits       │ 0 or 1      │
 *      │ 8-23     │ Fee in basis points │ 16 bits      │ 65535       │
 *      │ 24-183   │ Fee recipient addr  │ 160 bits     │ address     │
 *      │ 184-255  │ Unused              │ 72 bits      │ -           │
 *      └──────────┴─────────────────────┴──────────────┴─────────────┘
 *
 *      Benefits:
 *      - Single SLOAD for fee queries (saves ~2100 gas)
 *      - Efficient storage (fits in one slot)
 *
 *      TWO-TIER FEE SYSTEM:
 *      - Default fee: Applied to all vaults unless custom set
 *      - Custom fee: Per-vault override (recipient always uses default)
 *
 * @custom:security Governance controls all fee parameters
 * @custom:security Maximum fee capped at 50% (MAX_FEE_BPS = 5000)
 */

contract MultistrategyVaultFactory is IMultistrategyVaultFactory {
    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice API version of vaults deployed by this factory
    /// @dev Must match VAULT_ORIGINAL's API version
    string public constant override API_VERSION = "3.0.4";

    /// @notice Maximum protocol fee in basis points (50%)
    /// @dev Hard cap to prevent excessive fees. 5000 bps = 50%
    uint16 public constant override MAX_FEE_BPS = 5000;

    /// @notice Bitmask for extracting fee basis points from packed data
    /// @dev 16-bit mask: 0xFFFF (bits 8-23 in packed data)
    uint256 public constant override FEE_BPS_MASK = 2 ** 16 - 1;

    // ============================================
    // IMMUTABLES
    // ============================================

    /// @notice Address of the canonical vault implementation
    /// @dev All deployed vaults are minimal proxies pointing to this implementation
    ///      Set once during construction, never changes
    address public immutable override VAULT_ORIGINAL;

    // ============================================
    // STATE VARIABLES
    // ============================================

    /// @notice Whether factory has been permanently shutdown
    /// @dev When true, no new vaults can be deployed. Cannot be reversed
    bool public override shutdown;

    /// @notice Address with governance authority over factory
    /// @dev Can set fees, shutdown factory, transfer governance
    address public override governance;

    /// @notice Address pending to become new governance
    /// @dev Two-step transfer process for safety
    address public override pendingGovernance;

    /// @notice Human-readable name for this factory instance
    /// @dev Useful for identifying different factory versions
    string public override name;

    /// @notice Default protocol fee configuration packed into single slot
    /// @dev Bit layout: [72 empty][160 recipient][16 fee bps][8 custom flag]
    ///      Applied to all vaults unless custom fee is set
    ///      Packing saves gas by requiring only one SLOAD
    uint256 private defaultProtocolFeeData;

    /// @notice Per-vault custom protocol fee overrides
    /// @dev Maps vault address → custom fee data (same bit layout as default)
    ///      Custom flag (bit 0) set to 1 indicates custom fee active
    ///      Recipient always uses default (custom only overrides fee bps)
    mapping(address => uint256) private customProtocolFeeData;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /**
     * @notice Initializes the factory with implementation and governance
     * @dev Sets immutable values that cannot be changed after deployment
     * @param _name Human-readable name for this factory (e.g., "Octant V3 Factory")
     * @param _vaultOriginal Address of MultistrategyVault implementation to clone
     * @param _governance Address with authority to manage factory settings
     */
    constructor(string memory _name, address _vaultOriginal, address _governance) {
        name = _name;
        VAULT_ORIGINAL = _vaultOriginal;
        governance = _governance;
    }

    // ============================================
    // VAULT DEPLOYMENT
    // ============================================

    /**
     * @notice Deploys a new MultistrategyVault as a minimal proxy
     * @dev Uses CREATE2 for deterministic addresses based on unique parameters
     *
     *      DEPLOYMENT PROCESS:
     *      1. Validates factory not shutdown
     *      2. Generates unique salt from: deployer + asset + name + symbol
     *      3. Deploys minimal proxy clone via CREATE2
     *      4. Initializes the new vault with provided parameters
     *      5. Emits NewVault event
     *
     *      DETERMINISTIC ADDRESSES:
     *      - Same parameters always produce same address
     *      - Different name/symbol required for same deployer+asset
     *      - Prevents duplicate deployments
     *      - Address predictable before deployment
     *
     *      GAS COSTS:
     *      - Minimal proxy: ~50k gas (vs ~3M for full deployment)
     *      - All logic delegated to VAULT_ORIGINAL
     *      - Storage lives in proxy contract
     *
     * @param asset Address of underlying ERC20 asset token
     * @param _name Vault token name (must be unique for this deployer+asset combo)
     * @param symbol Vault token symbol (must be unique for this deployer+asset combo)
     * @param roleManager Address to manage vault roles
     * @param profitMaxUnlockTime Profit unlock duration in seconds (0-31556952)
     * @return vaultAddress Address of the newly deployed vault
     * @custom:security Reverts if factory is shutdown
     */
    function deployNewVault(
        address asset,
        string memory _name,
        string memory symbol,
        address roleManager,
        uint256 profitMaxUnlockTime
    )
        external
        returns (address)
    {
        // Make sure the factory is not shutdown
        require(!shutdown, "shutdown");

        // Generate unique salt for CREATE2: deployer + asset + name + symbol
        // This makes vault address deterministic and prevents duplicates
        bytes32 salt = keccak256(abi.encode(msg.sender, asset, _name, symbol));

        // Deploy minimal proxy clone using CREATE2
        address vaultAddress = _createClone(VAULT_ORIGINAL, salt);

        // Initialize the newly deployed vault
        IMultistrategyVault(vaultAddress).initialize(asset, _name, symbol, roleManager, profitMaxUnlockTime);

        emit NewVault(vaultAddress, asset);
        return vaultAddress;
    }

    /// @inheritdoc IMultistrategyVaultFactory
    function vaultOriginal() external view returns (address) {
        return VAULT_ORIGINAL;
    }

    /// @inheritdoc IMultistrategyVaultFactory
    function apiVersion() external pure override returns (string memory) {
        return API_VERSION;
    }

    // ============================================
    // FEE CONFIGURATION VIEWS
    // ============================================

    /**
     * @notice Returns protocol fee configuration for a vault
     * @dev Checks for vault-specific custom fee, falls back to default
     *      Called by vaults during processReport() to calculate protocol fees
     *
     *      LOGIC:
     *      1. If vault has custom fee (custom flag set): Return (custom fee bps, default recipient)
     *      2. Otherwise: Return (default fee bps, default recipient)
     *
     *      NOTE: Recipient ALWAYS comes from default config (custom only overrides bps)
     *
     * @param vault Address of the vault to query (or address(0) to use msg.sender)
     * @return feeBps Protocol fee in basis points (0-5000, where 5000 = 50%)
     * @return recipient Address to receive protocol fees
     */
    function protocolFeeConfig(address vault) external view override returns (uint16, address) {
        if (vault == address(0)) {
            vault = msg.sender;
        }

        // If there is a custom protocol fee set we return it
        uint256 configData = customProtocolFeeData[vault];
        if (_unpackCustomFlag(configData)) {
            // Always use the default fee recipient even with custom fees
            return (_unpackProtocolFee(configData), _unpackFeeRecipient(defaultProtocolFeeData));
        } else {
            // Otherwise return the default config
            configData = defaultProtocolFeeData;
            return (_unpackProtocolFee(configData), _unpackFeeRecipient(configData));
        }
    }

    /// @inheritdoc IMultistrategyVaultFactory
    function useCustomProtocolFee(address vault) external view override returns (bool) {
        return _unpackCustomFlag(customProtocolFeeData[vault]);
    }

    // ============================================
    // GOVERNANCE - FEE MANAGEMENT
    // ============================================

    /**
     * @notice Sets the default protocol fee basis points
     * @dev Updates default fee applied to all vaults without custom fees
     *      Requires fee recipient to be set first
     * @param newProtocolFeeBps New fee in basis points (0-5000, where 5000 = 50%)
     * @custom:security Only callable by governance
     * @custom:security Capped at MAX_FEE_BPS (50%)
     */
    function setProtocolFeeBps(uint16 newProtocolFeeBps) external override {
        require(msg.sender == governance, "not governance");
        require(newProtocolFeeBps <= MAX_FEE_BPS, "fee too high");

        // Cache the current default protocol fee
        uint256 defaultFeeData = defaultProtocolFeeData;
        address recipient = _unpackFeeRecipient(defaultFeeData);

        require(recipient != address(0), "no recipient");

        // Pack new fee with existing recipient
        defaultProtocolFeeData = _packProtocolFeeData(recipient, newProtocolFeeBps, false);

        emit UpdateProtocolFeeBps(_unpackProtocolFee(defaultFeeData), newProtocolFeeBps);
    }

    /**
     * @notice Sets the default protocol fee recipient address
     * @dev Updates recipient for all fees (default and custom)
     *      Custom fees only override bps, recipient always comes from default
     * @param newProtocolFeeRecipient Address to receive protocol fees (cannot be zero)
     * @custom:security Only callable by governance
     */
    function setProtocolFeeRecipient(address newProtocolFeeRecipient) external override {
        require(msg.sender == governance, "not governance");
        require(newProtocolFeeRecipient != address(0), "zero address");

        uint256 defaultFeeData = defaultProtocolFeeData;

        // Pack new recipient with existing fee bps
        defaultProtocolFeeData = _packProtocolFeeData(newProtocolFeeRecipient, _unpackProtocolFee(defaultFeeData), false);

        emit UpdateProtocolFeeRecipient(_unpackFeeRecipient(defaultFeeData), newProtocolFeeRecipient);
    }

    /**
     * @notice Sets a custom protocol fee for a specific vault
     * @dev Allows per-vault fee overrides while using default recipient
     *      Requires default recipient to be set first
     * @param vault Address of the vault to set custom fee for
     * @param newCustomProtocolFee Custom fee in basis points (0-5000)
     * @custom:security Only callable by governance
     * @custom:security Capped at MAX_FEE_BPS (50%)
     */
    function setCustomProtocolFeeBps(address vault, uint16 newCustomProtocolFee) external override {
        require(msg.sender == governance, "not governance");
        require(newCustomProtocolFee <= MAX_FEE_BPS, "fee too high");
        require(_unpackFeeRecipient(defaultProtocolFeeData) != address(0), "no recipient");

        // Pack with custom flag set to true, recipient = 0 (uses default)
        customProtocolFeeData[vault] = _packProtocolFeeData(address(0), newCustomProtocolFee, true);

        emit UpdateCustomProtocolFee(vault, newCustomProtocolFee);
    }

    /**
     * @notice Removes custom protocol fee for a vault (reverts to default)
     * @dev Clears custom fee data, vault will use default fee configuration
     * @param vault Address of the vault to clear custom fee for
     * @custom:security Only callable by governance
     */
    function removeCustomProtocolFee(address vault) external override {
        require(msg.sender == governance, "not governance");

        // Reset the custom fee to 0 and flag to false (will use default)
        customProtocolFeeData[vault] = _packProtocolFeeData(address(0), 0, false);

        emit RemovedCustomProtocolFee(vault);
    }

    // ============================================
    // GOVERNANCE - FACTORY MANAGEMENT
    // ============================================

    /**
     * @notice Permanently shuts down the factory
     * @dev IRREVERSIBLE: Prevents new vault deployments forever
     *      Existing vaults continue operating normally
     * @custom:security Only callable by governance
     * @custom:security Cannot be reversed
     */
    function shutdownFactory() external override {
        require(msg.sender == governance, "not governance");
        require(shutdown == false, "shutdown");

        shutdown = true;

        emit FactoryShutdown();
    }

    /**
     * @notice Initiates governance transfer (step 1 of 2)
     * @dev Two-step process prevents accidental transfer to wrong address
     * @param newGovernance Address to become new governance
     * @custom:security Only callable by current governance
     */
    function transferGovernance(address newGovernance) external override {
        require(msg.sender == governance, "not governance");
        pendingGovernance = newGovernance;

        emit UpdatePendingGovernance(newGovernance);
    }

    /**
     * @notice Completes governance transfer (step 2 of 2)
     * @dev Caller must be the pendingGovernance address
     * @custom:security Only callable by pendingGovernance
     */
    function acceptGovernance() external override {
        require(msg.sender == pendingGovernance, "not pending governance");

        address oldGovernance = governance;

        governance = msg.sender;
        pendingGovernance = address(0);

        emit GovernanceTransferred(oldGovernance, msg.sender);
    }

    // ============================================
    // INTERNAL FUNCTIONS - DEPLOYMENT
    // ============================================

    /**
     * @dev Creates a minimal proxy clone using CREATE2
     * @param target Implementation address to clone
     * @param salt Unique salt for deterministic address
     * @return clone Address of the deployed clone
     */
    function _createClone(address target, bytes32 salt) internal returns (address) {
        return Clones.cloneDeterministic(target, salt);
    }

    // ============================================
    // INTERNAL FUNCTIONS - FEE PACKING/UNPACKING
    // ============================================

    /**
     * @dev Extracts fee basis points from packed data
     * @param configData Packed fee configuration
     * @return fee Fee in basis points (bits 8-23)
     */
    function _unpackProtocolFee(uint256 configData) internal pure returns (uint16) {
        return uint16((configData >> 8) & FEE_BPS_MASK);
    }

    /**
     * @dev Extracts fee recipient address from packed data
     * @param configData Packed fee configuration
     * @return recipient Fee recipient address (bits 24-183)
     */
    function _unpackFeeRecipient(uint256 configData) internal pure returns (address) {
        return address(uint160(configData >> 24));
    }

    /**
     * @dev Extracts custom flag from packed data
     * @param configData Packed fee configuration
     * @return isCustom True if custom fee is set (bit 0)
     */
    function _unpackCustomFlag(uint256 configData) internal pure returns (bool) {
        return (configData & 1) == 1;
    }

    /**
     * @dev Packs fee data into single uint256
     * @dev Bit packing layout:
     *      [72 empty bits][160 recipient][16 fee bps][8 custom flag]
     * @param recipient Fee recipient address (160 bits)
     * @param fee Fee in basis points (16 bits, 0-65535)
     * @param custom Custom flag (8 bits, 0 or 1)
     * @return packed Single uint256 with all data packed
     */
    function _packProtocolFeeData(address recipient, uint16 fee, bool custom) internal pure returns (uint256) {
        return (uint256(uint160(recipient)) << 24) | (uint256(fee) << 8) | (custom ? 1 : 0);
    }
}
