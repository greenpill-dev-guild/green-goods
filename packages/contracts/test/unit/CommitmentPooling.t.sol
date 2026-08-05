// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

interface ICommitmentPoolingRedTarget {
    struct RecognitionPolicy {
        uint16 equalParticipationBps;
        uint16 verifiedContributionBps;
    }

    function initialize(address owner_, address rootGarden_) external;
    function owner() external view returns (address);
    function rootGarden() external view returns (address);
    function paused() external view returns (bool);
    function MAX_REQUIREMENTS() external pure returns (uint256);
    function MAX_LINKED_WORKS_PER_COMMITMENT() external pure returns (uint256);
    function MAX_CONTRIBUTORS_PER_COMMITMENT() external pure returns (uint256);
    function MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT() external pure returns (uint256);
    function MAX_CONFIRMERS() external pure returns (uint256);
    function cyclelessRecognitionPolicy() external pure returns (RecognitionPolicy memory);
    function getCommitmentIdByCreationRequest(address creator, bytes32 creationRequestKey) external view returns (uint256);
    function getWorkLinkOperationPayloadHash(address caller, bytes32 operationKey) external view returns (bytes32);
}

error RootGardenRequired();

/// @title CommitmentPoolingTest
/// @notice RED-first ABI and initialization coverage for PRD-721.
contract CommitmentPoolingTest is Test {
    address private constant OWNER = address(0xA11CE);
    address private constant ROOT_GARDEN = address(0xBEEF);

    ICommitmentPoolingRedTarget private module;

    function setUp() public {
        address implementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        bytes memory initData =
            abi.encodeWithSelector(ICommitmentPoolingRedTarget.initialize.selector, OWNER, ROOT_GARDEN);
        module = ICommitmentPoolingRedTarget(address(new ERC1967Proxy(implementation, initData)));
    }

    function testInitializerPinsRootAndStartsPaused() public {
        assertEq(module.owner(), OWNER);
        assertEq(module.rootGarden(), ROOT_GARDEN);
        assertTrue(module.paused());
    }

    function testInitializerRejectsZeroRoot() public {
        address implementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        bytes memory initData =
            abi.encodeWithSelector(ICommitmentPoolingRedTarget.initialize.selector, OWNER, address(0));

        vm.expectRevert(RootGardenRequired.selector);
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
        ICommitmentPoolingRedTarget.RecognitionPolicy memory policy = module.cyclelessRecognitionPolicy();
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
