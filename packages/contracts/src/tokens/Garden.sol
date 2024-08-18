// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import { TBALib } from "../lib/TBA.sol";
import { GardenAccount } from "../accounts/Garden.sol";

contract GardenToken is Ownable, ERC721 {
    uint256 private _nextTokenId;
    address private _gardenAccountImplementation;

    constructor(
        address gardenAccountImplementation
    ) ERC721("Green Goods Garden", "GGG") {
        _gardenAccountImplementation = gardenAccountImplementation;
    }

    function mintGarden(
        address communityToken,
        string calldata name,
        address[] calldata gardeners,
        address[] calldata gardenOperators
    ) external onlyOwner() {
        uint256 tokenId = _nextTokenId++;
        _safeMint(_msgSender(), tokenId);

        address gardenAccount = TBALib.createAccount(_gardenAccountImplementation, address(this), tokenId);

        GardenAccount(payable(gardenAccount)).initialize(communityToken, name, gardeners, gardenOperators);
    }
}
