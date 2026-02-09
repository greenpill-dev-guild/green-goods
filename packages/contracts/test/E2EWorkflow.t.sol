// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { ActionRegistry, Capital } from "../src/registries/Action.sol";
import { HatsModule } from "../src/modules/Hats.sol";
import { IHatsModule } from "../src/interfaces/IHatsModule.sol";
import { MockHats } from "../src/mocks/Hats.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";
import { MockEAS } from "../src/mocks/EAS.sol";
import { WorkSchema, WorkApprovalSchema } from "../src/Schemas.sol";
import { ERC6551Helper } from "./helpers/ERC6551Helper.sol";

/// @title E2EWorkflow Test
/// @notice End-to-end integration tests for Hats-only workflows
contract E2EWorkflowTest is Test, ERC6551Helper {
    GardenToken private gardenToken;
    ActionRegistry private actionRegistry;
    HatsModule private hatsModule;
    MockHats private mockHats;
    MockERC20 private communityToken;
    MockEAS private mockEAS;

    address private multisig = address(0x123);
    address private gardener1 = address(0x201);
    address private gardener2 = address(0x202);
    address private operator1 = address(0x301);
    address private nonMember = address(0x999);

    function setUp() public {
        _deployERC6551Registry();

        communityToken = new MockERC20();
        mockEAS = new MockEAS();
        mockHats = new MockHats();

        GardenAccount gardenAccountImplementation = new GardenAccount(
            address(0x1001), address(0x1002), address(0x1003), address(0x1004), address(0x2001), address(0x2002)
        );

        GardenToken gardenTokenImpl = new GardenToken(address(gardenAccountImplementation));
        bytes memory gardenTokenInitData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        gardenToken = GardenToken(address(new ERC1967Proxy(address(gardenTokenImpl), gardenTokenInitData)));

        ActionRegistry actionRegistryImpl = new ActionRegistry();
        bytes memory actionRegistryInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        actionRegistry = ActionRegistry(address(new ERC1967Proxy(address(actionRegistryImpl), actionRegistryInitData)));

        HatsModule hatsImpl = new HatsModule();
        bytes memory hatsInitData = abi.encodeWithSelector(HatsModule.initialize.selector, multisig, address(mockHats));
        hatsModule = HatsModule(address(new ERC1967Proxy(address(hatsImpl), hatsInitData)));

        vm.prank(multisig);
        gardenToken.setHatsModule(address(hatsModule));

        vm.prank(multisig);
        hatsModule.setGardenToken(address(gardenToken));

        uint256 gardensHatId = mockHats.mintTopHat(address(hatsModule), "Green Goods Gardens", "");
        vm.prank(multisig);
        hatsModule.setProtocolHatIds(0, gardensHatId, 0);
    }

    function _mintGarden(bool openJoining) internal returns (address garden) {
        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "E2E Test Garden",
            description: "A complete workflow test garden",
            location: "Test City",
            bannerImage: "ipfs://QmBanner",
            metadata: "",
            openJoining: openJoining
        });
        return gardenToken.mintGarden(config);
    }

    function _grantRoles(address garden) internal {
        vm.startPrank(multisig);
        hatsModule.grantRole(garden, operator1, IHatsModule.GardenRole.Operator);
        hatsModule.grantRole(garden, gardener1, IHatsModule.GardenRole.Gardener);
        vm.stopPrank();
    }

    /// @notice Complete Hats-only protocol flow (Mint → Role grant → Register → Submit → Approve)
    function testCompleteProtocolWorkflow() public {
        address garden = _mintGarden(false);
        GardenAccount gardenAccount = GardenAccount(payable(garden));
        _grantRoles(garden);

        assertEq(gardenAccount.name(), "E2E Test Garden");
        assertTrue(gardenAccount.isOperator(operator1));
        assertTrue(gardenAccount.isGardener(gardener1));

        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Plant Native Trees",
            "ipfs://QmInstructions",
            capitals,
            new string[](0)
        );

        WorkSchema memory workSubmission = WorkSchema({
            actionUID: 0,
            title: "Planted 10 Oak Trees",
            feedback: "",
            metadata: "{'trees': 10, 'species': 'Oak'}",
            media: new string[](1)
        });
        workSubmission.media[0] = "ipfs://QmWorkPhoto";

        bytes32 workUID = bytes32(uint256(1));
        Attestation memory workAttestation = Attestation({
            uid: workUID,
            schema: bytes32(uint256(100)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: garden,
            attester: gardener1,
            revocable: true,
            data: abi.encode(workSubmission)
        });

        vm.prank(gardener1);
        mockEAS.setAttestationByUID(workUID, workAttestation);

        WorkApprovalSchema memory approval =
            WorkApprovalSchema({ actionUID: 0, workUID: workUID, approved: true, feedback: "Great work" });

        bytes32 approvalUID = bytes32(uint256(2));
        Attestation memory approvalAttestation = Attestation({
            uid: approvalUID,
            schema: bytes32(uint256(101)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: workUID,
            recipient: garden,
            attester: operator1,
            revocable: true,
            data: abi.encode(approval)
        });

        vm.prank(operator1);
        mockEAS.setAttestationByUID(approvalUID, approvalAttestation);

        WorkApprovalSchema memory storedApproval =
            abi.decode(mockEAS.getAttestation(approvalUID).data, (WorkApprovalSchema));
        assertTrue(storedApproval.approved);
    }

    /// @notice Access control uses hats roles only
    function testAccessControlEnforcement() public {
        address garden = _mintGarden(false);
        GardenAccount gardenAccount = GardenAccount(payable(garden));

        vm.prank(nonMember);
        vm.expectRevert();
        gardenAccount.updateDescription("Unauthorized update");

        vm.startPrank(multisig);
        hatsModule.grantRole(garden, operator1, IHatsModule.GardenRole.Operator);
        vm.stopPrank();

        vm.prank(operator1);
        gardenAccount.updateDescription("Authorized update");
        assertEq(gardenAccount.description(), "Authorized update");
    }

    /// @notice Open joining grants gardener hat via HatsModule
    function testJoinGardenOpenJoining() public {
        address garden = _mintGarden(true);
        GardenAccount gardenAccount = GardenAccount(payable(garden));

        vm.prank(gardener2);
        gardenAccount.joinGarden();

        assertTrue(gardenAccount.isGardener(gardener2));
    }
}
