// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18;

import { AccountV3Upgradable } from "tokenbound/AccountV3Upgradable.sol";
import {Initializable} from "openzeppelin-contracts/proxy/utils/Initializable.sol";

error NotCreatureOwner();
error TransferNotStarted();
error NotGoodTransferResolver();

contract CampaignAccount is AccountV3Upgradable, Initializable {
    enum TransferStatus {
        None,
        Started,
        Approved
    }
    
    // AccountTypeEnum constant ACCOUNT_TYPE = AccountTypeEnum.Creature;
    address private _world;
    address private _goodTransferResolver;
    string public nfcId;

    address private _buyer;
    uint256 public transferStartedAt;
    TransferStatus public transferStatus;

    constructor(
        address world,
        address goodTransferResolver,
        address erc4337EntryPoint,
        address multicallForwarder,
        address erc6551Registry,
        address guardian
    ) AccountV3Upgradable(erc4337EntryPoint, multicallForwarder, erc6551Registry, guardian) {
        _world = world;
        _goodTransferResolver = goodTransferResolver;
    }

    function initialize(string memory _nfcId) external initializer {
        nfcId = _nfcId;
    }

    function compesateContribution(string memory name) external {
        if (_isValidSigner(msg.sender, "")) {
            revert NotCreatureOwner();
        }

    }
}
