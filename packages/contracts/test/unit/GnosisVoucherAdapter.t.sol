// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { GnosisVoucherAdapter } from "../../src/modules/GnosisVoucherAdapter.sol";
import { VoucherEntitlementModule } from "../../src/modules/VoucherEntitlementModule.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { VoucherMessageCodec } from "../../src/libraries/VoucherMessageCodec.sol";

interface VoucherAdapterReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

/// @dev Mock transport records acknowledgments without delivering them; it proves no live CCIP lane.
contract VoucherAdapterRouter {
    uint256 public fee;
    uint256 public sends;
    bool public quoteFails;
    bool public sendFails;
    bytes public lastData;

    function configure(uint256 fee_, bool quoteFails_, bool sendFails_) external {
        fee = fee_;
        quoteFails = quoteFails_;
        sendFails = sendFails_;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view returns (uint256) {
        require(!quoteFails, "mock quote failure");
        return fee;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata message) external payable returns (bytes32) {
        require(!sendFails && msg.value == fee, "mock send failure");
        require(message.tokenAmounts.length == 0 && message.feeToken == address(0), "message-only native fees");
        lastData = message.data;
        return keccak256(abi.encode(++sends));
    }

    function deliver(address receiver, Client.Any2EVMMessage memory message) external {
        VoucherAdapterReceiver(receiver).ccipReceive(message);
    }
}

/// @dev Fictional ERC-20 reserve fixture. The pinned fork tests separately exercise CLC GiftableToken.
contract VoucherAdapterToken is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    uint256 public override totalSupply;
    uint256 public transferCalls;
    address public failingRecipient;
    uint256 public transferFee;
    bool public skipDebit;
    bool public skipAllowanceDebit;
    address public reentryTarget;
    bytes public reentryData;
    bool public reentrySucceeded;

    function mintFixture(address recipient, uint256 amount) external {
        balanceOf[recipient] += amount;
        totalSupply += amount;
    }

    function configureFailure(address recipient, uint256 fee_, bool skipDebit_) external {
        failingRecipient = recipient;
        transferFee = fee_;
        skipDebit = skipDebit_;
    }

    function configureReentry(address target, bytes calldata data) external {
        reentryTarget = target;
        reentryData = data;
    }

    function configureAllowanceDebit(bool skip) external {
        skipAllowanceDebit = skip;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        require(allowance[sender][msg.sender] >= amount, "mock allowance");
        if (!skipAllowanceDebit) allowance[sender][msg.sender] -= amount;
        if (reentryTarget != address(0)) (reentrySucceeded,) = reentryTarget.call(reentryData);
        _transfer(sender, recipient, amount);
        ++transferCalls;
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) private {
        require(recipient != failingRecipient, "mock recipient failure");
        require(balanceOf[sender] >= amount && amount >= transferFee, "mock balance");
        if (!skipDebit) balanceOf[sender] -= amount;
        balanceOf[recipient] += amount - transferFee;
        emit Transfer(sender, recipient, amount - transferFee);
    }
}

    contract GnosisVoucherAdapterTest is Test {
        uint64 private constant _SOURCE_SELECTOR = 49_999;
        uint256 private constant _SOURCE_CHAIN = 42_161;
        address private constant _SOURCE_MODULE = address(0xAABB);
        // Labeled local stand-ins, not member passkeys or a verified production Safe configuration.
        address private constant _COMMUNITY_SAFE = address(0x1000);
        address private constant _ISSUER_SAFE = address(0x2000);
        address private constant _ISSUER_AUTHORITY = address(0x3000);
        address private constant _GUARDIAN = address(0x4000);
        address private constant _ALICE = address(0x5000);
        address private constant _BOB = address(0x6000);
        VoucherAdapterRouter private _router;
        VoucherAdapterToken private _token;
        GnosisVoucherAdapter private _adapter;

        function setUp() public {
            vm.chainId(100);
            _router = new VoucherAdapterRouter();
            _token = new VoucherAdapterToken();
            GnosisVoucherAdapter implementation = new GnosisVoucherAdapter(address(_router));
            _adapter = GnosisVoucherAdapter(
                payable(address(
                        new ERC1967Proxy(
                            address(implementation),
                            abi.encodeCall(
                                GnosisVoucherAdapter.initialize,
                                (_COMMUNITY_SAFE, _GUARDIAN, _SOURCE_SELECTOR, _SOURCE_CHAIN, _SOURCE_MODULE)
                            )
                        )
                    ))
            );
            vm.prank(_COMMUNITY_SAFE);
            _adapter.unpause();
            vm.prank(_ISSUER_SAFE);
            _adapter.configureAsset(address(_token), _ISSUER_AUTHORITY, true);
            _token.mintFixture(_ISSUER_SAFE, 10_000);
            _approve(5000);
        }

        function _approve(uint256 amount) private {
            vm.prank(_ISSUER_SAFE);
            _token.approve(address(_adapter), amount);
        }

        function _command() private view returns (VoucherMessageCodec.Command memory command) {
            command.version = 1;
            command.sourceChainId = _SOURCE_CHAIN;
            command.sourceModule = _SOURCE_MODULE;
            command.commitmentId = 7;
            command.revision = 3;
            command.issuer = _ISSUER_SAFE;
            command.issuerAuthority = _ISSUER_AUTHORITY;
            command.destinationChainId = 100;
            command.destinationAdapter = address(_adapter);
            command.token = address(_token);
            command.totalUnits = 1000;
            command.termsHash = keccak256("fictional terms revision three");
            command.recognitionHash = keccak256("source-validated canonical recognition");
            command.policyContext = keccak256("fictional service terms and season");
            command.recipients = new address[](2);
            command.recipients[0] = _ALICE;
            command.recipients[1] = _BOB;
            command.amounts = new uint256[](2);
            command.amounts[0] = 333;
            command.amounts[1] = 667;
        }

        function _message(
            VoucherMessageCodec.Command memory command,
            bytes32 messageId
        )
            private
            pure
            returns (Client.Any2EVMMessage memory)
        {
            return Client.Any2EVMMessage({
                messageId: messageId,
                sourceChainSelector: _SOURCE_SELECTOR,
                sender: abi.encode(_SOURCE_MODULE),
                data: VoucherMessageCodec.encodeCommand(command),
                destTokenAmounts: new Client.EVMTokenAmount[](0)
            });
        }

        function _deliver(VoucherMessageCodec.Command memory command, bytes32 messageId) private {
            _router.deliver(address(_adapter), _message(command, messageId));
        }

        function _result(VoucherMessageCodec.Command memory command)
            private
            view
            returns (GnosisVoucherAdapter.ExecutionResult memory)
        {
            return _adapter.getExecutionResult(VoucherMessageCodec.entitlementId(command));
        }

        function testGnosisVoucherAdapter_deliversExactTotalFromFiniteIssuerReserve() public {
            VoucherMessageCodec.Command memory command = _command();
            _deliver(command, bytes32(uint256(1)));
            assertEq(_token.balanceOf(_ALICE), 333);
            assertEq(_token.balanceOf(_BOB), 667);
            assertEq(_token.balanceOf(_ISSUER_SAFE), 9000);
            assertEq(_token.allowance(_ISSUER_SAFE, address(_adapter)), 4000);
            assertEq(_token.balanceOf(address(_adapter)), 0);
            assertTrue(_result(command).success);
            assertEq(_result(command).sequence, 1);
            VoucherMessageCodec.Ack memory acknowledgment = VoucherMessageCodec.decodeAck(_router.lastData());
            assertTrue(acknowledgment.success);
            assertEq(acknowledgment.entitlementId, VoucherMessageCodec.entitlementId(command));
            assertEq(acknowledgment.payloadHash, VoucherMessageCodec.hash(command));
        }

        function testGnosisVoucherAdapter_otherGardenAndOwnerCannotAuthorizeIssuerReserve() public {
            vm.prank(_ISSUER_SAFE);
            _adapter.configureAsset(address(_token), _ISSUER_AUTHORITY, false);
            vm.prank(_COMMUNITY_SAFE);
            _adapter.configureAsset(address(_token), _ISSUER_AUTHORITY, true);
            VoucherMessageCodec.Command memory command = _command();
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_token.balanceOf(_ISSUER_SAFE), 10_000);
            assertEq(
                _adapter.failureReason(VoucherMessageCodec.entitlementId(command)),
                abi.encodeWithSelector(GnosisVoucherAdapter.AssetNotAuthorized.selector)
            );
            vm.prank(_ISSUER_SAFE);
            _adapter.configureAsset(address(_token), _ISSUER_AUTHORITY, true);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertTrue(_result(command).success);
        }

        function testGnosisVoucherAdapter_wrongSourceIssuerAuthorityCannotSpend() public {
            VoucherMessageCodec.Command memory command = _command();
            command.issuerAuthority = address(0x123);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_token.transferCalls(), 0);
        }

        function testGnosisVoucherAdapter_secondIssuerRequiresIndependentAuthorization() public {
            VoucherMessageCodec.Command memory command = _command();
            command.issuer = address(0x7000);
            _token.mintFixture(command.issuer, 2000);
            vm.prank(command.issuer);
            _token.approve(address(_adapter), 2000);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            vm.prank(command.issuer);
            _adapter.configureAsset(address(_token), _ISSUER_AUTHORITY, true);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertEq(_token.balanceOf(_ISSUER_SAFE), 10_000);
            assertEq(_token.balanceOf(command.issuer), 1000);
        }

        function testGnosisVoucherAdapter_allowanceExhaustionAndRepairPreserveAuthorization() public {
            VoucherMessageCodec.Command memory command = _command();
            _approve(999);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_token.transferCalls(), 0);
            bytes32 originalHash = _result(command).payloadHash;
            _approve(1000);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertTrue(_result(command).success);
            assertEq(_result(command).sequence, 2);
            assertEq(_result(command).payloadHash, originalHash);
            assertEq(_token.allowance(_ISSUER_SAFE, address(_adapter)), 0);
        }

        function testGnosisVoucherAdapter_reserveExhaustionAndReplenishment() public {
            VoucherMessageCodec.Command memory command = _command();
            vm.prank(_ISSUER_SAFE);
            _token.transfer(address(0x9999), 9500);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_token.balanceOf(_ALICE), 0);
            _token.mintFixture(_ISSUER_SAFE, 500);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertTrue(_result(command).success);
            assertEq(_token.balanceOf(_ISSUER_SAFE), 0);
        }

        function testGnosisVoucherAdapter_unlimitedDelegationFailsUntilBounded() public {
            VoucherMessageCodec.Command memory command = _command();
            _approve(type(uint256).max);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_token.transferCalls(), 0);
            _approve(1000);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertTrue(_result(command).success);
        }

        function testGnosisVoucherAdapter_partialTransferFailureRollsBackAllTransfersAndAllowance() public {
            VoucherMessageCodec.Command memory command = _command();
            _token.configureFailure(_BOB, 0, false);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_token.balanceOf(_ALICE), 0);
            assertEq(_token.balanceOf(_BOB), 0);
            assertEq(_token.balanceOf(_ISSUER_SAFE), 10_000);
            assertEq(_token.allowance(_ISSUER_SAFE, address(_adapter)), 5000);
            assertEq(_token.transferCalls(), 0);
            _token.configureFailure(address(0), 0, false);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertTrue(_result(command).success);
        }

        function testGnosisVoucherAdapter_inexactCreditOrDebitFailsAtomically() public {
            VoucherMessageCodec.Command memory command = _command();
            _token.configureFailure(address(0), 1, false);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_token.balanceOf(_ALICE), 0);
            _token.configureFailure(address(0), 0, true);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertFalse(_result(command).success);
            assertEq(_token.balanceOf(_BOB), 0);
            assertEq(_token.allowance(_ISSUER_SAFE, address(_adapter)), 5000);
        }

        function testGnosisVoucherAdapter_issuerContributorConsumesWholeAllowanceWithNetReserveDebit() public {
            VoucherMessageCodec.Command memory command = _command();
            command.recipients[0] = _ISSUER_SAFE;
            _deliver(command, bytes32(uint256(1)));
            assertTrue(_result(command).success);
            assertEq(_token.balanceOf(_ISSUER_SAFE), 9333);
            assertEq(_token.balanceOf(_BOB), 667);
            assertEq(_token.allowance(_ISSUER_SAFE, address(_adapter)), 4000);
            assertEq(_token.transferCalls(), 2);
            assertEq(
                _adapter.getCommand(VoucherMessageCodec.entitlementId(command)), VoucherMessageCodec.encodeCommand(command)
            );
        }

        function testGnosisVoucherAdapter_nonDecrementingAllowanceFailsAtomically() public {
            VoucherMessageCodec.Command memory command = _command();
            _token.configureAllowanceDebit(true);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_token.balanceOf(_ALICE), 0);
            assertEq(_token.balanceOf(_BOB), 0);
            assertEq(_token.balanceOf(_ISSUER_SAFE), 10_000);
            assertEq(_token.allowance(_ISSUER_SAFE, address(_adapter)), 5000);
            _token.configureAllowanceDebit(false);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertTrue(_result(command).success);
        }

        function testGnosisVoucherAdapter_duplicateTransportAndEntitlementNeverRepeatDistribution() public {
            VoucherMessageCodec.Command memory command = _command();
            _deliver(command, bytes32(uint256(1)));
            _deliver(command, bytes32(uint256(1)));
            _deliver(command, bytes32(uint256(2)));
            assertEq(_token.transferCalls(), 2);
            assertEq(_result(command).sequence, 1);
            assertEq(_token.balanceOf(_ALICE), 333);
            vm.expectRevert(GnosisVoucherAdapter.AlreadyDelivered.selector);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
        }

        function testGnosisVoucherAdapter_duplicateFailureNeedsExplicitExecutionRetry() public {
            VoucherMessageCodec.Command memory command = _command();
            _approve(0);
            _deliver(command, bytes32(uint256(1)));
            _approve(1000);
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_result(command).sequence, 1);
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertTrue(_result(command).success);
        }

        function testGnosisVoucherAdapter_conflictingPayloadCannotReuseEntitlementOrTransportId() public {
            VoucherMessageCodec.Command memory command = _command();
            _deliver(command, bytes32(uint256(1)));
            command.amounts[0] = 334;
            command.amounts[1] = 666;
            vm.expectRevert(GnosisVoucherAdapter.ConflictingPayload.selector);
            _deliver(command, bytes32(uint256(2)));
            command.commitmentId = 8;
            vm.expectRevert(GnosisVoucherAdapter.ConflictingPayload.selector);
            _deliver(command, bytes32(uint256(1)));
            assertEq(_token.transferCalls(), 2);
        }

        function testGnosisVoucherAdapter_deliverySurvivesLostAcknowledgmentAndRetryDoesNotDistribute() public {
            VoucherMessageCodec.Command memory command = _command();
            _router.configure(0, false, true);
            _deliver(command, bytes32(uint256(1)));
            assertTrue(_result(command).success);
            assertTrue(_result(command).acknowledgmentFailureHash != bytes32(0));
            assertEq(_token.transferCalls(), 2);
            _router.configure(0, false, false);
            _adapter.retryAcknowledgment(VoucherMessageCodec.entitlementId(command));
            _adapter.retryAcknowledgment(VoucherMessageCodec.entitlementId(command));
            assertEq(_token.transferCalls(), 2);
            assertEq(_result(command).sequence, 1);
            assertEq(_result(command).acknowledgmentFailureHash, bytes32(0));
            assertEq(_router.sends(), 2);
        }

        function testGnosisVoucherAdapter_quoteFailureAndFeeRepairNeverChangeDelivery() public {
            VoucherMessageCodec.Command memory command = _command();
            _router.configure(1 ether, true, false);
            _deliver(command, bytes32(uint256(1)));
            assertTrue(_result(command).success);
            _router.configure(1 ether, false, false);
            vm.expectRevert(abi.encodeWithSignature("IncorrectAcknowledgmentFee(uint256,uint256)", 1 ether, 0));
            _adapter.retryAcknowledgment(VoucherMessageCodec.entitlementId(command));
            assertEq(_router.sends(), 0);
            vm.deal(address(this), 1 ether);
            _adapter.retryAcknowledgment{ value: 1 ether }(VoucherMessageCodec.entitlementId(command));
            assertEq(_router.sends(), 1);
            assertEq(_token.transferCalls(), 2);
        }

        function testGnosisVoucherAdapter_duplicateTransportNeverSpendsAnotherSponsoredAckFee() public {
            VoucherMessageCodec.Command memory command = _command();
            _router.configure(1 ether, false, false);
            vm.deal(address(_adapter), 5 ether);
            _deliver(command, bytes32(uint256(1)));
            _deliver(command, bytes32(uint256(1)));
            _deliver(command, bytes32(uint256(2)));
            _deliver(command, bytes32(uint256(3)));
            assertEq(address(_adapter).balance, 4 ether);
            assertEq(_router.sends(), 1);
            assertEq(_token.transferCalls(), 2);
        }

        function testGnosisVoucherAdapter_ackResendMustFundExactFeeWithoutDrainingReserve() public {
            VoucherMessageCodec.Command memory command = _command();
            bytes32 entitlement = VoucherMessageCodec.entitlementId(command);
            _router.configure(1 ether, false, false);
            vm.deal(address(_adapter), 5 ether);
            _deliver(command, bytes32(uint256(1)));
            assertEq(_adapter.quoteAcknowledgment(entitlement), 1 ether);
            for (uint256 i; i < 3; ++i) {
                vm.expectRevert(abi.encodeWithSignature("IncorrectAcknowledgmentFee(uint256,uint256)", 1 ether, 0));
                _adapter.retryAcknowledgment(entitlement);
            }
            vm.deal(address(this), 3 ether);
            vm.expectRevert(abi.encodeWithSignature("IncorrectAcknowledgmentFee(uint256,uint256)", 1 ether, 2 ether));
            _adapter.retryAcknowledgment{ value: 2 ether }(entitlement);
            assertEq(address(_adapter).balance, 4 ether);
            assertEq(_router.sends(), 1);
            _adapter.retryAcknowledgment{ value: 1 ether }(entitlement);
            _adapter.retryAcknowledgment{ value: 1 ether }(entitlement);
            assertEq(address(_adapter).balance, 4 ether);
            assertEq(_router.sends(), 3);
            assertEq(_token.transferCalls(), 2);
            _router.configure(1 ether, false, true);
            vm.expectRevert("mock send failure");
            _adapter.retryAcknowledgment{ value: 1 ether }(entitlement);
            assertEq(address(this).balance, 1 ether);
            assertEq(address(_adapter).balance, 4 ether);
            _router.configure(1 ether, true, false);
            vm.expectRevert("mock quote failure");
            _adapter.retryAcknowledgment{ value: 1 ether }(entitlement);
            assertEq(address(this).balance, 1 ether);
            assertEq(address(_adapter).balance, 4 ether);
            assertTrue(_result(command).success);
        }

        function testGnosisVoucherAdapter_executionRetriesDoNotSpendSponsoredAckReserve() public {
            VoucherMessageCodec.Command memory command = _command();
            bytes32 entitlement = VoucherMessageCodec.entitlementId(command);
            _router.configure(1 ether, false, false);
            vm.deal(address(_adapter), 5 ether);
            _approve(0);
            _deliver(command, bytes32(uint256(1)));
            _adapter.retry(entitlement);
            _adapter.retry(entitlement);
            vm.prank(_ISSUER_SAFE);
            _adapter.safeRetry(entitlement);
            assertEq(address(_adapter).balance, 4 ether);
            assertEq(_router.sends(), 1);
            _approve(1000);
            _adapter.retry(entitlement);
            assertTrue(_result(command).success);
            assertEq(address(_adapter).balance, 4 ether);
            assertEq(_router.sends(), 1);
            assertEq(_result(command).acknowledgmentSequence, 1);
            vm.deal(address(this), 1 ether);
            _adapter.retryAcknowledgment{ value: 1 ether }(entitlement);
            assertEq(address(_adapter).balance, 4 ether);
            VoucherMessageCodec.Ack memory acknowledgment = VoucherMessageCodec.decodeAck(_router.lastData());
            assertTrue(acknowledgment.success);
            assertEq(acknowledgment.resultSequence, _result(command).sequence);
            assertEq(_result(command).acknowledgmentSequence, _result(command).sequence);
        }

        function testGnosisVoucherAdapter_pausedIntakeStoresRecoverableFailureAndAuthenticatedAck() public {
            VoucherMessageCodec.Command memory command = _command();
            vm.prank(_GUARDIAN);
            _adapter.pause();
            _deliver(command, bytes32(uint256(1)));
            assertFalse(_result(command).success);
            assertEq(_result(command).sequence, 1);
            assertEq(
                _adapter.getCommand(VoucherMessageCodec.entitlementId(command)), VoucherMessageCodec.encodeCommand(command)
            );
            VoucherMessageCodec.Ack memory acknowledgment = VoucherMessageCodec.decodeAck(_router.lastData());
            assertFalse(acknowledgment.success);
            vm.expectRevert("Ownable: caller is not the owner");
            vm.prank(_GUARDIAN);
            _adapter.unpause();
            vm.prank(_COMMUNITY_SAFE);
            _adapter.unpause();
            _adapter.retry(VoucherMessageCodec.entitlementId(command));
            assertTrue(_result(command).success);
        }

        function testGnosisVoucherAdapter_boundedSafeFallbackUsesSameBudgetAndStoredPayload() public {
            VoucherMessageCodec.Command memory command = _command();
            bytes32 entitlement = VoucherMessageCodec.entitlementId(command);
            vm.expectRevert(GnosisVoucherAdapter.UnknownEntitlement.selector);
            _adapter.safeRetry(entitlement);
            _approve(0);
            _deliver(command, bytes32(uint256(1)));
            vm.expectRevert(GnosisVoucherAdapter.IssuerOnly.selector);
            vm.prank(_COMMUNITY_SAFE);
            _adapter.safeRetry(entitlement);
            vm.prank(_ISSUER_SAFE);
            _adapter.safeRetry(entitlement);
            assertFalse(_result(command).success);
            _approve(1000);
            vm.prank(_ISSUER_SAFE);
            _adapter.safeRetry(entitlement);
            assertTrue(_result(command).success);
            assertEq(_result(command).payloadHash, VoucherMessageCodec.hash(command));
        }

        function testGnosisVoucherAdapter_rejectsUnauthenticatedTransportAndAttachedTokens() public {
            VoucherMessageCodec.Command memory command = _command();
            Client.Any2EVMMessage memory message = _message(command, bytes32(uint256(1)));
            vm.expectRevert();
            _adapter.ccipReceive(message);
            message.sourceChainSelector += 1;
            vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
            _router.deliver(address(_adapter), message);
            message.sourceChainSelector = _SOURCE_SELECTOR;
            message.sender = abi.encode(_ALICE);
            vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
            _router.deliver(address(_adapter), message);
            message.sender = abi.encode(_SOURCE_MODULE);
            message.destTokenAmounts = new Client.EVMTokenAmount[](1);
            message.destTokenAmounts[0] = Client.EVMTokenAmount(address(_token), 1);
            vm.expectRevert(VoucherEndpoint.AttachedTokensForbidden.selector);
            _router.deliver(address(_adapter), message);
            assertEq(_token.transferCalls(), 0);
        }

        function testGnosisVoucherAdapter_rejectsWrongVersionAndChainQualifiedRoute() public {
            VoucherMessageCodec.Command memory command = _command();
            command.version = 2;
            vm.expectRevert(VoucherMessageCodec.UnsupportedVoucherMessage.selector);
            _deliver(command, bytes32(uint256(1)));
            command.version = 1;
            command.sourceChainId = 1;
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
            command.sourceChainId = _SOURCE_CHAIN;
            command.sourceModule = _ALICE;
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
            command.sourceModule = _SOURCE_MODULE;
            command.destinationChainId = 1;
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
            command.destinationChainId = 100;
            command.destinationAdapter = _ALICE;
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
        }

        function testGnosisVoucherAdapter_rejectsWrongMessageKindAndMalformedSenderEncoding() public {
            VoucherMessageCodec.Command memory command = _command();
            Client.Any2EVMMessage memory message = _message(command, bytes32(uint256(1)));
            message.data = abi.encode(keccak256("a different protocol"), command);
            vm.expectRevert(VoucherMessageCodec.UnsupportedVoucherMessage.selector);
            _router.deliver(address(_adapter), message);
            message.data = VoucherMessageCodec.encodeCommand(command);
            message.sender = abi.encodePacked(_SOURCE_MODULE);
            vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
            _router.deliver(address(_adapter), message);
            assertEq(_token.transferCalls(), 0);
        }

        function testGnosisVoucherAdapter_recipientLimitAndMismatchedArraysFailClosed() public {
            VoucherMessageCodec.Command memory command = _command();
            command.recipients = new address[](41);
            command.amounts = new uint256[](41);
            command.totalUnits = 41;
            for (uint256 i; i < 41; ++i) {
                command.recipients[i] = address(uint160(0x5000 + i));
                command.amounts[i] = 1;
            }
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
            command.amounts = new uint256[](40);
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
        }

        function testGnosisVoucherAdapter_fortyRecipientsFitAuthorizedMessageGasBudget() public {
            VoucherMessageCodec.Command memory command = _command();
            command.recipients = new address[](40);
            command.amounts = new uint256[](40);
            command.totalUnits = 40;
            for (uint256 i; i < 40; ++i) {
                command.recipients[i] = address(uint160(0x5000 + i));
                command.amounts[i] = 1;
            }
            uint256 gasBefore = gasleft();
            _deliver(command, bytes32(uint256(1)));
            uint256 used = gasBefore - gasleft();
            emit log_named_uint("Cold forty-recipient mock-router delivery gas", used);
            // Includes durable command storage, forty transfers, result storage and a mocked ack send.
            // This rehearsal bound does not attest a live CCIP lane's supported maximum gas setting.
            VoucherEntitlementModule sourceImplementation = new VoucherEntitlementModule(address(_router));
            assertLt(used, sourceImplementation.COMMAND_GAS_LIMIT());
            assertTrue(_result(command).success);
            assertEq(_token.transferCalls(), 40);
            assertEq(_token.balanceOf(_ISSUER_SAFE), 9960);
        }

        function testGnosisVoucherAdapter_rejectsMalformedAllocationAndLegacyRevision() public {
            VoucherMessageCodec.Command memory command = _command();
            command.amounts[0] = 332;
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
            command.amounts[0] = 333;
            command.recipients[1] = _ALICE;
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
            command.recipients[1] = _BOB;
            command.recipients[0] = address(0);
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
            command.recipients[0] = _ALICE;
            command.revision = 0;
            vm.expectRevert(GnosisVoucherAdapter.InvalidCommand.selector);
            _deliver(command, bytes32(uint256(1)));
        }

        function testGnosisVoucherAdapter_zeroRoundedAllocationKeepsCanonicalRecipients() public {
            VoucherMessageCodec.Command memory command = _command();
            command.totalUnits = 1;
            command.amounts[0] = 0;
            command.amounts[1] = 1;
            _deliver(command, bytes32(uint256(1)));
            assertTrue(_result(command).success);
            assertEq(_token.balanceOf(_ALICE), 0);
            assertEq(_token.balanceOf(_BOB), 1);
            assertEq(_token.transferCalls(), 1);
        }

        function testGnosisVoucherAdapter_tokenCannotReenterExecutionRetry() public {
            VoucherMessageCodec.Command memory command = _command();
            _token.configureReentry(
                address(_adapter), abi.encodeCall(GnosisVoucherAdapter.retry, (VoucherMessageCodec.entitlementId(command)))
            );
            _deliver(command, bytes32(uint256(1)));
            assertTrue(_result(command).success);
            assertFalse(_token.reentrySucceeded());
            assertEq(_token.transferCalls(), 2);
        }

        function testGnosisVoucherAdapter_selfOnlyExecutionAndAcknowledgmentCannotBeForged() public {
            vm.expectRevert(GnosisVoucherAdapter.SelfOnly.selector);
            _adapter.executeDistribution(bytes32(uint256(1)));
            vm.expectRevert(GnosisVoucherAdapter.SelfOnly.selector);
            _adapter.sendAcknowledgment(bytes32(uint256(1)));
            vm.expectRevert(GnosisVoucherAdapter.UnknownEntitlement.selector);
            _adapter.retryAcknowledgment(bytes32(uint256(1)));
        }

        function testGnosisVoucherAdapter_upgradeRequiresPausedOwnerWithoutWaitingAndPreservesReplay() public {
            VoucherMessageCodec.Command memory command = _command();
            _deliver(command, bytes32(uint256(1)));
            GnosisVoucherAdapter replacement = new GnosisVoucherAdapter(address(_router));
            vm.prank(_COMMUNITY_SAFE);
            _adapter.pause();
            vm.prank(_COMMUNITY_SAFE);
            _adapter.scheduleUpgrade(address(replacement));
            uint256 scheduledAt = block.timestamp;
            vm.expectRevert("Ownable: caller is not the owner");
            vm.prank(_GUARDIAN);
            _adapter.upgradeTo(address(replacement));
            vm.prank(_COMMUNITY_SAFE);
            _adapter.upgradeTo(address(replacement));
            assertEq(block.timestamp, scheduledAt);
            assertEq(_adapter.UPGRADE_DELAY(), 0);
            assertEq(_adapter.owner(), _COMMUNITY_SAFE);
            assertEq(_adapter.guardian(), _GUARDIAN);
            assertTrue(_adapter.paused());
            vm.prank(_COMMUNITY_SAFE);
            _adapter.unpause();
            _deliver(command, bytes32(uint256(2)));
            assertEq(_token.transferCalls(), 2);
            assertTrue(_result(command).success);
            assertEq(_adapter.scheduledImplementation(), address(0));
        }

        function testFuzz_GnosisVoucherAdapter_distributionConservesAuthorizedTotal(uint128 left, uint128 right) public {
            uint256 first = bound(uint256(left), 0, 5000);
            uint256 second = bound(uint256(right), 1, 5000);
            VoucherMessageCodec.Command memory command = _command();
            command.amounts[0] = first;
            command.amounts[1] = second;
            command.totalUnits = first + second;
            _approve(command.totalUnits);
            _deliver(command, bytes32(uint256(1)));
            assertTrue(_result(command).success);
            assertEq(_token.balanceOf(_ALICE) + _token.balanceOf(_BOB), command.totalUnits);
            assertEq(_token.balanceOf(_ISSUER_SAFE) + command.totalUnits, 10_000);
        }
    }
