// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase, IEASBase } from "./helpers/ForkTestBase.sol";
import {
    ActionRegistry,
    Capital,
    Domain,
    NotActionOwner,
    EndTimeBeforeStartTime,
    InvalidDomainMask
} from "../../src/registries/Action.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { WorkSchema } from "../../src/Schemas.sol";
import { NotActiveAction } from "../../src/resolvers/Work.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title ArbitrumActionRegistryForkTest
/// @notice Fork tests for ActionRegistry against real EAS and Hats Protocol on Arbitrum.
/// @dev Uses ForkTestBase for full protocol stack deployment. Gracefully skips when
///      ARBITRUM_RPC_URL is not configured. Tests CRUD lifecycle, domain validation,
///      capital types, authorization, disabled actions, multi-action registration,
///      and UUPS upgrade safety.
contract ArbitrumActionRegistryForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Full CRUD Lifecycle
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register → read → update fields → set past endTime (disable) → re-enable
    function testForkArbitrum_registerAction_fullLifecycle() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // 1. Register a new action
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        uint256 start = block.timestamp;
        uint256 end = block.timestamp + 30 days;

        actionRegistry.registerAction(
            start, end, "Plant Trees", "agro.plant_trees", "ipfs://QmInstructions", capitals, new string[](0), Domain.AGRO
        );

        // 2. Read back and verify stored data
        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.startTime, start, "startTime should match");
        assertEq(action.endTime, end, "endTime should match");
        assertEq(action.title, "Plant Trees", "title should match");
        assertEq(action.slug, "agro.plant_trees", "slug should match");
        assertEq(action.instructions, "ipfs://QmInstructions", "instructions should match");
        assertEq(action.capitals.length, 1, "should have 1 capital");
        assertEq(uint256(action.capitals[0]), uint256(Capital.SOCIAL), "capital should be SOCIAL");
        assertEq(uint256(action.domain), uint256(Domain.AGRO), "domain should be AGRO");

        // 3. Update title and instructions
        actionRegistry.updateActionTitle(0, "Plant Native Trees");
        actionRegistry.updateActionInstructions(0, "ipfs://QmUpdatedInstructions");

        ActionRegistry.Action memory updated = actionRegistry.getAction(0);
        assertEq(updated.title, "Plant Native Trees", "title should be updated");
        assertEq(updated.instructions, "ipfs://QmUpdatedInstructions", "instructions should be updated");

        // 4. "Disable" by setting endTime to past
        actionRegistry.updateActionEndTime(0, start + 1);

        ActionRegistry.Action memory disabled = actionRegistry.getAction(0);
        assertTrue(disabled.endTime < block.timestamp, "endTime should be in the past (disabled)");

        // 5. "Re-enable" by setting endTime to future
        actionRegistry.updateActionEndTime(0, block.timestamp + 60 days);

        ActionRegistry.Action memory reenabled = actionRegistry.getAction(0);
        assertTrue(reenabled.endTime > block.timestamp, "endTime should be in the future (re-enabled)");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Domain Mask Validation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice domain=0 is valid (no domains), mask > 0x0F reverts
    function testForkArbitrum_registerAction_domainMaskValidation() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Domain Mask Garden", 0x00);

        // Zero domain mask is valid (garden just has no domains)
        assertEq(actionRegistry.gardenDomains(garden), 0x00, "zero mask should be accepted");

        // Set max valid mask (0x0F = all 4 domains enabled)
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);

        vm.prank(forkOperator);
        actionRegistry.setGardenDomains(garden, 0x0F);
        assertEq(actionRegistry.gardenDomains(garden), 0x0F, "max valid mask should be accepted");

        // Verify individual domain checks
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.SOLAR), "SOLAR should be enabled");
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.AGRO), "AGRO should be enabled");
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.EDU), "EDU should be enabled");
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.WASTE), "WASTE should be enabled");

        // Invalid mask > 0x0F should revert
        vm.prank(forkOperator);
        vm.expectRevert(InvalidDomainMask.selector);
        actionRegistry.setGardenDomains(garden, 0x10);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Capital Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Each Capital variant is stored correctly when registered
    function testForkArbitrum_registerAction_capitalTypes() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Register action with all 8 capital types
        Capital[] memory allCapitals = new Capital[](8);
        allCapitals[0] = Capital.SOCIAL;
        allCapitals[1] = Capital.MATERIAL;
        allCapitals[2] = Capital.FINANCIAL;
        allCapitals[3] = Capital.LIVING;
        allCapitals[4] = Capital.INTELLECTUAL;
        allCapitals[5] = Capital.EXPERIENTIAL;
        allCapitals[6] = Capital.SPIRITUAL;
        allCapitals[7] = Capital.CULTURAL;

        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "All Capitals Action",
            "test.all_capitals",
            "ipfs://QmAllCapitals",
            allCapitals,
            new string[](0),
            Domain.EDU
        );

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.capitals.length, 8, "should store all 8 capitals");

        // Verify each capital type is stored in correct order
        assertEq(uint256(action.capitals[0]), uint256(Capital.SOCIAL), "index 0 should be SOCIAL");
        assertEq(uint256(action.capitals[1]), uint256(Capital.MATERIAL), "index 1 should be MATERIAL");
        assertEq(uint256(action.capitals[2]), uint256(Capital.FINANCIAL), "index 2 should be FINANCIAL");
        assertEq(uint256(action.capitals[3]), uint256(Capital.LIVING), "index 3 should be LIVING");
        assertEq(uint256(action.capitals[4]), uint256(Capital.INTELLECTUAL), "index 4 should be INTELLECTUAL");
        assertEq(uint256(action.capitals[5]), uint256(Capital.EXPERIENTIAL), "index 5 should be EXPERIENTIAL");
        assertEq(uint256(action.capitals[6]), uint256(Capital.SPIRITUAL), "index 6 should be SPIRITUAL");
        assertEq(uint256(action.capitals[7]), uint256(Capital.CULTURAL), "index 7 should be CULTURAL");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Unauthorized Registration Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-owner registerAction reverts with OwnableUnauthorizedAccount
    function testForkArbitrum_registerAction_unauthorizedReverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        // forkNonMember is not the owner
        vm.prank(forkNonMember);
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), forkNonMember)
        );
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Unauthorized Action",
            "test.unauthorized",
            "ipfs://QmUnauthorized",
            capitals,
            new string[](0),
            Domain.SOLAR
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Disabled Action Blocks Work Attestation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When an action's endTime is in the past, the WorkResolver rejects
    ///         work attestations against it via real EAS.
    function testForkArbitrum_disabledAction_blocksWorkAttestation() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Set up garden with roles and an action
        (address garden, uint256 actionUID) = _setupGardenWithRolesAndAction("Disabled Action Garden");

        // "Disable" the action by setting endTime to just after startTime (in the past)
        ActionRegistry.Action memory action = actionRegistry.getAction(actionUID);
        actionRegistry.updateActionEndTime(actionUID, action.startTime + 1);

        // Attempt to submit work attestation via real EAS — should revert
        // The WorkResolver checks action.endTime < block.timestamp → NotActiveAction
        string[] memory media = new string[](1);
        media[0] = "ipfs://QmDisabledWork";

        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Work on Disabled Action",
            feedback: "Should fail",
            metadata: "ipfs://QmMeta",
            media: media
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(work),
                value: 0
            })
        });

        // Gardener tries to submit work for the disabled action
        vm.prank(forkGardener);
        vm.expectRevert(NotActiveAction.selector);
        IEASBase(eas).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Multiple Actions Same Garden
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice 3 actions registered sequentially get unique UIDs and are all queryable
    function testForkArbitrum_multipleActions_sameGarden() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;

        // Register 3 actions across different domains
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Solar Action",
            "solar.action",
            "ipfs://QmSolar",
            capitals,
            new string[](0),
            Domain.SOLAR
        );

        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 60 days,
            "Agro Action",
            "agro.action",
            "ipfs://QmAgro",
            capitals,
            new string[](0),
            Domain.AGRO
        );

        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 90 days,
            "Waste Action",
            "waste.action",
            "ipfs://QmWaste",
            capitals,
            new string[](0),
            Domain.WASTE
        );

        // Verify each action is queryable with correct data
        ActionRegistry.Action memory a0 = actionRegistry.getAction(0);
        assertEq(a0.title, "Solar Action", "action 0 title");
        assertEq(uint256(a0.domain), uint256(Domain.SOLAR), "action 0 domain");

        ActionRegistry.Action memory a1 = actionRegistry.getAction(1);
        assertEq(a1.title, "Agro Action", "action 1 title");
        assertEq(uint256(a1.domain), uint256(Domain.AGRO), "action 1 domain");

        ActionRegistry.Action memory a2 = actionRegistry.getAction(2);
        assertEq(a2.title, "Waste Action", "action 2 title");
        assertEq(uint256(a2.domain), uint256(Domain.WASTE), "action 2 domain");

        // Verify owners are all the test contract (which is the owner)
        assertEq(actionRegistry.actionToOwner(0), address(this), "action 0 owner");
        assertEq(actionRegistry.actionToOwner(1), address(this), "action 1 owner");
        assertEq(actionRegistry.actionToOwner(2), address(this), "action 2 owner");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: UUPS Upgrade Preserves State
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy V1 → register action → upgrade to V2 → verify state preserved
    function testForkArbitrum_actionRegistry_uupsUpgrade() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Register an action on the current (V1) implementation
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.FINANCIAL;

        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Pre-Upgrade Action",
            "test.pre_upgrade",
            "ipfs://QmPreUpgrade",
            capitals,
            new string[](0),
            Domain.WASTE
        );

        // Verify pre-upgrade state
        ActionRegistry.Action memory preUpgrade = actionRegistry.getAction(0);
        assertEq(preUpgrade.title, "Pre-Upgrade Action", "pre-upgrade title should exist");
        address preUpgradeOwner = actionRegistry.actionToOwner(0);

        // Deploy a new implementation (same code -- just testing the upgrade mechanism)
        ActionRegistry newImpl = new ActionRegistry();

        // Upgrade (test contract is the owner)
        actionRegistry.upgradeTo(address(newImpl));

        // Verify state is preserved after upgrade
        ActionRegistry.Action memory postUpgrade = actionRegistry.getAction(0);
        assertEq(postUpgrade.title, "Pre-Upgrade Action", "title should survive upgrade");
        assertEq(postUpgrade.slug, "test.pre_upgrade", "slug should survive upgrade");
        assertEq(postUpgrade.endTime, preUpgrade.endTime, "endTime should survive upgrade");
        assertEq(uint256(postUpgrade.domain), uint256(Domain.WASTE), "domain should survive upgrade");
        assertEq(actionRegistry.actionToOwner(0), preUpgradeOwner, "owner should survive upgrade");

        // Verify new registrations still work after upgrade
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Post-Upgrade Action",
            "test.post_upgrade",
            "ipfs://QmPostUpgrade",
            capitals,
            new string[](0),
            Domain.SOLAR
        );

        ActionRegistry.Action memory postAction = actionRegistry.getAction(1);
        assertEq(postAction.title, "Post-Upgrade Action", "post-upgrade registration should work");
    }
}
