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
import { CommunityTokenLib } from "../src/lib/CommunityToken.sol";

import { TOKENBOUND_REGISTRY, GREEN_GOODS_SAFE, FACTORY, SALT } from "../src/Constants.sol";

/// @title DeployGardenToken
/// @notice Script for deploying the GardenToken contract and minting a garden for Rio Claro, São Paulo.
contract DeployGardenToken is Script {
    function run() external {
        address erc4337EntryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        address multicallForwarder = 0xcA11bde05977b3631167028862bE2a173976CA11;

        address gardenAccount;

        // Compute addresses
        address guardian = Create2.computeAddress(
            SALT,
            keccak256(abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(GREEN_GOODS_SAFE))),
            FACTORY
        );
        address implementation = Create2.computeAddress(
            SALT,
            keccak256(
                abi.encodePacked(
                    type(GardenAccount).creationCode,
                    abi.encode(erc4337EntryPoint, multicallForwarder, TOKENBOUND_REGISTRY, guardian)
                )
            ),
            FACTORY
        );
        address proxy = Create2.computeAddress(
            SALT,
            keccak256(abi.encodePacked(type(AccountProxy).creationCode, abi.encode(guardian, implementation))),
            FACTORY
        );
        address token = Create2.computeAddress(
            SALT,
            keccak256(abi.encodePacked(type(GardenToken).creationCode, abi.encode(implementation))),
            FACTORY
        );

        // Deploy AccountGuardian
        if (guardian.code.length == 0) {
            vm.startBroadcast();
            new AccountGuardian{ salt: SALT }(GREEN_GOODS_SAFE);
            vm.stopBroadcast();
            console.log("AccountGuardian deployed at:", guardian);
        } else {
            console.log("AccountGuardian already exists at:", guardian);
        }

        // Deploy GardenAccount implementation
        if (implementation.code.length == 0) {
            vm.startBroadcast();
            new GardenAccount{ salt: SALT }(erc4337EntryPoint, multicallForwarder, TOKENBOUND_REGISTRY, guardian);
            vm.stopBroadcast();
            console.log("GardenAccount deployed at:", implementation);
        } else {
            console.log("GardenAccount already exists at:", implementation);
        }

        // Deploy AccountProxy
        if (proxy.code.length == 0) {
            vm.startBroadcast();
            new AccountProxy{ salt: SALT }(guardian, implementation);
            vm.stopBroadcast();
            console.log("AccountProxy deployed at:", proxy);
        } else {
            console.log("AccountProxy already exists at:", proxy);
        }

        // Deploy GardenToken
        if (token.code.length == 0) {
            vm.startBroadcast();
            GardenToken gardenToken = new GardenToken{ salt: SALT }(implementation);
            gardenToken.initialize(address(this));

            address communityToken = CommunityTokenLib.getCommunityToken();
            console.log("GardenToken deployed at:", token);

            // Mint a garden for Rio Claro, São Paulo
            address[] memory gardeners = new address[](4);
            address[] memory gardenOperators = new address[](4);

            gardeners[0] = 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e; // afo-wefa.eth
            gardeners[1] = 0xAcD59e854adf632d2322404198624F757C868C97; // groweco.eth
            gardeners[2] = 0x29e6cbF2450F86006292D10A3cF791955600a457; // marcin
            gardeners[3] = 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e; // afo@greenpill.builders
            gardenOperators[0] = 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e; // afo-wefa.eth
            gardenOperators[1] = 0xAcD59e854adf632d2322404198624F757C868C97; // groweco.eth
            gardenOperators[2] = 0x29e6cbF2450F86006292D10A3cF791955600a457; // marcin
            gardenOperators[3] = 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e; // afo@greenpill.builders

            gardenAccount = gardenToken.mintGarden(
                communityToken,
                "Root Planet",
                "Observing invasive species and planting natives species to improve biodiversity.",
                gardeners,
                gardenOperators
            );

            vm.stopBroadcast();
            console.log("Root Plane Garden for Rio Claro, S\u00e3o Paulo minted.");
        } else {
            console.log("Garden Token already exists at:", token);
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
                ", ",
                Strings.toHexString(multicallForwarder),
                ", ",
                Strings.toHexString(TOKENBOUND_REGISTRY),
                ", ",
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
                ", ",
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
                ", ",
                Strings.toHexString(gardenAccount),
                ")\n"
            )
        );
    }
}
