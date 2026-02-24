// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardensModule } from "../../src/modules/Gardens.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { GardensV2Addresses } from "./helpers/GardensV2Addresses.sol";

/// @title ArbitrumGardensNegativePathsForkTest
/// @notice Fork tests for GardensModule negative/error paths against Arbitrum mainnet.
/// @dev Extends ForkTestBase — uses real HatsModule, real GardenToken, real RegistryFactory.
///      Tests error paths for:
///      1. RegistryFactory rejecting invalid params (graceful degradation via try/catch)
///      2. Pool creation access control (non-operator revert via real HatsModule)
///      3. Uninitialized garden revert on pool creation
///      Gracefully skips when ARBITRUM_RPC_URL is not set.
contract ArbitrumGardensNegativePathsForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: RegistryFactory Rejects Invalid Params
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When onGardenMinted is called with a non-contract GOODS token, the real
    ///         RegistryFactory rejects the createRegistry call. GardensModule's try/catch
    ///         handles it gracefully — garden still initializes with partial state.
    function testForkArbitrum_gardens_registryFactoryRejectsInvalidParams() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        // Verify real RegistryFactory is deployed on this chain
        address realFactory = GardensV2Addresses.getRegistryFactory(block.chainid);
        if (realFactory == address(0) || realFactory.code.length == 0) {
            emit log("SKIPPED: RegistryFactory not deployed on this fork chain");
            return;
        }

        _deployFullStackOnFork();

        // Configure GardensModule with real RegistryFactory
        _configureRealGardensV2();

        // Override GOODS token to a non-contract address — this will cause the real
        // RegistryFactory to reject the createRegistry call
        gardensModule.setGoodsToken(address(communityToken)); // valid ERC20 but not what factory expects

        // Mint garden — triggers GardenToken.mintGarden() -> GardensModule.onGardenMinted()
        // The RegistryFactory rejection should be caught gracefully (try/catch in _createCommunity)
        address garden = _mintTestGarden("Negative Test Garden", 0x0F);
        assertTrue(garden != address(0), "garden should be minted despite factory failure");

        // Garden should be initialized (GardensModule marks it before calling factory)
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized despite factory rejection");

        // Weight scheme should still be stored
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "weight scheme should be stored despite factory failure"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Pool Creation Access Control - Non-Operator Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice createGardenPools requires operator role. A non-member calling it should revert.
    ///         Uses real HatsModule role checks instead of a mock that always returns false.
    function testForkArbitrum_gardens_poolCreation_nonOperatorReverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployFullStackOnFork();

        // Mint a garden (forkNonMember has no roles)
        address garden = _mintTestGarden("Access Control Garden", 0x0F);

        // attemptPoolCreation called by external address should revert with OnlySelfCall
        vm.expectRevert(GardensModule.OnlySelfCall.selector);
        gardensModule.attemptPoolCreation(garden, address(0xDEAD), address(0));

        // forkNonMember is NOT an operator — real HatsModule should deny access
        vm.prank(forkNonMember);
        vm.expectRevert(GardensModule.NotGardenOperator.selector);
        gardensModule.createGardenPools(garden);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Uninitialized Garden Reverts on Pool Creation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice createGardenPools on an uninitialized garden address should revert.
    ///         Even an operator cannot create pools for a non-existent garden.
    function testForkArbitrum_gardens_uninitializedGarden_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployFullStackOnFork();

        // Mint a garden and grant operator role to forkOperator
        address garden = _mintTestGarden("Real Garden", 0x0F);
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);

        // Use a different, non-existent garden address
        address fakeGarden = makeAddr("fakeGarden");

        // forkOperator has the role for `garden`, but `fakeGarden` is not initialized
        vm.prank(forkOperator);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenNotInitialized.selector, fakeGarden));
        gardensModule.createGardenPools(fakeGarden);
    }
}
