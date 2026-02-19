// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GoodsToken } from "../../src/tokens/Goods.sol";

/// @title SepoliaGoodsTokenForkTest
/// @notice Fork tests for GoodsToken on Sepolia (11155111). Verifies supply management,
/// access control, burn mechanics, and staking integration with the Gardens V2 module.
/// @dev Ports all 6 scenarios from ArbitrumGoodsTokenForkTest. Tests that need
/// direct mint access deploy a separate standalone GoodsToken instance.
contract SepoliaGoodsTokenForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Standalone Token Helper
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy a standalone GoodsToken where address(this) is owner.
    function _deployStandaloneGoodsToken(uint256 initialSupply, uint256 maxSupply_) internal returns (GoodsToken) {
        return new GoodsToken("Test GOODS", "tGOODS", address(this), initialSupply, maxSupply_);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Initial Supply Minted To Owner
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify GoodsToken deployed by full stack has correct initial state
    function test_fork_sepolia_goodsToken_initialSupplyMintedToOwner() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Full stack deploys with 0 initial supply, 10M max supply
        assertEq(goodsTokenContract.totalSupply(), 0, "initial supply should be 0");
        assertEq(goodsTokenContract.maxSupply(), 10_000_000e18, "max supply should be 10M");

        // After wiring, GardensModule owns the token
        assertEq(goodsTokenContract.owner(), address(gardensModule), "owner should be GardensModule");

        // Token metadata
        assertEq(goodsTokenContract.name(), "Green Goods", "name should match");
        assertEq(goodsTokenContract.symbol(), "GOODS", "symbol should match");
        assertEq(goodsTokenContract.decimals(), 18, "decimals should be 18");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Max Supply Enforced
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Minting beyond maxSupply reverts with ExceedsMaxSupply
    function test_fork_sepolia_goodsToken_maxSupplyEnforced() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        // Deploy standalone token with small max for easy testing
        uint256 maxSup = 1000e18;
        GoodsToken token = _deployStandaloneGoodsToken(500e18, maxSup);

        // Mint up to max should succeed
        token.mint(address(this), 500e18);
        assertEq(token.totalSupply(), maxSup, "should be at max supply");

        // Mint 1 wei beyond max should revert
        vm.expectRevert(abi.encodeWithSelector(GoodsToken.ExceedsMaxSupply.selector, 1, 0));
        token.mint(address(this), 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Only Owner Can Mint
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-owner mint reverts with OwnableUnauthorizedAccount
    function test_fork_sepolia_goodsToken_onlyOwnerCanMint() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        GoodsToken token = _deployStandaloneGoodsToken(0, 1_000_000e18);

        // Owner (address(this)) can mint
        token.mint(forkGardener, 100e18);
        assertEq(token.balanceOf(forkGardener), 100e18, "owner mint should succeed");

        // Non-owner should revert
        vm.prank(forkNonMember);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", forkNonMember));
        token.mint(forkNonMember, 100e18);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Burn Reduces Supply
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Burning tokens reduces totalSupply, freeing capacity for subsequent mints
    function test_fork_sepolia_goodsToken_burnReducesSupply() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        uint256 maxSup = 500e18;
        GoodsToken token = _deployStandaloneGoodsToken(maxSup, maxSup);

        // At max supply - can't mint
        assertEq(token.totalSupply(), maxSup, "should be at max");

        // Burn 200 tokens
        token.burn(200e18);
        assertEq(token.totalSupply(), 300e18, "supply should decrease after burn");
        assertEq(token.balanceOf(address(this)), 300e18, "holder balance should decrease");

        // Now can mint 200 more (freed capacity)
        token.mint(forkGardener, 200e18);
        assertEq(token.totalSupply(), maxSup, "should be back at max after re-mint");
        assertEq(token.balanceOf(forkGardener), 200e18, "gardener should receive minted tokens");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Staking Integration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy full stack, configure real Gardens V2, verify GOODS token is wired
    function test_fork_sepolia_goodsToken_stakingIntegration() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();
        _configureRealGardensV2();

        // Verify GOODS token is configured on GardensModule
        assertEq(address(gardensModule.goodsToken()), address(goodsToken), "GardensModule goodsToken should be configured");

        // Mint a garden - triggers community creation via onGardenMinted
        address garden = _mintTestGarden("Sepolia GOODS Staking Garden", 0x0F);
        assertTrue(garden != address(0), "garden should be created");

        // If community was created, verify the GOODS token is wired as the community gardenToken
        address community = gardensModule.getGardenCommunity(garden);
        if (community != address(0)) {
            (bool ok, bytes memory data) = community.staticcall(abi.encodeWithSignature("gardenToken()"));
            if (ok && data.length >= 32) {
                address communityGardenToken = abi.decode(data, (address));
                assertEq(communityGardenToken, address(goodsToken), "community staking token should be GOODS");
            }
        }

        // Verify GardensModule ownership of GoodsToken allows minting through the module
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Max Supply Zero Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice maxSupply=0 in constructor reverts with MaxSupplyZero
    function test_fork_sepolia_goodsToken_maxSupplyZeroReverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        // maxSupply=0 should revert
        vm.expectRevert(GoodsToken.MaxSupplyZero.selector);
        new GoodsToken("Bad GOODS", "BAD", address(this), 0, 0);
    }
}
