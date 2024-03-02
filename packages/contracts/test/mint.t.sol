// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {CampaignToken} from "../src/tokens/Campaign.sol";
import {CampaignAccount} from "../src/accounts/Campaign.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "erc6551/interfaces/IERC6551Registry.sol";
import "tokenbound/AccountProxy.sol";
import "erc6551/examples/simple/ERC6551Account.sol";
import "../src/interfaces/ISchemaRegistry.sol";
import "../src/interfaces/ISchemaResolver.sol";
import { IEAS, AttestationRequest, AttestationRequestData } from "../src/interfaces/IEAS.sol";

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { Create2 } from "openzeppelin-contracts/utils/Create2.sol";
import { AccountProxy } from "tokenbound/AccountProxy.sol";
import { AccountGuardian } from "tokenbound/AccountGuardian.sol";

import { TOKENBOUND_REGISTRY, EAS_OP } from "../src/Constants.sol";

import { CampaignToken, TBALib } from "../src/tokens/Campaign.sol";
import { CampaignAccount } from "../src/accounts/Campaign.sol";
import {ConfirmationResolver} from "../src/resolvers/Confirmation.sol";
import {ContributionResolver} from "../src/resolvers/Contribution.sol";

contract MintTest is Test {
    //CampaignToken public gpnft;

    address payable public alice =
        payable(0x00000000000000000000000000000000000A11cE);
    address payable public bob =
        payable(0x0000000000000000000000000000000000000B0b);
    
    IERC6551Registry public registry6551 = 	IERC6551Registry(0x000000006551c19487814612e58FE06813775758);
    AccountProxy public implementation = AccountProxy(payable(0x55266d75D1a14E4572138116aF39863Ed6596E7F));
    address public actualImplementation = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;
    address public entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    ISchemaRegistry public easRegistry = ISchemaRegistry(0x4200000000000000000000000000000000000020);
    IEAS public eas = IEAS(EAS_OP);

    address[] public team;
    string[] public capitals;

    bytes32 salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
    bytes32 contributionSchemaUid;
    bytes32 confirmationSchemaUid;


    address factory = address(this);//0x4e59b44847b379578588920cA78FbF26c0B4956C;

    address gpSafe = 0x3F35aC99149fD564f9a3f5eC78d146aeE1db7387;
    address erc4337EntryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address multicallForwarder = 0xcA1167915584462449EE5b4Ea51c37fE81eCDCCD;

    address guardian;
    address confirmationResolver;
    address contributionResolver;
    address campaignImplementation;
    address campaignProxy;
    address campaignToken;


    function setUp() public {
    

    guardian = Create2.computeAddress(
        salt,
        keccak256(abi.encodePacked(type(AccountGuardian).creationCode, abi.encode(gpSafe))),
        factory
    );

    confirmationResolver = Create2.computeAddress(
        salt,
        keccak256(abi.encodePacked(type(ConfirmationResolver).creationCode, abi.encode(EAS_OP))),
        factory
    );

    contributionResolver = Create2.computeAddress(
        salt,
        keccak256(abi.encodePacked(type(ContributionResolver).creationCode, abi.encode(EAS_OP))),
        factory
    );

    campaignImplementation = Create2.computeAddress(
        salt,
        keccak256(
            abi.encodePacked(
                type(CampaignAccount).creationCode,
                abi.encode(confirmationResolver, erc4337EntryPoint, multicallForwarder, TOKENBOUND_REGISTRY, guardian)
            )
        ),
        factory
    );

    campaignProxy = Create2.computeAddress(
        salt,
        keccak256(abi.encodePacked(type(AccountProxy).creationCode, abi.encode(guardian, campaignImplementation))),
        factory
    );

    campaignToken = Create2.computeAddress(
        salt,
        keccak256(
            abi.encodePacked(
                type(CampaignToken).creationCode, abi.encode(campaignImplementation, confirmationResolver)
            )
        ),
        factory
    );

    // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
    //uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    // Deploy AccountGuardian
    if (guardian.code.length == 0) {
        //vm.startBroadcast(deployerPrivateKey);
        new AccountGuardian{salt: salt}(gpSafe);
        //vm.stopBroadcast();

        console.log("AccountGuardian:", guardian, "(deployed)");
    } else {
        console.log("AccountGuardian:", guardian, "(exists)");
    }

    // Deploy Campaign Account Implementation
    if (campaignImplementation.code.length == 0) {
        //vm.startBroadcast(deployerPrivateKey);
        new CampaignAccount{salt: salt}(
            confirmationResolver,
            erc4337EntryPoint,
            multicallForwarder,
            TOKENBOUND_REGISTRY,
            guardian
        );
        //vm.stopBroadcast();

        console.log("CampaignAccount:", campaignImplementation, "(deployed)");
    } else {
        console.log("CampaignAccount:", campaignImplementation, "(exists)");
    }

    // Deploy Campaign Account Proxy
    if (campaignProxy.code.length == 0) {
        //vm.startBroadcast(deployerPrivateKey);
        new AccountProxy{salt: salt}(guardian, campaignImplementation);
        //vm.stopBroadcast();

        console.log("CampaignProxy:", campaignProxy, "(deployed)");
    } else {
        console.log("CampaignProxy:", campaignProxy, "(exists)");
    }

    // Deploy Campaign Token
    if (campaignToken.code.length == 0) {
        //vm.startBroadcast(deployerPrivateKey);
        new CampaignToken{salt: salt}(campaignImplementation, confirmationResolver);
        //vm.stopBroadcast();
        console.log("CampaignToken:", campaignToken, "(deployed)");
    } else {
        console.log("CampaignToken:", campaignToken, "(exists)");
    }

     if (contributionResolver.code.length == 0) {
        //vm.startBroadcast(deployerPrivateKey);
        new ContributionResolver{salt: salt}(EAS_OP);
        //vm.stopBroadcast();
        console.log("ContributionResolver:", contributionResolver, "(deployed)");
    } else {
        console.log("ContributionResolver:", contributionResolver, "(exists)");
    }

    if (confirmationResolver.code.length == 0) {
        //vm.startBroadcast(deployerPrivateKey);
        new ConfirmationResolver{salt: salt}(EAS_OP);
        //vm.stopBroadcast();
        console.log("ConfirmationResolver:", confirmationResolver, "(deployed)");
    } else {
        console.log("ConfirmationResolver:", confirmationResolver, "(exists)");
    }


    contributionSchemaUid = easRegistry.register("uint256 value, string title, string description, string[] media, string[] capitals", ISchemaResolver(contributionResolver), true);
    confirmationSchemaUid = easRegistry.register("uint  contributionId, bool approval, string feedback, address campAccount", ISchemaResolver(confirmationResolver), true);


        // campaignToken = new CampaignToken(address(0x41C8f39463A868d3A88af00cd0fe7102F30E44eC), address(0xabcd));
        team.push(alice);
        team.push(bob);
        team.push(0xa53A6fE2d8Ad977aD926C485343Ba39f32D3A3F6);
        
        capitals.push("cash");
        capitals.push("money");
        capitals.push("dollars");
        capitals.push("cheese");
    }

    function testCreateCampaign() public {
        console2.log(CampaignToken(campaignToken).name());
        hoax(alice);
        CampaignToken(campaignToken).createCampaign(1709250389, 1709350000, "metadata", capitals, team);
        uint tokenId = 0;
        address shouldBeAlice = CampaignToken(campaignToken).ownerOf(tokenId);
        assertEq(shouldBeAlice, alice, "Not Alice");
    }

    function testSCAccount() public {
        hoax(alice);
        (address tbaAddress, uint hyperCertId) = CampaignToken(campaignToken).createCampaign(1709250389, 1709350000,"metadata", capitals, team);
        uint tokenId = 0;
        console2.log("scaddress ", tbaAddress);
        address scAddress = TBALib.getAccount(
            address(implementation),
            
            address(campaignToken),
            tokenId
        );
        console2.log("scAddress ", scAddress);
        CampaignAccount scAccount = CampaignAccount(payable(tbaAddress));
        address shouldBeAlice = scAccount.owner();
        //console2.log("shouldBeAlice ", shouldBeAlice);
        assertEq(shouldBeAlice, alice, "Not Alice 2");
        assert(scAccount.isCampaign());
    }

    function testHypercert() public {
        hoax(alice);
        (address tbaAddress, uint hyperCertId) = CampaignToken(campaignToken).createCampaign(1709250389, 1709350000,"metadata", capitals, team);
        uint tokenId = 0;
        //console2.log("scaddress ", tbaAddress);
        address scAddress = TBALib.getAccount(
            address(implementation),
            address(campaignToken),
            tokenId
        );
        //console2.log("scAddress ", scAddress);
        CampaignAccount scAccount = CampaignAccount(payable(tbaAddress));
        uint hyperId = scAccount.hypercertId();
        console2.log("hypercertId ", hyperId);
        assertGt(hyperId, 0, "0 hyperId");
        assertEq(hyperId, hyperCertId, "hypercert doesn't match");
    }

    function testContributionResolver() public {
        hoax(alice);
        (address tbaAddress, uint hyperCertId) = CampaignToken(campaignToken).createCampaign(1709250389, 1709350000,"metadata", capitals, team);
        uint tokenId = 0;
        //console2.log("scaddress ", tbaAddress);
        address scAddress = TBALib.getAccount(
            address(implementation),
            address(campaignToken),
            tokenId
        );
        //console2.log("scAddress ", scAddress);
        CampaignAccount scAccount = CampaignAccount(payable(tbaAddress));
        uint hyperId = scAccount.hypercertId();

        AttestationRequestData memory attestationRequestData = AttestationRequestData({
            recipient: tbaAddress,
            expirationTime: 0, // The time when the attestation expires (Unix timestamp).
            revocable: true, // Whether the attestation is revocable.
            refUID: 0, // The UID of the related attestation.
            data: abi.encode(5, "title", "description", capitals, capitals), // Custom attestation data.
            value: 0 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
        });

        /// @notice A struct representing the full arguments of the attestation request.
        AttestationRequest memory request = AttestationRequest({
            schema: contributionSchemaUid, // The unique identifier of the schema.
            data: attestationRequestData // The arguments of the attestation request.
        });

        //hoax(alice);
        eas.attest(request);

        //???
    }

    // function testConfirmationResolver() public {
    //     hoax(alice);
    //     (address tbaAddress, uint hyperCertId) = CampaignToken(campaignToken).createCampaign(1709250389, 1709350000,"metadata", capitals, team);
    //     uint tokenId = 0;
    //     //console2.log("scaddress ", tbaAddress);
    //     address scAddress = TBALib.getAccount(
    //         address(implementation),
    //         address(campaignToken),
    //         tokenId
    //     );
    //     //console2.log("scAddress ", scAddress);
    //     CampaignAccount scAccount = CampaignAccount(payable(tbaAddress));
    //     uint hyperId = scAccount.hypercertId();

    //     AttestationRequestData memory attestationRequestData = AttestationRequestData({
    //         recipient: tbaAddress,
    //         expirationTime: 0, // The time when the attestation expires (Unix timestamp).
    //         revocable: true, // Whether the attestation is revocable.
    //         refUID: 0, // The UID of the related attestation.
    //         data: abi.encode(5, "title", "description", capitals, capitals), // Custom attestation data.
    //         value: 0 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
    //     });

    //     /// @notice A struct representing the full arguments of the attestation request.
    //     AttestationRequest memory request = AttestationRequest({
    //         schema: contributionSchemaUid, // The unique identifier of the schema.
    //         data: attestationRequestData // The arguments of the attestation request.
    //     });

    //     hoax(alice);
    //     eas.attest(request);

    //     //???
    // }



    

    // function testTheArt() public {
    //     vm.prank(alice);
    //     campaignToken.createCampaign(capitals, team, 1709250389, 1709350000);
    //     uint tokenId = 0;

        
    //     vm.prank(alice);
    //     campaignToken.initializeData(tokenId, 111222333444555);
    //     string memory art = campaignToken.tokenURI(tokenId);
    //     console2.log(art);
        
    //     vm.prank(bob);
    //     campaignToken.createCampaign(capitals, team, 1709250389, 1709350000);
    //     tokenId = 1;
    //     art = campaignToken.tokenURI(1);
    //     console2.log(art);
    // }


    

}
