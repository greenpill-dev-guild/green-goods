// SPDX-License-Identifier: UNLICENSED
/* solhint-disable no-console2 */
/* solhint-disable no-console */
/* solhint-disable max-states-count */
pragma solidity ^0.8.20;

import { Test, console2} from "forge-std/Test.sol";
import { AccountProxy } from "tokenbound/AccountProxy.sol";
import { AccountGuardian } from "tokenbound/AccountGuardian.sol";
import { Create2 } from "openzeppelin-contracts/utils/Create2.sol";
import { IERC6551Registry } from "erc6551/interfaces/IERC6551Registry.sol";

import { TOKENBOUND_REGISTRY, EAS_OP } from "../src/Constants.sol";

import { Hypercert } from "../src/tokens/Hypercert.sol";
import { CampaignAccount } from "../src/accounts/Campaign.sol";
import { CampaignToken, TBALib } from "../src/tokens/Campaign.sol";
import { ConfirmationResolver } from "../src/resolvers/Confirmation.sol";
import { ContributionResolver } from "../src/resolvers/Contribution.sol";

import { ISchemaRegistry } from "../src/interfaces/ISchemaRegistry.sol";
import { ISchemaResolver } from "../src/interfaces/ISchemaResolver.sol";
import { IEAS, AttestationRequest, AttestationRequestData } from "../src/interfaces/IEAS.sol";

contract MintTest is Test {    
    address payable public alice =
        payable(0x00000000000000000000000000000000000A11cE);
    address payable public bob =
        payable(0x0000000000000000000000000000000000000B0b);
    
    IEAS public eas = IEAS(EAS_OP);
    Hypercert public hypercertContract;
    ISchemaRegistry public easRegistry = ISchemaRegistry(0x4200000000000000000000000000000000000020);
    IERC6551Registry public registry6551 = 	IERC6551Registry(0x000000006551c19487814612e58FE06813775758);
    AccountProxy public implementation = AccountProxy(payable(0x55266d75D1a14E4572138116aF39863Ed6596E7F));

    address public entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address public actualImplementation = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;

    address[] public team;
    string[] public capitals;

    bytes32 public salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
    bytes32 public contributionSchemaUid;
    bytes32 public confirmationSchemaUid;

    address public factory = address(this);//0x4e59b44847b379578588920cA78FbF26c0B4956C;

    address public gpSafe = 0x3F35aC99149fD564f9a3f5eC78d146aeE1db7387;
    address public erc4337EntryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address public multicallForwarder = 0xcA1167915584462449EE5b4Ea51c37fE81eCDCCD;

    address public guardian;
    address public confirmationResolver;
    address public contributionResolver;
    address public campaignImplementation;
    address public campaignProxy;
    address public campaignToken;
    address public hypercert;

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

        hypercert = Create2.computeAddress(
            salt,
            keccak256(
                abi.encodePacked(
                    type(Hypercert).creationCode, abi.encode()
                )
            ),
            factory
        );

        console2.log("hypercert", hypercert);

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
                    type(CampaignToken).creationCode, abi.encode(campaignImplementation, confirmationResolver, hypercert)
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

            console2.log("AccountGuardian:", guardian, "(deployed)");
        } else {
            console2.log("AccountGuardian:", guardian, "(exists)");
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

            console2.log("CampaignAccount:", campaignImplementation, "(deployed)");
        } else {
            console2.log("CampaignAccount:", campaignImplementation, "(exists)");
        }

        // Deploy Campaign Account Proxy
        if (campaignProxy.code.length == 0) {
            //vm.startBroadcast(deployerPrivateKey);
            new AccountProxy{salt: salt}(guardian, campaignImplementation);
            //vm.stopBroadcast();

            console2.log("CampaignProxy:", campaignProxy, "(deployed)");
        } else {
            console2.log("CampaignProxy:", campaignProxy, "(exists)");
        }

        // Deploy Campaign Token
        if (campaignToken.code.length == 0) {
            //vm.startBroadcast(deployerPrivateKey);
            new CampaignToken{salt: salt}(campaignImplementation, confirmationResolver, hypercert);
            //vm.stopBroadcast();
            console2.log("CampaignToken:", campaignToken, "(deployed)");
        } else {
            console2.log("CampaignToken:", campaignToken, "(exists)");
        }

        if (contributionResolver.code.length == 0) {
            //vm.startBroadcast(deployerPrivateKey);
            new ContributionResolver{salt: salt}(EAS_OP);
            //vm.stopBroadcast();
            console2.log("ContributionResolver:", contributionResolver, "(deployed)");
        } else {
            console2.log("ContributionResolver:", contributionResolver, "(exists)");
        }

        if (confirmationResolver.code.length == 0) {
            //vm.startBroadcast(deployerPrivateKey);
            /*ConfirmationResolver test2 =*/ new ConfirmationResolver{salt: salt}(EAS_OP);
            //vm.stopBroadcast();
            //console2.log("s/b ConfResolver", address(test2));
            console2.log("ConfirmationResolver:", confirmationResolver, "(deployed)");
        } else {
            console2.log("ConfirmationResolver:", confirmationResolver, "(exists)");
        }

        if (hypercert.code.length == 0) {
            //vm.startBroadcast(deployerPrivateKey);
            new Hypercert{salt: salt}();
            //vm.stopBroadcast();
            //console2.log("s/b ConfResolver", address(test2));
            console2.log("Hypercert:", hypercert, "(deployed)");
        } else {
            console2.log("Hypercert:", hypercert, "(exists)");
        }

        hypercertContract = Hypercert(hypercert);

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

    function testMint() public {
        hoax(alice);

        uint256 tokID1 = hypercertContract.mint(100);

        hoax(bob);

        hypercertContract.mint(50);
        console2.log("alice balance", hypercertContract.balanceOf(alice, tokID1));
    }

    function testCreateCampaign() public {
        console2.log(CampaignToken(campaignToken).name());

        hoax(alice);
        
        CampaignToken(campaignToken).createCampaign(1709250389, 1709350000, "metadata", capitals, team);

        uint256 tokenId = 0;
        address shouldBeAlice = CampaignToken(campaignToken).ownerOf(tokenId);

        assertEq(shouldBeAlice, alice, "Not Alice");
    }

    function testSCAccount() public {
        hoax(alice);

        uint256 tokenId = 0;
        (address tbaAddress, uint256 hyperCertId) = CampaignToken(campaignToken).createCampaign(1709250389, 1709350000,"metadata", capitals, team);

        console2.log("scaddress ", tbaAddress);
        console2.log("hyperCertId ", hyperCertId);

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

        uint256 tokenId = 0;
        (address tbaAddress, uint256 hyperCertId) = CampaignToken(campaignToken).createCampaign(1709250389, 1709350000,"metadata", capitals, team);

        //console2.log("scaddress ", tbaAddress);
        address scAddress = TBALib.getAccount(
            address(implementation),
            address(campaignToken),
            tokenId
        );

        //console2.log("scAddress ", scAddress);
        CampaignAccount scAccount = CampaignAccount(payable(tbaAddress));

        uint256 hyperId = scAccount.hypercertId();

        console2.log("hypercertId ", hyperId);

        //assertGt(hyperId, 0, "0 hyperId");
        assertEq(hyperId, hyperCertId, "hypercert doesn't match");

        uint256 balance = hypercertContract.balanceOf(scAddress, hyperId);

        console2.log("balance", balance);
    }

    function testContributionResolver() public {
        hoax(alice);

        uint256 tokenId = 0;
        (address tbaAddress, uint256 hyperCertId) = CampaignToken(campaignToken).createCampaign(1709250389, 1709350000,"metadata", capitals, team);

        //console2.log("scaddress ", tbaAddress);
        console2.log("hyperCertId ", hyperCertId);

        address scAddress = TBALib.getAccount(
            address(implementation),
            address(campaignToken),
            tokenId
        );

        console2.log("scAddress ", scAddress);

        CampaignAccount scAccount = CampaignAccount(payable(tbaAddress));

        uint256 hyperId = scAccount.hypercertId();

        console2.log("hypercertId ", hyperId);

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
    }

    function testConfirmationResolver() public {
        hoax(alice);

        uint256 tokenId = 0;
        (address tbaAddress, uint256 hyperCertId) = CampaignToken(campaignToken).createCampaign(1709250389, 1709350000,"metadata", capitals, team);

        //console2.log("scaddress ", tbaAddress);
        console2.log("hyperCertId ", hyperCertId);

        address scAddress = TBALib.getAccount(
            address(implementation),
            address(campaignToken),
            tokenId
        );

        console2.log("scAddress ", scAddress);

        CampaignAccount scAccount = CampaignAccount(payable(tbaAddress));

        uint256 hyperId = scAccount.hypercertId();

        console2.log("hypercertId ", hyperId);

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

        hoax(bob);

        eas.attest(request);

        //for confirmation
        attestationRequestData.recipient = bob;
        attestationRequestData.data = abi.encode(0, true, "gud", tbaAddress);

        request.schema = confirmationSchemaUid;
        request.data = attestationRequestData;

        hoax(alice);

        eas.attest(request);
    }
}
