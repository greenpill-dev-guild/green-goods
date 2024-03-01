// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18;

import { AccountV3Upgradable } from "tokenbound/AccountV3Upgradable.sol";
import {Initializable} from "openzeppelin-contracts/proxy/utils/Initializable.sol";

error NotTeamMember();
error NotConfirmationResolver();
error AlreadyCompensated();

contract CampaignAccount is AccountV3Upgradable, Initializable {
    address private confirmationResolver;

    uint256 public startDate;
    uint256 public endDate;
    uint256 public hypercertId;
    string[] public capitals;
    mapping (address => bool) public team;
    mapping (uint256 => bool) public contributions;

    constructor(
        address _confirmationResolver,
        address _erc4337EntryPoint,
        address _multicallForwarder,
        address _erc6551Registry,
        address _guardian
    ) AccountV3Upgradable(_erc4337EntryPoint, _multicallForwarder, _erc6551Registry, _guardian) {
        confirmationResolver = confirmationResolver;
    }

    function initialize(
        uint256 _startDate,
        uint256 _endDate,
        string[] memory _capitals,
        address[] memory _team // Users smart account address
    ) external initializer returns (uint256) {
        startDate = _startDate;
        endDate = _endDate;
        capitals = _capitals;

        for (uint256 i = 0; i < _team.length; i++) {
            team[_team[i]] = true;
        }
        
        // TODO: Mint hypercert

        return hypercertId;
    }

    function compesateContribution(
        address _recipient,
        uint256 _amount,
        uint256 _contributionId
    ) external {
        if (msg.sender != confirmationResolver) {
            revert NotConfirmationResolver();
        }

        if (contributions[_contributionId]) {
            revert AlreadyCompensated();
        }

        // TODO: Transfer fraction of hypercert

        contributions[_contributionId] = true;

    }

    function owner2() public view returns(address){
        return(0x00000000000000000000000000000000000A11cE);
    }
}
