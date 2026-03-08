// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";

/// @title MockRevertingModuleSepolia
/// @notice A module that always reverts, used to test graceful degradation during mintGarden
contract MockRevertingModuleSepolia {
    error AlwaysReverts();

    fallback() external payable {
        revert AlwaysReverts();
    }

    receive() external payable {
        revert AlwaysReverts();
    }
}

/// @title SepoliaGardenTokenForkTest
/// @notice Fork tests for GardenToken against Sepolia testnet.
/// @dev Subset of Arbitrum tests (4 of 7). Skips transfer restriction tests (chain-independent logic).
///      Verifies the same production deployment path works against Sepolia EAS and Hats Protocol.
contract SepoliaGardenTokenForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Mint Garden — Module Callback Ordering
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies module callbacks fire during mintGarden on Sepolia fork.
    function test_fork_mintGarden_callbackOrdering() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Verify modules are wired
        assertTrue(address(gardenToken.hatsModule()) != address(0), "hatsModule should be wired");
        assertTrue(address(gardenToken.actionRegistry()) != address(0), "actionRegistry should be wired");

        // Mint a garden with all domains enabled
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Sepolia Callback Garden",
            slug: "",
            description: "Tests callback ordering on Sepolia",
            location: "Sepolia Fork",
            bannerImage: "ipfs://QmSepoliaCallback",
            metadata: "ipfs://QmMeta",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x0F,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden(config);
        assertTrue(garden != address(0), "garden TBA should be created");

        // Verify HatsModule callback: hat tree was created + owner role granted
        (,,,,,,, bool configured) = hatsModule.getGardenHatIds(garden);
        assertTrue(configured, "hat tree should be configured (hatsModule callback fired)");
        assertTrue(hatsModule.isOwnerOf(garden, address(this)), "minter should have owner role");

        // Verify GardenAccount was initialized (last callback in the chain)
        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Sepolia Callback Garden")), "name not set");

        // Verify domain mask was set on ActionRegistry
        uint8 domains = actionRegistry.gardenDomains(garden);
        assertEq(domains, 0x0F, "domain mask should be set on ActionRegistry");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Mint Garden — Single Callback Reverts, Graceful Degradation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When KarmaGAP module reverts, mintGarden still succeeds on Sepolia.
    function test_fork_mintGarden_singleCallbackReverts_gracefulDegradation() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Replace KarmaGAP with a reverting mock
        MockRevertingModuleSepolia revertingModule = new MockRevertingModuleSepolia();
        gardenToken.setKarmaGAPModule(address(revertingModule));

        // Mint should succeed despite KarmaGAP reverting
        address garden = _mintTestGarden("Sepolia Degraded Garden", 0x0F);
        assertTrue(garden != address(0), "mint should succeed with reverting KarmaGAP");

        // Verify the non-reverting modules still fired
        (,,,,,,, bool configured) = hatsModule.getGardenHatIds(garden);
        assertTrue(configured, "hat tree should still be configured");

        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(
            keccak256(bytes(gardenAcct.name())),
            keccak256(bytes("Sepolia Degraded Garden")),
            "account should still be initialized"
        );

        // Restore original module
        gardenToken.setKarmaGAPModule(address(karmaGAPModule));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Mint Garden Increments Token ID — Sequential Mints, Unique TBAs
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Sequential mints on Sepolia produce incrementing token IDs and unique TBAs.
    function test_fork_mintGarden_incrementsTokenId() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint 3 gardens sequentially
        address garden0 = _mintTestGarden("Sepolia Garden Zero", 0x01);
        address garden1 = _mintTestGarden("Sepolia Garden One", 0x02);
        address garden2 = _mintTestGarden("Sepolia Garden Two", 0x04);

        // Verify unique TBA addresses
        assertTrue(garden0 != garden1, "gardens 0 and 1 should have different TBAs");
        assertTrue(garden1 != garden2, "gardens 1 and 2 should have different TBAs");
        assertTrue(garden0 != garden2, "gardens 0 and 2 should have different TBAs");

        // Verify sequential ownership (token IDs 0, 1, 2)
        assertEq(gardenToken.ownerOf(0), address(this), "token 0 should belong to minter");
        assertEq(gardenToken.ownerOf(1), address(this), "token 1 should belong to minter");
        assertEq(gardenToken.ownerOf(2), address(this), "token 2 should belong to minter");

        // Verify each garden has distinct metadata
        assertEq(
            keccak256(bytes(GardenAccount(payable(garden0)).name())),
            keccak256(bytes("Sepolia Garden Zero")),
            "garden 0 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(garden1)).name())),
            keccak256(bytes("Sepolia Garden One")),
            "garden 1 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(garden2)).name())),
            keccak256(bytes("Sepolia Garden Two")),
            "garden 2 name mismatch"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Failed ENS Refund Accounting
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When ENS registration fails on Sepolia, ETH is queued for refund and claimable.
    function test_fork_failedENSRefund_accounting() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Replace ENS module with a reverting mock
        MockRevertingModuleSepolia revertingENS = new MockRevertingModuleSepolia();
        gardenToken.setENSModule(address(revertingENS));

        // Mint with ETH and a slug (triggers ENS registration path)
        uint256 mintValue = 0.01 ether;
        vm.deal(address(this), mintValue);

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Sepolia ENS Refund Garden",
            slug: "sepolia-refund-test",
            description: "Tests ENS refund flow on Sepolia",
            location: "Sepolia Fork",
            bannerImage: "",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden{ value: mintValue }(config);
        assertTrue(garden != address(0), "mint should succeed despite ENS failure");

        // Verify refund was queued
        uint256 refundAmount = gardenToken.failedENSRefunds(address(this));
        assertEq(refundAmount, mintValue, "refund should equal sent ETH");
        assertEq(gardenToken.totalPendingENSRefunds(), mintValue, "total pending should match");

        // Claim the refund
        uint256 balanceBefore = address(this).balance;
        gardenToken.claimENSRefund();
        uint256 balanceAfter = address(this).balance;

        assertEq(balanceAfter - balanceBefore, mintValue, "should receive refund");
        assertEq(gardenToken.failedENSRefunds(address(this)), 0, "refund should be cleared");
        assertEq(gardenToken.totalPendingENSRefunds(), 0, "total pending should be zero");

        // Double-claim should revert
        vm.expectRevert(GardenToken.NoENSRefundAvailable.selector);
        gardenToken.claimENSRefund();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Receive ETH (for ENS refund claim)
    // ═══════════════════════════════════════════════════════════════════════════

    receive() external payable { }
}
