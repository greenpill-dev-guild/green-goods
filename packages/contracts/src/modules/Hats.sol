// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IHatsProtocol } from "../interfaces/IHatsProtocol.sol";
import { IHats } from "../interfaces/IHats.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";

/// @title HatsModule
/// @notice Manages Hats Protocol hat trees for Green Goods gardens
/// @dev Creates per-garden hat hierarchies with role-based access control
///
/// **Hat Tree Structure:**
/// ```
/// Green Goods Top Hat (Tree 92 on Arbitrum)
/// └── Gardens Hat (parent for all gardens)
///     └── Garden Hat (per-garden root)
///         ├── Operator Hat (can mint Gardener/Evaluator)
///         ├── Gardener Hat (minted by Operator)
///         ├── Evaluator Hat (minted by Operator)
///         ├── Funder Hat (eligibility-based)
///         └── Community Hat (token-gated)
/// ```
///
/// **Security:**
/// - Only GardenToken can create hat trees
/// - Only garden owner can grant/revoke Operator role
/// - Operators can grant/revoke Gardener/Evaluator roles
/// - Funder/Community roles use eligibility modules
contract HatsModule is IHats, OwnableUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The Hats Protocol contract
    IHatsProtocol public hatsProtocol;

    /// @notice The parent hat ID for all gardens (child of top hat)
    uint256 public gardensHatId;

    /// @notice GardenToken contract address
    address public gardenToken;

    /// @notice KarmaGAPModule for syncing GAP project admins
    IKarmaGAPModule public karmaGAPModule;

    /// @notice Garden address → Hat tree structure
    mapping(address garden => GardenHatTree tree) public gardenHatTrees;

    /// @notice Storage gap for future upgrades
    uint256[45] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the module
    /// @param _owner The owner address
    /// @param _hats The Hats Protocol contract address
    /// @param _gardensHatId The parent hat ID for all gardens (0 for testnet)
    /// @dev gardenToken must be set via setGardenToken() after deployment
    function initialize(
        address _owner,
        address _hats,
        uint256 _gardensHatId
    ) external initializer {
        if (_owner == address(0)) revert ZeroAddress();
        if (_hats == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);

        hatsProtocol = IHatsProtocol(_hats);
        gardensHatId = _gardensHatId;
        // Note: gardenToken is set separately via setGardenToken() to allow flexible deployment order

        emit HatsContractUpdated(address(0), _hats);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyGardenToken() {
        if (msg.sender != gardenToken) revert NotGardenToken();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set the Hats Protocol contract address
    /// @param _hats The new Hats contract address
    function setHatsContract(address _hats) external onlyOwner {
        if (_hats == address(0)) revert ZeroAddress();
        address oldHats = address(hatsProtocol);
        hatsProtocol = IHatsProtocol(_hats);
        emit HatsContractUpdated(oldHats, _hats);
    }

    /// @notice Set the GardenToken contract address
    /// @param _gardenToken The new GardenToken address
    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        gardenToken = _gardenToken;
    }

    /// @notice Set the KarmaGAPModule contract address
    /// @param _karmaGAPModule The KarmaGAPModule address
    function setKarmaGAPModule(address _karmaGAPModule) external onlyOwner {
        karmaGAPModule = IKarmaGAPModule(_karmaGAPModule);
    }

    /// @notice Set the gardens hat ID
    /// @param _gardensHatId The parent hat ID for all gardens
    function setGardensHatId(uint256 _gardensHatId) external onlyOwner {
        gardensHatId = _gardensHatId;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Hat Tree Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHats
    function createGardenHatTree(
        address garden,
        address operator,
        string calldata gardenName
    ) external onlyGardenToken returns (uint256 rootHatId) {
        if (gardenHatTrees[garden].exists) {
            revert GardenTreeAlreadyExists(garden);
        }

        // Create garden root hat under gardens hat
        rootHatId = hatsProtocol.createHat(
            gardensHatId,
            string(abi.encodePacked(gardenName, " Garden")),
            1, // Max 1 wearer for root (the garden itself)
            address(0), // No eligibility module
            address(0), // No toggle module
            true, // Mutable
            "" // No image
        );

        // Mint root hat to garden
        hatsProtocol.mintHat(rootHatId, garden);

        // Create role hats under garden root
        uint256 operatorHatId = hatsProtocol.createHat(
            rootHatId,
            "Operator",
            type(uint32).max, // Unlimited operators
            address(0),
            address(0),
            true,
            ""
        );

        uint256 gardenerHatId = hatsProtocol.createHat(
            rootHatId,
            "Gardener",
            type(uint32).max, // Unlimited gardeners
            address(0),
            address(0),
            true,
            ""
        );

        uint256 evaluatorHatId = hatsProtocol.createHat(
            rootHatId,
            "Evaluator",
            type(uint32).max, // Unlimited evaluators
            address(0),
            address(0),
            true,
            ""
        );

        uint256 funderHatId = hatsProtocol.createHat(
            rootHatId,
            "Funder",
            type(uint32).max,
            address(0), // Eligibility module set later
            address(0),
            true,
            ""
        );

        uint256 communityHatId = hatsProtocol.createHat(
            rootHatId,
            "Community",
            type(uint32).max,
            address(0), // Eligibility module set later
            address(0),
            true,
            ""
        );

        // Store the tree
        gardenHatTrees[garden] = GardenHatTree({
            rootHatId: rootHatId,
            operatorHatId: operatorHatId,
            gardenerHatId: gardenerHatId,
            evaluatorHatId: evaluatorHatId,
            funderHatId: funderHatId,
            communityHatId: communityHatId,
            exists: true
        });

        // Mint operator hat to the primary operator
        hatsProtocol.mintHat(operatorHatId, operator);

        emit GardenHatTreeCreated(garden, rootHatId, operatorHatId, gardenerHatId, evaluatorHatId);
        emit RoleAssigned(garden, operator, GardenRole.Operator, operatorHatId);

        return rootHatId;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHats
    function grantRole(address garden, address account, GardenRole role) external {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) revert GardenTreeNotFound(garden);

        uint256 hatId = _getRoleHatId(tree, role);

        // Check authorization based on role
        _checkGrantAuthorization(garden, tree, role);

        // Check if already has role
        if (hatsProtocol.isWearerOfHat(account, hatId)) {
            revert RoleAlreadyAssigned(account, role);
        }

        // Mint the hat
        hatsProtocol.mintHat(hatId, account);

        // Sync with GAP if operator
        if (role == GardenRole.Operator && address(karmaGAPModule) != address(0)) {
            karmaGAPModule.addProjectAdmin(garden, account);
        }

        emit RoleAssigned(garden, account, role, hatId);
    }

    /// @inheritdoc IHats
    function revokeRole(address garden, address account, GardenRole role) external {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) revert GardenTreeNotFound(garden);

        uint256 hatId = _getRoleHatId(tree, role);

        // Check authorization based on role
        _checkRevokeAuthorization(garden, tree, role);

        // Check if has role
        if (!hatsProtocol.isWearerOfHat(account, hatId)) {
            revert RoleNotAssigned(account, role);
        }

        // Transfer hat away (effectively revoking)
        // Note: Hats protocol doesn't have a direct "burn" - we transfer to zero or use renounce
        hatsProtocol.transferHat(hatId, account, address(0));

        // Sync with GAP if operator
        if (role == GardenRole.Operator && address(karmaGAPModule) != address(0)) {
            karmaGAPModule.removeProjectAdmin(garden, account);
        }

        emit RoleRevoked(garden, account, role, hatId);
    }

    /// @inheritdoc IHats
    function batchGrantRoles(
        address garden,
        address[] calldata accounts,
        GardenRole[] calldata roles
    ) external {
        if (accounts.length != roles.length) revert InvalidRole();

        for (uint256 i = 0; i < accounts.length; i++) {
            // Use internal logic instead of external call to save gas
            _grantRoleInternal(garden, accounts[i], roles[i]);
        }
    }

    /// @inheritdoc IHats
    function batchRevokeRoles(
        address garden,
        address[] calldata accounts,
        GardenRole[] calldata roles
    ) external {
        if (accounts.length != roles.length) revert InvalidRole();

        for (uint256 i = 0; i < accounts.length; i++) {
            _revokeRoleInternal(garden, accounts[i], roles[i]);
        }
    }

    /// @inheritdoc IHats
    function joinGarden(address garden) external {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) revert GardenTreeNotFound(garden);

        // Check if garden allows open joining
        if (!IGardenAccount(garden).openJoining()) {
            revert OpenJoiningNotEnabled();
        }

        // Check if already a gardener
        if (hatsProtocol.isWearerOfHat(msg.sender, tree.gardenerHatId)) {
            revert AlreadyGardener();
        }

        // Mint gardener hat to caller
        hatsProtocol.mintHat(tree.gardenerHatId, msg.sender);

        emit RoleAssigned(garden, msg.sender, GardenRole.Gardener, tree.gardenerHatId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Eligibility Module Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHats
    function setEligibilityModule(address garden, GardenRole role, address module) external {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) revert GardenTreeNotFound(garden);

        // Only owner or garden can set eligibility modules
        if (msg.sender != owner() && msg.sender != garden) {
            revert NotAuthorizedCaller();
        }

        // Only Funder and Community roles can have eligibility modules
        if (role != GardenRole.Funder && role != GardenRole.Community) {
            revert InvalidRole();
        }

        uint256 hatId = _getRoleHatId(tree, role);

        // Change eligibility module
        hatsProtocol.changeHatEligibility(hatId, module);

        emit EligibilityModuleSet(garden, role, module);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHats
    function hasRole(address garden, address account, GardenRole role) external view returns (bool) {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) return false;

        uint256 hatId = _getRoleHatId(tree, role);
        return hatsProtocol.isWearerOfHat(account, hatId);
    }

    /// @inheritdoc IHats
    function getRoleHatId(address garden, GardenRole role) external view returns (uint256) {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) return 0;
        return _getRoleHatId(tree, role);
    }

    /// @inheritdoc IHats
    function getGardenHatTree(address garden) external view returns (GardenHatTree memory) {
        return gardenHatTrees[garden];
    }

    /// @inheritdoc IHats
    function hasHatTree(address garden) external view returns (bool) {
        return gardenHatTrees[garden].exists;
    }

    /// @inheritdoc IHats
    function isOperator(address garden, address account) external view returns (bool) {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) return false;
        return hatsProtocol.isWearerOfHat(account, tree.operatorHatId);
    }

    /// @inheritdoc IHats
    function isGardener(address garden, address account) external view returns (bool) {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) return false;
        return hatsProtocol.isWearerOfHat(account, tree.gardenerHatId);
    }

    /// @inheritdoc IHats
    function isEvaluator(address garden, address account) external view returns (bool) {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) return false;
        return hatsProtocol.isWearerOfHat(account, tree.evaluatorHatId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Gets the hat ID for a role
    function _getRoleHatId(GardenHatTree storage tree, GardenRole role) private view returns (uint256) {
        if (role == GardenRole.Operator) return tree.operatorHatId;
        if (role == GardenRole.Gardener) return tree.gardenerHatId;
        if (role == GardenRole.Evaluator) return tree.evaluatorHatId;
        if (role == GardenRole.Funder) return tree.funderHatId;
        if (role == GardenRole.Community) return tree.communityHatId;
        revert InvalidRole();
    }

    /// @notice Checks if caller is authorized to grant a role
    function _checkGrantAuthorization(address garden, GardenHatTree storage tree, GardenRole role) private view {
        if (role == GardenRole.Operator) {
            // Only garden owner (root hat wearer) or module owner can grant operator
            if (!hatsProtocol.isWearerOfHat(msg.sender, tree.rootHatId) && msg.sender != owner() && msg.sender != gardenToken) {
                revert NotGardenOwner();
            }
        } else {
            // Only operators can grant other roles
            if (!hatsProtocol.isWearerOfHat(msg.sender, tree.operatorHatId) && msg.sender != owner() && msg.sender != gardenToken) {
                revert NotGardenOperator();
            }
        }
    }

    /// @notice Checks if caller is authorized to revoke a role
    function _checkRevokeAuthorization(address garden, GardenHatTree storage tree, GardenRole role) private view {
        if (role == GardenRole.Operator) {
            // Only garden owner can revoke operator
            if (!hatsProtocol.isWearerOfHat(msg.sender, tree.rootHatId) && msg.sender != owner()) {
                revert NotGardenOwner();
            }
        } else {
            // Only operators can revoke other roles
            if (!hatsProtocol.isWearerOfHat(msg.sender, tree.operatorHatId) && msg.sender != owner()) {
                revert NotGardenOperator();
            }
        }
    }

    /// @notice Internal grant role logic
    function _grantRoleInternal(address garden, address account, GardenRole role) private {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) revert GardenTreeNotFound(garden);

        uint256 hatId = _getRoleHatId(tree, role);
        _checkGrantAuthorization(garden, tree, role);

        if (hatsProtocol.isWearerOfHat(account, hatId)) {
            revert RoleAlreadyAssigned(account, role);
        }

        hatsProtocol.mintHat(hatId, account);

        if (role == GardenRole.Operator && address(karmaGAPModule) != address(0)) {
            karmaGAPModule.addProjectAdmin(garden, account);
        }

        emit RoleAssigned(garden, account, role, hatId);
    }

    /// @notice Internal revoke role logic
    function _revokeRoleInternal(address garden, address account, GardenRole role) private {
        GardenHatTree storage tree = gardenHatTrees[garden];
        if (!tree.exists) revert GardenTreeNotFound(garden);

        uint256 hatId = _getRoleHatId(tree, role);
        _checkRevokeAuthorization(garden, tree, role);

        if (!hatsProtocol.isWearerOfHat(account, hatId)) {
            revert RoleNotAssigned(account, role);
        }

        hatsProtocol.transferHat(hatId, account, address(0));

        if (role == GardenRole.Operator && address(karmaGAPModule) != address(0)) {
            karmaGAPModule.removeProjectAdmin(garden, account);
        }

        emit RoleRevoked(garden, account, role, hatId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
