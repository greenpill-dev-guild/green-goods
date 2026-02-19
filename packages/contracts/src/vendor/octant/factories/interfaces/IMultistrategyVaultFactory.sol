// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.25;

/**
 * @title Yearn Vault Factory Interface
 * @author yearn.finance; port maintained by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @custom:ported-from https://github.com/yearn/yearn-vaults-v3/blob/master/contracts/VaultFactory.vy
 * @notice Interface for Yearn Vault Factory that can deploy ERC4626 compliant vaults
 */
interface IMultistrategyVaultFactory {
    // Events
    /// @notice Emitted when a new vault is deployed
    /// @param vault_address Deployed vault address
    /// @param asset Underlying asset address
    event NewVault(address indexed vault_address, address indexed asset);
    /// @notice Emitted when protocol fee basis points are updated
    /// @param old_fee_bps Previous fee in basis points
    /// @param new_fee_bps New fee in basis points
    event UpdateProtocolFeeBps(uint16 old_fee_bps, uint16 new_fee_bps);
    /// @notice Emitted when protocol fee recipient is updated
    /// @param old_fee_recipient Previous fee recipient address
    /// @param new_fee_recipient New fee recipient address
    event UpdateProtocolFeeRecipient(address indexed old_fee_recipient, address indexed new_fee_recipient);
    /// @notice Emitted when a custom protocol fee is set for a vault
    /// @param vault Vault address
    /// @param new_custom_protocol_fee New custom fee in basis points
    event UpdateCustomProtocolFee(address indexed vault, uint16 new_custom_protocol_fee);
    /// @notice Emitted when custom protocol fee is removed for a vault
    /// @param vault Vault address
    event RemovedCustomProtocolFee(address indexed vault);
    /// @notice Emitted when factory is shut down
    event FactoryShutdown();
    /// @notice Emitted when governance is transferred
    /// @param previousGovernance Previous governance address
    /// @param newGovernance New governance address
    event GovernanceTransferred(address indexed previousGovernance, address indexed newGovernance);
    /// @notice Emitted when pending governance is updated
    /// @param newPendingGovernance New pending governance address
    event UpdatePendingGovernance(address indexed newPendingGovernance);

    // Constants
    function API_VERSION() external pure returns (string memory);
    /// @notice Returns the maximum allowed protocol fee in basis points
    /// @return maxFeeBps Maximum fee value (typically 5000 = 50%)
    function MAX_FEE_BPS() external pure returns (uint16);
    /// @notice Returns the bitmask used for fee encoding
    /// @return mask Fee encoding bitmask value
    function FEE_BPS_MASK() external pure returns (uint256);

    // View functions
    /// @notice Returns the vault implementation address used for cloning
    /// @return implementation Vault implementation contract address
    function VAULT_ORIGINAL() external view returns (address);
    /// @notice Returns whether factory is shutdown
    /// @return isShutdown True if factory is shutdown
    function shutdown() external view returns (bool);
    /// @notice Returns current governance address
    /// @return governanceAddress Current governance address
    function governance() external view returns (address);
    /// @notice Returns pending governance address awaiting acceptance
    /// @return pendingGovernanceAddress Pending governance address
    function pendingGovernance() external view returns (address);
    /// @notice Returns factory name
    /// @return factoryName Factory identifier string
    function name() external view returns (string memory);

    // Core functionality
    /// @notice Deploys a new multistrategy vault with specified parameters
    /// @param asset Underlying ERC20 asset address
    /// @param _name Vault name
    /// @param symbol Vault share token symbol
    /// @param roleManager Address that manages vault roles
    /// @param profitMaxUnlockTime Maximum time for profit unlocking
    /// @return Deployed vault address
    function deployNewVault(
        address asset,
        string memory _name,
        string memory symbol,
        address roleManager,
        uint256 profitMaxUnlockTime
    )
        external
        returns (address);

    /// @notice Returns the vault implementation address used for cloning
    /// @return implementation Vault implementation contract address
    function vaultOriginal() external view returns (address);
    /// @notice Returns the API version string
    /// @return version API version identifier
    function apiVersion() external pure returns (string memory);
    /// @notice Returns protocol fee configuration for a vault
    /// @param vault Vault address to query
    /// @return feeBps Protocol fee in basis points
    /// @return feeRecipient Fee recipient address
    function protocolFeeConfig(address vault) external view returns (uint16, address);
    /// @notice Returns whether vault uses custom protocol fee
    /// @param vault Vault address to query
    /// @return usesCustomFee True if vault has custom fee configured
    function useCustomProtocolFee(address vault) external view returns (bool);

    // Administrative functions
    /// @notice Sets the default protocol fee for all vaults
    /// @param newProtocolFeeBps New protocol fee in basis points
    function setProtocolFeeBps(uint16 newProtocolFeeBps) external;
    /// @notice Sets the protocol fee recipient address
    /// @param newProtocolFeeRecipient New fee recipient address
    function setProtocolFeeRecipient(address newProtocolFeeRecipient) external;
    /// @notice Sets a custom protocol fee for a specific vault
    /// @param vault Vault address
    /// @param newCustomProtocolFee Custom fee in basis points
    function setCustomProtocolFeeBps(address vault, uint16 newCustomProtocolFee) external;
    /// @notice Removes custom protocol fee for a vault
    /// @param vault Vault address
    function removeCustomProtocolFee(address vault) external;
    /// @notice Permanently shuts down the factory
    function shutdownFactory() external;
    /// @notice Initiates governance transfer to new address
    /// @param newGovernance New governance address
    function transferGovernance(address newGovernance) external;
    /// @notice Accepts pending governance transfer
    function acceptGovernance() external;
}
