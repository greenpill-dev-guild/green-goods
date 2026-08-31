// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenAccount } from "../../src/accounts/Garden.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { KarmaGAPModule } from "../../src/modules/Karma.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IKarmaGAPModule } from "../../src/interfaces/IKarmaGAPModule.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";
import { FaithfulGap, FaithfulProjectResolver } from "../helpers/FaithfulKarmaGap.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";

contract KarmaGAPReconciliationTest is Test, ERC6551Helper {
    address internal constant GAP = 0x9E5560f5b084c227Dc40672f48F59DA617eeFA28;
    address internal constant PROJECT_RESOLVER = 0x099787D5a5aC92779A519CfD925ACB0Dc7E8bd23;
    bytes32 internal constant PROJECT_SCHEMA = 0xec77990a252b54b17673955c774b9712766de5eecb22ca5aa2c440e0e93257fb;
    bytes32 internal constant DETAILS_SCHEMA = 0x2c270e35bfcdc4d611f0e9d3d2ab6924ec6c673505abc22a1dd07e19b67211af;
    bytes32 internal constant MEMBER_SCHEMA = 0xdd87b3500457931252424f4439365534ba72a367503a8805ff3482353fb90301;

    address internal owner = address(0xA11CE);
    address internal steward = address(0xB0B);

    GardenToken internal gardenToken;
    GardenAccount internal garden;
    KarmaGAPModule internal karma;
    MockHatsModule internal hats;
    FaithfulGap internal gap;
    FaithfulProjectResolver internal resolver;

    function setUp() public {
        vm.chainId(11_155_111);
        _deployERC6551Registry();
        _installKarmaFixtures();

        GardenAccount accountImplementation =
            new GardenAccount(address(1), address(2), address(3), address(4), address(5), address(6));
        GardenToken tokenImplementation = new GardenToken(address(accountImplementation));
        gardenToken = GardenToken(
            address(
                new ERC1967Proxy(address(tokenImplementation), abi.encodeCall(GardenToken.initialize, (owner, address(0))))
            )
        );
        hats = new MockHatsModule();
        KarmaGAPModule karmaImplementation = new KarmaGAPModule();
        karma = KarmaGAPModule(
            address(
                new ERC1967Proxy(
                    address(karmaImplementation),
                    abi.encodeCall(KarmaGAPModule.initialize, (owner, address(gardenToken), owner, address(0)))
                )
            )
        );

        vm.startPrank(owner);
        gardenToken.setHatsModule(address(hats));
        gardenToken.setKarmaGAPModule(address(karma));
        gardenToken.setCommunityToken(address(new MockERC20()));
        karma.setHatsModule(address(hats));
        hats.setKarmaGAPModule(address(karma));
        garden = GardenAccount(payable(gardenToken.mintGarden(_gardenConfig())));
        vm.stopPrank();
    }

    function testIntegration_Karma_projectExistsBeforeInitialOwnerAndStewardSync() public {
        bytes32 projectUID = karma.getProjectUID(address(garden));

        assertTrue(projectUID != bytes32(0));
        assertTrue(resolver.isAdmin(projectUID, owner));
        assertTrue(resolver.isAdmin(projectUID, steward));
        assertTrue(karma.gardenMemberOfUIDs(address(garden), owner) != bytes32(0));
        assertTrue(karma.gardenMemberOfUIDs(address(garden), steward) != bytes32(0));
    }

    function testIntegration_Karma_gapFacadeCannotAddAdminButGardenAccountCan() public {
        bytes32 projectUID = karma.getProjectUID(address(garden));
        vm.expectRevert(bytes("ProjectResolver: Not owner"));
        gap.addProjectAdmin(projectUID, steward);

        karma.reconcileProjectAccess(address(garden), steward);
        assertTrue(resolver.isAdmin(projectUID, steward));
        assertFalse(resolver.isAdmin(projectUID, address(karma)));
    }

    function testIntegration_Karma_ownerAndStewardBecomeMembersAndAdmins() public {
        karma.reconcileProjectAccess(address(garden), owner);
        karma.reconcileProjectAccess(address(garden), steward);

        bytes32 projectUID = karma.getProjectUID(address(garden));
        assertTrue(resolver.isAdmin(projectUID, owner));
        assertTrue(resolver.isAdmin(projectUID, steward));
        assertTrue(karma.gardenMemberOfUIDs(address(garden), owner) != bytes32(0));
        assertTrue(karma.gardenMemberOfUIDs(address(garden), steward) != bytes32(0));
    }

    function testIntegration_Karma_revokedStewardLosesAdminButKeepsMembership() public {
        karma.reconcileProjectAccess(address(garden), steward);
        bytes32 memberUID = karma.gardenMemberOfUIDs(address(garden), steward);
        hats.setOperator(address(garden), steward, false);

        karma.reconcileProjectAccess(address(garden), steward);

        assertFalse(resolver.isAdmin(karma.getProjectUID(address(garden)), steward));
        assertEq(karma.gardenMemberOfUIDs(address(garden), steward), memberUID);
    }

    function testIntegration_Karma_revokedStewardWhoStillOwnsGardenKeepsAdmin() public {
        hats.setOwner(address(garden), steward, true);
        karma.reconcileProjectAccess(address(garden), steward);
        hats.setOperator(address(garden), steward, false);

        karma.reconcileProjectAccess(address(garden), steward);

        assertTrue(resolver.isAdmin(karma.getProjectUID(address(garden)), steward));
    }

    function testIntegration_Karma_reconcileProjectAndAccessAreIdempotent() public {
        bytes32 projectUID = karma.getProjectUID(address(garden));
        uint256 projectsBefore = gap.attestationCount(PROJECT_SCHEMA);
        uint256 detailsBefore = gap.attestationCount(DETAILS_SCHEMA);

        karma.reconcileProject(address(garden));
        karma.reconcileProjectAccess(address(garden), steward);
        uint256 membersAfterFirst = gap.attestationCount(MEMBER_SCHEMA);
        karma.reconcileProjectAccess(address(garden), steward);

        assertEq(karma.getProjectUID(address(garden)), projectUID);
        assertEq(gap.attestationCount(PROJECT_SCHEMA), projectsBefore);
        assertEq(gap.attestationCount(DETAILS_SCHEMA), detailsBefore);
        assertEq(gap.attestationCount(MEMBER_SCHEMA), membersAfterFirst);
    }

    function testIntegration_Karma_resetRecreateCreatesMembershipForNewProject() public {
        bytes32 oldProjectUID = karma.getProjectUID(address(garden));
        bytes32 oldMemberUID = karma.gardenMemberOfUIDs(address(garden), steward);
        uint256 membersBefore = gap.attestationCount(MEMBER_SCHEMA);

        vm.prank(owner);
        karma.resetProject(address(garden));
        bytes32 newProjectUID = karma.reconcileProject(address(garden));
        karma.reconcileProjectAccess(address(garden), steward);

        assertTrue(newProjectUID != bytes32(0));
        assertTrue(newProjectUID != oldProjectUID);
        assertTrue(karma.gardenMemberOfUIDs(address(garden), steward) != oldMemberUID);
        assertEq(karma.gardenMemberOfProjectUIDs(address(garden), steward), newProjectUID);
        assertEq(gap.attestationCount(MEMBER_SCHEMA), membersBefore + 1);
        assertTrue(resolver.isAdmin(newProjectUID, steward));
    }

    function testIntegration_Karma_projectReentrancyDoesNotCreateDuplicateAttestations() public {
        vm.prank(owner);
        karma.resetProject(address(garden));
        uint256 projectsBefore = gap.attestationCount(PROJECT_SCHEMA);
        gap.setCallback(address(karma), abi.encodeCall(KarmaGAPModule.reconcileProject, (address(garden))));

        bytes32 projectUID = karma.reconcileProject(address(garden));

        assertTrue(projectUID != bytes32(0));
        assertEq(gap.attestationCount(PROJECT_SCHEMA), projectsBefore + 1);
        assertTrue(gap.callbackSucceeded());
    }

    function testIntegration_Karma_membershipReentrancyDoesNotCreateDuplicateAttestations() public {
        address nextSteward = address(0xCAFE);
        hats.setOperator(address(garden), nextSteward, true);
        uint256 membersBefore = gap.attestationCount(MEMBER_SCHEMA);
        gap.setCallback(
            address(karma), abi.encodeCall(KarmaGAPModule.reconcileProjectAccess, (address(garden), nextSteward))
        );

        karma.reconcileProjectAccess(address(garden), nextSteward);

        assertEq(gap.attestationCount(MEMBER_SCHEMA), membersBefore + 1);
        assertEq(karma.gardenMemberOfProjectUIDs(address(garden), nextSteward), karma.getProjectUID(address(garden)));
        assertTrue(gap.callbackSucceeded());
    }

    function testIntegration_Karma_recordsOneFinalMembershipAndAccessOutcomePerAccountAttempt() public {
        vm.recordLogs();
        karma.reconcileProjectAccess(address(garden), steward);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(_countSyncEvents(logs, IKarmaGAPModule.KarmaSyncOperation.Membership, steward), 1);
        assertEq(_countSyncEvents(logs, IKarmaGAPModule.KarmaSyncOperation.Access, steward), 1);
    }

    function testIntegration_Karma_zeroAccountDoesNotCreateUnrecoverableSyncRecords() public {
        vm.recordLogs();
        (bool roleActive, bool changed) = karma.reconcileProjectAccess(address(garden), address(0));
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertFalse(roleActive);
        assertFalse(changed);
        assertEq(_countSyncEvents(logs, IKarmaGAPModule.KarmaSyncOperation.Membership, address(0)), 0);
        assertEq(_countSyncEvents(logs, IKarmaGAPModule.KarmaSyncOperation.Access, address(0)), 0);
    }

    function testIntegration_Karma_membershipRetryReportsAChangeWhenAccessIsAlreadyCurrent() public {
        address nextSteward = address(0xCAFE);
        hats.setOperator(address(garden), nextSteward, true);
        gap.setFailSchema(MEMBER_SCHEMA, true);

        (, bool accessChanged) = karma.reconcileProjectAccess(address(garden), nextSteward);
        assertTrue(accessChanged);
        assertEq(karma.gardenMemberOfUIDs(address(garden), nextSteward), bytes32(0));

        gap.setFailSchema(MEMBER_SCHEMA, false);
        (bool roleActive, bool membershipChanged) = karma.reconcileProjectAccess(address(garden), nextSteward);

        assertTrue(roleActive);
        assertTrue(membershipChanged);
        assertTrue(karma.gardenMemberOfUIDs(address(garden), nextSteward) != bytes32(0));
    }

    function testIntegration_Karma_detailsFailureKeepsProjectAndRetriesDetailsOnly() public {
        bytes32 detailsHashBefore = karma.gardenDetailsHashes(address(garden));
        gap.setFailSchema(DETAILS_SCHEMA, true);
        vm.recordLogs();
        vm.prank(owner);
        garden.updateDescription("updated while Karma is down");
        Vm.Log[] memory failedLogs = vm.getRecordedLogs();
        bytes32 projectUID = karma.getProjectUID(address(garden));
        uint256 projectsBefore = gap.attestationCount(PROJECT_SCHEMA);

        assertEq(garden.description(), "updated while Karma is down");
        assertEq(karma.gardenDetailsHashes(address(garden)), detailsHashBefore);
        assertEq(_countSyncEvents(failedLogs, IKarmaGAPModule.KarmaSyncOperation.Project, address(0)), 1);
        assertEq(_countSyncEvents(failedLogs, IKarmaGAPModule.KarmaSyncOperation.Details, address(0)), 1);

        gap.setFailSchema(DETAILS_SCHEMA, false);
        karma.reconcileProject(address(garden));

        assertEq(karma.getProjectUID(address(garden)), projectUID);
        assertEq(gap.attestationCount(PROJECT_SCHEMA), projectsBefore);
        assertTrue(karma.gardenDetailsHashes(address(garden)) != bytes32(0));
        assertTrue(karma.gardenDetailsHashes(address(garden)) != detailsHashBefore);
    }

    function testIntegration_Karma_projectUpdateIsSupportedAndIdempotent() public {
        bytes32 workUID = bytes32(uint256(0xA11CE));
        uint256 detailsBefore = gap.attestationCount(DETAILS_SCHEMA);

        vm.prank(owner);
        bytes32 updateUID = karma.createProjectUpdate(
            address(garden),
            "Planted trees",
            "Planted 100 native trees",
            "ipfs://https://cdn.example/evidence.jpg",
            workUID,
            "bafy-metadata"
        );
        vm.prank(owner);
        bytes32 duplicateUID = karma.createProjectUpdate(
            address(garden),
            "Planted trees",
            "Planted 100 native trees",
            "ipfs://https://cdn.example/evidence.jpg",
            workUID,
            "bafy-metadata"
        );

        assertTrue(updateUID != bytes32(0));
        assertEq(duplicateUID, updateUID);
        assertEq(karma.projectUpdateUIDs(workUID), updateUID);
        assertEq(gap.attestationCount(DETAILS_SCHEMA), detailsBefore + 1);

        string memory json = abi.decode(gap.lastData(DETAILS_SCHEMA), (string));
        assertTrue(_contains(json, "\"type\":\"project-update\""));
        assertTrue(_contains(json, "\"startsAt\""));
        assertTrue(_contains(json, "\"endsAt\""));
        assertTrue(_contains(json, "[View in Green Goods](https://www.greengoods.app/home/0x"));
        assertTrue(_contains(json, "https://sepolia.easscan.org/attestation/view/0x"));
        assertTrue(_contains(json, "\"proof\":\"https://cdn.example/evidence.jpg\""));
        assertTrue(_contains(json, "\"proof\":\"https://ipfs.io/ipfs/bafy-metadata\""));
        assertFalse(_contains(json, "\"links\""));
        assertFalse(_contains(json, "\"metadataCID\""));
        assertFalse(_contains(json, "ipfs://https://"));
    }

    function testIntegration_Karma_projectUpdateFailureIsRetryable() public {
        bytes32 workUID = bytes32(uint256(0xB0B));
        gap.setFailSchema(DETAILS_SCHEMA, true);

        vm.prank(owner);
        bytes32 failedUID = karma.createProjectUpdate(address(garden), "Work", "Update", "proof", workUID, "metadata");
        assertEq(failedUID, bytes32(0));
        assertEq(karma.projectUpdateUIDs(workUID), bytes32(0));

        gap.setFailSchema(DETAILS_SCHEMA, false);
        vm.prank(owner);
        bytes32 retryUID = karma.createProjectUpdate(address(garden), "Work", "Update", "proof", workUID, "metadata");
        assertTrue(retryUID != bytes32(0));
        assertEq(karma.projectUpdateUIDs(workUID), retryUID);
    }

    function testIntegration_Karma_nonModuleCannotCallGardenAccountAccessSync() public {
        vm.expectRevert();
        garden.syncKarmaProjectAccess(steward);
    }

    function testIntegration_Karma_syncVersionAndEnumOrdinalsAreFrozen() public {
        assertEq(garden.karmaSyncVersion(), 1);
        assertEq(uint8(IKarmaGAPModule.KarmaSyncOperation.Project), 0);
        assertEq(uint8(IKarmaGAPModule.KarmaSyncOperation.Details), 1);
        assertEq(uint8(IKarmaGAPModule.KarmaSyncOperation.Membership), 2);
        assertEq(uint8(IKarmaGAPModule.KarmaSyncOperation.Access), 3);
        assertEq(uint8(IKarmaGAPModule.KarmaSyncOperation.ProjectUpdate), 4);
        assertEq(uint8(IKarmaGAPModule.KarmaSyncOutcome.Noop), 0);
        assertEq(uint8(IKarmaGAPModule.KarmaSyncOutcome.Succeeded), 1);
        assertEq(uint8(IKarmaGAPModule.KarmaSyncOutcome.Failed), 2);
    }

    function _installKarmaFixtures() internal {
        FaithfulProjectResolver resolverImplementation = new FaithfulProjectResolver();
        vm.etch(PROJECT_RESOLVER, address(resolverImplementation).code);
        resolver = FaithfulProjectResolver(PROJECT_RESOLVER);
        resolver.initialize(GAP, address(0xF00D));

        FaithfulGap gapImplementation = new FaithfulGap();
        vm.etch(GAP, address(gapImplementation).code);
        gap = FaithfulGap(GAP);
        gap.initialize(PROJECT_RESOLVER, PROJECT_SCHEMA);
    }

    function _gardenConfig() internal view returns (GardenToken.GardenConfig memory config) {
        address[] memory stewards = new address[](1);
        stewards[0] = steward;
        config = GardenToken.GardenConfig({
            name: "Aiyeloja Family Garden",
            slug: "aiyeloja-family-garden",
            description: "A garden",
            location: "Lagos",
            bannerImage: "ipfs://bafy-banner",
            metadata: "ipfs://bafy-metadata",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0,
            gardeners: new address[](0),
            stewards: stewards
        });
    }

    function _countSyncEvents(
        Vm.Log[] memory logs,
        IKarmaGAPModule.KarmaSyncOperation expectedOperation,
        address expectedAccount
    )
        internal
        pure
        returns (uint256 count)
    {
        bytes32 signature = keccak256("KarmaSyncRecorded(address,bytes32,address,uint8,uint8,bytes32,bytes32,string)");
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length != 4 || logs[i].topics[0] != signature) continue;
            if (address(uint160(uint256(logs[i].topics[3]))) != expectedAccount) continue;
            (IKarmaGAPModule.KarmaSyncOperation operation,,,,) = abi.decode(
                logs[i].data,
                (IKarmaGAPModule.KarmaSyncOperation, IKarmaGAPModule.KarmaSyncOutcome, bytes32, bytes32, string)
            );
            if (operation == expectedOperation) count++;
        }
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory source = bytes(haystack);
        bytes memory search = bytes(needle);
        if (search.length > source.length) return false;
        for (uint256 i = 0; i <= source.length - search.length; i++) {
            bool matches = true;
            for (uint256 j = 0; j < search.length; j++) {
                if (source[i + j] != search[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) return true;
        }
        return false;
    }
}
