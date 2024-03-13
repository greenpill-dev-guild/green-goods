// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18;

import { AccountV3Upgradable } from "tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "openzeppelin-contracts/proxy/utils/Initializable.sol";

import { Hypercert } from "../tokens/Hypercert.sol";

error NotTeamMember();
error NotConfirmationResolver();
error AlreadyCompensated();
error NotEnoughFragments();

contract CampaignAccount is AccountV3Upgradable, Initializable {
    address private confirmationResolver;

    uint256 public startDate;
    uint256 public endDate;
    uint256 public hypercertId;
    uint256 public tempHypercertId;
    string[] public capitals;
    mapping (address => bool) public team;
    mapping (uint256 => bool) public contributions;
    address public hypercert;

    uint256[] private values;

    constructor(
        address _confirmationResolver,
        address _erc4337EntryPoint,
        address _multicallForwarder,
        address _erc6551Registry,
        address _guardian
    ) AccountV3Upgradable(_erc4337EntryPoint, _multicallForwarder, _erc6551Registry, _guardian) {
        confirmationResolver = _confirmationResolver;    
    }

    function initialize(
        uint256 _startDate,
        uint256 _endDate,
        string calldata _metadata,
        string[] memory _capitals,
        address[] memory _team,
        address _hypercert 
    ) external initializer returns (uint256) {
        startDate = _startDate;
        endDate = _endDate;
        hypercert = _hypercert;

        for (uint256 i = 0; i < _team.length; i++) {
            team[_team[i]] = true;
        }

        for (uint256 i = 0; i < _capitals.length; i++) {
            capitals.push(_capitals[i]);
        }
        
        hypercertId = Hypercert(hypercert).mint(100);

        return hypercertId;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes memory data
    ) public override returns (bytes4){
        // if(operator == address(this) && hypercertId == 0){
        //     hypercertId = id;
        // } else if(operator == address(this)){
        //     tempHypercertId = id;
        // }
        _handleOverride();
        return this.onERC1155Received.selector;
    }

    function compensateContribution(
        address _recipient,
        uint256 _amount,
        uint256 _contributionId
    ) external {
        // this is throwing when it should not, not sure why.
        if (_msgSender() != confirmationResolver) {
            revert NotConfirmationResolver();
        }

        if (contributions[_contributionId]) {
            revert AlreadyCompensated();
        }

        uint256 totalValueLeft = Hypercert(hypercert).balanceOf(address(this), hypercertId);
        
        if(totalValueLeft >= _amount){
            Hypercert(hypercert).safeTransferFrom(address(this), _recipient, tempHypercertId, _amount, abi.encodePacked("0"));
        } else {
            revert NotEnoughFragments();
        }
         //else{
            // if(values.length > 0) values.pop();
            // values.push(_amount);
            // //hypercert.splitFraction(address(this), hypercertId, values);
            // hypercert.safeTransferFrom(address(this), _recipient, tempHypercertId, _amount, abi.encodePacked("0"));
        // TODO: Transfer fraction of hypercert
        //}
        
        contributions[_contributionId] = true;
    }

    function isCampaign() public pure returns(bool){
        return(true);
    }   
}
