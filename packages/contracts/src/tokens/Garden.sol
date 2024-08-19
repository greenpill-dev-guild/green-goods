// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

import { TBALib } from "../lib/TBA.sol";
import { GardenAccount } from "../accounts/Garden.sol";

contract GardenToken is ERC721Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 private _nextTokenId;
    address private _gardenAccountImplementation;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address gardenAccountImplementation) ERC721Upgradeable() {
        _gardenAccountImplementation = gardenAccountImplementation;
    }

    function initialize(address _multisig) external initializer {
        __ERC721_init("Green Goods Garden", "GGG");
        __Ownable_init();
        transferOwnership(_multisig);
    }

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
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
