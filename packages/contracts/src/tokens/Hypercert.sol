// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

contract Hypercert is ERC1155 {
    using Counters for Counters.Counter;
    Counters.Counter private _hypercertIdCounter;

    constructor()ERC1155("sweet uri bro"){
        //
    }

    function mint(uint256 amount) public returns(uint){
        uint256 id = _hypercertIdCounter.current();
        _hypercertIdCounter.increment();
        _mint(
            msg.sender,
            id,
            amount,
            abi.encodePacked("0")
        );
        return(id);
    }

}