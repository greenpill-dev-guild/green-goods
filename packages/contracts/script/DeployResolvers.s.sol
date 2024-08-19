// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */

pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

import { EASLib } from "../src/lib/EAS.sol";
import { ACTION_REGISTRY, GREEN_GOODS_SAFE } from "../src/Constants.sol";

import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";

error InvalidChainId();

contract Deploy is Script {
    function run() public {
        bytes32 salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
        address factory = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        address eas = EASLib.getEAS();

        address work = Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(type(WorkResolver).creationCode, abi.encode(eas, ACTION_REGISTRY))),
            factory
        );

        address workApproval = Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(type(WorkApprovalResolver).creationCode, abi.encode(eas, ACTION_REGISTRY))),
            factory
        );

        // Deploy WorkResolver
        if (work.code.length == 0) {
            vm.startBroadcast();
            new WorkResolver{ salt: salt }(eas, ACTION_REGISTRY).initialize(GREEN_GOODS_SAFE);
            vm.stopBroadcast();

            console.log("WorkResolver:", work, "(deployed)");
        } else {
            console.log("WorkResolver:", work, "(exists)");
        }

        // Deploy WorkApprovalResolver
        if (workApproval.code.length == 0) {
            vm.startBroadcast();
            new WorkApprovalResolver{ salt: salt }(eas, ACTION_REGISTRY).initialize(GREEN_GOODS_SAFE);
            vm.stopBroadcast();

            console.log("WorkApprovalResolver:", workApproval, "(deployed)");
        } else {
            console.log("WorkApprovalResolver:", workApproval, "(exists)");
        }

        console.log("\nVerification Commands:\n");
        console.log(
            "WorkResolver: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            work,
            string.concat(
                'src/resolvers/Work.sol:WorkResolver --constructor-args $(cast abi-encode "constructor(address,address)" ',
                Strings.toHexString(eas),
                ", ",
                Strings.toHexString(ACTION_REGISTRY)
            )
        );

        console.log(
            "WorkApprovalResolver: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            workApproval,
            string.concat(
                'src/resolvers/WorkApproval.sol:WorkApprovalResolver --constructor-args $(cast abi-encode "constructor(address,address)" ',
                Strings.toHexString(eas),
                ", ",
                Strings.toHexString(ACTION_REGISTRY)
            )
        );
    }
}
