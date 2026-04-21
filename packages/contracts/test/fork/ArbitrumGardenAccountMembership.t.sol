// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount, InvalidInvite, AlreadyGardener, GardenFull } from "../../src/accounts/Garden.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";

/// @title ArbitrumGardenAccountMembershipForkTest
/// @notice Fork tests for GardenAccount membership behavior against Arbitrum mainnet.
contract ArbitrumGardenAccountMembershipForkTest is ForkTestBase {
    /// @notice After maxGardeners is reached, joinGarden reverts with GardenFull.
    function testForkArbitrum_gardenFull_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = gardenToken.mintGarden(_openGardenConfig("Capacity Test Garden", "Tests max capacity"));
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        gardenAcct.setMaxGardeners(1);
        assertEq(gardenAcct.maxGardeners(), 1, "max should be set to 1");

        vm.prank(forkGardener);
        gardenAcct.joinGarden();
        assertTrue(gardenAcct.isGardener(forkGardener), "first joiner should be gardener");

        address extraUser = makeAddr("extraUser");
        vm.prank(extraUser);
        vm.expectRevert(GardenFull.selector);
        gardenAcct.joinGarden();
    }

    /// @notice joinGarden() reverts with InvalidInvite when openJoining is false.
    function testForkArbitrum_invalidInvite_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Closed Garden", 0x01);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        assertFalse(gardenAcct.openJoining(), "garden should not allow open joining");

        vm.prank(forkNonMember);
        vm.expectRevert(InvalidInvite.selector);
        gardenAcct.joinGarden();
    }

    /// @notice joinGarden() reverts with AlreadyGardener when caller already has a role.
    function testForkArbitrum_alreadyGardener_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = gardenToken.mintGarden(_openGardenConfig("Double Join Garden", "Tests double join prevention"));
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        vm.prank(forkGardener);
        gardenAcct.joinGarden();
        assertTrue(gardenAcct.isGardener(forkGardener), "should be gardener after first join");

        vm.prank(forkGardener);
        vm.expectRevert(AlreadyGardener.selector);
        gardenAcct.joinGarden();
    }

    /// @notice isOperator/isGardener/isEvaluator on GardenAccount delegate to real HatsModule.
    function testForkArbitrum_roleCheck_delegatesToHatsModule() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Role Delegation Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        assertTrue(gardenAcct.isOwner(address(this)), "test contract should be owner");
        assertTrue(gardenAcct.isOperator(forkOperator), "forkOperator should be operator");
        assertTrue(gardenAcct.isGardener(forkOperator), "operator should implicitly be gardener");
        assertTrue(gardenAcct.isEvaluator(forkOperator), "operator should implicitly be evaluator");
        assertTrue(gardenAcct.isGardener(forkGardener), "forkGardener should be gardener");
        assertFalse(hatsModule.isOperatorOf(garden, forkGardener), "gardener should NOT be operator in HatsModule");
        assertTrue(gardenAcct.isEvaluator(forkEvaluator), "forkEvaluator should be evaluator");
        assertFalse(gardenAcct.isGardener(forkNonMember), "nonMember should NOT be gardener");
        assertFalse(gardenAcct.isOperator(forkNonMember), "nonMember should NOT be operator");
        assertFalse(gardenAcct.isEvaluator(forkNonMember), "nonMember should NOT be evaluator");
        assertFalse(gardenAcct.isOwner(forkNonMember), "nonMember should NOT be owner");
    }

    function _openGardenConfig(
        string memory name,
        string memory description
    )
        private
        pure
        returns (GardenToken.GardenConfig memory config)
    {
        config.name = name;
        config.description = description;
        config.location = "Arbitrum Fork";
        config.openJoining = true;
        config.weightScheme = IGardensModule.WeightScheme.Linear;
        config.domainMask = 0x01;
        config.gardeners = new address[](0);
        config.operators = new address[](0);
    }
}
