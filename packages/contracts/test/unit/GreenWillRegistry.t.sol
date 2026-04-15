// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { GreenWillRegistry } from "../../src/registries/GreenWillRegistry.sol";
import { GreenWillUnlockModule } from "../../src/modules/GreenWillUnlockModule.sol";
import { GenesisHatValidator } from "../../src/validators/GenesisHatValidator.sol";
import { WorkAttestationValidator } from "../../src/validators/WorkAttestationValidator.sol";
import { MockHats } from "../../src/mocks/Hats.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockUnlockFactory, MockPublicLock } from "../../src/mocks/Unlock.sol";

contract GreenWillRegistryTest is Test {
    GreenWillRegistry internal registry;
    GreenWillUnlockModule internal unlockModule;

    MockHats internal hats;
    MockEAS internal eas;
    MockUnlockFactory internal unlockFactory;
    MockPublicLock internal genesisLock;

    GenesisHatValidator internal genesisValidator;
    WorkAttestationValidator internal workValidator;

    bytes32 internal constant GENESIS_BADGE = keccak256("GENESIS");
    bytes32 internal constant FIRST_WORK_BADGE = keccak256("FIRST_WORK");
    bytes32 internal constant WORK_SCHEMA_UID = keccak256("WORK_SCHEMA_UID");
    bytes32 internal constant WORK_UID = keccak256("WORK_UID");
    uint256 internal constant PROTOCOL_HAT_ID = 42;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);
    address internal constant GARDEN = address(0x600D);

    function setUp() public {
        hats = new MockHats();
        hats.setHatActive(PROTOCOL_HAT_ID, true);

        eas = new MockEAS();
        unlockFactory = new MockUnlockFactory();
        genesisLock = new MockPublicLock();

        genesisValidator = new GenesisHatValidator(address(hats), PROTOCOL_HAT_ID);
        workValidator = new WorkAttestationValidator(address(eas), WORK_SCHEMA_UID);

        GreenWillRegistry registryImplementation = new GreenWillRegistry();
        registry = GreenWillRegistry(
            address(
                new ERC1967Proxy(
                    address(registryImplementation),
                    abi.encodeWithSelector(GreenWillRegistry.initialize.selector, address(this))
                )
            )
        );

        GreenWillUnlockModule unlockImplementation = new GreenWillUnlockModule();
        unlockModule = GreenWillUnlockModule(
            address(
                new ERC1967Proxy(
                    address(unlockImplementation),
                    abi.encodeWithSelector(
                        GreenWillUnlockModule.initialize.selector,
                        address(this),
                        address(registry),
                        address(unlockFactory),
                        0
                    )
                )
            )
        );

        registry.setUnlockModule(address(unlockModule));
        registry.configureBadgeClass(
            GENESIS_BADGE,
            "genesis",
            "ipfs://genesis",
            address(genesisValidator),
            address(0),
            address(genesisLock),
            true,
            true
        );
        registry.configureBadgeClass(
            FIRST_WORK_BADGE, "first-work", "ipfs://first-work", address(workValidator), address(0), address(0), true, true
        );
    }

    function test_claimBadge_issuesGenesisForEligibleWearer() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);

        vm.prank(ALICE);
        uint256 tokenId = registry.claimBadge(GENESIS_BADGE, "");

        GreenWillRegistry.BadgeRecord memory record = registry.getBadgeRecord(GENESIS_BADGE, ALICE);
        assertEq(tokenId, 1, "unlock token id should be returned");
        assertTrue(registry.hasBadge(GENESIS_BADGE, ALICE), "registry should mark badge ownership");
        assertEq(record.sourceRef, bytes32(PROTOCOL_HAT_ID), "source ref should encode hat id");
        assertEq(record.unlockTokenId, 1, "unlock token id should be stored canonically");
        assertTrue(genesisLock.getHasValidKey(ALICE), "unlock key should be minted");
    }

    function test_claimBadge_revertsWhenGenesisWearerIsIneligible() public {
        vm.prank(BOB);
        vm.expectRevert(abi.encodeWithSelector(GenesisHatValidator.NotHatWearer.selector, BOB, PROTOCOL_HAT_ID));
        registry.claimBadge(GENESIS_BADGE, "");
    }

    function test_claimBadge_revertsForDuplicateGenesisOwnership() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);

        vm.prank(ALICE);
        registry.claimBadge(GENESIS_BADGE, "");

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWillRegistry.BadgeAlreadyOwned.selector, GENESIS_BADGE, ALICE));
        registry.claimBadge(GENESIS_BADGE, "");
    }

    function test_batchIssueEligible_issuesOnlyEligibleRecipientsWithoutDoubleIssuing() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);
        hats.setWearer(PROTOCOL_HAT_ID, CAROL, true);

        vm.prank(ALICE);
        registry.claimBadge(GENESIS_BADGE, "");

        address[] memory recipients = new address[](3);
        recipients[0] = ALICE;
        recipients[1] = BOB;
        recipients[2] = CAROL;

        bytes[] memory claimData = new bytes[](3);
        claimData[0] = "";
        claimData[1] = "";
        claimData[2] = "";

        uint256 issuedCount = registry.batchIssueEligible(GENESIS_BADGE, recipients, claimData);

        assertEq(issuedCount, 1, "only the newly eligible address should be issued");
        assertTrue(registry.hasBadge(GENESIS_BADGE, ALICE), "existing owner should remain unchanged");
        assertFalse(registry.hasBadge(GENESIS_BADGE, BOB), "ineligible address should be skipped");
        assertTrue(registry.hasBadge(GENESIS_BADGE, CAROL), "eligible address should be airdropped");
        assertEq(genesisLock.totalSupply(), 2, "unlock should only mint for unique eligible owners");
    }

    function test_claimBadge_issuesFirstWorkForValidAttestation() public {
        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, ALICE);

        vm.prank(ALICE);
        registry.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));

        GreenWillRegistry.BadgeRecord memory record = registry.getBadgeRecord(FIRST_WORK_BADGE, ALICE);
        assertTrue(registry.hasBadge(FIRST_WORK_BADGE, ALICE), "first-work badge should be owned");
        assertEq(record.sourceRef, WORK_UID, "work uid should be stored as source ref");
    }

    function test_claimBadge_revertsForWrongWorkSchema() public {
        _setWorkAttestation(WORK_UID, keccak256("WRONG_SCHEMA_UID"), ALICE);

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                WorkAttestationValidator.InvalidAttestationSchema.selector,
                WORK_UID,
                WORK_SCHEMA_UID,
                keccak256("WRONG_SCHEMA_UID")
            )
        );
        registry.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));
    }

    function test_claimBadge_revertsForWrongWorkAttester() public {
        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, BOB);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(WorkAttestationValidator.InvalidAttester.selector, WORK_UID, ALICE, BOB));
        registry.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));
    }

    function test_claimBadge_revertsWhenWorkAttestationMissing() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(WorkAttestationValidator.AttestationNotFound.selector, WORK_UID));
        registry.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));
    }

    function test_claimBadge_revertsForDuplicateFirstWorkOwnership() public {
        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, ALICE);

        vm.prank(ALICE);
        registry.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWillRegistry.BadgeAlreadyOwned.selector, FIRST_WORK_BADGE, ALICE));
        registry.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));
    }

    function _setWorkAttestation(bytes32 uid, bytes32 schemaUID, address attester) internal {
        eas.setAttestationByUID(
            uid,
            Attestation({
                uid: uid,
                schema: schemaUID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: GARDEN,
                attester: attester,
                revocable: true,
                data: abi.encode("work")
            })
        );
    }
}
