// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICLCGiftableToken, ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { GnosisVoucherAdapter } from "../../src/modules/GnosisVoucherAdapter.sol";
import { VoucherMessageCodec } from "../../src/libraries/VoucherMessageCodec.sol";

/// @dev Mock transport only: delivers authenticated-shaped bytes locally and returns mock ack IDs.
contract GnosisVoucherForkMockRouter {
    uint256 private _nonce;
    bool public acknowledgmentsUnavailable;

    error MockAcknowledgmentUnavailable();

    function setAcknowledgmentsUnavailable(bool unavailable) external {
        acknowledgmentsUnavailable = unavailable;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view returns (uint256) {
        if (acknowledgmentsUnavailable) revert MockAcknowledgmentUnavailable();
        return 0;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata) external payable returns (bytes32) {
        if (acknowledgmentsUnavailable) revert MockAcknowledgmentUnavailable();
        return keccak256(abi.encode("mock acknowledgment", ++_nonce));
    }

    function deliver(GnosisVoucherAdapter adapter, VoucherMessageCodec.Command memory command, bytes32 messageId) external {
        adapter.ccipReceive(
            Client.Any2EVMMessage({
                messageId: messageId,
                sourceChainSelector: 4_949_039_107_694_359_620,
                sender: abi.encode(command.sourceModule),
                data: VoucherMessageCodec.encodeCommand(command),
                destTokenAmounts: new Client.EVMTokenAmount[](0)
            })
        );
    }
}

/// @notice Actual pinned CLC implementation and factory, with fictional local issuer inventory.
/// @dev This fork proves deployed interface behavior, not live CCIP delivery or member signing.
contract GnosisVoucherReserveForkTest is Test {
    uint256 private constant GNOSIS_BLOCK = 48_848_261;
    address private constant TOKEN_IMPLEMENTATION = 0x34445d13F112A11f72C1d353a7dcdc407F3df2d8;
    address private constant FACTORY = 0xB286994c648F98fD3a3BA6C43934828a5b88162b;
    address private constant WEBAUTHN_VALIDATOR = 0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd;
    bytes32 private constant TOKEN_CODEHASH = 0x074980d5e0e6bfb3afd2faa9f828cf65d65ae7ed568f65b2623fa61190e95d91;
    bytes32 private constant FACTORY_CODEHASH = 0x2e06e9a024d7bd35356833e6fcb9f34c1fbdae8bbd91da3bc55e4cc2ba4d1230;

    address private issuerSafeStandIn;
    address private sourceModuleStandIn;
    address private issuerAuthorityStandIn;
    address private constant RECIPIENT_A = address(0x1001);
    address private constant RECIPIENT_B = address(0x1002);
    ICLCGiftableToken private voucher;
    TimelockController private upgradeTimelock;
    GnosisVoucherAdapter private adapter;
    GnosisVoucherForkMockRouter private router;

    function setUp() public {
        // A missing or wrong fork fails setup; this suite must never silently pass without RPC.
        string memory rpc = "https://rpc.gnosischain.com";
        try vm.envString("GNOSIS_RPC_URL") returns (string memory configuredRpc) {
            rpc = configuredRpc;
        } catch { }
        vm.createSelectFork(rpc, GNOSIS_BLOCK);
        assertEq(block.chainid, 100, "expected Gnosis fork");
        assertEq(block.number, GNOSIS_BLOCK, "expected recorded conformance block");
        assertEq(TOKEN_IMPLEMENTATION.codehash, TOKEN_CODEHASH, "GiftableToken conformance drift");
        assertEq(FACTORY.codehash, FACTORY_CODEHASH, "factory conformance drift");

        issuerSafeStandIn = makeAddr("fictional-issuer-Safe-stand-in");
        address[] memory governors = new address[](1);
        governors[0] = issuerSafeStandIn;
        upgradeTimelock = new TimelockController(0, governors, governors, address(0));
        address proxy = ICLCERC1967Factory(FACTORY)
            .deployAndCall(
                TOKEN_IMPLEMENTATION,
                address(upgradeTimelock),
                abi.encodeCall(
                    ICLCGiftableToken.initialize,
                    ("Fictional rehearsal service voucher", "FICTION", uint8(6), issuerSafeStandIn, uint256(0))
                )
            );
        voucher = ICLCGiftableToken(proxy);
        vm.prank(issuerSafeStandIn);
        voucher.mintTo(issuerSafeStandIn, 100);

        sourceModuleStandIn = makeAddr("fictional-Arbitrum-voucher-module");
        issuerAuthorityStandIn = makeAddr("fictional-Arbitrum-issuer-authority");
        router = new GnosisVoucherForkMockRouter();
        adapter = GnosisVoucherAdapter(
            payable(address(
                    new ERC1967Proxy(
                        address(new GnosisVoucherAdapter(address(router))),
                        abi.encodeCall(
                            GnosisVoucherAdapter.initialize,
                            (
                                issuerSafeStandIn,
                                makeAddr("fictional-emergency-guardian"),
                                uint64(4_949_039_107_694_359_620),
                                uint256(42_161),
                                sourceModuleStandIn
                            )
                        )
                    )
                ))
        );
        vm.startPrank(issuerSafeStandIn);
        adapter.configureAsset(address(voucher), issuerAuthorityStandIn, true);
        adapter.unpause();
        vm.stopPrank();
    }

    function testGnosisVoucherReserve_initializesFictionalInventoryWithSeparatedUpgradeAuthority() public {
        assertEq(voucher.owner(), issuerSafeStandIn);
        assertEq(voucher.name(), "Fictional rehearsal service voucher");
        assertEq(voucher.decimals(), 6);
        assertEq(voucher.balanceOf(issuerSafeStandIn), 100);
        assertEq(voucher.totalSupply(), 100);
        assertEq(ICLCERC1967Factory(FACTORY).adminOf(address(voucher)), address(upgradeTimelock));
        assertEq(upgradeTimelock.getMinDelay(), 0);
        assertTrue(address(upgradeTimelock) != issuerSafeStandIn);
    }

    function testGnosisVoucherReserve_recordsMissingMemberPasskeyValidator() public {
        assertEq(WEBAUTHN_VALIDATOR.code.length, 0, "review account model if validator deployment changes");
    }

    function testGnosisVoucherReserve_exhaustedAllowancePreservesEntireBatchUntilRepair() public {
        VoucherMessageCodec.Command memory command = _command(1, 30, 40);
        bytes32 id = VoucherMessageCodec.entitlementId(command);
        _approve(60);
        router.deliver(adapter, command, keccak256("mock allowance failure"));
        _assertUnchangedReserve();
        assertEq(adapter.failureReason(id), abi.encodeWithSelector(GnosisVoucherAdapter.InsufficientAllowance.selector));
        assertEq(voucher.allowance(issuerSafeStandIn, address(adapter)), 60);
        bytes32 authorizedPayload = adapter.getExecutionResult(id).payloadHash;

        _approve(70);
        adapter.retry(id);
        assertTrue(adapter.getExecutionResult(id).success);
        assertEq(adapter.getExecutionResult(id).payloadHash, authorizedPayload);
        assertEq(voucher.balanceOf(RECIPIENT_A), 30);
        assertEq(voucher.balanceOf(RECIPIENT_B), 40);
        assertEq(voucher.balanceOf(issuerSafeStandIn), 30);
        assertEq(voucher.allowance(issuerSafeStandIn, address(adapter)), 0);
        assertEq(voucher.totalSupply(), 100, "distribution must not mint inventory");
    }

    function testGnosisVoucherReserve_revocationAndSafeRetryUseTheSameAuthorization() public {
        VoucherMessageCodec.Command memory command = _command(2, 30, 40);
        bytes32 id = VoucherMessageCodec.entitlementId(command);
        _approve(70);
        _approve(0);
        router.deliver(adapter, command, keccak256("mock revoked allowance"));
        _assertUnchangedReserve();
        assertFalse(adapter.getExecutionResult(id).success);

        _approve(70);
        vm.prank(issuerSafeStandIn);
        adapter.safeRetry(id);
        assertTrue(adapter.getExecutionResult(id).success);
        assertEq(keccak256(adapter.getCommand(id)), keccak256(VoucherMessageCodec.encodeCommand(command)));
        router.deliver(adapter, command, keccak256("mock duplicate after fallback"));
        assertEq(voucher.balanceOf(RECIPIENT_A), 30);
        assertEq(voucher.balanceOf(RECIPIENT_B), 40);
        assertEq(adapter.getExecutionResult(id).sequence, 2);
    }

    function testGnosisVoucherReserve_inventoryExhaustionRemainsRecoverableWithoutChangingReward() public {
        VoucherMessageCodec.Command memory command = _command(3, 70, 80);
        bytes32 id = VoucherMessageCodec.entitlementId(command);
        _approve(150);
        router.deliver(adapter, command, keccak256("mock reserve exhaustion"));
        _assertUnchangedReserve();
        assertEq(adapter.failureReason(id), abi.encodeWithSelector(GnosisVoucherAdapter.InsufficientReserve.selector));

        // Only the issuer replenishes fictional inventory; this does not prove service capacity.
        vm.prank(issuerSafeStandIn);
        voucher.mintTo(issuerSafeStandIn, 50);
        adapter.retry(id);
        assertTrue(adapter.getExecutionResult(id).success);
        assertEq(voucher.balanceOf(RECIPIENT_A), 70);
        assertEq(voucher.balanceOf(RECIPIENT_B), 80);
        assertEq(voucher.balanceOf(issuerSafeStandIn), 0);
        assertEq(voucher.totalSupply(), 150);
    }

    function testGnosisVoucherReserve_secondTransferFailureRollsBackRealFirstTransfer() public {
        VoucherMessageCodec.Command memory command = _command(4, 30, 40);
        bytes32 id = VoucherMessageCodec.entitlementId(command);
        _approve(70);
        // Controlled failure at the second token call. The first transfer executes real fork code.
        vm.mockCall(
            address(voucher),
            abi.encodeWithSelector(voucher.transferFrom.selector, issuerSafeStandIn, RECIPIENT_B, uint256(40)),
            abi.encode(false)
        );
        router.deliver(adapter, command, keccak256("mock second transfer failure"));
        _assertUnchangedReserve();
        assertFalse(adapter.getExecutionResult(id).success);
        assertEq(voucher.allowance(issuerSafeStandIn, address(adapter)), 70);
        vm.clearMockedCalls();

        adapter.retry(id);
        assertTrue(adapter.getExecutionResult(id).success);
        assertEq(voucher.balanceOf(RECIPIENT_A), 30);
        assertEq(voucher.balanceOf(RECIPIENT_B), 40);
    }

    function testGnosisVoucherReserve_acknowledgmentRepairDoesNotRepeatActualTokenDistribution() public {
        VoucherMessageCodec.Command memory command = _command(5, 30, 40);
        bytes32 id = VoucherMessageCodec.entitlementId(command);
        _approve(70);
        router.setAcknowledgmentsUnavailable(true);
        router.deliver(adapter, command, keccak256("mock lost acknowledgment"));
        assertTrue(adapter.getExecutionResult(id).success);
        assertTrue(adapter.getExecutionResult(id).acknowledgmentFailureHash != bytes32(0));

        router.setAcknowledgmentsUnavailable(false);
        adapter.retryAcknowledgment(id);
        assertEq(adapter.getExecutionResult(id).acknowledgmentFailureHash, bytes32(0));
        assertEq(adapter.getExecutionResult(id).sequence, 1);
        assertEq(voucher.balanceOf(RECIPIENT_A), 30);
        assertEq(voucher.balanceOf(RECIPIENT_B), 40);
        assertEq(voucher.balanceOf(issuerSafeStandIn), 30);
    }

    function testGnosisVoucherReserve_adapterCannotMintIssuerInventory() public {
        assertFalse(voucher.isWriter(address(adapter)));
        vm.prank(address(adapter));
        vm.expectRevert();
        voucher.mintTo(RECIPIENT_A, 1);
        assertEq(voucher.totalSupply(), 100);
        assertEq(voucher.balanceOf(RECIPIENT_A), 0);
    }

    function testGnosisVoucherReserve_issuerAllocationConsumesFiniteAllowanceWithExactNetReserveDebit() public {
        VoucherMessageCodec.Command memory command = _command(6, 40, 30);
        command.recipients[1] = issuerSafeStandIn;
        bytes32 id = VoucherMessageCodec.entitlementId(command);
        _approve(70);

        // GiftableToken executes the issuer's self-transfer as well as the other recipient's.
        router.deliver(adapter, command, keccak256("mock issuer contributor allocation"));
        assertTrue(adapter.getExecutionResult(id).success);
        assertEq(voucher.balanceOf(RECIPIENT_A), 40);
        assertEq(voucher.balanceOf(issuerSafeStandIn), 60);
        assertEq(voucher.allowance(issuerSafeStandIn, address(adapter)), 0);
        assertEq(voucher.totalSupply(), 100);

        router.deliver(adapter, command, keccak256("mock duplicate issuer contributor allocation"));
        assertEq(voucher.balanceOf(RECIPIENT_A), 40);
        assertEq(voucher.balanceOf(issuerSafeStandIn), 60);
        assertEq(adapter.getExecutionResult(id).sequence, 1);
    }

    function _approve(uint256 amount) private {
        vm.prank(issuerSafeStandIn);
        voucher.approve(address(adapter), amount);
    }

    function _assertUnchangedReserve() private {
        assertEq(voucher.balanceOf(issuerSafeStandIn), 100);
        assertEq(voucher.balanceOf(RECIPIENT_A), 0);
        assertEq(voucher.balanceOf(RECIPIENT_B), 0);
    }

    function _command(
        uint256 commitmentId,
        uint256 firstUnits,
        uint256 secondUnits
    )
        private
        view
        returns (VoucherMessageCodec.Command memory command)
    {
        address[] memory recipients = new address[](2);
        recipients[0] = RECIPIENT_A;
        recipients[1] = RECIPIENT_B;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = firstUnits;
        amounts[1] = secondUnits;
        return VoucherMessageCodec.Command({
            version: 1,
            sourceChainId: 42_161,
            sourceModule: sourceModuleStandIn,
            commitmentId: commitmentId,
            revision: 1,
            issuer: issuerSafeStandIn,
            issuerAuthority: issuerAuthorityStandIn,
            destinationChainId: 100,
            destinationAdapter: address(adapter),
            token: address(voucher),
            totalUnits: firstUnits + secondUnits,
            termsHash: keccak256("fictional service terms, not a real issuer commitment"),
            recognitionHash: keccak256("mock authorization; recognition validated on source lane separately"),
            policyContext: keccak256("fictional season and revision"),
            recipients: recipients,
            amounts: amounts
        });
    }
}
