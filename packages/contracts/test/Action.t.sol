// SPDX-License-Identifier: UNLICENSED
/* solhint-disable no-console2 */
/* solhint-disable no-console */
/* solhint-disable max-states-count */
pragma solidity ^0.8.20;

import { Test, console2} from "forge-std/Test.sol";
import { Create2 } from "openzeppelin-contracts/utils/Create2.sol";

import { EAS_OP } from "../src/Constants.sol";

import { ActionResolver } from "../src/resolvers/Action.sol";
import { ActionRegistry } from "../src/registries/Action.sol";


// import { ISchemaResolver } from "../src/interfaces/ISchemaResolver.sol";
// import { IEAS, AttestationRequest, AttestationRequestData } from "../src/interfaces/IEAS.sol";

contract MintTest is Test {    
    address payable public alice =
        payable(0x00000000000000000000000000000000000A11cE);
    address payable public bob =
        payable(0x0000000000000000000000000000000000000B0b);
    
    IEAS public eas = IEAS(EAS_OP);
    ISchemaRegistry public easRegistry = ISchemaRegistry(0x4200000000000000000000000000000000000020);

    address[] public team;
    string[] public capitals;

    bytes32 public salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
    bytes32 public actionSchemaUid;

    address public factory = address(this);//0x4e59b44847b379578588920cA78FbF26c0B4956C;

    address public actionResolver;
    address public actionRegistry;

    function setUp() public {
    
        actionResolver = Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(type(ActionResolver).creationCode, abi.encode(EAS_OP))),
            factory
        );

        actionRegistry = Create2.computeAddress(
            salt,
            keccak256(
                abi.encodePacked(
                    type(ActionRegistry).creationCode, abi.encode(campaignImplementation, actionResolver, hypercert)
                )
            ),
            factory
        );
        
        // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
        //uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");


        // Deploy Action Token
        if (actionRegistry.code.length == 0) {
            //vm.startBroadcast(deployerPrivateKey);
            new ActionRegistry{salt: salt}(campaignImplementation, actionResolver, hypercert);
            //vm.stopBroadcast();
            console2.log("ActionRegistry:", actionRegistry, "(deployed)");
        } else {
            console2.log("ActionRegistry:", actionRegistry, "(exists)");
        }

        if (actionResolver.code.length == 0) {
            //vm.startBroadcast(deployerPrivateKey);
            /*ActionResolver test2 =*/ new ActionResolver{salt: salt}(EAS_OP);
            //vm.stopBroadcast();
            //console2.log("s/b ConfResolver", address(test2));
            console2.log("ActionResolver:", actionResolver, "(deployed)");
        } else {
            console2.log("ActionResolver:", actionResolver, "(exists)");
        }

        actionSchemaUid = easRegistry.register("uint  contributionId, bool approval, string feedback, address campAccount", ISchemaResolver(actionResolver), true);

        // actionRegistry = new ActionRegistry(address(0x41C8f39463A868d3A88af00cd0fe7102F30E44eC), address(0xabcd));
        team.push(alice);
        team.push(bob);
        team.push(0xa53A6fE2d8Ad977aD926C485343Ba39f32D3A3F6);
        
        capitals.push("cash");
        capitals.push("money");
        capitals.push("dollars");
        capitals.push("cheese");
    }

    function testCreateAction() public {
        console2.log(ActionRegistry(actionRegistry).name());

        hoax(alice);
        
        ActionRegistry(actionRegistry).createAction(1709250389, 1709350000, "metadata", capitals, team);

        uint256 tokenId = 0;
        address shouldBeAlice = ActionRegistry(actionRegistry).ownerOf(tokenId);

        assertEq(shouldBeAlice, alice, "Not Alice");
    }

    function testSCAccount() public {
        hoax(alice);

        uint256 tokenId = 0;
        (address tbaAddress, uint256 hyperCertId) = ActionRegistry(actionRegistry).createAction(1709250389, 1709350000,"metadata", capitals, team);

        console2.log("scaddress ", tbaAddress);
        console2.log("hyperCertId ", hyperCertId);

        address scAddress = TBALib.getAccount(
            address(implementation),
            
            address(actionRegistry),
            tokenId
        );

        console2.log("scAddress ", scAddress);

        ActionAccount scAccount = ActionAccount(payable(tbaAddress));

        address shouldBeAlice = scAccount.owner();
        //console2.log("shouldBeAlice ", shouldBeAlice);

        assertEq(shouldBeAlice, alice, "Not Alice 2");
        assert(scAccount.isAction());
    }

    function testActionResolver() public {
        hoax(alice);

        uint256 tokenId = 0;
        (address tbaAddress, uint256 hyperCertId) = ActionRegistry(actionRegistry).createAction(1709250389, 1709350000,"metadata", capitals, team);

        //console2.log("scaddress ", tbaAddress);
        console2.log("hyperCertId ", hyperCertId);

        address scAddress = TBALib.getAccount(
            address(implementation),
            address(actionRegistry),
            tokenId
        );

        console2.log("scAddress ", scAddress);

        ActionAccount scAccount = ActionAccount(payable(tbaAddress));

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

        //for action
        attestationRequestData.recipient = bob;
        attestationRequestData.data = abi.encode(0, true, "gud", tbaAddress);

        request.schema = actionSchemaUid;
        request.data = attestationRequestData;

        hoax(alice);

        eas.attest(request);
    }
}
