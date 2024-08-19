// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

import { TBALib } from "../lib/TBA.sol";
import { GardenAccount } from "../accounts/Garden.sol";

/// @title GardenToken Contract
/// @notice This contract manages the minting of Garden tokens and the creation of associated Garden accounts.
/// @dev This contract is upgradable and follows the UUPS pattern.
contract GardenToken is ERC721Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 private _nextTokenId;
    address private _gardenAccountImplementation;

    /// @notice Emitted when a new Garden is minted.
    /// @param owner The owner of the minted Garden token.
    /// @param tokenId The unique identifier of the minted Garden token.
    /// @param name The name of the Garden associated with the minted token.
    event GardenMinted(address indexed owner, uint256 indexed tokenId, string name);

    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @param gardenAccountImplementation The address of the Garden account implementation.
    constructor(address gardenAccountImplementation) ERC721Upgradeable() {
        _gardenAccountImplementation = gardenAccountImplementation;
        _disableInitializers(); // Prevent constructor usage for upgradable contracts
    }

    /// @notice Initializes the contract with the given multisig wallet and Garden account implementation.
    /// @dev This function replaces the constructor for upgradable contracts.
    /// @param _multisig The address of the multisig wallet to set as the owner.
    function initialize(address _multisig) external initializer {
        __ERC721_init("Green Goods Garden", "GGG");
        __Ownable_init();
        transferOwnership(_multisig);
    }

    /// @notice Mints a new Garden token and creates the associated Garden account.
    /// @dev The Garden account is initialized with the provided parameters.
    /// @param communityToken The address of the community token associated with the Garden.
    /// @param name The name of the Garden.
    /// @param gardeners An array of addresses representing the gardeners of the Garden.
    /// @param gardenOperators An array of addresses representing the operators of the Garden.
    function mintGarden(
        address communityToken,
        string calldata name,
        address[] calldata gardeners,
        address[] calldata gardenOperators
    ) external onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(_msgSender(), tokenId);

        address gardenAccount = TBALib.createAccount(_gardenAccountImplementation, address(this), tokenId);

        GardenAccount(payable(gardenAccount)).initialize(communityToken, name, gardeners, gardenOperators);

        emit GardenMinted(_msgSender(), tokenId, name);
    }

    /// @notice Authorizes contract upgrades.
    /// @dev Restricted to the contract owner.
    /// @param newImplementation The address of the new contract implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
