// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { GreenWillUnlockModule } from "../../src/modules/GreenWillUnlockModule.sol";
import { IUnlockFactory } from "../../src/interfaces/IUnlock.sol";
import { MockUnlockFactory, MockPublicLock } from "../../src/mocks/Unlock.sol";
import { UnauthorizedCaller } from "../../src/errors/CommonErrors.sol";

contract GreenWillUnlockModuleTest is Test {
    GreenWillUnlockModule internal module;
    MockUnlockFactory internal unlockFactory;

    address internal constant REGISTRY = address(0xBEEF);
    address internal constant RECIPIENT = address(0xA11CE);

    function setUp() public {
        unlockFactory = new MockUnlockFactory();

        GreenWillUnlockModule implementation = new GreenWillUnlockModule();
        bytes memory initData = abi.encodeWithSelector(
            GreenWillUnlockModule.initialize.selector, address(this), REGISTRY, address(unlockFactory), 0
        );
        module = GreenWillUnlockModule(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function test_createLock_usesUnlockFactory() public {
        address lock = module.createLock(hex"1234");

        assertTrue(lock != address(0), "lock should be created");
        assertEq(unlockFactory.lockCount(), 1, "factory should be called once");
    }

    function test_mintBadge_grantsPermanentKey() public {
        MockPublicLock lock = new MockPublicLock();

        vm.prank(REGISTRY);
        uint256 tokenId = module.mintBadge(address(lock), RECIPIENT);

        assertEq(tokenId, 1, "first token id should be returned");
        assertTrue(lock.getHasValidKey(RECIPIENT), "recipient should receive a valid key");
    }

    function test_mintBadge_revertsForUnauthorizedCaller() public {
        MockPublicLock lock = new MockPublicLock();

        vm.expectRevert(abi.encodeWithSelector(UnauthorizedCaller.selector, address(this)));
        module.mintBadge(address(lock), RECIPIENT);
    }

    function test_upgradeToV2_preservesRegistryFactoryDurationAndMintedKey() public {
        MockPublicLock lock = new MockPublicLock();
        address replacementRegistry = address(0xCAFE);
        uint256 replacementDuration = 30 days;

        module.setRegistry(replacementRegistry);
        module.setDefaultDuration(replacementDuration);

        vm.warp(1_700_000_000);
        vm.prank(replacementRegistry);
        uint256 originalTokenId = module.mintBadge(address(lock), RECIPIENT);

        address originalOwner = module.owner();
        address originalFactory = address(module.unlockFactory());
        uint256 originalExpiration = lock.keyExpirationTimestampFor(RECIPIENT);

        GreenWillUnlockModuleV2 moduleV2Implementation = new GreenWillUnlockModuleV2();
        module.upgradeTo(address(moduleV2Implementation));

        GreenWillUnlockModuleV2 upgraded = GreenWillUnlockModuleV2(address(module));

        assertEq(upgraded.owner(), originalOwner, "owner should survive upgrade");
        assertEq(upgraded.registry(), replacementRegistry, "registry should survive upgrade");
        assertEq(address(upgraded.unlockFactory()), originalFactory, "factory should survive upgrade");
        assertEq(upgraded.defaultDuration(), replacementDuration, "duration should survive upgrade");
        assertEq(originalTokenId, 1, "setup should mint first key");
        assertEq(lock.keyExpirationTimestampFor(RECIPIENT), originalExpiration, "external lock state should remain intact");
        assertTrue(lock.getHasValidKey(RECIPIENT), "recipient should keep valid key after module upgrade");

        upgraded.setV2MintPolicy(7);
        assertEq(upgraded.v2MintPolicy(), 7, "v2 storage slot should be writable");
    }
}

contract GreenWillUnlockModuleV2 is OwnableUpgradeable, UUPSUpgradeable {
    address public registry;
    IUnlockFactory public unlockFactory;
    uint256 public defaultDuration;

    uint256 public v2MintPolicy;

    uint256[46] private __gap;

    function setV2MintPolicy(uint256 policy) external onlyOwner {
        v2MintPolicy = policy;
    }

    function _authorizeUpgrade(address) internal override onlyOwner { }
}
