// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { GreenWill } from "../../src/registries/GreenWill.sol";
import { ArrayLengthMismatch } from "../../src/CommonErrors.sol";
import { MockHats } from "../../src/mocks/Hats.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockOctantVault } from "../../src/mocks/Octant.sol";
import { MockPublicLock } from "../../src/mocks/Unlock.sol";

contract MockGreenWillVaultResolver {
    mapping(address garden => mapping(address asset => address vault)) internal vaults;

    function setVault(address garden, address asset, address vault) external {
        vaults[garden][asset] = vault;
    }

    function gardenAssetVaults(address garden, address asset) external view returns (address) {
        return vaults[garden][asset];
    }
}

contract GreenWillTest is Test {
    GreenWill internal greenWill;

    MockHats internal hats;
    MockEAS internal eas;
    MockGreenWillVaultResolver internal vaultResolver;
    MockOctantVault internal vault;
    MockPublicLock internal genesisLock;
    MockPublicLock internal firstWorkLock;
    MockPublicLock internal firstSupportLock;

    bytes32 internal constant GENESIS_BADGE = keccak256("GENESIS");
    bytes32 internal constant FIRST_WORK_BADGE = keccak256("FIRST_WORK");
    bytes32 internal constant FIRST_SUPPORT_BADGE = keccak256("FIRST_SUPPORT");
    bytes32 internal constant AUTHORIZED_BADGE = keccak256("AUTHORIZED");
    bytes32 internal constant WORK_SCHEMA_UID = keccak256("WORK_SCHEMA_UID");
    bytes32 internal constant WORK_UID = keccak256("WORK_UID");
    uint256 internal constant PROTOCOL_HAT_ID = 42;
    uint256 internal constant TEMPORARY_UNLOCK_DURATION = 30 days;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);
    address internal constant GARDEN = address(0x600D);
    address internal constant ASSET = address(0xA55E7);

    function setUp() public {
        hats = new MockHats();
        hats.setHatActive(PROTOCOL_HAT_ID, true);

        eas = new MockEAS();
        vaultResolver = new MockGreenWillVaultResolver();
        vault = new MockOctantVault(ASSET, "Support Vault", "SVLT", address(this), 0);
        vaultResolver.setVault(GARDEN, ASSET, address(vault));

        genesisLock = new MockPublicLock();
        firstWorkLock = new MockPublicLock();
        firstSupportLock = new MockPublicLock();

        GreenWill implementation = new GreenWill();
        greenWill = GreenWill(
            address(
                new ERC1967Proxy(
                    address(implementation), abi.encodeWithSelector(GreenWill.initialize.selector, address(this))
                )
            )
        );

        greenWill.configureBadgeClass(
            GENESIS_BADGE, "genesis", "ipfs://genesis", address(hats), address(0), address(genesisLock), true, true
        );
        greenWill.configureBadgeRule(GENESIS_BADGE, GreenWill.BadgeRule.Hat, bytes32(PROTOCOL_HAT_ID), 0);

        greenWill.configureBadgeClass(
            FIRST_WORK_BADGE,
            "first-work",
            "ipfs://first-work",
            address(eas),
            address(0),
            address(firstWorkLock),
            true,
            true
        );
        greenWill.configureBadgeRule(FIRST_WORK_BADGE, GreenWill.BadgeRule.WorkAttestation, WORK_SCHEMA_UID, 0);

        greenWill.configureBadgeClass(
            FIRST_SUPPORT_BADGE,
            "first-support",
            "ipfs://first-support",
            address(vaultResolver),
            address(0),
            address(firstSupportLock),
            true,
            true
        );
        greenWill.configureBadgeRule(FIRST_SUPPORT_BADGE, GreenWill.BadgeRule.VaultShares, bytes32(0), 0);
    }

    function test_claimBadge_issuesGenesisForEligibleWearer() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);

        vm.prank(ALICE);
        uint256 tokenId = greenWill.claimBadge(GENESIS_BADGE, "");

        GreenWill.BadgeRecord memory record = greenWill.getBadgeRecord(GENESIS_BADGE, ALICE);
        assertEq(tokenId, 1, "unlock token id should be returned");
        assertTrue(greenWill.hasBadge(GENESIS_BADGE, ALICE), "GreenWill should mark badge ownership");
        assertEq(record.sourceRef, bytes32(PROTOCOL_HAT_ID), "source ref should encode hat id");
        assertEq(record.unlockTokenId, 1, "unlock token id should be stored canonically");
        assertTrue(genesisLock.getHasValidKey(ALICE), "unlock key should be minted directly by GreenWill");
    }

    function test_claimBadge_revertsWhenGenesisWearerIsIneligible() public {
        vm.prank(BOB);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.NotHatWearer.selector, BOB, PROTOCOL_HAT_ID));
        greenWill.claimBadge(GENESIS_BADGE, "");
    }

    function test_previewClaim_returnsSourceRefWithoutIssuing() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);

        bytes32 sourceRef = greenWill.previewClaim(GENESIS_BADGE, ALICE, "");

        assertEq(sourceRef, bytes32(PROTOCOL_HAT_ID), "preview should return the eligibility source");
        assertFalse(greenWill.hasBadge(GENESIS_BADGE, ALICE), "preview should not issue a badge");
        assertEq(genesisLock.totalSupply(), 0, "preview should not mint an unlock key");
    }

    function test_claimBadge_revertsWhenBadgeIsAlreadyOwned() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);

        vm.startPrank(ALICE);
        greenWill.claimBadge(GENESIS_BADGE, "");
        vm.expectRevert(abi.encodeWithSelector(GreenWill.BadgeAlreadyOwned.selector, GENESIS_BADGE, ALICE));
        greenWill.claimBadge(GENESIS_BADGE, "");
        vm.stopPrank();
    }

    function test_claimBadge_usesConfiguredUnlockDuration() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);
        greenWill.configureBadgeRule(
            GENESIS_BADGE, GreenWill.BadgeRule.Hat, bytes32(PROTOCOL_HAT_ID), TEMPORARY_UNLOCK_DURATION
        );

        vm.prank(ALICE);
        greenWill.claimBadge(GENESIS_BADGE, "");

        assertEq(
            genesisLock.keyExpirationTimestampFor(ALICE),
            block.timestamp + TEMPORARY_UNLOCK_DURATION,
            "temporary badge should mint a time-bound unlock key"
        );
    }

    function test_claimBadge_revertsWhenBadgeIsNotConfigured() public {
        bytes32 unknownBadge = keccak256("UNKNOWN_BADGE");

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.BadgeClassNotConfigured.selector, unknownBadge));
        greenWill.claimBadge(unknownBadge, "");
    }

    function test_claimBadge_revertsWhenBadgeIsInactive() public {
        greenWill.configureBadgeClass(
            GENESIS_BADGE, "genesis", "ipfs://genesis", address(hats), address(0), address(genesisLock), true, false
        );

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.BadgeInactive.selector, GENESIS_BADGE));
        greenWill.claimBadge(GENESIS_BADGE, "");
    }

    function test_claimBadge_revertsWhenBadgeIsNotClaimable() public {
        greenWill.configureBadgeClass(
            GENESIS_BADGE, "genesis", "ipfs://genesis", address(hats), address(0), address(genesisLock), false, true
        );

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.BadgeNotClaimable.selector, GENESIS_BADGE));
        greenWill.claimBadge(GENESIS_BADGE, "");
    }

    function test_claimBadge_revertsWhenRuleIsNotConfigured() public {
        bytes32 manualBadge = keccak256("MANUAL_BADGE");
        greenWill.configureBadgeClass(
            manualBadge, "manual", "ipfs://manual", address(hats), address(0), address(0), true, true
        );

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.BadgeRuleNotConfigured.selector, manualBadge));
        greenWill.claimBadge(manualBadge, "");
    }

    function test_configureBadgeRule_revertsWhenBadgeClassIsMissing() public {
        bytes32 unknownBadge = keccak256("UNKNOWN_BADGE");

        vm.expectRevert(abi.encodeWithSelector(GreenWill.BadgeClassNotConfigured.selector, unknownBadge));
        greenWill.configureBadgeRule(unknownBadge, GreenWill.BadgeRule.Hat, bytes32(PROTOCOL_HAT_ID), 0);
    }

    function test_batchIssueEligible_revertsWhenInputLengthsMismatch() public {
        address[] memory recipients = new address[](1);
        recipients[0] = ALICE;

        bytes[] memory claimData = new bytes[](0);

        vm.expectRevert(ArrayLengthMismatch.selector);
        greenWill.batchIssueEligible(GENESIS_BADGE, recipients, claimData);
    }

    function test_batchIssueEligible_issuesOnlyEligibleRecipientsWithoutDoubleIssuing() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);
        hats.setWearer(PROTOCOL_HAT_ID, CAROL, true);

        vm.prank(ALICE);
        greenWill.claimBadge(GENESIS_BADGE, "");

        address[] memory recipients = new address[](3);
        recipients[0] = ALICE;
        recipients[1] = BOB;
        recipients[2] = CAROL;

        bytes[] memory claimData = new bytes[](3);
        claimData[0] = "";
        claimData[1] = "";
        claimData[2] = "";

        uint256 issuedCount = greenWill.batchIssueEligible(GENESIS_BADGE, recipients, claimData);

        assertEq(issuedCount, 1, "only the newly eligible address should be issued");
        assertTrue(greenWill.hasBadge(GENESIS_BADGE, ALICE), "existing owner should remain unchanged");
        assertFalse(greenWill.hasBadge(GENESIS_BADGE, BOB), "ineligible address should be skipped");
        assertTrue(greenWill.hasBadge(GENESIS_BADGE, CAROL), "eligible address should be airdropped");
        assertEq(genesisLock.totalSupply(), 2, "unlock should only mint for unique eligible owners");
    }

    function test_claimBadge_issuesFirstWorkForValidAttestation() public {
        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, ALICE);

        vm.prank(ALICE);
        uint256 tokenId = greenWill.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));

        GreenWill.BadgeRecord memory record = greenWill.getBadgeRecord(FIRST_WORK_BADGE, ALICE);
        assertEq(tokenId, 1, "first-work should mint a lock key directly");
        assertTrue(greenWill.hasBadge(FIRST_WORK_BADGE, ALICE), "first-work badge should be owned");
        assertEq(record.sourceRef, WORK_UID, "work uid should be stored as source ref");
        assertTrue(firstWorkLock.getHasValidKey(ALICE), "first-work lock should be minted");
    }

    function test_claimBadge_revertsForMalformedWorkClaimData() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.InvalidClaimData.selector, FIRST_WORK_BADGE));
        greenWill.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID, bytes32("extra")));
    }

    function test_claimBadge_revertsWhenWorkAttestationIsMissing() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.AttestationNotFound.selector, WORK_UID));
        greenWill.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));
    }

    function test_claimBadge_revertsWhenWorkAttestationIsRevoked() public {
        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, ALICE, uint64(block.timestamp));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.AttestationRevoked.selector, WORK_UID));
        greenWill.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));
    }

    function test_claimBadge_revertsForWrongWorkSchema() public {
        _setWorkAttestation(WORK_UID, keccak256("WRONG_SCHEMA_UID"), ALICE);

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                GreenWill.InvalidAttestationSchema.selector, WORK_UID, WORK_SCHEMA_UID, keccak256("WRONG_SCHEMA_UID")
            )
        );
        greenWill.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));
    }

    function test_claimBadge_revertsForWrongWorkAttester() public {
        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, BOB);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.InvalidAttester.selector, WORK_UID, ALICE, BOB));
        greenWill.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));
    }

    function test_claimBadge_issuesFirstSupportForExistingVaultPosition() public {
        vault.deposit(10 ether, ALICE);

        vm.prank(ALICE);
        uint256 tokenId = greenWill.claimBadge(FIRST_SUPPORT_BADGE, abi.encode(GARDEN, ASSET));

        GreenWill.BadgeRecord memory record = greenWill.getBadgeRecord(FIRST_SUPPORT_BADGE, ALICE);
        assertEq(tokenId, 1, "first-support should mint a lock key directly");
        assertTrue(greenWill.hasBadge(FIRST_SUPPORT_BADGE, ALICE), "first-support badge should be owned");
        assertEq(record.sourceRef, keccak256(abi.encode(GARDEN, ASSET, address(vault))), "source ref should key the vault");
        assertTrue(firstSupportLock.getHasValidKey(ALICE), "first-support lock should be minted");
    }

    function test_claimBadge_revertsWhenSupporterHasNoVaultShares() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.NoVaultShares.selector, ALICE, address(vault)));
        greenWill.claimBadge(FIRST_SUPPORT_BADGE, abi.encode(GARDEN, ASSET));
    }

    function test_claimBadge_revertsForMalformedSupportClaimData() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.InvalidClaimData.selector, FIRST_SUPPORT_BADGE));
        greenWill.claimBadge(FIRST_SUPPORT_BADGE, abi.encode(GARDEN));
    }

    function test_claimBadge_revertsWhenSupportVaultIsMissing() public {
        address unknownAsset = address(0x1234);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.VaultNotFound.selector, GARDEN, unknownAsset));
        greenWill.claimBadge(FIRST_SUPPORT_BADGE, abi.encode(GARDEN, unknownAsset));
    }

    function test_issueByAuthorizedIssuer_issuesActiveBadgeWithoutClaimRuleOrUnlockLock() public {
        bytes32 sourceRef = keccak256("manual-source");
        greenWill.configureBadgeClass(
            AUTHORIZED_BADGE, "authorized", "ipfs://authorized", address(0), CAROL, address(0), false, true
        );

        vm.prank(CAROL);
        uint256 tokenId = greenWill.issueByAuthorizedIssuer(AUTHORIZED_BADGE, ALICE, sourceRef);

        GreenWill.BadgeRecord memory record = greenWill.getBadgeRecord(AUTHORIZED_BADGE, ALICE);
        assertEq(tokenId, 0, "manual badge without lock should not mint an unlock key");
        assertTrue(record.issued, "authorized issuer should record badge ownership");
        assertEq(record.sourceRef, sourceRef, "manual source should be stored");
        assertEq(record.issuer, CAROL, "authorized issuer should be recorded");
    }

    function test_issueByAuthorizedIssuer_revertsWhenCallerIsNotAuthorized() public {
        bytes32 sourceRef = keccak256("manual-source");

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.UnauthorizedIssuer.selector, GENESIS_BADGE, ALICE));
        greenWill.issueByAuthorizedIssuer(GENESIS_BADGE, BOB, sourceRef);
    }

    function test_issueByAuthorizedIssuer_revertsWhenAccountAlreadyOwnsBadge() public {
        bytes32 sourceRef = keccak256("manual-source");
        greenWill.configureBadgeClass(
            AUTHORIZED_BADGE, "authorized", "ipfs://authorized", address(0), CAROL, address(0), false, true
        );

        vm.startPrank(CAROL);
        greenWill.issueByAuthorizedIssuer(AUTHORIZED_BADGE, ALICE, sourceRef);
        vm.expectRevert(abi.encodeWithSelector(GreenWill.BadgeAlreadyOwned.selector, AUTHORIZED_BADGE, ALICE));
        greenWill.issueByAuthorizedIssuer(AUTHORIZED_BADGE, ALICE, sourceRef);
        vm.stopPrank();
    }

    function test_upgradeToV2_preservesConfiguredClassesRulesAndIssuedRecords() public {
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);

        vm.prank(ALICE);
        greenWill.claimBadge(GENESIS_BADGE, "");

        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, ALICE);

        vm.prank(ALICE);
        greenWill.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));

        GreenWill.BadgeClass memory originalGenesisClass = greenWill.getBadgeClass(GENESIS_BADGE);
        GreenWill.BadgeClass memory originalWorkClass = greenWill.getBadgeClass(FIRST_WORK_BADGE);
        GreenWill.BadgeRecord memory originalGenesisRecord = greenWill.getBadgeRecord(GENESIS_BADGE, ALICE);
        GreenWill.BadgeRecord memory originalWorkRecord = greenWill.getBadgeRecord(FIRST_WORK_BADGE, ALICE);
        (GreenWill.BadgeRule originalGenesisRule, bytes32 originalGenesisCriteria, uint256 originalGenesisDuration) =
            greenWill.getBadgeRule(GENESIS_BADGE);
        (GreenWill.BadgeRule originalWorkRule, bytes32 originalWorkCriteria, uint256 originalWorkDuration) =
            greenWill.getBadgeRule(FIRST_WORK_BADGE);
        address originalOwner = greenWill.owner();
        address originalDeprecatedUnlockModule = greenWill.unlockModule();

        GreenWillV2 v2Implementation = new GreenWillV2();
        greenWill.upgradeTo(address(v2Implementation));

        GreenWillV2 upgraded = GreenWillV2(address(greenWill));

        assertEq(upgraded.owner(), originalOwner, "owner should survive upgrade");
        assertEq(upgraded.unlockModule(), originalDeprecatedUnlockModule, "deprecated unlock slot should survive upgrade");

        GreenWill.BadgeClass memory upgradedGenesisClass = upgraded.getBadgeClass(GENESIS_BADGE);
        GreenWill.BadgeClass memory upgradedWorkClass = upgraded.getBadgeClass(FIRST_WORK_BADGE);
        assertEq(upgradedGenesisClass.slug, originalGenesisClass.slug, "genesis slug should survive upgrade");
        assertEq(upgradedGenesisClass.metadataURI, originalGenesisClass.metadataURI, "genesis metadata should survive");
        assertEq(upgradedGenesisClass.validator, originalGenesisClass.validator, "genesis source should survive upgrade");
        assertEq(upgradedGenesisClass.unlockLock, originalGenesisClass.unlockLock, "genesis lock should survive upgrade");
        assertEq(upgradedGenesisClass.claimable, originalGenesisClass.claimable, "genesis claimable flag should survive");
        assertEq(upgradedGenesisClass.active, originalGenesisClass.active, "genesis active flag should survive");
        assertEq(upgradedWorkClass.slug, originalWorkClass.slug, "work slug should survive upgrade");
        assertEq(upgradedWorkClass.validator, originalWorkClass.validator, "work source should survive upgrade");
        assertEq(upgradedWorkClass.claimable, originalWorkClass.claimable, "work claimable flag should survive");
        assertEq(upgradedWorkClass.active, originalWorkClass.active, "work active flag should survive");

        (GreenWill.BadgeRule upgradedGenesisRule, bytes32 upgradedGenesisCriteria, uint256 upgradedGenesisDuration) =
            upgraded.getBadgeRule(GENESIS_BADGE);
        (GreenWill.BadgeRule upgradedWorkRule, bytes32 upgradedWorkCriteria, uint256 upgradedWorkDuration) =
            upgraded.getBadgeRule(FIRST_WORK_BADGE);
        assertEq(uint8(upgradedGenesisRule), uint8(originalGenesisRule), "genesis rule should survive upgrade");
        assertEq(upgradedGenesisCriteria, originalGenesisCriteria, "genesis criteria should survive upgrade");
        assertEq(upgradedGenesisDuration, originalGenesisDuration, "genesis duration should survive upgrade");
        assertEq(uint8(upgradedWorkRule), uint8(originalWorkRule), "work rule should survive upgrade");
        assertEq(upgradedWorkCriteria, originalWorkCriteria, "work criteria should survive upgrade");
        assertEq(upgradedWorkDuration, originalWorkDuration, "work duration should survive upgrade");

        GreenWill.BadgeRecord memory upgradedGenesisRecord = upgraded.getBadgeRecord(GENESIS_BADGE, ALICE);
        GreenWill.BadgeRecord memory upgradedWorkRecord = upgraded.getBadgeRecord(FIRST_WORK_BADGE, ALICE);
        assertEq(upgradedGenesisRecord.issued, originalGenesisRecord.issued, "genesis issued flag should survive");
        assertEq(upgradedGenesisRecord.issuedAt, originalGenesisRecord.issuedAt, "genesis issuedAt should survive");
        assertEq(upgradedGenesisRecord.sourceRef, originalGenesisRecord.sourceRef, "genesis sourceRef should survive");
        assertEq(
            upgradedGenesisRecord.unlockTokenId, originalGenesisRecord.unlockTokenId, "genesis unlock token should survive"
        );
        assertEq(upgradedGenesisRecord.issuer, originalGenesisRecord.issuer, "genesis issuer should survive");
        assertEq(upgradedWorkRecord.issued, originalWorkRecord.issued, "work issued flag should survive");
        assertEq(upgradedWorkRecord.issuedAt, originalWorkRecord.issuedAt, "work issuedAt should survive");
        assertEq(upgradedWorkRecord.sourceRef, originalWorkRecord.sourceRef, "work sourceRef should survive");
        assertEq(upgradedWorkRecord.issuer, originalWorkRecord.issuer, "work issuer should survive");
        assertTrue(upgraded.hasBadge(GENESIS_BADGE, ALICE), "genesis ownership should remain queryable");
        assertTrue(upgraded.hasBadge(FIRST_WORK_BADGE, ALICE), "first-work ownership should remain queryable");

        upgraded.setV2StorageMarker(20_260_420);
        assertEq(upgraded.v2StorageMarker(), 20_260_420, "v2 storage slot should be writable");
    }

    function _setWorkAttestation(bytes32 uid, bytes32 schemaUID, address attester) internal {
        _setWorkAttestation(uid, schemaUID, attester, 0);
    }

    function _setWorkAttestation(bytes32 uid, bytes32 schemaUID, address attester, uint64 revocationTime) internal {
        eas.setAttestationByUID(
            uid,
            Attestation({
                uid: uid,
                schema: schemaUID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: revocationTime,
                refUID: bytes32(0),
                recipient: GARDEN,
                attester: attester,
                revocable: true,
                data: abi.encode("work")
            })
        );
    }
}

contract GreenWillV2 is GreenWill {
    uint256 public v2StorageMarker;

    function setV2StorageMarker(uint256 marker) external onlyOwner {
        v2StorageMarker = marker;
    }
}
