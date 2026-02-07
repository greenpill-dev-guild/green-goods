// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";

import { IGardenAccount } from "../src/interfaces/IGardenAccount.sol";
import { IGardenHatsModule } from "../src/interfaces/IGardenHatsModule.sol";
import { IKarmaGAPModule } from "../src/interfaces/IKarmaGAPModule.sol";

/// @title MigrateGardens
/// @notice Script for migrating v1 gardens to Hats-based roles (future-proofing)
/// @dev Expects a JSON config file with gardens and operator lists
///
/// Example JSON:
/// {
///   "gardens": [
///     {
///       "garden": "0x...",
///       "name": "Garden Name",
///       "description": "",
///       "location": "",
///       "bannerImage": "",
///       "communityToken": "0x...",
///       "operators": ["0x...", "0x..."]
///     }
///   ]
/// }
contract MigrateGardens is Script {
    error MissingOperators(address garden);

    IGardenHatsModule public gardenHatsModule;
    IKarmaGAPModule public karmaGAPModule;

    function run() external {
        address hatsModuleAddr = vm.envAddress("GARDEN_HATS_MODULE");
        address karmaModuleAddr = vm.envAddress("KARMA_GAP_MODULE");
        string memory configPath = vm.envString("MIGRATION_CONFIG");

        gardenHatsModule = IGardenHatsModule(hatsModuleAddr);
        karmaGAPModule = IKarmaGAPModule(karmaModuleAddr);

        string memory json = vm.readFile(configPath);

        vm.startBroadcast();

        for (uint256 i = 0; i < 50; i++) {
            string memory basePath = string.concat(".gardens[", vm.toString(i), "]");

            try vm.parseJson(json, string.concat(basePath, ".garden")) returns (bytes memory gardenBytes) {
                address garden = abi.decode(gardenBytes, (address));

                string memory name = _parseOptionalString(json, string.concat(basePath, ".name"));
                string memory description = _parseOptionalString(json, string.concat(basePath, ".description"));
                string memory location = _parseOptionalString(json, string.concat(basePath, ".location"));
                string memory bannerImage = _parseOptionalString(json, string.concat(basePath, ".bannerImage"));
                address communityToken = _parseOptionalAddress(json, string.concat(basePath, ".communityToken"));
                address[] memory operators =
                    abi.decode(vm.parseJson(json, string.concat(basePath, ".operators")), (address[]));

                if (operators.length == 0) revert MissingOperators(garden);

                if (bytes(name).length == 0) {
                    // Fallback to on-chain name if not provided
                    name = IGardenAccount(garden).name();
                }

                // 1. Create hat tree
                gardenHatsModule.createGardenHatTree(garden, name, communityToken);

                // 2. Grant operator roles (best-effort sub-grants handled by module)
                for (uint256 j = 0; j < operators.length; j++) {
                    gardenHatsModule.grantRole(garden, operators[j], IGardenHatsModule.GardenRole.Operator);
                }

                // 3. Create GAP project (graceful degradation handled in module)
                karmaGAPModule.createProject(garden, operators[0], name, description, location, bannerImage);
            } catch {
                break;
            }
        }

        vm.stopBroadcast();
    }

    function _parseOptionalString(string memory json, string memory path) private view returns (string memory value) {
        try vm.parseJson(json, path) returns (bytes memory data) {
            return abi.decode(data, (string));
        } catch {
            return "";
        }
    }

    function _parseOptionalAddress(string memory json, string memory path) private view returns (address value) {
        try vm.parseJson(json, path) returns (bytes memory data) {
            return abi.decode(data, (address));
        } catch {
            return address(0);
        }
    }
}
