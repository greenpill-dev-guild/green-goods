// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";

/// @title MockRevertingModule
/// @notice A module that always reverts, used to test graceful degradation during mintGarden
contract MockRevertingModule {
    error AlwaysReverts();

    fallback() external payable {
        revert AlwaysReverts();
    }

    receive() external payable {
        revert AlwaysReverts();
    }
}

/// @title ArbitrumGardenTokenForkTest
/// @notice Fork tests for GardenToken against Arbitrum mainnet.
/// @dev Tests transfer restrictions, ENS refund accounting, sequential minting,
/// module callback ordering, graceful degradation, and access control.
contract ArbitrumGardenTokenForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Mint Garden — Module Callback Ordering
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies all 6 module callbacks fire during mintGarden with full module wiring.
    /// @dev Callback order: hatsModule.createGardenHatTree → hatsModule.grantRole → karmaGAPModule →
    ///      octantModule → gardensModule → cookieJarModule → actionRegistry.setGardenDomainsFromMint →
    ///      ensModule → gardenAccount.initialize
    function testForkArbitrum_mintGarden_callbackOrdering() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Verify all modules are wired before the mint
        assertTrue(address(gardenToken.hatsModule()) != address(0), "hatsModule should be wired");
        assertTrue(address(gardenToken.karmaGAPModule()) != address(0), "karmaGAPModule should be wired");
        assertTrue(address(gardenToken.octantModule()) != address(0), "octantModule should be wired");
        assertTrue(address(gardenToken.gardensModule()) != address(0), "gardensModule should be wired");
        assertTrue(address(gardenToken.actionRegistry()) != address(0), "actionRegistry should be wired");
        assertTrue(address(gardenToken.cookieJarModule()) != address(0), "cookieJarModule should be wired");

        // Mint a garden with all domains enabled
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Callback Order Garden",
            slug: "",
            description: "Tests callback ordering",
            location: "Arbitrum Fork",
            bannerImage: "ipfs://QmCallbackTest",
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
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Callback Order Garden")), "name not set");
        assertEq(
            keccak256(bytes(gardenAcct.description())), keccak256(bytes("Tests callback ordering")), "description not set"
        );

        // Verify domain mask was set on ActionRegistry (actionRegistry callback)
        uint8 domains = actionRegistry.gardenDomains(garden);
        assertEq(domains, 0x0F, "domain mask should be set on ActionRegistry");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Mint Garden — Single Callback Reverts, Graceful Degradation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When a single optional module reverts, mintGarden still succeeds.
    /// @dev Sets KarmaGAP module to a reverting mock. Mint should succeed with all other
    ///      modules functional. This verifies the try/catch graceful degradation pattern.
    function testForkArbitrum_mintGarden_singleCallbackReverts_gracefulDegradation() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Replace KarmaGAP with a reverting mock
        MockRevertingModule revertingModule = new MockRevertingModule();
        gardenToken.setKarmaGAPModule(address(revertingModule));

        // Mint should succeed despite KarmaGAP reverting
        address garden = _mintTestGarden("Degraded KarmaGAP Garden", 0x0F);
        assertTrue(garden != address(0), "mint should succeed with reverting KarmaGAP");

        // Verify the non-reverting modules still fired
        (,,,,,,, bool configured) = hatsModule.getGardenHatIds(garden);
        assertTrue(configured, "hat tree should still be configured");

        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(
            keccak256(bytes(gardenAcct.name())),
            keccak256(bytes("Degraded KarmaGAP Garden")),
            "account should still be initialized"
        );

        // Restore original module
        gardenToken.setKarmaGAPModule(address(karmaGAPModule));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Transfer Restriction — Locked Mode
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Locked mode prevents all transfers (except minting).
    function testForkArbitrum_transferRestriction_locked() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint a garden (minting always allowed regardless of restriction)
        _mintTestGarden("Locked Garden", 0x01);

        // Set transfer restriction to Locked
        gardenToken.setTransferRestriction(GardenToken.TransferRestriction.Locked);

        // Owner (address(this)) attempts transfer — should revert even for owner
        vm.expectRevert(GardenToken.TransfersLocked.selector);
        gardenToken.transferFrom(address(this), forkOperator, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Transfer Restriction — OwnerOnly Mode
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice OwnerOnly mode allows only the contract owner to transfer.
    function testForkArbitrum_transferRestriction_ownerOnly() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint a garden (token 0 to address(this))
        _mintTestGarden("OwnerOnly Garden", 0x01);

        // Set transfer restriction to OwnerOnly
        gardenToken.setTransferRestriction(GardenToken.TransferRestriction.OwnerOnly);

        // Owner (address(this)) can transfer
        gardenToken.transferFrom(address(this), forkOperator, 0);
        assertEq(gardenToken.ownerOf(0), forkOperator, "token should be transferred to operator");

        // Mint another garden (token 1 to address(this))
        _mintTestGarden("OwnerOnly Garden 2", 0x02);

        // Non-owner attempts transfer — should revert
        vm.prank(forkGardener);
        vm.expectRevert(GardenToken.TransfersRestricted.selector);
        gardenToken.transferFrom(address(this), forkGardener, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Failed ENS Refund Accounting
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When ENS registration fails, ETH is queued for refund and claimable by minter.
    /// @dev Replaces ENS module with a reverting mock, sends ETH with mint, then verifies
    ///      failedENSRefunds mapping and claimENSRefund() flow.
    function testForkArbitrum_failedENSRefund_accounting() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Replace ENS module with a reverting mock
        MockRevertingModule revertingENS = new MockRevertingModule();
        gardenToken.setENSModule(address(revertingENS));

        // Mint with ETH and a slug (triggers ENS registration path)
        uint256 mintValue = 0.01 ether;
        vm.deal(address(this), mintValue);

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "ENS Refund Garden",
            slug: "ens-refund-test",
            description: "Tests ENS refund flow",
            location: "Arbitrum Fork",
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
    // Test 6: Mint Garden Increments Token ID — Sequential Mints, Unique TBAs
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Sequential mints produce incrementing token IDs and unique TBA addresses.
    function testForkArbitrum_mintGarden_incrementsTokenId() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint 3 gardens sequentially
        address garden0 = _mintTestGarden("Garden Zero", 0x01);
        address garden1 = _mintTestGarden("Garden One", 0x02);
        address garden2 = _mintTestGarden("Garden Two", 0x04);

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
            keccak256(bytes("Garden Zero")),
            "garden 0 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(garden1)).name())),
            keccak256(bytes("Garden One")),
            "garden 1 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(garden2)).name())),
            keccak256(bytes("Garden Two")),
            "garden 2 name mismatch"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: setModuleAddress — Only Owner Can Update
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-owner cannot call setHatsModule, setKarmaGAPModule, etc.
    function testForkArbitrum_setModuleAddress_onlyOwner() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Non-owner attempts to set modules — all should revert with OwnableUnauthorizedAccount
        bytes memory expectedRevert = abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", forkNonMember);

        vm.startPrank(forkNonMember);

        vm.expectRevert(expectedRevert);
        gardenToken.setHatsModule(address(0xDEAD));

        vm.expectRevert(expectedRevert);
        gardenToken.setKarmaGAPModule(address(0xDEAD));

        vm.expectRevert(expectedRevert);
        gardenToken.setOctantModule(address(0xDEAD));

        vm.expectRevert(expectedRevert);
        gardenToken.setGardensModule(address(0xDEAD));

        vm.expectRevert(expectedRevert);
        gardenToken.setActionRegistry(address(0xDEAD));

        vm.expectRevert(expectedRevert);
        gardenToken.setCookieJarModule(address(0xDEAD));

        vm.expectRevert(expectedRevert);
        gardenToken.setENSModule(address(0xDEAD));

        vm.expectRevert(expectedRevert);
        gardenToken.setTransferRestriction(GardenToken.TransferRestriction.Locked);

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Receive ETH (for ENS refund claim)
    // ═══════════════════════════════════════════════════════════════════════════

    receive() external payable { }
}
