// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";

import { IEAS, AttestationRequest, AttestationRequestData } from "eas-contracts/IEAS.sol";

import { Script } from "forge-std/Script.sol";
import { Create2 } from "openzeppelin-contracts/utils/Create2.sol";

import { EAS_OP } from "../src/Constants.sol";

import { ActionRegistry } from "../src/registries/Action.sol";
import { ActionResolver } from "../src/resolvers/Action.sol";

contract Deploy is Script {
    //ActionRegistry public gpnft;

    function run() public {
    
    // guardian = Create2.computeAddress(
    //     salt,
    //     keccak256(abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(gpSafe))),
    //     factory
    // );

    // confirmationResolver = Create2.computeAddress(
    //     salt,
    //     keccak256(abi.encodePacked(type(ConfirmationResolver).creationCode, abi.encode(EAS_OP))),
    //     factory
    // );

    // contributionResolver = Create2.computeAddress(
    //     salt,
    //     keccak256(abi.encodePacked(type(ContributionResolver).creationCode, abi.encode(EAS_OP))),
    //     factory
    // );

    // hypercert = Create2.computeAddress(
    //     salt,
    //     keccak256(
    //         abi.encodePacked(
    //             type(Hypercert).creationCode, abi.encode()
    //         )
    //     ),
    //     factory
    // );

    // console2.log("hypercert", hypercert);

    // campaignImplementation = Create2.computeAddress(
    //     salt,
    //     keccak256(
    //         abi.encodePacked(
    //             type(CampaignAccount).creationCode,
    //             abi.encode(confirmationResolver, erc4337EntryPoint, multicallForwarder, TOKENBOUND_REGISTRY, guardian)
    //         )
    //     ),
    //     factory
    // );

    // campaignProxy = Create2.computeAddress(
    //     salt,
    //     keccak256(abi.encodePacked(type(AccountProxy).creationCode, abi.encode(guardian, campaignImplementation))),
    //     factory
    // );

    // campaignToken = Create2.computeAddress(
    //     salt,
    //     keccak256(
    //         abi.encodePacked(
    //             type(ActionRegistry).creationCode, abi.encode(campaignImplementation, confirmationResolver, hypercert)
    //         )
    //     ),
    //     factory
    // );


    
    // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    // // Deploy AccountGuardian
    // if (guardian.code.length == 0) {
    //     vm.startBroadcast(deployerPrivateKey);
    //     new AccountGuardian{salt: salt}(gpSafe);
    //     vm.stopBroadcast();

    //     console.log("AccountGuardian:", guardian, "(deployed)");
    // } else {
    //     console.log("AccountGuardian:", guardian, "(exists)");
    // }

    // // Deploy Campaign Account Implementation
    // if (campaignImplementation.code.length == 0) {
    //     vm.startBroadcast(deployerPrivateKey);
    //     new CampaignAccount{salt: salt}(
    //         confirmationResolver,
    //         erc4337EntryPoint,
    //         multicallForwarder,
    //         TOKENBOUND_REGISTRY,
    //         guardian
    //     );
    //     vm.stopBroadcast();

    //     console.log("CampaignAccount:", campaignImplementation, "(deployed)");
    // } else {
    //     console.log("CampaignAccount:", campaignImplementation, "(exists)");
    // }

    // // Deploy Campaign Account Proxy
    // if (campaignProxy.code.length == 0) {
    //     vm.startBroadcast(deployerPrivateKey);
    //     new AccountProxy{salt: salt}(guardian, campaignImplementation);
    //     vm.stopBroadcast();

    //     console.log("CampaignProxy:", campaignProxy, "(deployed)");
    // } else {
    //     console.log("CampaignProxy:", campaignProxy, "(exists)");
    // }

    // // Deploy Campaign Token
    // if (campaignToken.code.length == 0) {
    //     vm.startBroadcast(deployerPrivateKey);
    //     new ActionRegistry{salt: salt}(campaignImplementation, confirmationResolver, hypercert);
    //     vm.stopBroadcast();
    //     console.log("ActionRegistry:", campaignToken, "(deployed)");
    // } else {
    //     console.log("ActionRegistry:", campaignToken, "(exists)");
    // }

    //  if (contributionResolver.code.length == 0) {
    //     vm.startBroadcast(deployerPrivateKey);
    //     new ContributionResolver{salt: salt}(EAS_OP);
    //     vm.stopBroadcast();
    //     console.log("ContributionResolver:", contributionResolver, "(deployed)");
    // } else {
    //     console.log("ContributionResolver:", contributionResolver, "(exists)");
    // }

    // if (confirmationResolver.code.length == 0) {
    //     vm.startBroadcast(deployerPrivateKey);
    //     new ConfirmationResolver{salt: salt}(EAS_OP);
    //     vm.stopBroadcast();
        
    //     console.log("ConfirmationResolver:", confirmationResolver, "(deployed)");
    // } else {
    //     console.log("ConfirmationResolver:", confirmationResolver, "(exists)");
    // }

    // if (hypercert.code.length == 0) {
    //     vm.startBroadcast(deployerPrivateKey);
    //     new Hypercert{salt: salt}();
    //     vm.stopBroadcast();
        
    //     console.log("Hypercert:", hypercert, "(deployed)");
    // } else {
    //     console.log("Hypercert:", hypercert, "(exists)");
    // }

    
    vm.startBroadcast(deployerPrivateKey);
    contributionSchemaUid = easRegistry.register("uint256 value, string title, string description, string[] media, string[] capitals", ISchemaResolver(0xa547526412e87fBAD5B483bd17F6540a1dC686fd), true);
    vm.stopBroadcast();
    // console2.log("contributionSchemaUid", contributionSchemaUid);
    vm.startBroadcast(deployerPrivateKey);    
    confirmationSchemaUid = easRegistry.register("uint  contributionId, bool approval, string feedback, address campAccount", ISchemaResolver(0xd76a4D50F1CcaD941B85692Dc6681b35bC6B480c), true);
    vm.stopBroadcast();
    // console2.log("confirmationSchemaUid", confirmationSchemaUid);

    vm.startBroadcast(deployerPrivateKey);

    // Test stuff

    vm.stopBroadcast();
  }
}
