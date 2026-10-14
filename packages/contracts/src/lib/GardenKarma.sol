// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IProjectResolver } from "../interfaces/IKarma.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { KarmaLib } from "./Karma.sol";

/// @notice Storage-neutral GardenAccount adapter that keeps ProjectResolver calls account-owned.
library GardenKarmaLib {
    function syncProjectAccess(
        IKarmaGAPModule module,
        IHatsModule hats,
        address account
    )
        internal
        returns (bool roleActive, bool changed)
    {
        bytes32 projectUID = module.getProjectUID(address(this));
        if (projectUID == bytes32(0)) return (false, false);

        roleActive = hats.isOwnerOf(address(this), account) || hats.isStewardOf(address(this), account);
        IProjectResolver resolver = IProjectResolver(KarmaLib.getProjectResolver());
        if (roleActive) {
            if (resolver.isAdmin(projectUID, account)) return (true, false);
            resolver.addAdmin(projectUID, account);
            return (true, true);
        }

        if (!resolver.projectAdmins(projectUID, account)) return (false, false);
        resolver.removeAdmin(projectUID, account);
        return (false, true);
    }

    function reconcileDetails(IKarmaGAPModule module) internal returns (bool succeeded) {
        if (address(module) == address(0)) return false;
        try module.reconcileProject(address(this)) {
            return true;
        } catch {
            return false;
        }
    }
}
