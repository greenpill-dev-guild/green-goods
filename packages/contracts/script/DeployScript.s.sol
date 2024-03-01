// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { Create2 } from "openzeppelin-contracts/utils/Create2.sol";
import { AccountProxy } from "tokenbound/AccountProxy.sol";
import { AccountGuardian } from "tokenbound/AccountGuardian.sol";

import { TOKENBOUND_REGISTRY, EAS_OP } from "../src/Constants.sol";

import { CampaignToken } from "../src/tokens/Campaign.sol";
import { CampaignAccount } from "../src/accounts/Campaign.sol";
import {ConfirmationResolver} from "../src/resolvers/Confirmation.sol";

contract Deploy is Script {
  function run() external {
    bytes32 salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
    address factory = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    address gpSafe = 0x3F35aC99149fD564f9a3f5eC78d146aeE1db7387;
    address erc4337EntryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address multicallForwarder = 0xcA1167915584462449EE5b4Ea51c37fE81eCDCCD;

    address guardian = Create2.computeAddress(
        salt,
        keccak256(abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(gpSafe))),
        factory
    );

    address confirmationResolver = Create2.computeAddress(
        salt,
        keccak256(abi.encodePacked(type(ConfirmationResolver).creationCode, abi.encode(EAS_OP))),
        factory
    );

    address campaignImplementation = Create2.computeAddress(
        salt,
        keccak256(
            abi.encodePacked(
                type(CampaignAccount).creationCode,
                abi.encode(confirmationResolver, erc4337EntryPoint, multicallForwarder, TOKENBOUND_REGISTRY, guardian)
            )
        ),
        factory
    );

    address campaignProxy = Create2.computeAddress(
        salt,
        keccak256(abi.encodePacked(type(AccountProxy).creationCode, abi.encode(guardian, campaignImplementation))),
        factory
    );

    address campaignToken = Create2.computeAddress(
        salt,
        keccak256(
            abi.encodePacked(
                type(CampaignToken).creationCode, abi.encode(confirmationResolver, campaignImplementation)
            )
        ),
        factory
    );

    // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    // Deploy AccountGuardian
    if (guardian.code.length == 0) {
        vm.startBroadcast(deployerPrivateKey);
        new AccountGuardian{salt: salt}(gpSafe);
        vm.stopBroadcast();

        console.log("AccountGuardian:", guardian, "(deployed)");
    } else {
        console.log("AccountGuardian:", guardian, "(exists)");
    }

    // Deploy Campaign Account Implementation
    if (campaignImplementation.code.length == 0) {
        vm.startBroadcast(deployerPrivateKey);
        new CampaignAccount{salt: salt}(
            confirmationResolver,
            erc4337EntryPoint,
            multicallForwarder,
            TOKENBOUND_REGISTRY,
            guardian
        );
        vm.stopBroadcast();

        console.log("CampaignAccount:", campaignImplementation, "(deployed)");
    } else {
        console.log("CampaignAccount:", campaignImplementation, "(exists)");
    }

    // Deploy Campaign Account Proxy
    if (campaignProxy.code.length == 0) {
        vm.startBroadcast(deployerPrivateKey);
        new AccountProxy{salt: salt}(guardian, campaignImplementation);
        vm.stopBroadcast();

        console.log("CampaignProxy:", campaignProxy, "(deployed)");
    } else {
        console.log("CampaignProxy:", campaignProxy, "(exists)");
    }

    // Deploy Campaign Token
    if (campaignToken.code.length == 0) {
        vm.startBroadcast(deployerPrivateKey);
        new CampaignToken{salt: salt}( confirmationResolver, campaignImplementation);
        vm.stopBroadcast();

        console.log("CampaignToken:", campaignToken, "(deployed)");
    } else {
        console.log("CampaignToken:", campaignToken, "(exists)");
    }

    vm.startBroadcast(deployerPrivateKey);

    // Test stuff

    vm.stopBroadcast();
  }
}
