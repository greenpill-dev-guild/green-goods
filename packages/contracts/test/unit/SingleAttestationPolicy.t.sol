// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { SingleAttestationPolicy, ReportingPackedUserOperation } from "../../src/modules/SingleAttestationPolicy.sol";

contract SingleAttestationPolicyTest is Test {
    SingleAttestationPolicy private policy;
    bytes32 private constant ID = bytes32(bytes4(0x12345678));
    address private constant ACCOUNT = address(0xA1);
    address private constant PAYMASTER = address(0xB1);
    bytes4 private constant EXECUTE = bytes4(keccak256("execute(bytes32,bytes)"));

    function setUp() public {
        policy = new SingleAttestationPolicy();
        vm.prank(ACCOUNT);
        policy.onInstall(abi.encodePacked(ID, abi.encode(uint128(100_000), PAYMASTER)));
    }

    function operation(bytes32 mode, uint256 value) private pure returns (ReportingPackedUserOperation memory op) {
        op.sender = ACCOUNT;
        op.paymasterAndData = abi.encodePacked(PAYMASTER, uint128(10_000), uint128(10_000));
        op.accountGasLimits = bytes32((uint256(10_000) << 128) | 10_000);
        op.gasFees = bytes32(uint256(1));
        op.preVerificationGas = 1000;
        op.callData = abi.encodeWithSelector(EXECUTE, mode, abi.encodePacked(address(0xEA5), value, bytes4(0x12345678)));
    }

    function testSingleAttestationPolicy_acceptsCanonicalSingleZeroValueCall() public {
        vm.prank(ACCOUNT);
        assertEq(policy.checkUserOpPolicy(ID, operation(bytes32(0), 0)), 0);
    }

    function testSingleAttestationPolicy_acceptsPinnedSdkEncodingVector() public {
        ReportingPackedUserOperation memory op = operation(bytes32(0), 0);
        // @zerodev/sdk 5.5.10 createKernelAccount(...0.3.1).encodeCalls vector, independently
        // asserted against that installed SDK in Shared kernel-permissions.test.ts.
        op.callData =
            hex"e9ae5c530000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000380000000000000000000000000000000000000ea50000000000000000000000000000000000000000000000000000000000000000123456780000000000000000";
        vm.prank(ACCOUNT);
        assertEq(policy.checkUserOpPolicy(ID, op), 0);
    }

    function testSingleAttestationPolicy_revertsWhenBatchDelegatecallOrValue() public {
        bytes32[3] memory modes = [bytes32(uint256(1) << 248), bytes32(uint256(255) << 248), bytes32(uint256(1) << 240)];
        for (uint256 i; i < modes.length; i++) {
            vm.expectRevert(SingleAttestationPolicy.InvalidExecution.selector);
            vm.prank(ACCOUNT);
            policy.checkUserOpPolicy(ID, operation(modes[i], 0));
        }
        vm.expectRevert(SingleAttestationPolicy.InvalidExecution.selector);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, operation(bytes32(0), 1));
    }

    function testSingleAttestationPolicy_revertsWhenRetiredPermissionReinstalled() public {
        vm.prank(ACCOUNT);
        policy.onUninstall(abi.encodePacked(ID));
        vm.expectRevert(SingleAttestationPolicy.PermissionAlreadyUsed.selector);
        vm.prank(ACCOUNT);
        policy.onInstall(abi.encodePacked(ID, abi.encode(uint128(100_000), PAYMASTER)));
        vm.expectRevert(SingleAttestationPolicy.PermissionNotActive.selector);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, operation(bytes32(0), 0));
    }

    function testSingleAttestationPolicy_revertsWhenWrongAccountOrMessage() public {
        vm.expectRevert(SingleAttestationPolicy.PermissionNotActive.selector);
        policy.checkUserOpPolicy(ID, operation(bytes32(0), 0));
        vm.expectRevert(SingleAttestationPolicy.MessageSigningForbidden.selector);
        policy.checkSignaturePolicy(ID, ACCOUNT, bytes32(0), "");
    }

    function testSingleAttestationPolicy_revertsWhenPointerPaddingOrTrailingDataChanged() public {
        ReportingPackedUserOperation memory op = operation(bytes32(0), 0);
        op.callData[67] = 0x60;
        vm.expectRevert(SingleAttestationPolicy.InvalidExecution.selector);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
        op = operation(bytes32(0), 0);
        op.callData[op.callData.length - 1] = 0x01;
        vm.expectRevert(SingleAttestationPolicy.InvalidExecution.selector);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
    }

    function testSingleAttestationPolicy_countsFullPaymasterPrefundCumulatively() public {
        ReportingPackedUserOperation memory op = operation(bytes32(0), 0);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
        assertEq(policy.remainingCostWei(ID, ACCOUNT), 59_000);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
        assertEq(policy.remainingCostWei(ID, ACCOUNT), 18_000);
        vm.expectRevert(SingleAttestationPolicy.CostBudgetExceeded.selector);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
    }

    function testSingleAttestationPolicy_revertsWhenPaymasterAbsentSubstitutedOrTruncated() public {
        ReportingPackedUserOperation memory op = operation(bytes32(0), 0);
        op.paymasterAndData = "";
        vm.expectRevert(SingleAttestationPolicy.SponsorshipRequired.selector);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
        op.paymasterAndData = abi.encodePacked(address(0xB2), uint128(0), uint128(0));
        vm.expectRevert(SingleAttestationPolicy.SponsorshipRequired.selector);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
        op.paymasterAndData = abi.encodePacked(PAYMASTER, uint128(0));
        vm.expectRevert(SingleAttestationPolicy.SponsorshipRequired.selector);
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
    }

    function testSingleAttestationPolicy_acceptsExactCostBoundaryAndRejectsOverflow() public {
        ReportingPackedUserOperation memory op = operation(bytes32(0), 0);
        op.preVerificationGas = 60_000;
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
        assertEq(policy.remainingCostWei(ID, ACCOUNT), 0);
        op.preVerificationGas = type(uint256).max;
        vm.expectRevert();
        vm.prank(ACCOUNT);
        policy.checkUserOpPolicy(ID, op);
    }
}
