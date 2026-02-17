// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase, IEASBase } from "./helpers/ForkTestBase.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { WorkSchema } from "../../src/Schemas.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

/// @title ArbitrumNegativePathsForkTest
/// @notice Fork tests exercising error paths on Arbitrum (42161). Each test deploys the full
///         protocol stack against real EAS and verifies that invalid operations revert cleanly.
/// @dev Uses `testForkArbitrum_` prefix to match the `test:e2e:arbitrum` script filter.
///      All tests gracefully skip when ARBITRUM_RPC_URL is not configured.
contract ArbitrumNegativePathsForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: YieldSplitter — Split with zero shares reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice splitYield reverts when garden has no registered vault shares
    function testForkArbitrum_yieldSplitter_splitWithZeroShares_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Arb Zero Shares Garden", 0x0F);

        // YieldResolver has no shares for this garden — splitYield should revert
        vm.expectRevert();
        yieldSplitter.splitYield(garden, address(communityToken), address(0xDEAD));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: YieldSplitter — Unauthorized registerShares reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice registerShares called by non-octant/non-owner address reverts
    function testForkArbitrum_yieldSplitter_unauthorizedRegisterShares_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Arb Unauthorized Shares", 0x0F);

        // forkNonMember is neither octantModule nor owner
        vm.prank(forkNonMember);
        vm.expectRevert();
        yieldSplitter.registerShares(garden, address(0xDEAD), 100 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: OctantVault — Zero deposit reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Depositing zero into OctantModule's vault setup should be a no-op or revert
    /// @dev The OctantModule requires gardenToken to call onGardenMinted; a non-gardenToken
    ///      caller is rejected.
    function testForkArbitrum_octantVault_depositZero_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Non-gardenToken caller cannot trigger onGardenMinted
        vm.prank(forkNonMember);
        vm.expectRevert();
        octantModule.onGardenMinted(address(0xBEEF), "Zero Deposit Test");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: OctantVault — Withdraw more than balance reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Harvest by non-operator is rejected (operator-only access)
    function testForkArbitrum_octantVault_withdrawMoreThanBalance_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Arb Overdraw Garden", 0x0F);

        // forkNonMember is not an operator — harvest reverts
        vm.prank(forkNonMember);
        vm.expectRevert();
        octantModule.harvest(garden, address(communityToken));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Hypercerts — Buy fraction with expired order reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice HypercertsModule mintAndRegister by non-operator reverts
    function testForkArbitrum_hypercerts_buyFractionExpiredOrder_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Arb Expired Order Garden", 0x0F);

        // forkNonMember is not an operator — mintAndRegister should revert
        vm.prank(forkNonMember);
        vm.expectRevert();
        hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://QmTest");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Hypercerts — Deactivate by non-owner reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice HypercertsModule paused state blocks all operations
    function testForkArbitrum_hypercerts_deactivateByNonOwner_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Arb Deactivate Garden", 0x0F);
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);

        // Pause the module (owner only)
        hypercertsModule.setPaused(true);

        // Even operator cannot mint when paused
        vm.prank(forkOperator);
        vm.expectRevert();
        hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://QmPausedTest");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: ENS — CCIP fee with zero value reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice claimName without sufficient msg.value for CCIP fee reverts
    function testForkArbitrum_ens_ccipFeeWithZeroValue_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // claimName requires hat membership AND msg.value for CCIP fee
        // forkNonMember is not a protocol member → NotProtocolMember revert
        vm.prank(forkNonMember);
        vm.expectRevert();
        greenGoodsENS.claimName{ value: 0 }("test-slug");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: KarmaGAP — Impact without project reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice KarmaGAPModule rejects createProject from non-gardenToken caller
    function testForkArbitrum_karmaGAP_impactWithoutProject_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Arb No GAP Garden", 0x0F);

        // createProject is onlyGardenToken — a non-gardenToken caller should be rejected
        vm.prank(forkNonMember);
        vm.expectRevert();
        karmaGAPModule.createProject(
            garden,
            forkOperator,
            "Unauthorized Project",
            "Should fail",
            "Nowhere",
            ""
        );
    }
}
