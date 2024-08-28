// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

error NotGardenOwner();

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

    /// @notice The community token associated with this garden.
    address public communityToken;

    /// @notice The name of the garden.
    string public name;

    /// @notice The description of the garden.
    string public description;

    /// @notice Mapping of gardener addresses to their status.
    mapping(address gardener => bool isGardener) public gardeners;

    /// @notice Mapping of garden operator addresses to their status.
    mapping(address operator => bool isOperator) public gardenOperators;

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
    ) AccountV3Upgradable(erc4337EntryPoint, multicallForwarder, erc6551Registry, guardian) {}

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
        address[] calldata _gardeners,
        address[] calldata _gardenOperators
    ) external initializer {
        communityToken = _communityToken;
        name = _name;
        description = _description;

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
    function updateName(string memory _name) external {
        if (_isValidSigner(_msgSender(), "")) {
            revert NotGardenOwner();
        }

        name = _name;

        emit NameUpdated(_msgSender(), _name);
    }

    /// @notice Updates the description of the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param _description The new description of the garden.
    function updateDescription(string memory _description) external {
        if (_isValidSigner(_msgSender(), "")) {
            revert NotGardenOwner();
        }

        description = _description;

        emit DescriptionUpdated(_msgSender(), _description);
    }

    /// @notice Adds a new gardener to the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param gardener The address of the gardener to add.
    function addGardener(address gardener) external {
        if (_isValidSigner(_msgSender(), "")) {
            revert NotGardenOwner();
        }

        gardeners[gardener] = true;

        emit GardenerAdded(_msgSender(), gardener);
    }

    /// @notice Removes an existing gardener from the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param gardener The address of the gardener to remove.
    function removeGardener(address gardener) external {
        if (_isValidSigner(_msgSender(), "")) {
            revert NotGardenOwner();
        }

        gardeners[gardener] = false;

        emit GardenerRemoved(_msgSender(), gardener);
    }

    /// @notice Adds a new operator to the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param operator The address of the operator to add.
    function addGardenOperator(address operator) external {
        if (_isValidSigner(_msgSender(), "")) {
            revert NotGardenOwner();
        }

        gardenOperators[operator] = true;

        emit GardenOperatorAdded(_msgSender(), operator);
    }

    /// @notice Removes an existing operator from the garden.
    /// @dev Only callable by a valid signer of the contract.
    /// @param operator The address of the operator to remove.
    function removeGardenOperator(address operator) external {
        if (_isValidSigner(_msgSender(), "")) {
            revert NotGardenOwner();
        }

        gardenOperators[operator] = false;

        emit GardenOperatorRemoved(_msgSender(), operator);
    }
}
