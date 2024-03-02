// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18;

import { AccountV3Upgradable } from "tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "openzeppelin-contracts/proxy/utils/Initializable.sol";

import { IHypercertToken } from "../interfaces/IHypercertToken.sol";

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

    //IHypercertToken hypercert = IHypercertToken(0xC2d179166bc9dbB00A03686a5b17eCe2224c2704);

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
        string calldata _metadata,
        string[] memory _capitals,
        address[] memory _team // Users smart account address
    ) external initializer returns (uint256) {
        startDate = _startDate;
        endDate = _endDate;

        for (uint256 i = 0; i < _team.length; i++) {
            team[_team[i]] = true;
        }

        for (uint256 i = 0; i < _capitals.length; i++) {
            capitals.push(_capitals[i]);
        }
        
        IHypercertToken(0xC2d179166bc9dbB00A03686a5b17eCe2224c2704).mintClaim(address(this), 100, _metadata, IHypercertToken.TransferRestrictions.FromCreatorOnly);


        //return hypercertId;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes memory data
    ) public override returns (bytes4){
        if(operator == address(this)){
            hypercertId = id;
        }
    _handleOverride();
        return this.onERC1155Received.selector;
    /**
     * @dev Handles the receipt of a multiple ERC1155 token types. This function
     * is called at the end of a `safeBatchTransferFrom` after the balances have
     * been updated.
     *
     * NOTE: To accept the transfer(s), this must return
     * `bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`
     * (i.e. 0xbc197c81, or its own function selector).
     *
     * @param operator The address which initiated the batch transfer (i.e. msg.sender)
     * @param from The address which previously owned the token
     * @param ids An array containing ids of each token being transferred (order and length must match values array)
     * @param values An array containing amounts of each token being transferred (order and length must match ids array)
     * @param data Additional data with no specified format
     * @return `bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))` if transfer is allowed
     */
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

    
}
