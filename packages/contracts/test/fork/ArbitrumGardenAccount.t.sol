// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ArbitrumGardenAccountCoreForkTest
/// @notice Fork tests for GardenAccount execution and token config against Arbitrum mainnet.
contract ArbitrumGardenAccountCoreForkTest is ForkTestBase {
    address private constant ARBITRUM_DAI_HOLDER = 0x489ee077994B6658eAfA855C308275EAd8097C4A;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Owner Can Execute External Contract Call
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Garden owner (NFT holder) can call execute() on the TBA to interact with external contracts.
    function testForkArbitrum_execute_ownerCanCallExternalContract() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Execute Test Garden", 0x0F);

        IERC20 token = communityToken;
        assertGe(token.balanceOf(ARBITRUM_DAI_HOLDER), 100e18, "live DAI holder should fund test transfer");
        vm.prank(ARBITRUM_DAI_HOLDER);
        assertTrue(token.transfer(garden, 100e18), "live DAI transfer to garden should succeed");

        // Owner (address(this)) calls execute() on the TBA to transfer tokens out
        bytes memory transferCall = abi.encodeWithSelector(IERC20.transfer.selector, forkOperator, 50e18);

        GardenAccount gardenAcct = GardenAccount(payable(garden));
        gardenAcct.execute(address(token), 0, transferCall, 0);

        assertEq(token.balanceOf(forkOperator), 50e18, "operator should receive 50 tokens");
        assertEq(token.balanceOf(garden), 50e18, "garden should have 50 tokens remaining");
    }
}
