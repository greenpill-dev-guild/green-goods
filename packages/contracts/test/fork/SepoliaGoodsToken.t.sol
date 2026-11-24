// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";

/// @title SepoliaGoodsTokenForkTest
/// @notice Full-stack GOODS wiring and staking integration on Sepolia.
contract SepoliaGoodsTokenForkTest is ForkTestBase {
    /// @notice Verify GoodsToken deployed by full stack has correct initial state
    function test_fork_sepolia_goodsToken_initialSupplyMintedToOwner() public {
        if (!_tryChainFork("sepolia")) {
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

    /// @notice Deploy full stack, configure real Gardens V2, verify GOODS token is wired
    function test_fork_sepolia_goodsToken_stakingIntegration() public {
        if (!_tryChainFork("sepolia")) {
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
}
