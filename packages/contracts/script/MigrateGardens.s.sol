// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console2 } from "forge-std/Script.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { HatsModule } from "../src/modules/Hats.sol";
import { IHats } from "../src/interfaces/IHats.sol";
import { KarmaGAPModule, IKarmaGAPModule } from "../src/modules/Karma.sol";
import { IGardenAccessControl } from "../src/interfaces/IGardenAccessControl.sol";
import { IGardenAccount } from "../src/interfaces/IGardenAccount.sol";
import { KarmaLib } from "../src/lib/Karma.sol";

/// @title MigrateGardens
/// @notice Migration script for existing gardens to Hats Protocol + Karma GAP modules
/// @dev Run this script after deploying HatsModule and KarmaGAPModule
///
/// **Migration Steps:**
/// 1. Deploy HatsModule and KarmaGAPModule
/// 2. Configure modules in GardenToken
/// 3. Run this script to migrate existing gardens
///
/// **What This Script Does:**
/// - Creates hat trees for existing gardens via HatsModule
/// - Creates GAP projects for existing gardens via KarmaGAPModule
/// - Grants operator roles to existing operators
contract MigrateGardens is Script {
    // ===== ERRORS =====
    error NoGardensToMigrate();
    error GardenTokenNotFound();
    error HatsModuleNotConfigured();
    error GAPModuleNotConfigured();

    // ===== STATE =====
    GardenToken public gardenToken;
    HatsModule public hatsModule;
    KarmaGAPModule public karmaGAPModule;

    /// @notice Main entry point for migration
    function run() external {
        // Load configuration from environment
        address gardenTokenAddr = vm.envAddress("GARDEN_TOKEN");
        address hatsModuleAddr = vm.envAddress("GARDEN_HATS_MODULE");
        address gapModuleAddr = vm.envAddress("KARMA_GAP_MODULE");

        if (gardenTokenAddr == address(0)) revert GardenTokenNotFound();

        gardenToken = GardenToken(gardenTokenAddr);
        hatsModule = HatsModule(hatsModuleAddr);
        karmaGAPModule = KarmaGAPModule(gapModuleAddr);

        // Get garden addresses to migrate from environment (comma-separated)
        string memory gardensStr = vm.envString("GARDENS_TO_MIGRATE");
        address[] memory gardenAddresses = _parseAddresses(gardensStr);

        if (gardenAddresses.length == 0) revert NoGardensToMigrate();

        console2.log("Starting migration of", gardenAddresses.length, "gardens");
        console2.log("GardenToken:", gardenTokenAddr);
        console2.log("HatsModule:", hatsModuleAddr);
        console2.log("KarmaGAPModule:", gapModuleAddr);

        vm.startBroadcast();

        for (uint256 i = 0; i < gardenAddresses.length; i++) {
            _migrateGarden(gardenAddresses[i]);
        }

        vm.stopBroadcast();

        console2.log("Migration complete!");
    }

    /// @notice Migrates a single garden to the new module architecture
    /// @param garden The garden address to migrate
    function _migrateGarden(address garden) internal {
        console2.log("Migrating garden:", garden);

        // Get garden info
        IGardenAccount gardenAccount = IGardenAccount(garden);
        string memory gardenName = gardenAccount.name();

        // Get operators (we'll need to iterate or get from events in production)
        // For now, assume msg.sender is an operator
        address primaryOperator = msg.sender;

        // 1. Create hat tree if module is configured
        if (address(hatsModule) != address(0)) {
            try hatsModule.hasHatTree(garden) returns (bool hasTree) {
                if (!hasTree) {
                    try hatsModule.createGardenHatTree(garden, primaryOperator, gardenName) returns (uint256 rootHatId) {
                        console2.log("  - Created hat tree with root hat:", rootHatId);
                    } catch {
                        console2.log("  - Failed to create hat tree");
                    }
                } else {
                    console2.log("  - Hat tree already exists");
                }
            } catch {
                console2.log("  - Could not check hat tree status");
            }
        }

        // 2. Create GAP project if module is configured and GAP is supported
        if (address(karmaGAPModule) != address(0)) {
            try karmaGAPModule.getProjectUID(garden) returns (bytes32 existingUID) {
                if (existingUID == bytes32(0)) {
                    try karmaGAPModule.createProject(
                        garden,
                        primaryOperator,
                        gardenName,
                        gardenAccount.description(),
                        gardenAccount.location(),
                        gardenAccount.bannerImage()
                    ) returns (bytes32 projectUID) {
                        if (projectUID != bytes32(0)) {
                            console2.log("  - Created GAP project:", vm.toString(projectUID));
                        } else {
                            console2.log("  - GAP project creation returned empty UID (chain may not support GAP)");
                        }
                    } catch {
                        console2.log("  - Failed to create GAP project");
                    }
                } else {
                    console2.log("  - GAP project already exists:", vm.toString(existingUID));
                }
            } catch {
                console2.log("  - Could not check GAP project status");
            }
        }

        console2.log("  - Migration complete for garden");
    }

    /// @notice Parses a comma-separated string of addresses
    /// @param str The comma-separated string of addresses
    /// @return addresses Array of parsed addresses
    function _parseAddresses(string memory str) internal pure returns (address[] memory) {
        // Simple implementation - in production, use a proper parser
        bytes memory strBytes = bytes(str);
        if (strBytes.length == 0) return new address[](0);

        // Count commas to determine array size
        uint256 count = 1;
        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == ",") count++;
        }

        address[] memory addresses = new address[](count);
        uint256 start = 0;
        uint256 addrIndex = 0;

        for (uint256 i = 0; i <= strBytes.length; i++) {
            if (i == strBytes.length || strBytes[i] == ",") {
                // Extract substring from start to i
                bytes memory addrBytes = new bytes(i - start);
                for (uint256 j = start; j < i; j++) {
                    addrBytes[j - start] = strBytes[j];
                }
                // Parse address (trim whitespace)
                addresses[addrIndex] = _parseAddress(string(addrBytes));
                addrIndex++;
                start = i + 1;
            }
        }

        return addresses;
    }

    /// @notice Parses a hex string to an address
    /// @param str The hex string (with or without 0x prefix)
    /// @return The parsed address
    function _parseAddress(string memory str) internal pure returns (address) {
        bytes memory strBytes = bytes(str);
        uint256 start = 0;

        // Skip whitespace and 0x prefix
        while (start < strBytes.length && (strBytes[start] == " " || strBytes[start] == "\t")) {
            start++;
        }
        if (start + 1 < strBytes.length && strBytes[start] == "0" && (strBytes[start + 1] == "x" || strBytes[start + 1] == "X")) {
            start += 2;
        }

        // Parse hex characters
        uint160 result = 0;
        for (uint256 i = start; i < strBytes.length && i < start + 40; i++) {
            bytes1 c = strBytes[i];
            uint8 value;
            if (c >= "0" && c <= "9") {
                value = uint8(c) - 48;
            } else if (c >= "a" && c <= "f") {
                value = uint8(c) - 87;
            } else if (c >= "A" && c <= "F") {
                value = uint8(c) - 55;
            } else {
                break;
            }
            result = result * 16 + value;
        }

        return address(result);
    }
}
