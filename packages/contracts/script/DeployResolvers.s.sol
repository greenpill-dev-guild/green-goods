// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */
pragma solidity ^0.8.25;

// import { ISchemaRegistry } from "@eas/IEAS.sol";
import { Script, console } from "forge-std/Script.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

import { EASLib } from "../src/lib/EAS.sol";
// import { WorkSchema, WorkApprovalSchema } from "../src/Schemas.sol";
import { ACTION_REGISTRY, FACTORY, SALT } from "../src/Constants.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";

/// @title DeployResolvers
/// @notice Script for deploying the WorkResolver and WorkApprovalResolver contracts using CREATE2.
contract DeployResolvers is Script {
    function run() public {
        address eas = EASLib.getEAS();
        // address schemaRegistry = EASLib.getSchemaRegistry();

        // Calculate the CREATE2 addresses for the resolvers
        address predictedWorkResolverAddress = Create2.computeAddress(
            SALT,
            keccak256(abi.encodePacked(type(WorkResolver).creationCode, abi.encode(eas, ACTION_REGISTRY))),
            FACTORY
        );

        address predictedWorkApprovalResolverAddress = Create2.computeAddress(
            SALT,
            keccak256(abi.encodePacked(type(WorkApprovalResolver).creationCode, abi.encode(eas, ACTION_REGISTRY))),
            FACTORY
        );

        // Deploy WorkResolver
        if (predictedWorkResolverAddress.code.length == 0) {
            vm.startBroadcast();

            WorkResolver workResolver = new WorkResolver{ salt: SALT }(eas, ACTION_REGISTRY);
            workResolver.initialize(address(this));

            // bytes32 workSchemaUID = ISchemaRegistry(schemaRegistry).register(
            //     abi.encode(WorkSchema),
            //     WorkResolver(predictedWorkResolverAddress),
            //     true
            // );

            vm.stopBroadcast();

            console.log("WorkResolver deployed at:", predictedWorkResolverAddress);
            // console.log("WorkSchema UID:", workSchemaUID);
        } else {
            console.log("WorkResolver already exists at:", predictedWorkResolverAddress);
        }

        // Deploy WorkApprovalResolvers
        if (predictedWorkApprovalResolverAddress.code.length == 0) {
            vm.startBroadcast();

            WorkApprovalResolver workApprovalResolver = new WorkApprovalResolver{ salt: SALT }(eas, ACTION_REGISTRY);
            workApprovalResolver.initialize(address(this));

            // bytes32 workApprovalSchemaUID = ISchemaRegistry(schemaRegistry).register(
            //     abi.encode(WorkApprovalSchema),
            //     predictedWorkApprovalResolverAddress,
            //     true
            // );

            vm.stopBroadcast();

            console.log("WorkApprovalResolver deployed at:", predictedWorkApprovalResolverAddress);
            // console.log("WorkApprovalSchema UID:", workApprovalSchemaUID);
        } else {
            console.log("WorkApprovalResolver already exists at:", predictedWorkApprovalResolverAddress);
        }

        // Print out verification commands
        console.log("\nVerification Commands:\n");

        console.log(
            "WorkResolver: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            predictedWorkResolverAddress,
            string.concat(
                'src/resolvers/Work.sol:WorkResolver --constructor-args $(cast abi-encode "constructor(address,address)", ',
                Strings.toHexString(eas),
                ", ",
                Strings.toHexString(ACTION_REGISTRY),
                ")"
            )
        );

        console.log(
            "WorkApprovalResolver: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            predictedWorkApprovalResolverAddress,
            string.concat(
                'src/resolvers/WorkApproval.sol:WorkApprovalResolver --constructor-args $(cast abi-encode "constructor(address,address)" ',
                Strings.toHexString(eas),
                ", ",
                Strings.toHexString(ACTION_REGISTRY),
                ")"
            )
        );
    }
}
