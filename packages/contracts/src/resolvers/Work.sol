// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkSchema } from "../Schemas.sol";
import { GardenAccount } from "../accounts/Garden.sol";
import { ActionRegistry } from "../registries/Action.sol";
import { NotGardenerAccount, NotInActionRegistry } from "../Constants.sol";

error NotActiveAction();

/// @title WorkResolver
/// @notice A schema resolver for the Actions event schema
contract WorkResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    address public actionRegistry;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddrs, address actionAddrs) SchemaResolver(IEAS(easAddrs)) {
        actionRegistry = actionAddrs;
        _disableInitializers();
    }

    function initialize(address _multisig) external initializer {
        __Ownable_init();
        transferOwnership(_multisig);
    }

    function isPayable() public pure override returns (bool) {
        return true;
    }

    function onAttest(Attestation calldata attestation, uint256 /*value*/ )
        internal
        override
        returns (bool)
    {   
        WorkSchema memory schema = abi.decode(attestation.data, (WorkSchema));

        GardenAccount gardenAccount = GardenAccount(payable(attestation.recipient));

        if (gardenAccount.gardeners(attestation.attester) == false) {
            revert NotGardenerAccount();
        }

        // solhint-disable max-line-length
        if (
            ActionRegistry(actionRegistry).idToAction(schema.actionUID) == Action(0, 0, "", new Capital[](0), new string[](0))
        ) {
            revert NotInActionRegistry();
        }

        if (ActionRegistry(actionRegistry).idToAction(schema.actionUID).endTime < block.timestamp) {
            revert NotActiveAction();
        }

        return(true);
    }

    // solhint-disable no-unused-vars
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
