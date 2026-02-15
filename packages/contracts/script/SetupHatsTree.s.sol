// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

import { IHats } from "../src/interfaces/IHats.sol";
import { HatsLib } from "../src/lib/Hats.sol";
import { HatsModule } from "../src/modules/Hats.sol";

/// @title SetupHatsTree
/// @notice Creates the Green Goods protocol hat tree and configures HatsModule
/// @dev Intended for testnets (e.g., Sepolia) when the Hats UI is unavailable
///
/// Environment Variables:
/// - HATS_MODULE: HatsModule proxy address (required to sync IDs)
/// - HATS_PROTOCOL: Override Hats Protocol address (optional)
/// - HATS_CREATE_TOP_HAT: true/false to mint a new top hat (default true)
/// - COMMUNITY_HAT_ID: Existing top hat ID (required if HATS_CREATE_TOP_HAT=false)
/// - HATS_COMMUNITY_DETAILS: Top hat details string (optional)
/// - HATS_GARDENS_DETAILS: Gardens hat details string (optional)
/// - HATS_PROTOCOL_GARDENERS_DETAILS: Protocol gardeners hat details string (optional)
contract SetupHatsTree is Script {
    error MissingCommunityHatId();

    function run() external {
        address hatsModuleAddress = _envAddress("HATS_MODULE", address(0));
        address hatsAddress = _envAddress("HATS_PROTOCOL", HatsLib.getHatsProtocol());
        bool createTopHat = _envBool("HATS_CREATE_TOP_HAT", true);

        string memory communityDetails = _envString("HATS_COMMUNITY_DETAILS", "Green Goods Community");
        string memory gardensDetails = _envString("HATS_GARDENS_DETAILS", "Green Goods Gardens");
        string memory protocolGardenersDetails = _envString("HATS_PROTOCOL_GARDENERS_DETAILS", "Green Goods Gardeners");

        IHats hats = IHats(hatsAddress);

        vm.startBroadcast();

        uint256 communityHatId;
        if (createTopHat) {
            communityHatId = hats.mintTopHat(msg.sender, communityDetails, "");
        } else {
            communityHatId = vm.envUint("COMMUNITY_HAT_ID");
            if (communityHatId == 0) revert MissingCommunityHatId();
        }

        uint256 gardensHatId =
            hats.createHat(communityHatId, gardensDetails, type(uint32).max, address(0), address(0), true, "");

        uint256 protocolGardenersHatId =
            hats.createHat(communityHatId, protocolGardenersDetails, type(uint32).max, address(0), address(0), true, "");

        if (hatsModuleAddress != address(0)) {
            hats.mintHat(gardensHatId, hatsModuleAddress);
            if (HatsModule(hatsModuleAddress).owner() == msg.sender) {
                HatsModule(hatsModuleAddress).setProtocolHatIds(communityHatId, gardensHatId, protocolGardenersHatId);
            } else {
                console.log("Skipping setProtocolHatIds: caller is not HatsModule owner");
            }
        }

        vm.stopBroadcast();

        console.log("Green Goods Hats tree created:");
        console.log("  Community (Top Hat):", communityHatId);
        console.log("  Gardens Hat:", gardensHatId);
        console.log("  Protocol Gardeners Hat:", protocolGardenersHatId);
    }

    function _envAddress(string memory key, address defaultValue) internal view returns (address value) {
        try vm.envAddress(key) returns (address found) {
            return found;
        } catch {
            return defaultValue;
        }
    }

    function _envBool(string memory key, bool defaultValue) internal view returns (bool value) {
        try vm.envBool(key) returns (bool found) {
            return found;
        } catch {
            return defaultValue;
        }
    }

    function _envString(string memory key, string memory defaultValue) internal view returns (string memory value) {
        try vm.envString(key) returns (string memory found) {
            return found;
        } catch {
            return defaultValue;
        }
    }
}
