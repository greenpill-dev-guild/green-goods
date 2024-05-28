// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import { CampaignAccount } from "../accounts/Campaign.sol";

import { TBALib } from "../lib/TBA.sol";

contract CampaignToken is ERC721 {
    using Strings for uint256;

    event CampaignCreated(address indexed creator, address indexed tba, /*uint256 hypercertId,*/ string[] capitals, string metadata);

    address private implementation;
    address private confirmationResolver;
    address public hypercert;

    using Counters for Counters.Counter;

    Counters.Counter private _campaignIdCounter;

    constructor(
        address _implementation,
        address _confirmationResolver,
        address _hypercert
    ) ERC721("Greenpill Campaign", "GPC") {
        implementation = _implementation;
        confirmationResolver = _confirmationResolver;
        hypercert = _hypercert;
    }

    //how to gate this so only app users can mint
    function createCampaign(
        uint256 _startDate,
        uint256 _endDate,
        string calldata _metadata,
        string[] calldata _capitals,
        address[] calldata _team
    ) external returns(address, uint256){
        uint256 id = _campaignIdCounter.current();
    
        _campaignIdCounter.increment();
        _mint(msg.sender, id);

        address campaignAddrs = TBALib.createAccount(address(implementation), address(this), id);

        uint256 hypeId = CampaignAccount(payable(campaignAddrs)).initialize(_startDate, _endDate, _metadata, _capitals, _team, hypercert);

        emit CampaignCreated(msg.sender, campaignAddrs, _capitals, _metadata);
    
        return(campaignAddrs, hypeId);
    }
}
