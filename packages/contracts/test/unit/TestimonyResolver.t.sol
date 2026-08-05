// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";

interface ITestimonyResolverRedTarget {
    function initialize(address owner_) external;
    function setSchemaUID(bytes32 uid) external;
    function setCommitmentModule(address module) external;
    function schemaUID() external view returns (bytes32);
    function attest(Attestation calldata attestation) external payable returns (bool);
}

error NotCommunityMember(address attester, address garden);
error TestimonyRequired();
error InvalidSchema();
error SchemaUIDRequired();
error SchemaUIDConflict(bytes32 currentUID, bytes32 requestedUID);
error CommitmentModuleRequired();

/// @title TestimonyResolverTest
/// @notice RED-first append-only schema activation coverage for PRD-721.
contract TestimonyResolverTest is Test {
    address private constant OWNER = address(0xA11CE);
    address private constant COMMUNITY_MEMBER = address(0xC011);
    bytes32 private constant TESTIMONY_SCHEMA_UID = bytes32(uint256(0x721));

    MockEAS private eas;
    MockGardenAccessControl private garden;
    ITestimonyResolverRedTarget private resolver;

    function setUp() public {
        eas = new MockEAS();
        garden = new MockGardenAccessControl();
        garden.setCommunity(COMMUNITY_MEMBER, true);

        address implementation = deployCode("Testimony.sol:TestimonyResolver", abi.encode(address(eas)));
        bytes memory initData = abi.encodeWithSelector(ITestimonyResolverRedTarget.initialize.selector, OWNER);
        resolver = ITestimonyResolverRedTarget(address(new ERC1967Proxy(implementation, initData)));
    }

    function testSchemaPinIsOneWayAndExactReplayIsNoOp() public {
        vm.prank(OWNER);
        resolver.setSchemaUID(TESTIMONY_SCHEMA_UID);
        assertEq(resolver.schemaUID(), TESTIMONY_SCHEMA_UID);

        vm.recordLogs();
        vm.prank(OWNER);
        resolver.setSchemaUID(TESTIMONY_SCHEMA_UID);
        assertEq(vm.getRecordedLogs().length, 0);

        bytes32 conflictingUID = bytes32(uint256(0x722));
        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(SchemaUIDConflict.selector, TESTIMONY_SCHEMA_UID, conflictingUID)
        );
        resolver.setSchemaUID(conflictingUID);
    }

    function testSchemaPinRejectsZero() public {
        vm.prank(OWNER);
        vm.expectRevert(SchemaUIDRequired.selector);
        resolver.setSchemaUID(bytes32(0));
    }

    function testModuleCannotActivateBeforeSchemaPin() public {
        vm.prank(OWNER);
        vm.expectRevert(SchemaUIDRequired.selector);
        resolver.setCommitmentModule(address(0xC0DE));
    }

    function testAttestationFailsClosedBeforeModuleActivation() public {
        Attestation memory attestation = _attestation(COMMUNITY_MEMBER, TESTIMONY_SCHEMA_UID, "bafy-testimony");

        vm.prank(address(eas));
        vm.expectRevert(CommitmentModuleRequired.selector);
        resolver.attest(attestation);
    }

    function testActivatedResolverRejectsWrongSchema() public {
        _activate();
        Attestation memory attestation = _attestation(COMMUNITY_MEMBER, bytes32(uint256(0xBAD)), "bafy-testimony");

        vm.prank(address(eas));
        vm.expectRevert(InvalidSchema.selector);
        resolver.attest(attestation);
    }

    function testActivatedResolverRequiresCommunityMember() public {
        _activate();
        address stranger = address(0xBAD);
        Attestation memory attestation = _attestation(stranger, TESTIMONY_SCHEMA_UID, "bafy-testimony");

        vm.prank(address(eas));
        vm.expectRevert(abi.encodeWithSelector(NotCommunityMember.selector, stranger, address(garden)));
        resolver.attest(attestation);
    }

    function testActivatedResolverRequiresTestimonyCID() public {
        _activate();
        Attestation memory attestation = _attestation(COMMUNITY_MEMBER, TESTIMONY_SCHEMA_UID, "");

        vm.prank(address(eas));
        vm.expectRevert(TestimonyRequired.selector);
        resolver.attest(attestation);
    }

    function testGardenLevelCommunityTestimonySucceeds() public {
        _activate();
        Attestation memory attestation = _attestation(COMMUNITY_MEMBER, TESTIMONY_SCHEMA_UID, "bafy-testimony");

        vm.prank(address(eas));
        assertTrue(resolver.attest(attestation));
    }

    function _activate() private {
        vm.startPrank(OWNER);
        resolver.setSchemaUID(TESTIMONY_SCHEMA_UID);
        resolver.setCommitmentModule(address(0xC0DE));
        vm.stopPrank();
    }

    function _attestation(
        address attester,
        bytes32 schema,
        string memory testimonyCID
    ) private view returns (Attestation memory) {
        return Attestation({
            uid: bytes32(uint256(1)),
            schema: schema,
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(garden),
            attester: attester,
            revocable: false,
            data: abi.encode(uint256(0), "A community story", testimonyCID)
        });
    }
}
