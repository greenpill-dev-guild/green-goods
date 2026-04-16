// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IOctantVault } from "../interfaces/IOctantFactory.sol";
import { IGreenWillRegistry } from "../interfaces/IGreenWillRegistry.sol";
import { ZeroAddress } from "../errors/CommonErrors.sol";

interface IGreenWillVaultResolver {
    function gardenAssetVaults(address garden, address asset) external view returns (address vault);
}

/// @title GreenWillSupportRouter
/// @notice Protocol-owned deposit router that issues FIRST_SUPPORT from routed vault funding
contract GreenWillSupportRouter is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    error VaultNotFound(address garden, address asset);
    error ZeroAmount();

    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event OctantModuleUpdated(address indexed oldOctantModule, address indexed newOctantModule);
    event SupportBadgeUpdated(bytes32 indexed oldSupportBadgeId, bytes32 indexed newSupportBadgeId);
    event BadgeIssuanceFailed(bytes32 indexed badgeId, address indexed account);
    event SupportRouted(
        address indexed supporter,
        address indexed garden,
        address indexed asset,
        address vault,
        uint256 amount,
        uint256 shares,
        bool badgeIssued
    );

    IGreenWillRegistry public registry;
    address public octantModule;
    bytes32 public supportBadgeId;

    uint256[47] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _registry,
        address _octantModule,
        bytes32 _supportBadgeId
    )
        external
        initializer
    {
        if (_owner == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();
        if (_octantModule == address(0)) revert ZeroAddress();

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(_owner);

        registry = IGreenWillRegistry(_registry);
        octantModule = _octantModule;
        supportBadgeId = _supportBadgeId;

        emit RegistryUpdated(address(0), _registry);
        emit OctantModuleUpdated(address(0), _octantModule);
        emit SupportBadgeUpdated(bytes32(0), _supportBadgeId);
    }

    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();

        address oldRegistry = address(registry);
        registry = IGreenWillRegistry(_registry);

        emit RegistryUpdated(oldRegistry, _registry);
    }

    function setOctantModule(address _octantModule) external onlyOwner {
        if (_octantModule == address(0)) revert ZeroAddress();

        address oldOctantModule = octantModule;
        octantModule = _octantModule;

        emit OctantModuleUpdated(oldOctantModule, _octantModule);
    }

    function setSupportBadgeId(bytes32 _supportBadgeId) external onlyOwner {
        bytes32 oldSupportBadgeId = supportBadgeId;
        supportBadgeId = _supportBadgeId;

        emit SupportBadgeUpdated(oldSupportBadgeId, _supportBadgeId);
    }

    function fundVault(address garden, address asset, uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        address vault = IGreenWillVaultResolver(octantModule).gardenAssetVaults(garden, asset);
        if (vault == address(0)) revert VaultNotFound(garden, asset);

        IERC20 token = IERC20(asset);
        token.safeTransferFrom(msg.sender, address(this), amount);
        token.safeApprove(vault, 0);
        token.safeApprove(vault, amount);

        shares = IOctantVault(vault).deposit(amount, msg.sender);

        bool badgeIssued = false;
        if (!registry.hasBadge(supportBadgeId, msg.sender)) {
            try registry.issueByAuthorizedIssuer(
                supportBadgeId, msg.sender, keccak256(abi.encode(garden, asset, vault, msg.sender))
            ) {
                badgeIssued = true;
            } catch {
                emit BadgeIssuanceFailed(supportBadgeId, msg.sender);
            }
        }

        emit SupportRouted(msg.sender, garden, asset, vault, amount, shares, badgeIssued);
    }

    function _authorizeUpgrade(address) internal override onlyOwner { }
}
