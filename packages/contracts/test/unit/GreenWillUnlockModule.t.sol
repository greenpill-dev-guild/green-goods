// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GreenWillUnlockModule } from "../../src/modules/GreenWillUnlockModule.sol";
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
}
