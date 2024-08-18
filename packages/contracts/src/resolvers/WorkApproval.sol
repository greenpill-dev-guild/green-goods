// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { SchemaResolver } from "@eas/resolver/SchemaResolver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { WorkApprovalSchema } from "../Schemas.sol";
import { GardenAccount } from "../accounts/Garden.sol";
import { ActionRegistry } from "../registries/Action.sol";
import { NotInActionRegistry } from "../Constants.sol";

error NotInWorkRegistry();
error NotGardenOperator();

/// @title WorkApprovalResolver
/// @notice A schema resolver for the Actions event schema
contract WorkApprovalResolver is SchemaResolver, OwnableUpgradeable, UUPSUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address easAddrs) SchemaResolver(IEAS(easAddrs)) {
        _disableInitializers();
    }

    function initialize(address _multisig) external initializer {
        __Ownable_init();
        transferOwnership(_multisig);
    }

    function isPayable() public pure override returns (bool) {
        return true;
    }

    function onAttest(Attestation calldata attestation, uint256 /*value*/) internal override returns (bool) {
        WorkApprovalSchema memory schema = abi.decode(attestation.data, (WorkApprovalSchema));
        Attestation memory workAttestation = _eas.getAttestation(schema.workUID);

        if (workAttestation.attester != attestation.recipient) {
            revert NotInWorkRegistry();
        }

        GardenAccount gardenAccount = GardenAccount(payable(workAttestation.recipient));

        if (gardenAccount.gardenOperators(attestation.attester) == false) {
            revert NotGardenOperator();
        }

        if (ActionRegistry(ActionRegistry(actionRegistry).idToAction(schema.actionUID)).startTime == 0) {
            revert NotInActionRegistry();
        }

        return (true);
    }

    // solhint-disable no-unused-vars
    function onRevoke(
        Attestation calldata attestation,
        uint256 /*value*/
    ) internal view override onlyOwner returns (bool) {
        return true;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
