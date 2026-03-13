// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { KarmaGAPModule } from "../../src/modules/Karma.sol";
import { KarmaLib } from "../../src/lib/Karma.sol";

/// @title ArbitrumKarmaGAPForkTest
/// @notice Fork tests against the real Karma GAP contract on Arbitrum mainnet.
/// @dev Creates project/impact/milestone attestations through KarmaGAPModule and
/// validates returned UIDs are non-zero on the real GAP deployment (0x6dC1...).
/// Mirrors SepoliaKarmaGAP.t.sol structure for Arbitrum.
contract ArbitrumKarmaGAPForkTest is Test {
    KarmaGAPModule internal module;

    address internal constant OWNER = address(0xA101);
    address internal constant GARDEN_TOKEN = address(0xA102);
    address internal constant WORK_APPROVAL_RESOLVER = address(0xA103);
    address internal constant ASSESSMENT_RESOLVER = address(0xA104);

    address internal constant GARDEN = address(0xB101);
    address internal constant OPERATOR = address(0xB102);

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Full Project -> Impact -> Milestone Flow
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Full project, impact, milestone creation on real Arbitrum GAP (0x6dC1D6b864...)
    function testForkArbitrum_createProjectImpactMilestone() public {
        string memory rpcUrl = _getRpc("ARBITRUM_RPC_URL");
        if (bytes(rpcUrl).length == 0) {
            return;
        }

        vm.createSelectFork(rpcUrl);
        assertEq(block.chainid, 42_161, "Expected Arbitrum fork");

        _deployModule();

        vm.prank(GARDEN_TOKEN);
        bytes32 projectUID = module.createProject(
            GARDEN,
            OPERATOR,
            "Green Goods Arbitrum Fork Garden",
            "Fork test project created via KarmaGAPModule on Arbitrum",
            "Arbitrum Test Location",
            "QmArbitrumForkBanner"
        );

        assertTrue(projectUID != bytes32(0), "Project UID should be non-zero");
        assertEq(module.gardenProjects(GARDEN), projectUID, "Project UID should be persisted for garden");

        vm.prank(WORK_APPROVAL_RESOLVER);
        bytes32 impactUID = module.createImpact(
            GARDEN,
            1,
            "Arbitrum Fork Impact",
            "Created impact attestation on real Arbitrum GAP",
            "QmArbitrumImpactProof",
            bytes32(uint256(0xABCDEF))
        );

        assertTrue(impactUID != bytes32(0), "Impact UID should be non-zero");

        vm.prank(ASSESSMENT_RESOLVER);
        bytes32 milestoneUID = module.createMilestone(
            GARDEN,
            "Arbitrum Fork Milestone",
            "Created milestone attestation on real Arbitrum GAP",
            block.timestamp,
            block.timestamp + 7 days,
            1,
            "Arbitrum Test Location",
            "QmArbitrumAssessmentConfig"
        );

        assertTrue(milestoneUID != bytes32(0), "Milestone UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Schema UIDs Match Known Arbitrum Values
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice KarmaLib addresses and schema UIDs match real Arbitrum deployment
    function testForkArbitrum_schemaUIDs_matchKnownArbitrumValues() public {
        string memory rpcUrl = _getRpc("ARBITRUM_RPC_URL");
        if (bytes(rpcUrl).length == 0) {
            return;
        }

        vm.createSelectFork(rpcUrl);
        assertEq(block.chainid, 42_161, "Expected Arbitrum fork");

        assertEq(KarmaLib.getGapContract(), 0x6dC1D6b864e8BEf815806f9e4677123496e12026, "Arbitrum GAP contract mismatch");
        assertEq(
            KarmaLib.getProjectSchemaUID(),
            0xac2a06e955a7e25e6729efe1a6532237e3435b21ccd3dc827ae3c94e624d25b3,
            "Arbitrum project schema mismatch"
        );
        assertEq(
            KarmaLib.getDetailsSchemaUID(),
            0x16bfe4783b7a9c743c401222c56a07ecb77ed42afc84b61ff1f62f5936c0b9d7,
            "Arbitrum details schema mismatch"
        );
        assertEq(
            KarmaLib.getMemberOfSchemaUID(),
            0x5f430aec9d04f0dcb3729775c5dfe10752e436469a7607f8c64ae44ef996e477,
            "Arbitrum memberOf schema mismatch"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Create Project Persists UID
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice gardenProjects mapping updated on real Arbitrum chain after project creation
    function testForkArbitrum_createProject_persistsUID() public {
        string memory rpcUrl = _getRpc("ARBITRUM_RPC_URL");
        if (bytes(rpcUrl).length == 0) {
            return;
        }

        vm.createSelectFork(rpcUrl);

        _deployModule();

        // Before creation, project UID should be zero
        assertEq(module.gardenProjects(GARDEN), bytes32(0), "project should not exist before creation");

        vm.prank(GARDEN_TOKEN);
        bytes32 projectUID =
            module.createProject(GARDEN, OPERATOR, "Persist Test", "Testing persistence", "Test Location", "QmBanner");

        // After creation, project UID should be stored
        assertTrue(projectUID != bytes32(0), "project UID should be non-zero");
        assertEq(module.gardenProjects(GARDEN), projectUID, "gardenProjects mapping should store the UID");

        // Verify via getProjectUID view function
        assertEq(module.getProjectUID(GARDEN), projectUID, "getProjectUID should return same UID");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Create Impact Without Project Reverts Gracefully
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Impact without prior project returns zero UID (graceful degradation)
    function testForkArbitrum_createImpact_withoutProject_reverts() public {
        string memory rpcUrl = _getRpc("ARBITRUM_RPC_URL");
        if (bytes(rpcUrl).length == 0) {
            return;
        }

        vm.createSelectFork(rpcUrl);

        _deployModule();

        // No project created for GARDEN — createImpact should return bytes32(0)
        vm.prank(WORK_APPROVAL_RESOLVER);
        bytes32 impactUID =
            module.createImpact(GARDEN, 1, "Orphan Impact", "Should fail gracefully", "QmOrphan", bytes32(uint256(0x999)));

        assertEq(impactUID, bytes32(0), "impact without project should return zero UID");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function _deployModule() internal {
        KarmaGAPModule implementation = new KarmaGAPModule();
        bytes memory initData = abi.encodeWithSelector(
            KarmaGAPModule.initialize.selector, OWNER, GARDEN_TOKEN, WORK_APPROVAL_RESOLVER, ASSESSMENT_RESOLVER
        );
        module = KarmaGAPModule(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function _getRpc(string memory envVar) internal view returns (string memory) {
        try vm.envString(envVar) returns (string memory rpcUrl) {
            return rpcUrl;
        } catch {
            return "";
        }
    }
}
