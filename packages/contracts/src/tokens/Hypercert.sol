// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Hypercert is ER1155 {
    constructor()ERC1155("sweet uri bro"){
        //
    }

function mint(uint256 amount) public {
        uint256 id = _campaignIdCounter.current();
        _campaignIdCounter.increment();
        _mint(
            msg.sender,
            id,
            amount,
            abi.encodePacked("0")
        );
    }

}