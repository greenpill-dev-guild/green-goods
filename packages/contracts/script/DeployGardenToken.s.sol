// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { AccountProxy } from "@tokenbound/AccountProxy.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { TOKENBOUND_REGISTRY, GREEN_GOODS_SAFE } from "../src/Constants.sol";

/// @title DeployGardenToken
/// @notice Script for deploying the GardenToken contract and minting a garden for Rio Claro, São Paulo.
contract DeployGardenToken is Script {
    function run() external {
        bytes32 salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
        address factory = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

        address erc4337EntryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        address multicallForwarder = 0xcA11bde05977b3631167028862bE2a173976CA11;

        // Compute addresses
        address guardian = Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(GREEN_GOODS_SAFE))),
            factory
        );
        address implementation = Create2.computeAddress(
            salt,
            keccak256(
                abi.encodePacked(
                    type(GardenAccount).creationCode,
                    abi.encode(erc4337EntryPoint, multicallForwarder, TOKENBOUND_REGISTRY, guardian)
                )
            ),
            factory
        );
        address proxy = Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(type(AccountProxy).creationCode, abi.encode(guardian, implementation))),
            factory
        );
        address token = Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(type(GardenToken).creationCode, abi.encode(implementation))),
            factory
        );

        // Deploy AccountGuardian
        if (guardian.code.length == 0) {
            vm.startBroadcast();
            new AccountGuardian{ salt: salt }(GREEN_GOODS_SAFE);
            vm.stopBroadcast();
            console.log("AccountGuardian deployed at:", guardian);
        } else {
            console.log("AccountGuardian already exists at:", guardian);
        }

        // Deploy GardenAccount implementation
        if (implementation.code.length == 0) {
            vm.startBroadcast();
            new GardenAccount{ salt: salt }(erc4337EntryPoint, multicallForwarder, TOKENBOUND_REGISTRY, guardian);
            vm.stopBroadcast();
            console.log("GardenAccount deployed at:", implementation);
        } else {
            console.log("GardenAccount already exists at:", implementation);
        }

        // Deploy AccountProxy
        if (proxy.code.length == 0) {
            vm.startBroadcast();
            new AccountProxy{ salt: salt }(guardian, implementation);
            vm.stopBroadcast();
            console.log("AccountProxy deployed at:", proxy);
        } else {
            console.log("AccountProxy already exists at:", proxy);
        }

        // Deploy GardenToken
        if (token.code.length == 0) {
            vm.startBroadcast();
            GardenToken gardenToken = new GardenToken{ salt: salt }(implementation);
            gardenToken.initialize(GREEN_GOODS_SAFE);
            console.log("GardenToken deployed at:", token);

            // Mint a garden for Rio Claro, São Paulo
            address[] memory gardeners = new address[](1);
            address[] memory gardenOperators = new address[](1);

            gardeners[0] = GREEN_GOODS_SAFE; // Example gardener
            gardenOperators[0] = GREEN_GOODS_SAFE; // Example operator
            gardenToken.mintGarden(address(0x3), "Rio Claro, S\u00e3o Paulo", gardeners, gardenOperators);

            vm.stopBroadcast();
            console.log("Garden for Rio Claro, S\u00e3o Paulo minted.");
        } else {
            console.log("GardenToken already exists at:", token);
        }

        // Print out verification commands
        console.log("\nVerification Commands:\n");

        console.log(
            "AccountGuardian: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            guardian,
            string.concat(
                'src/AccountGuardian.sol:AccountGuardian --constructor-args $(cast abi-encode "constructor(address)" ',
                Strings.toHexString(GREEN_GOODS_SAFE),
                ")\n"
            )
        );
        console.log(
            "GardenAccount: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            implementation,
            string.concat(
                'src/GardenAccount.sol:GardenAccount --constructor-args $(cast abi-encode "constructor(address,address,address,address)" ',
                Strings.toHexString(erc4337EntryPoint),
                " ",
                Strings.toHexString(multicallForwarder),
                " ",
                Strings.toHexString(TOKENBOUND_REGISTRY),
                " ",
                Strings.toHexString(guardian),
                ")\n"
            )
        );
        console.log(
            "AccountProxy: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            proxy,
            string.concat(
                'src/AccountProxy.sol:AccountProxy --constructor-args $(cast abi-encode "constructor(address,address)" ',
                Strings.toHexString(guardian),
                " ",
                Strings.toHexString(implementation),
                ")\n"
            )
        );
        console.log(
            "GardenToken: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            string.concat(
                'src/GardenToken.sol:GardenToken --constructor-args $(cast abi-encode "constructor(address)" ',
                Strings.toHexString(implementation),
                ")\n"
            )
        );
    }
}
