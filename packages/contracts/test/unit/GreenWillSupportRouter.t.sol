// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { GreenWillRegistry } from "../../src/registries/GreenWillRegistry.sol";
import { GreenWillSupportRouter } from "../../src/modules/GreenWillSupportRouter.sol";
import { IGreenWillRegistry } from "../../src/interfaces/IGreenWillRegistry.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockOctantVault } from "../../src/mocks/Octant.sol";

contract MockVaultResolver {
    mapping(address garden => mapping(address asset => address vault)) internal vaults;

    function setVault(address garden, address asset, address vault) external {
        vaults[garden][asset] = vault;
    }

    function gardenAssetVaults(address garden, address asset) external view returns (address) {
        return vaults[garden][asset];
    }
}

contract GreenWillSupportRouterTest is Test {
    GreenWillRegistry internal registry;
    GreenWillSupportRouter internal router;

    MockVaultResolver internal vaultResolver;
    MockERC20 internal asset;
    MockOctantVault internal vault;

    bytes32 internal constant FIRST_SUPPORT_BADGE = keccak256("FIRST_SUPPORT");

    address internal constant ALICE = address(0xA11CE);
    address internal constant GARDEN = address(0x600D);

    function setUp() public {
        vaultResolver = new MockVaultResolver();
        asset = new MockERC20();
        vault = new MockOctantVault(address(asset), "Support Vault", "SVLT", address(this), 0);

        asset.mint(ALICE, 100 ether);
        vaultResolver.setVault(GARDEN, address(asset), address(vault));

        GreenWillRegistry registryImplementation = new GreenWillRegistry();
        registry = GreenWillRegistry(
            address(
                new ERC1967Proxy(
                    address(registryImplementation),
                    abi.encodeWithSelector(GreenWillRegistry.initialize.selector, address(this))
                )
            )
        );

        GreenWillSupportRouter routerImplementation = new GreenWillSupportRouter();
        router = GreenWillSupportRouter(
            address(
                new ERC1967Proxy(
                    address(routerImplementation),
                    abi.encodeWithSelector(
                        GreenWillSupportRouter.initialize.selector,
                        address(this),
                        address(registry),
                        address(vaultResolver),
                        FIRST_SUPPORT_BADGE
                    )
                )
            )
        );

        registry.configureBadgeClass(
            FIRST_SUPPORT_BADGE,
            "first-support",
            "ipfs://first-support",
            address(0),
            address(router),
            address(0),
            false,
            true
        );
    }

    function test_fundVault_depositsAndIssuesFirstSupportOnce() public {
        vm.startPrank(ALICE);
        asset.approve(address(router), type(uint256).max);

        uint256 firstShares = router.fundVault(GARDEN, address(asset), 10 ether);
        GreenWillRegistry.BadgeRecord memory firstRecord = registry.getBadgeRecord(FIRST_SUPPORT_BADGE, ALICE);

        vm.warp(block.timestamp + 1 days);
        uint256 secondShares = router.fundVault(GARDEN, address(asset), 5 ether);
        GreenWillRegistry.BadgeRecord memory secondRecord = registry.getBadgeRecord(FIRST_SUPPORT_BADGE, ALICE);
        vm.stopPrank();

        assertEq(firstShares, 10 ether, "first deposit should mint shares 1:1");
        assertEq(secondShares, 5 ether, "second deposit should mint shares 1:1");
        assertEq(vault.balanceOf(ALICE), 15 ether, "vault shares should accumulate");
        assertTrue(registry.hasBadge(FIRST_SUPPORT_BADGE, ALICE), "support badge should be issued");
        assertEq(secondRecord.issuedAt, firstRecord.issuedAt, "badge should only be issued once");
    }

    function test_fundVault_revertsWhenVaultIsMissing() public {
        vm.startPrank(ALICE);
        asset.approve(address(router), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(GreenWillSupportRouter.VaultNotFound.selector, address(0xBAD), address(asset))
        );
        router.fundVault(address(0xBAD), address(asset), 1 ether);
        vm.stopPrank();
    }

    function test_fundVault_succeedsWhenBadgeClassIsInactive() public {
        // Deactivate the badge class so issuance will revert
        registry.configureBadgeClass(
            FIRST_SUPPORT_BADGE,
            "first-support",
            "ipfs://first-support",
            address(0),
            address(router),
            address(0),
            false,
            false // active = false
        );

        vm.startPrank(ALICE);
        asset.approve(address(router), type(uint256).max);

        uint256 shares = router.fundVault(GARDEN, address(asset), 10 ether);
        vm.stopPrank();

        assertEq(shares, 10 ether, "deposit should succeed despite badge failure");
        assertEq(vault.balanceOf(ALICE), 10 ether, "vault shares should be minted");
        assertFalse(registry.hasBadge(FIRST_SUPPORT_BADGE, ALICE), "badge should not be issued when class is inactive");
    }

    function test_directVaultDeposit_doesNotIssueSupportBadge() public {
        vm.prank(ALICE);
        vault.deposit(10 ether, ALICE);

        assertFalse(registry.hasBadge(FIRST_SUPPORT_BADGE, ALICE), "direct deposits must remain ineligible in v1");
    }

    function test_upgradeToV2_preservesRoutingConfigurationAndIssuedSupportState() public {
        vm.startPrank(ALICE);
        asset.approve(address(router), type(uint256).max);
        uint256 shares = router.fundVault(GARDEN, address(asset), 10 ether);
        vm.stopPrank();

        GreenWillRegistry.BadgeRecord memory originalRecord = registry.getBadgeRecord(FIRST_SUPPORT_BADGE, ALICE);
        address originalOwner = router.owner();
        address originalRegistry = address(router.registry());
        address originalOctantModule = router.octantModule();
        bytes32 originalSupportBadgeId = router.supportBadgeId();

        GreenWillSupportRouterV2 routerV2Implementation = new GreenWillSupportRouterV2();
        router.upgradeTo(address(routerV2Implementation));

        GreenWillSupportRouterV2 upgraded = GreenWillSupportRouterV2(address(router));

        assertEq(shares, 10 ether, "setup should mint vault shares");
        assertEq(upgraded.owner(), originalOwner, "owner should survive upgrade");
        assertEq(address(upgraded.registry()), originalRegistry, "registry should survive upgrade");
        assertEq(upgraded.octantModule(), originalOctantModule, "octant module should survive upgrade");
        assertEq(upgraded.supportBadgeId(), originalSupportBadgeId, "support badge id should survive upgrade");
        assertEq(vault.balanceOf(ALICE), 10 ether, "external vault share state should remain intact");
        assertTrue(registry.hasBadge(FIRST_SUPPORT_BADGE, ALICE), "support badge should remain issued");

        GreenWillRegistry.BadgeRecord memory upgradedRecord = registry.getBadgeRecord(FIRST_SUPPORT_BADGE, ALICE);
        assertEq(upgradedRecord.issued, originalRecord.issued, "issued flag should survive");
        assertEq(upgradedRecord.issuedAt, originalRecord.issuedAt, "issuedAt should survive");
        assertEq(upgradedRecord.sourceRef, originalRecord.sourceRef, "sourceRef should survive");
        assertEq(upgradedRecord.issuer, originalRecord.issuer, "issuer should survive");

        upgraded.setV2RoutingNonce(11);
        assertEq(upgraded.v2RoutingNonce(), 11, "v2 storage slot should be writable");
    }
}

contract GreenWillSupportRouterV2 is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    IGreenWillRegistry public registry;
    address public octantModule;
    bytes32 public supportBadgeId;

    uint256 public v2RoutingNonce;

    uint256[46] private __gap;

    function setV2RoutingNonce(uint256 nonce) external onlyOwner {
        v2RoutingNonce = nonce;
    }

    function _authorizeUpgrade(address) internal override onlyOwner { }
}
