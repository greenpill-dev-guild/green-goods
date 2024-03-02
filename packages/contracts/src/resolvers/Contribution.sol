// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {IEAS, Attestation} from "eas-contracts/IEAS.sol";
import {SchemaResolver} from "eas-contracts/resolver/SchemaResolver.sol";
import "openzeppelin-contracts/proxy/utils/UUPSUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/access/OwnableUpgradeable.sol";

import {CampaignToken} from "../tokens/Campaign.sol";
import {CampaignAccount} from "../accounts/Campaign.sol";

/// @title ContributionResolver
/// @notice A schema resolver for the Contributions event schema
contract ContributionResolver is SchemaResolver, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    struct ContributionSchema {
        uint256 value;
        uint256 created_at; 
        address campaign;
        string title;
        string description;
        string[] media;
        string[] capitals;
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
        CampaignAccount campaignAccount = CampaignAccount(attestation.recipient);
        
        return(campaignAccount.isCampaign());
    }

    function onRevoke(Attestation calldata attestation, uint256 /*value*/ )
        internal
        view
        override
        onlyOwner
        returns (bool)
    {
        require(attestation.attester == owner(), "ContributionResolver: only owner can revoke");

        return true;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
