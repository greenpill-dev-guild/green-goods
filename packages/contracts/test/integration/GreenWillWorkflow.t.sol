// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { GreenWill } from "../../src/registries/GreenWill.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockHats } from "../../src/mocks/Hats.sol";
import { MockOctantVault } from "../../src/mocks/Octant.sol";
import { MockPublicLock } from "../../src/mocks/Unlock.sol";

contract GreenWillWorkflowVaultResolver {
    mapping(address garden => mapping(address asset => address vault)) internal vaults;

    function setVault(address garden, address asset, address vault) external {
        vaults[garden][asset] = vault;
    }

    function gardenAssetVaults(address garden, address asset) external view returns (address) {
        return vaults[garden][asset];
    }
}

contract GreenWillWorkflowTest is Test {
    GreenWill internal greenWill;

    GreenWillWorkflowVaultResolver internal vaultResolver;
    MockERC20 internal asset;
    MockEAS internal eas;
    MockHats internal hats;
    MockOctantVault internal vault;
    MockPublicLock internal genesisLock;
    MockPublicLock internal firstWorkLock;
    MockPublicLock internal firstSupportLock;

    bytes32 internal constant GENESIS_BADGE = keccak256("GENESIS");
    bytes32 internal constant FIRST_WORK_BADGE = keccak256("FIRST_WORK");
    bytes32 internal constant FIRST_SUPPORT_BADGE = keccak256("FIRST_SUPPORT");
    bytes32 internal constant WORK_SCHEMA_UID = keccak256("WORK_SCHEMA_UID");
    bytes32 internal constant WORK_UID = keccak256("WORK_UID");
    uint256 internal constant PROTOCOL_HAT_ID = 42;

    address internal constant ALICE = address(0xA11CE);
    address internal constant GARDEN = address(0x600D);

    function setUp() public {
        hats = new MockHats();
        hats.setHatActive(PROTOCOL_HAT_ID, true);
        hats.setWearer(PROTOCOL_HAT_ID, ALICE, true);

        eas = new MockEAS();
        asset = new MockERC20();
        vaultResolver = new GreenWillWorkflowVaultResolver();

        vault = new MockOctantVault(address(asset), "GreenWill Support Vault", "gwSVLT", address(this), 0);
        vaultResolver.setVault(GARDEN, address(asset), address(vault));
        asset.mint(ALICE, 25 ether);

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

    function test_workflow_claimGenesisClaimFirstWorkThenClaimFirstSupport() public {
        vm.prank(ALICE);
        uint256 genesisTokenId = greenWill.claimBadge(GENESIS_BADGE, "");

        _setWorkAttestation(WORK_UID, WORK_SCHEMA_UID, ALICE);

        vm.prank(ALICE);
        uint256 firstWorkTokenId = greenWill.claimBadge(FIRST_WORK_BADGE, abi.encode(WORK_UID));

        vm.prank(ALICE);
        uint256 shares = vault.deposit(10 ether, ALICE);

        vm.prank(ALICE);
        uint256 firstSupportTokenId = greenWill.claimBadge(FIRST_SUPPORT_BADGE, abi.encode(GARDEN, address(asset)));

        GreenWill.BadgeRecord memory genesisRecord = greenWill.getBadgeRecord(GENESIS_BADGE, ALICE);
        GreenWill.BadgeRecord memory firstWorkRecord = greenWill.getBadgeRecord(FIRST_WORK_BADGE, ALICE);
        GreenWill.BadgeRecord memory firstSupportRecord = greenWill.getBadgeRecord(FIRST_SUPPORT_BADGE, ALICE);

        assertEq(genesisTokenId, 1, "genesis should mint first lock token");
        assertEq(firstWorkTokenId, 1, "first-work should mint first lock token on its lock");
        assertEq(firstSupportTokenId, 1, "first-support should mint first lock token on its lock");
        assertTrue(greenWill.hasBadge(GENESIS_BADGE, ALICE), "genesis should be issued");
        assertTrue(greenWill.hasBadge(FIRST_WORK_BADGE, ALICE), "first-work should be issued");
        assertTrue(greenWill.hasBadge(FIRST_SUPPORT_BADGE, ALICE), "first-support should be issued");
        assertEq(genesisRecord.sourceRef, bytes32(PROTOCOL_HAT_ID), "genesis source ref should be hat id");
        assertEq(firstWorkRecord.sourceRef, WORK_UID, "first-work source ref should be work attestation");
        assertEq(firstSupportRecord.issuer, ALICE, "claimer should be issuer for self-claims");
        assertEq(
            firstSupportRecord.sourceRef,
            keccak256(abi.encode(GARDEN, address(asset), address(vault))),
            "support source ref should key the vault"
        );
        assertEq(shares, 10 ether, "support deposit should mint vault shares");
        assertEq(vault.balanceOf(ALICE), 10 ether, "supporter should receive vault shares");
        assertTrue(genesisLock.getHasValidKey(ALICE), "genesis lock key should be valid");
        assertTrue(firstWorkLock.getHasValidKey(ALICE), "first-work lock key should be valid");
        assertTrue(firstSupportLock.getHasValidKey(ALICE), "first-support lock key should be valid");
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
