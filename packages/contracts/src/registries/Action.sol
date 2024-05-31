// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Strings } from "openzeppelin-contracts/utils/Strings.sol";
import { ERC721 } from "openzeppelin-contracts/token/ERC721/ERC721.sol";

contract ActionRegistry is ERC721 {
    using Strings for uint256;

    event ActionCreated(address indexed creator, address indexed tba, /*uint256 hypercertId,*/ string[] capitals, string metadata);

    address private implementation;
    address private confirmationResolver;
    address public hypercert;


    constructor(
        address _implementation,
        address _confirmationResolver,
        address _hypercert
    ) ERC721("Greenpill Action", "GPC") {
        implementation = _implementation;
        confirmationResolver = _confirmationResolver;
        hypercert = _hypercert;
    }

    //how to gate this so only app users can mint
    function createAction(
        uint256 _startDate,
        uint256 _endDate,
        string calldata _metadata,
        string[] calldata _capitals,
        address[] calldata _team
    ) external returns(address, uint256){
    
        // _mint(msg.sender, id);

        // emit ActionCreated(msg.sender, actionAddrs, _capitals, _metadata);
    
        // return(actionAddrs, hypeId);
    }
}
