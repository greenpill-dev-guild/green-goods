// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {IEAS, Attestation} from "eas-contracts/IEAS.sol";
import {SchemaResolver} from "eas-contracts/resolver/SchemaResolver.sol";
import "openzeppelin-contracts/proxy/utils/UUPSUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/access/OwnableUpgradeable.sol";

import {CampaignToken} from "../tokens/Campaign.sol";
import {CampaignAccount} from "../accounts/Campaign.sol";

/// @title ConfirmationResolver
/// @notice A schema resolver for the Confirmations event schema
contract ConfirmationResolver is SchemaResolver, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    struct ConfirmationSchema {
        bool approval;
        string  contributionId; //uint???
        uint256 created_at;
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
        CampaignAccount campaignAccount = CampaignAccount(payable(attestation.recipient));
        return(campaignAccount.isCampaign() && campaignAccount.team(attestation.attester));

        campaignAccount.compensateContribution(
            _recipient,
            _amount,
            _contributionId
            );

    }

    function onRevoke(Attestation calldata attestation, uint256 /*value*/ )
        internal
        view
        override
        onlyOwner
        returns (bool)
    {
        require(attestation.attester == owner(), "ConfirmationResolver: only owner can revoke");

        return true;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
