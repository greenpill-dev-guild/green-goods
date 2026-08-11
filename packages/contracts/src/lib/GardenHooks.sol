// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { ICookieJarModule } from "../interfaces/ICookieJarModule.sol";
import { IGardensModule } from "../interfaces/IGardensModule.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { OctantModule } from "../modules/Octant.sol";
import { ActionRegistry } from "../registries/Action.sol";

/// @title GardenHooksLib
/// @notice The best-effort integration notifications GardenToken fires while minting a garden.
/// @dev Every hook here is graceful degradation: an unset module is skipped and a reverting
///      module is swallowed, because a garden mint MUST NOT revert on integration failure.
///      Success and failure are observable through each module's own events. Internal-only:
///      inlined into GardenToken, never deployed.
library GardenHooksLib {
    /// @dev Best-effort role grants for a configured member list; zero addresses are skipped.
    function grantRolesBestEffort(
        IHatsModule hats,
        address gardenAccount,
        address[] calldata members,
        IHatsModule.GardenRole role
    )
        internal
    {
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] != address(0)) {
                // solhint-disable-next-line no-empty-blocks
                try hats.grantRole(gardenAccount, members[i], role) { } catch { }
            }
        }
    }

    function notifyKarma(
        IKarmaGAPModule module,
        address gardenAccount,
        address minter,
        string calldata name,
        string calldata description,
        string calldata location,
        string calldata bannerImage
    )
        internal
    {
        if (address(module) == address(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try module.createProject(gardenAccount, minter, name, description, location, bannerImage) { } catch { }
    }

    function notifyOctant(OctantModule module, address gardenAccount, string calldata name) internal {
        if (address(module) == address(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try module.onGardenMinted(gardenAccount, name) returns (address[] memory) { } catch { }
    }

    function notifyGardens(
        IGardensModule module,
        address gardenAccount,
        IGardensModule.WeightScheme weightScheme,
        string calldata name,
        string calldata description
    )
        internal
    {
        if (address(module) == address(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try module.onGardenMinted(gardenAccount, weightScheme, name, description) returns (address, address[] memory) { }
            catch { }
    }

    function notifyCookieJar(ICookieJarModule module, address gardenAccount) internal {
        if (address(module) == address(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try module.onGardenMinted(gardenAccount) returns (address[] memory) { } catch { }
    }

    function notifyPooling(ICommitmentPoolingModule module, address gardenAccount) internal {
        if (address(module) == address(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try module.onGardenMinted(gardenAccount) returns (uint256) { } catch { }
    }

    function notifyActionDomains(ActionRegistry registry, address gardenAccount, uint8 domainMask) internal {
        if (domainMask == 0 || address(registry) == address(0)) return;
        // solhint-disable-next-line no-empty-blocks
        try registry.setGardenDomainsFromMint(gardenAccount, domainMask) { } catch { }
    }
}
