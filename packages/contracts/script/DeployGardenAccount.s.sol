// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */

pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { AccountProxy } from "@tokenbound/AccountProxy.sol";
import { AccountGuardian } from "@tokenbound/AccountGuardian.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { TOKENBOUND_REGISTRY } from "../src/Constants.sol";

contract Deploy is Script {
  function run() external {
        bytes32 salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
        address factory = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

        address tokenboundSafe = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19; // ToDo: Deploy with same address on Sepolia
        address erc4337EntryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        address multicallForwarder = 0xcA11bde05977b3631167028862bE2a173976CA11;

        address guardian = Create2.computeAddress(
            salt,
            keccak256(
                abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(tokenboundSafe))
            ),
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
            keccak256(
                abi.encodePacked(
                    type(AccountProxy).creationCode, abi.encode(guardian, implementation)
                )
            ),
            factory
        );

        // Deploy AccountGuardian
        if (guardian.code.length == 0) {
            vm.startBroadcast();
            new AccountGuardian{salt: salt}(tokenboundSafe);
            vm.stopBroadcast();

            console.log("AccountGuardian:", guardian, "(deployed)");
        } else {
            console.log("AccountGuardian:", guardian, "(exists)");
        }

        // Deploy Account implementation
        if (implementation.code.length == 0) {
            vm.startBroadcast();
            new GardenAccount{salt: salt}(
                erc4337EntryPoint,
                multicallForwarder,
                TOKENBOUND_REGISTRY,
                guardian
            );
            vm.stopBroadcast();

            console.log("GardenAccount:", implementation, "(deployed)");
        } else {
            console.log("GardenAccount:", implementation, "(exists)");
        }

        // Deploy AccountProxy
        if (proxy.code.length == 0) {
            vm.startBroadcast();
            new AccountProxy{salt: salt}(guardian, implementation);
            vm.stopBroadcast();

            console.log("AccountProxy:", proxy, "(deployed)");
        } else {
            console.log("AccountProxy:", proxy, "(exists)");
        }

        console.log("\nVerification Commands:\n");
        console.log(
            "AccountGuardian: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            guardian,
            string.concat(
                "src/AccountGuardian.sol:AccountGuardian --constructor-args $(cast abi-encode \"constructor(address)\" ",
                Strings.toHexString(tokenboundSafe),
                ")\n"
            )
        );
        console.log(
            "GardenAccount: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            implementation,
            string.concat(
                "src/GardenAccount.sol:GardenAccount --constructor-args $(cast abi-encode \"constructor(address,address,address,address)\" ",
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
                "src/AccountProxy.sol:AccountProxy --constructor-args $(cast abi-encode \"constructor(address,address)\" ",
                Strings.toHexString(guardian),
                " ",
                Strings.toHexString(implementation),
                ")\n"
            )
        );
    }
}
