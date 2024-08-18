// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkApprovalSchema } from "../Schemas.sol";
import { ActionRegistry } from "../registries/Action.sol";
import { NotGardenAccount, NotGardenerAccount, NotInActionRegistry } from "../Constants.sol";

error NotInWorkRegistry();
error NotGardenOperator();

/// @title WorkApprovalResolver
/// @notice A schema resolver for the Actions event schema
contract WorkApprovalResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddrs) SchemaResolver(IEAS(easAddrs)) {
        _disableInitializers();
    }

    function initialize() external initializer {
        // __Ownable_init();
    }

    function isPayable() public pure override returns (bool) {
        return true;
    }

    function onAttest(Attestation calldata attestation, uint256 /*value*/ )
        internal
        override
        returns (bool)
    {   
        WorkApprovalSchema memory schema = abi.decode(attestation.data, (WorkApprovalSchema));
        // CampaignAccount campaignAccount = CampaignAccount(payable(schema.campAccount));

        // if (!campaignAccount.isCampaign()) {
        //     revert NotCampaignAccount();
        // }

        // if (!campaignAccount.team(attestation.attester)) {
        //     revert NotAllowed();
        // }

        // if(schema.approval){campaignAccount.compensateContribution(
        //     attestation.recipient,
        //     4,//schema.amount, 
        //     schema.contributionId
        // );}

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
