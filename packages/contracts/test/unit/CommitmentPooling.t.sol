// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";

interface IOwnableCommitmentPoolingModule is ICommitmentPoolingModule {
    function owner() external view returns (address);
}

/// @title CommitmentPoolingTest
/// @notice RED-first ABI and initialization coverage for PRD-721.
contract CommitmentPoolingTest is Test {
    address private constant OWNER = address(0xA11CE);
    address private constant ROOT_GARDEN = address(0xBEEF);

    IOwnableCommitmentPoolingModule private module;

    function setUp() public {
        address implementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        bytes memory initData =
            abi.encodeWithSelector(ICommitmentPoolingModule.initialize.selector, OWNER, ROOT_GARDEN);
        module = IOwnableCommitmentPoolingModule(address(new ERC1967Proxy(implementation, initData)));
    }

    function testInitializerPinsRootAndStartsPaused() public {
        assertEq(module.owner(), OWNER);
        assertEq(module.rootGarden(), ROOT_GARDEN);
        assertTrue(module.paused());
    }

    function testInitializerRejectsZeroRoot() public {
        address implementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        bytes memory initData =
            abi.encodeWithSelector(ICommitmentPoolingModule.initialize.selector, OWNER, address(0));

        vm.expectRevert(ICommitmentPoolingModule.RootGardenRequired.selector);
        new ERC1967Proxy(implementation, initData);
    }

    function testBoundsAreExplicitPureAbiGetters() public {
        assertGt(module.MAX_REQUIREMENTS(), 0);
        assertGt(module.MAX_LINKED_WORKS_PER_COMMITMENT(), 0);
        assertGt(module.MAX_CONTRIBUTORS_PER_COMMITMENT(), 0);
        assertGt(module.MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT(), 0);
        assertGt(module.MAX_CONFIRMERS(), 0);
    }

    function testCyclelessRecognitionPolicyIsFrozenTwentyEighty() public {
        ICommitmentPoolingModule.RecognitionPolicy memory policy = module.cyclelessRecognitionPolicy();
        assertEq(policy.equalParticipationBps, 2_000);
        assertEq(policy.verifiedContributionBps, 8_000);
    }

    function testCreationRequestReadThroughStartsUnseen() public {
        assertEq(module.getCommitmentIdByCreationRequest(address(this), keccak256("offline-create")), 0);
    }

    function testWorkLinkOperationReadThroughStartsUnseen() public {
        assertEq(module.getWorkLinkOperationPayloadHash(address(this), keccak256("offline-work-link")), bytes32(0));
    }
}
