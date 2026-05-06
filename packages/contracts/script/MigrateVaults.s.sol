// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console } from "forge-std/Script.sol";

interface IOctantMigrationModule {
    function enableAutoAllocate(address garden, address asset) external;
}

interface IGardensMigrationModule {
    function gardenHypercertSignalPools(address garden) external view returns (address);
    function setGardenHypercertSignalPool(address garden, address pool) external;
}

interface IYieldMigrationResolver {
    function gardenHypercertPools(address garden) external view returns (address);
    function gardenTreasuries(address garden) external view returns (address);
    function gardenVaults(address garden, address asset) external view returns (address);
    function setGardenHypercertPool(address garden, address pool) external;
    function setGardenTreasury(address garden, address treasury) external;
}

/// @notice Executes a precomputed vault/signal/treasury migration plan in one Foundry broadcast session.
contract MigrateVaults is Script {
    function run(string memory planPath) public {
        string memory json = vm.readFile(planPath);

        address octantModule = abi.decode(vm.parseJson(json, ".octantModule"), (address));
        address gardensModule = abi.decode(vm.parseJson(json, ".gardensModule"), (address));
        address yieldResolver = abi.decode(vm.parseJson(json, ".yieldResolver"), (address));

        address[] memory vaultGardens = abi.decode(vm.parseJson(json, ".vaultGardens"), (address[]));
        address[] memory vaultAssets = abi.decode(vm.parseJson(json, ".vaultAssets"), (address[]));
        address[] memory typedPoolGardens = abi.decode(vm.parseJson(json, ".typedPoolGardens"), (address[]));
        address[] memory typedPools = abi.decode(vm.parseJson(json, ".typedPools"), (address[]));
        address[] memory resolverPoolGardens = abi.decode(vm.parseJson(json, ".resolverPoolGardens"), (address[]));
        address[] memory resolverPools = abi.decode(vm.parseJson(json, ".resolverPools"), (address[]));
        address[] memory treasuryGardens = abi.decode(vm.parseJson(json, ".treasuryGardens"), (address[]));
        address[] memory treasuries = abi.decode(vm.parseJson(json, ".treasuries"), (address[]));

        require(vaultGardens.length == vaultAssets.length, "vault plan length mismatch");
        require(typedPoolGardens.length == typedPools.length, "typed pool plan length mismatch");
        require(resolverPoolGardens.length == resolverPools.length, "resolver pool plan length mismatch");
        require(treasuryGardens.length == treasuries.length, "treasury plan length mismatch");

        console.log("Executing vault migration plan");
        console.log("  vault migrations:", vaultGardens.length);
        console.log("  typed pool backfills:", typedPoolGardens.length);
        console.log("  resolver pool backfills:", resolverPoolGardens.length);
        console.log("  treasury backfills:", treasuryGardens.length);

        vm.startBroadcast();

        for (uint256 i = 0; i < vaultGardens.length; i++) {
            IOctantMigrationModule(octantModule).enableAutoAllocate(vaultGardens[i], vaultAssets[i]);
        }

        for (uint256 i = 0; i < typedPoolGardens.length; i++) {
            IGardensMigrationModule(gardensModule).setGardenHypercertSignalPool(typedPoolGardens[i], typedPools[i]);
        }

        for (uint256 i = 0; i < resolverPoolGardens.length; i++) {
            IYieldMigrationResolver(yieldResolver).setGardenHypercertPool(resolverPoolGardens[i], resolverPools[i]);
        }

        for (uint256 i = 0; i < treasuryGardens.length; i++) {
            IYieldMigrationResolver(yieldResolver).setGardenTreasury(treasuryGardens[i], treasuries[i]);
        }

        vm.stopBroadcast();

        for (uint256 i = 0; i < typedPoolGardens.length; i++) {
            require(
                IGardensMigrationModule(gardensModule).gardenHypercertSignalPools(typedPoolGardens[i]) == typedPools[i],
                "typed pool backfill failed"
            );
        }

        for (uint256 i = 0; i < resolverPoolGardens.length; i++) {
            require(
                IYieldMigrationResolver(yieldResolver).gardenHypercertPools(resolverPoolGardens[i]) == resolverPools[i],
                "resolver pool backfill failed"
            );
        }

        for (uint256 i = 0; i < treasuryGardens.length; i++) {
            require(
                IYieldMigrationResolver(yieldResolver).gardenTreasuries(treasuryGardens[i]) == treasuries[i],
                "treasury backfill failed"
            );
        }

        for (uint256 i = 0; i < vaultGardens.length; i++) {
            require(
                IYieldMigrationResolver(yieldResolver).gardenVaults(vaultGardens[i], vaultAssets[i]) != address(0),
                "vault resolver registration failed"
            );
        }

        console.log("Migration plan executed successfully");
    }
}
