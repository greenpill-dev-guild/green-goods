// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// import { Action } from "../registries/Action.sol";

error NotGardenOwner();
error NotGardenOperator();
error InviteAlreadyExists();
error InvalidExpiry();
error InvalidInvite();
error InviteAlreadyUsed();
error InviteExpired();
error AlreadyGardener();
error InvalidCommunityToken();
error CommunityTokenNotContract();
error InvalidERC20Token();

/// @title GardenAccount Contract
/// @notice Manages gardeners and operators for a Garden, and supports community token management.
/// @dev Inherits from AccountV3Upgradable and uses OpenZeppelin's Initializable for upgradability.
contract GardenAccount is AccountV3Upgradable, Initializable {
    /// @notice Emitted when the garden name is updated.
    /// @param updater The address of the entity that updated the name.
    /// @param newName The new name of the garden.
    event NameUpdated(address indexed updater, string newName);

    /// @notice Emitted when the garden description is updated.
    /// @param updater The address of the entity that updated the description.
    /// @param newDescription The new description of the garden.
    event DescriptionUpdated(address indexed updater, string newDescription);

    /// @notice Emitted when a new gardener is added.
    /// @param updater The address of the entity that added the gardener.
    /// @param gardener The address of the added gardener.
    event GardenerAdded(address indexed updater, address indexed gardener);

    /// @notice Emitted when a gardener is removed.
    /// @param updater The address of the entity that removed the gardener.
    /// @param gardener The address of the removed gardener.
    event GardenerRemoved(address indexed updater, address indexed gardener);

    /// @notice Emitted when a new garden operator is added.
    /// @param updater The address of the entity that added the operator.
    /// @param operator The address of the added garden operator.
    event GardenOperatorAdded(address indexed updater, address indexed operator);

    /// @notice Emitted when a garden operator is removed.
    /// @param updater The address of the entity that removed the operator.
    /// @param operator The address of the removed garden operator.
    event GardenOperatorRemoved(address indexed updater, address indexed operator);

    /// @notice Emitted when a garden invite is created.
    /// @param inviteCode The unique code for the invite.
    /// @param garden The address of the garden.
    /// @param creator The address of the operator who created the invite.
    /// @param expiry The expiration timestamp of the invite.
    event InviteCreated(bytes32 indexed inviteCode, address indexed garden, address indexed creator, uint256 expiry);

    /// @notice Emitted when a garden invite is used.
    /// @param inviteCode The unique code for the invite.
    /// @param garden The address of the garden.
    /// @param user The address of the user who used the invite.
    event InviteUsed(bytes32 indexed inviteCode, address indexed garden, address indexed user);

    /// @notice Emitted when a garden invite is revoked.
    /// @param inviteCode The unique code for the invite.
    /// @param garden The address of the garden.
    event InviteRevoked(bytes32 indexed inviteCode, address indexed garden);

    /// @notice The community token associated with this garden.
    address public communityToken;

    /// @notice The name of the garden.
    string public name;

    /// @notice The description of the garden.
    string public description;

    /// @notice The location of the garden.
    string public location;

    /// @notice The URL of the banner image of the garden.
    string public bannerImage;

    /// @notice Mapping of gardener addresses to their status.
    mapping(address gardener => bool isGardener) public gardeners;

    /// @notice Mapping of garden operator addresses to their status.
    mapping(address operator => bool isOperator) public gardenOperators;

    /// @notice Mapping of invite codes to their validity status.
    mapping(bytes32 inviteCode => bool isValid) public gardenInvites;

    /// @notice Mapping of invite codes to the garden address they belong to.
    mapping(bytes32 inviteCode => address garden) public inviteToGarden;

    /// @notice Mapping of invite codes to their expiration timestamps.
    mapping(bytes32 inviteCode => uint256 expiry) public inviteExpiry;

    /// @notice Mapping of invite codes to their used status.
    mapping(bytes32 inviteCode => bool isUsed) public inviteUsed;

    /// @notice Whether this garden allows open joining without invite
    bool public openJoining;

    modifier onlyGardenOwner() {
        if (_isValidSigner(_msgSender(), "") == false) {
            revert NotGardenOwner();
        }

        _;
    }

    modifier onlyOperator() {
        if (!gardenOperators[_msgSender()]) {
            revert NotGardenOperator();
        }

        _;
    }

    /// @notice Initializes the contract with the necessary dependencies.
    /// @dev This constructor is for the upgradable pattern and uses Initializable for upgrade safety.
    /// @param erc4337EntryPoint The entry point address for ERC-4337 operations.
    /// @param multicallForwarder The forwarder address for multicall operations.
    /// @param erc6551Registry The registry address for ERC-6551.
    /// @param guardian The guardian address for security-related functions.
    constructor(
        address erc4337EntryPoint,
        address multicallForwarder,
        address erc6551Registry,
        address guardian
    )
        AccountV3Upgradable(erc4337EntryPoint, multicallForwarder, erc6551Registry, guardian)
    { }

    /// @notice Initializes the GardenAccount with initial gardeners and operators.
    /// @dev This function must be called after the contract is deployed.
    /// @param _communityToken The address of the community token associated with the garden.
    /// @param _name The name of the garden.
    /// @param _description The description of the garden.
    /// @param _gardeners An array of addresses representing the initial gardeners.
    /// @param _gardenOperators An array of addresses representing the initial garden operators.
    function initialize(
        address _communityToken,
        string calldata _name,
        string calldata _description,
        string calldata _location,
        string calldata _bannerImage,
        address[] calldata _gardeners,
        address[] calldata _gardenOperators
    )
        external
        initializer
    {
        // Validate array lengths to prevent gas exhaustion
        require(_gardeners.length <= 100, "Too many gardeners");
        require(_gardenOperators.length <= 100, "Too many operators");
        
        // Validate community token is a valid ERC-20
        _validateCommunityToken(_communityToken);

        communityToken = _communityToken;
        name = _name;
        description = _description;
        location = _location;
        bannerImage = _bannerImage;

        // Enable open joining for root garden (tokenId 1)
        (,, uint256 tokenId) = token();
        openJoining = (tokenId == 1);

        gardeners[_msgSender()] = true;
        gardenOperators[_msgSender()] = true;

        for (uint256 i = 0; i < _gardeners.length; i++) {
            gardeners[_gardeners[i]] = true;
            emit GardenerAdded(_msgSender(), _gardeners[i]);
        }

        for (uint256 i = 0; i < _gardenOperators.length; i++) {
            gardenOperators[_gardenOperators[i]] = true;
            emit GardenOperatorAdded(_msgSender(), _gardenOperators[i]);
        }

        emit NameUpdated(_msgSender(), _name);
        emit DescriptionUpdated(_msgSender(), _description);

        emit GardenerAdded(_msgSender(), _msgSender());
        emit GardenOperatorAdded(_msgSender(), _msgSender());
    }

    /// @notice Updates the name of the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param _name The new name of the garden.
    function updateName(string memory _name) external onlyGardenOwner {
        name = _name;

        emit NameUpdated(_msgSender(), _name);
    }

    /// @notice Updates the description of the garden.
    /// @dev Only callable by garden operators.
    /// @param _description The new description of the garden.
    function updateDescription(string memory _description) external onlyOperator {
        description = _description;

        emit DescriptionUpdated(_msgSender(), _description);
    }

    /// @notice Adds a new gardener to the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param gardener The address of the gardener to add.
    function addGardener(address gardener) external onlyOperator {
        gardeners[gardener] = true;

        emit GardenerAdded(_msgSender(), gardener);
    }

    /// @notice Removes an existing gardener from the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param gardener The address of the gardener to remove.
    function removeGardener(address gardener) external onlyOperator {
        gardeners[gardener] = false;

        emit GardenerRemoved(_msgSender(), gardener);
    }

    /// @notice Adds a new operator to the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param operator The address of the operator to add.
    function addGardenOperator(address operator) external onlyOperator {
        gardenOperators[operator] = true;

        emit GardenOperatorAdded(_msgSender(), operator);
    }

    /// @notice Removes an existing operator from the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param operator The address of the operator to remove.
    function removeGardenOperator(address operator) external onlyGardenOwner {
        gardenOperators[operator] = false;

        emit GardenOperatorRemoved(_msgSender(), operator);
    }

    /// @notice Creates an invite code for the garden.
    /// @dev Only callable by garden operators. Invite codes allow users to join the garden.
    /// @param inviteCode The unique code for the invite.
    /// @param expiry The expiration timestamp for the invite.
    function createInviteCode(bytes32 inviteCode, uint256 expiry) external onlyOperator {
        if (gardenInvites[inviteCode]) revert InviteAlreadyExists();
        if (expiry <= block.timestamp) revert InvalidExpiry();

        gardenInvites[inviteCode] = true;
        inviteToGarden[inviteCode] = address(this);
        inviteExpiry[inviteCode] = expiry;

        emit InviteCreated(inviteCode, address(this), _msgSender(), expiry);
    }

    /// @notice Allows a user to join the garden using a valid invite code.
    /// @dev This function can be called by anyone with a valid invite code.
    /// @param inviteCode The unique code for the invite.
    function joinGardenWithInvite(bytes32 inviteCode) external {
        if (!gardenInvites[inviteCode]) revert InvalidInvite();
        if (inviteUsed[inviteCode]) revert InviteAlreadyUsed();
        if (block.timestamp > inviteExpiry[inviteCode]) revert InviteExpired();
        if (gardeners[_msgSender()]) revert AlreadyGardener();

        gardeners[_msgSender()] = true;
        inviteUsed[inviteCode] = true;

        emit InviteUsed(inviteCode, address(this), _msgSender());
        emit GardenerAdded(address(this), _msgSender());
    }

    /// @notice Revokes an unused invite code.
    /// @dev Only callable by garden operators.
    /// @param inviteCode The unique code for the invite to revoke.
    function revokeInvite(bytes32 inviteCode) external onlyOperator {
        if (!gardenInvites[inviteCode]) revert InvalidInvite();
        if (inviteUsed[inviteCode]) revert InviteAlreadyUsed();

        delete gardenInvites[inviteCode];
        delete inviteToGarden[inviteCode];
        delete inviteExpiry[inviteCode];

        emit InviteRevoked(inviteCode, address(this));
    }

    /// @notice Join garden if open joining is enabled
    /// @dev Allows anyone to join without invite code if openJoining is true
    function joinGarden() external {
        if (!openJoining) revert InvalidInvite();
        if (gardeners[_msgSender()]) revert AlreadyGardener();

        gardeners[_msgSender()] = true;
        emit GardenerAdded(address(this), _msgSender());
    }

    /// @notice Validates that the provided address is a valid ERC-20 token contract
    /// @dev Checks: non-zero address, has contract code, implements ERC-20 totalSupply
    /// @param _token The token address to validate
    function _validateCommunityToken(address _token) private view {
        // Check non-zero address
        if (_token == address(0)) {
            revert InvalidCommunityToken();
        }

        // Check that address contains contract code
        if (_token.code.length == 0) {
            revert CommunityTokenNotContract();
        }

        // Attempt to call totalSupply() to verify it's an ERC-20
        // This provides a basic sanity check without requiring full interface compliance
        try IERC20(_token).totalSupply() returns (uint256) {
            // Success - the contract implements at least the totalSupply function
            // This is a good indicator it's an ERC-20 token
        } catch {
            revert InvalidERC20Token();
        }
    }

    /// @notice Storage gap for upgradeable contract
    /// @dev Reserve 50 slots minus 14 existing state variables = 36 slots
    /// State variables: communityToken(1) + name(1) + description(1) + location(1) +
    /// bannerImage(1) + gardeners(1) + gardenOperators(1) + gardenInvites(1) +
    /// inviteToGarden(1) + inviteExpiry(1) + inviteUsed(1) + openJoining(1) +
    /// Initializable(1) + AccountV3Upgradable inherited slots(1) = 14
    uint256[36] private __gap;
}
