// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ICommitmentRegistry } from "../../src/interfaces/ICommitmentRegistry.sol";

interface ICommitmentRegistryRedTarget is ICommitmentRegistry {
    function initialize(address owner_, address module_) external;
    function module() external view returns (address);
}

contract PausedModuleProbe {
    bool public paused;

    constructor(bool paused_) {
        paused = paused_;
    }

    function setPaused(bool paused_) external {
        paused = paused_;
    }
}

/// @title CommitmentRegistryTest
/// @notice RED-first non-transferable accounting coverage for PRD-721.
contract CommitmentRegistryTest is Test {
    uint256 private constant CLASS_ID = 7;
    uint256 private constant POOL_ID = 3;
    uint256 private constant CYCLE_ID = 11;
    uint256 private constant QUOTA = 40;

    address private constant OWNER = address(0xA11CE);
    address private constant PROVIDER = address(0xB0B);

    ICommitmentRegistryRedTarget private registry;

    function setUp() public {
        address implementation = deployCode("Commitment.sol:CommitmentRegistry");
        bytes memory initData =
            abi.encodeWithSelector(ICommitmentRegistryRedTarget.initialize.selector, OWNER, address(this));
        registry = ICommitmentRegistryRedTarget(address(new ERC1967Proxy(implementation, initData)));
    }

    function testRegistersCommitsAndFulfillsOnlyTheFullQuota() public {
        registry.setProviderOpenCommitmentCap(POOL_ID, 1);
        registry.registerClass(CLASS_ID, POOL_ID, CYCLE_ID, "hours", QUOTA);
        registry.commitUnits(CLASS_ID, PROVIDER, QUOTA);

        assertEq(registry.committedOf(PROVIDER, CLASS_ID), QUOTA);
        assertEq(registry.openCommitmentCountOf(POOL_ID, PROVIDER), 1);

        registry.fulfillUnits(CLASS_ID, PROVIDER, QUOTA);

        ICommitmentRegistry.CommitmentClass memory class_ = registry.getClass(CLASS_ID);
        assertEq(registry.committedOf(PROVIDER, CLASS_ID), 0);
        assertEq(registry.fulfilledOf(PROVIDER, CLASS_ID), QUOTA);
        assertEq(registry.openCommitmentCountOf(POOL_ID, PROVIDER), 0);
        assertEq(uint256(class_.accountingState), uint256(ICommitmentRegistry.AccountingState.Fulfilled));
    }

    function testRejectsZeroCapBeforeMutation() public {
        vm.expectRevert(abi.encodeWithSelector(ICommitmentRegistry.OpenCommitmentCapRequired.selector, POOL_ID));
        registry.setProviderOpenCommitmentCap(POOL_ID, 0);
        assertEq(registry.providerOpenCommitmentCapOf(POOL_ID), 0);
    }

    function testRejectsPartialCommit() public {
        registry.setProviderOpenCommitmentCap(POOL_ID, 1);
        registry.registerClass(CLASS_ID, POOL_ID, CYCLE_ID, "hours", QUOTA);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentRegistry.InvalidUnitAmount.selector, CLASS_ID, QUOTA - 1, QUOTA)
        );
        registry.commitUnits(CLASS_ID, PROVIDER, QUOTA - 1);
    }

    function testRejectsProviderCapExhaustionWithoutResidue() public {
        registry.setProviderOpenCommitmentCap(POOL_ID, 1);
        registry.registerClass(CLASS_ID, POOL_ID, CYCLE_ID, "hours", QUOTA);
        registry.registerClass(CLASS_ID + 1, POOL_ID, CYCLE_ID, "hours", QUOTA);
        registry.commitUnits(CLASS_ID, PROVIDER, QUOTA);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentRegistry.OpenCommitmentCapExceeded.selector, POOL_ID, PROVIDER, 1, 0
            )
        );
        registry.commitUnits(CLASS_ID + 1, PROVIDER, QUOTA);

        assertEq(registry.committedOf(PROVIDER, CLASS_ID + 1), 0);
        assertEq(registry.openCommitmentCountOf(POOL_ID, PROVIDER), 1);
    }

    function testHasNoTransferOrApprovalSurface() public {
        (bool transferSuccess,) = address(registry).call(
            abi.encodeWithSignature("safeTransferFrom(address,address,uint256,uint256,bytes)", PROVIDER, OWNER, CLASS_ID, 1, "")
        );
        (bool approvalSuccess,) = address(registry).call(
            abi.encodeWithSignature("setApprovalForAll(address,bool)", OWNER, true)
        );

        assertFalse(transferSuccess);
        assertFalse(approvalSuccess);
    }

    function testModuleReplacementRequiresCurrentModulePaused() public {
        PausedModuleProbe first = new PausedModuleProbe(false);
        PausedModuleProbe second = new PausedModuleProbe(true);

        vm.prank(OWNER);
        registry.setModule(address(first));

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(ICommitmentRegistry.ModuleMustBePaused.selector, address(first)));
        registry.setModule(address(second));

        first.setPaused(true);
        vm.prank(OWNER);
        registry.setModule(address(second));
        assertEq(registry.module(), address(second));
    }
}
