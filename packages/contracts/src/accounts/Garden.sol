// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

error NotGardenOwner();
error TransferNotStarted();
error NotGoodTransferResolver();

contract GardenAccount is AccountV3Upgradable, Initializable {
    address public communityToken;
    string public name;

    mapping(address gardener => bool isGardener) public gardeners;
    mapping(address operator => bool isOperator) public gardenOperators;

    constructor(
        address erc4337EntryPoint,
        address multicallForwarder,
        address erc6551Registry,
        address guardian
    ) AccountV3Upgradable(erc4337EntryPoint, multicallForwarder, erc6551Registry, guardian) {}

    function initialize(
        address _communityToken,
        string calldata _name,
        address[] calldata _gardeners,
        address[] calldata _gardenOperators
    ) external initializer {
        communityToken = _communityToken;
        name = _name;

        for (uint256 i = 0; i < _gardeners.length; i++) {
            gardeners[_gardeners[i]] = true;
        }

        for (uint256 i = 0; i < _gardenOperators.length; i++) {
            gardenOperators[_gardenOperators[i]] = true;
        }
    }

    function updateName(string memory _name) external {
        if (_isValidSigner(msg.sender, "")) {
            revert NotGardenOwner();
        }

        name = _name;
    }

    function addGardener(address gardener) external {
        if (_isValidSigner(msg.sender, "")) {
            revert NotGardenOwner();
        }

        gardeners[gardener] = true;
    }

    function removeGardener(address gardener) external {
        if (_isValidSigner(msg.sender, "")) {
            revert NotGardenOwner();
        }

        gardeners[gardener] = false;
    }

    function addGardenOperator(address operator) external {
        if (_isValidSigner(msg.sender, "")) {
            revert NotGardenOwner();
        }

        gardenOperators[operator] = true;
    }

    function removeGardenOperator(address operator) external {
        if (_isValidSigner(msg.sender, "")) {
            revert NotGardenOwner();
        }

        gardenOperators[operator] = false;
    }
}
