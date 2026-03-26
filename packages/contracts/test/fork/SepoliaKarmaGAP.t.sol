// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { KarmaGAPModule } from "../../src/modules/Karma.sol";
import { KarmaLib } from "../../src/lib/Karma.sol";

/// @title SepoliaKarmaGAPForkTest
/// @notice Fork tests against the real Karma GAP contract on Sepolia.
/// @dev Creates project/impact/milestone attestations through KarmaGAPModule and
/// validates returned UIDs are non-zero on the real GAP deployment.
contract SepoliaKarmaGAPForkTest is Test {
    KarmaGAPModule internal module;

    address internal constant OWNER = address(0xA101);
    address internal constant GARDEN_TOKEN = address(0xA102);
    address internal constant WORK_APPROVAL_RESOLVER = address(0xA103);
    address internal constant ASSESSMENT_RESOLVER = address(0xA104);

    address internal constant GARDEN = address(0xB101);
    address internal constant OPERATOR = address(0xB102);

    function test_fork_sepolia_createProjectImpactMilestone() public {
        string memory rpcUrl = _getRpc("SEPOLIA_RPC_URL");
        if (bytes(rpcUrl).length == 0) {
            return;
        }

        vm.createSelectFork(rpcUrl);
        assertEq(block.chainid, 11_155_111, "Expected Sepolia fork");

        KarmaGAPModule implementation = new KarmaGAPModule();
        bytes memory initData = abi.encodeWithSelector(
            KarmaGAPModule.initialize.selector, OWNER, GARDEN_TOKEN, WORK_APPROVAL_RESOLVER, ASSESSMENT_RESOLVER
        );
        module = KarmaGAPModule(address(new ERC1967Proxy(address(implementation), initData)));

        vm.prank(GARDEN_TOKEN);
        bytes32 projectUID = module.createProject(
            GARDEN,
            OPERATOR,
            "Green Goods Sepolia Fork Garden",
            "Fork test project created via KarmaGAPModule",
            "Sepolia Test Location",
            "QmSepoliaForkBanner"
        );

        assertTrue(projectUID != bytes32(0), "Project UID should be non-zero");
        assertEq(module.gardenProjects(GARDEN), projectUID, "Project UID should be persisted for garden");

        vm.prank(WORK_APPROVAL_RESOLVER);
        bytes32 impactUID = module.createImpact(
            GARDEN,
            1,
            "Fork Impact",
            "Created impact attestation on real GAP",
            "QmSepoliaImpactProof",
            bytes32(uint256(0x123456)),
            "bafkreiForkMetadata"
        );

        assertTrue(impactUID != bytes32(0), "Impact UID should be non-zero");

        vm.prank(ASSESSMENT_RESOLVER);
        bytes32 milestoneUID = module.createMilestone(
            GARDEN,
            "Fork Milestone",
            "Created milestone attestation on real GAP",
            block.timestamp,
            block.timestamp + 7 days,
            1,
            "Sepolia Test Location",
            "QmSepoliaAssessmentConfig"
        );

        assertTrue(milestoneUID != bytes32(0), "Milestone UID should be non-zero");
    }

    function test_fork_sepolia_schemaUIDs_matchKnownValues() public {
        string memory rpcUrl = _getRpc("SEPOLIA_RPC_URL");
        if (bytes(rpcUrl).length == 0) {
            return;
        }

        vm.createSelectFork(rpcUrl);

        assertEq(KarmaLib.getGapContract(), 0x9E5560f5b084c227Dc40672f48F59DA617eeFA28, "Sepolia GAP contract mismatch");
        assertEq(
            KarmaLib.getProjectSchemaUID(),
            0xec77990a252b54b17673955c774b9712766de5eecb22ca5aa2c440e0e93257fb,
            "Sepolia project schema mismatch"
        );
        assertEq(
            KarmaLib.getDetailsSchemaUID(),
            0x2c270e35bfcdc4d611f0e9d3d2ab6924ec6c673505abc22a1dd07e19b67211af,
            "Sepolia details schema mismatch"
        );
        assertEq(
            KarmaLib.getMemberOfSchemaUID(),
            0xdd87b3500457931252424f4439365534ba72a367503a8805ff3482353fb90301,
            "Sepolia memberOf schema mismatch"
        );

        vm.chainId(42_161);
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

    function _getRpc(string memory envVar) internal view returns (string memory) {
        try vm.envString(envVar) returns (string memory rpcUrl) {
            return rpcUrl;
        } catch {
            return "";
        }
    }
}
