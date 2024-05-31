// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import { IEAS, Attestation } from "eas-contracts/IEAS.sol";
import { SchemaResolver } from "eas-contracts/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "openzeppelin-contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "openzeppelin-contracts-upgradeable/access/OwnableUpgradeable.sol";

error NotCampaignAccount();
error NotAllowed();

/// @title ActionResolver
/// @notice A schema resolver for the Actions event schema
contract ActionResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    struct ActionSchema {
        uint256  contributionId;
        bool approval;
        string feedback;
        address campAccount;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddrs) SchemaResolver(IEAS(easAddrs)) {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init();
    }

    function isPayable() public pure override returns (bool) {
        return true;
    }

    function onAttest(Attestation calldata attestation, uint256 /*value*/ )
        internal
        override
        returns (bool)
    {   
        ActionSchema memory schema = abi.decode(attestation.data, (ActionSchema));
        CampaignAccount campaignAccount = CampaignAccount(payable(schema.campAccount));

        if (!campaignAccount.isCampaign()) {
            revert NotCampaignAccount();
        }

        if (!campaignAccount.team(attestation.attester)) {
            revert NotAllowed();
        }

        if(schema.approval){campaignAccount.compensateContribution(
            attestation.recipient,
            4,//schema.amount, 
            schema.contributionId
        );}

        return(true);

    }

    function onRevoke(Attestation calldata attestation, uint256 /*value*/ )
        internal
        view
        override
        onlyOwner
        returns (bool)
    {
        return true;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
