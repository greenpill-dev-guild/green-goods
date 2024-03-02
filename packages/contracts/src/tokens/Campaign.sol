// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "base64/base64.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccountProxy } from "tokenbound/AccountProxy.sol";

import { CampaignAccount } from "../accounts/Campaign.sol";

import { TBALib } from "../lib/TBA.sol";

contract CampaignToken is ERC721 {
    using Strings for uint256;

    event CampaignCreated(address indexed owner, address indexed tba, /*uint256 hypercertId,*/ string[] capitals, string metadata);

    address private implementation;
    address private confirmationResolver;

    using Counters for Counters.Counter;

    Counters.Counter private _campaignIdCounter;

    constructor(address _implementation, address _confirmationResolver) ERC721("Greenpill Campaign", "GPC") {
        implementation = _implementation;
        confirmationResolver = _confirmationResolver;
    }

    //how to gate this so only app users can mint
    function createCampaign(
        uint _startDate,
        uint _endDate,
        string calldata _metadata,
        string[] calldata _capitals,
        address[] calldata _team
    ) external returns(address){
        uint256 id = _campaignIdCounter.current();
    
        _campaignIdCounter.increment();
        _mint(msg.sender, id);

        address campaignAddrs = TBALib.createAccount(address(implementation), address(this), id);

        CampaignAccount(payable(campaignAddrs)).initialize(_startDate, _endDate, _metadata, _capitals, _team);

        emit CampaignCreated(msg.sender, campaignAddrs, /*hypercertId,*/ _capitals, _metadata);
    
        return campaignAddrs;
    }

    // function owner2() public view returns(address){
    //     return(0x00000000000000000000000000000000000A11cE);
    // }

    // function initializeData(uint _id, uint _hypercertId) public {
    //     require(msg.sender == ownerOf(_id), "not owner");
    //     traitData[_id].hypercertId = _hypercertId;
    //     traitData[_id].initialized = true;
    // }
}
