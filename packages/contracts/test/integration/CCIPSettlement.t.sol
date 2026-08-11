// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { ICeloSettlementExecutor } from "../../src/interfaces/ICeloSettlementExecutor.sol";
import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { CeloSettlementExecutor } from "../../src/modules/CeloSettlementExecutor.sol";
import { SettlementModule } from "../../src/modules/SettlementModule.sol";
import { SettlementPayerMockHats, SettlementPayerMockPooling } from "../unit/SettlementPayer.t.sol";
import {
    ExecutorMockGoodDollar,
    ExecutorMockRoles,
    ExecutorMockSafe,
    ICcipMessageReceiver
} from "../unit/CeloSettlementExecutor.t.sol";

contract AsynchronousSettlementRouter {
    uint256 public fee;
    uint256 public nonce;
    uint64 public lastDestinationSelector;
    bytes public lastReceiver;
    bytes public lastData;
    bytes32 public lastMessageId;

    function setFee(uint256 fee_) external {
        fee = fee_;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view returns (uint256) {
        return fee;
    }

    function ccipSend(
        uint64 destinationSelector,
        Client.EVM2AnyMessage calldata message
    )
        external
        payable
        returns (bytes32 messageId)
    {
        require(msg.value == fee, "fee");
        require(message.tokenAmounts.length == 0, "tokens");
        lastDestinationSelector = destinationSelector;
        lastReceiver = message.receiver;
        lastData = message.data;
        messageId = keccak256(abi.encode(address(this), ++nonce));
        lastMessageId = messageId;
    }

    function deliverLast(address receiver, uint64 sourceSelector, address sender) external {
        deliver(receiver, lastMessageId, sourceSelector, sender, lastData);
    }

    function deliver(
        address receiver,
        bytes32 messageId,
        uint64 sourceSelector,
        address sender,
        bytes memory data
    )
        public
    {
        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);
        ICcipMessageReceiver(receiver).ccipReceive(
            Client.Any2EVMMessage({
                messageId: messageId,
                sourceChainSelector: sourceSelector,
                sender: abi.encode(sender),
                data: data,
                destTokenAmounts: noTokens
            })
        );
    }
}

contract CCIPSettlementIntegrationTest is Test {
    uint64 internal constant ARBITRUM_SELECTOR = 4_949_039_107_694_359_620;
    uint64 internal constant CELO_SELECTOR = 13_420;
    uint64 internal constant ARBITRUM_EVM_CHAIN_ID = 42_161;
    uint64 internal constant CELO_CHAIN_ID = 42_220;
    address internal constant OWNER = address(0xA11CE);
    address internal constant PROTOCOL_GARDEN = address(0x1000);
    address internal constant PROVIDER_GARDEN = address(0x2000);
    bytes32 internal constant ROLE_KEY = keccak256("role");
    bytes32 internal constant ALLOWANCE_KEY = keccak256("allowance");

    AsynchronousSettlementRouter internal arbitrumRouter;
    AsynchronousSettlementRouter internal celoRouter;
    SettlementPayerMockHats internal hats;
    SettlementPayerMockPooling internal pooling;
    ExecutorMockGoodDollar internal token;
    ExecutorMockSafe internal payerSafe;
    ExecutorMockSafe internal beneficiarySafe;
    ExecutorMockRoles internal payerRoles;
    ExecutorMockRoles internal beneficiaryRoles;
    ISettlementModule internal settlement;
    ICeloSettlementExecutor internal executor;

    function setUp() public {
        arbitrumRouter = new AsynchronousSettlementRouter();
        celoRouter = new AsynchronousSettlementRouter();
        hats = new SettlementPayerMockHats();
        pooling = new SettlementPayerMockPooling();
        token = new ExecutorMockGoodDollar();
        payerSafe = new ExecutorMockSafe();
        beneficiarySafe = new ExecutorMockSafe();

        SettlementModule settlementImplementation =
            new SettlementModule(address(arbitrumRouter), ARBITRUM_SELECTOR, CELO_CHAIN_ID);
        settlement = ISettlementModule(
            address(
                new ERC1967Proxy(
                    address(settlementImplementation),
                    abi.encodeWithSelector(
                        ISettlementModule.initialize.selector,
                        OWNER,
                        address(hats),
                        address(pooling),
                        PROTOCOL_GARDEN,
                        address(token)
                    )
                )
            )
        );
        CeloSettlementExecutor executorImplementation =
            new CeloSettlementExecutor(address(celoRouter), address(token), CELO_SELECTOR, ARBITRUM_EVM_CHAIN_ID);
        executor = ICeloSettlementExecutor(
            address(
                new ERC1967Proxy(
                    address(executorImplementation),
                    abi.encodeWithSelector(
                        ICeloSettlementExecutor.initialize.selector, OWNER, ARBITRUM_SELECTOR, address(settlement), uint8(1)
                    )
                )
            )
        );

        payerRoles = new ExecutorMockRoles(address(payerSafe), token);
        beneficiaryRoles = new ExecutorMockRoles(address(beneficiarySafe), token);
        payerRoles.configureMember(address(executor), ROLE_KEY);
        beneficiaryRoles.configureMember(address(executor), ROLE_KEY);
        hats.setSteward(PROTOCOL_GARDEN, OWNER, true);
        hats.setSteward(PROVIDER_GARDEN, OWNER, true);
        vm.deal(OWNER, 2);

        vm.startPrank(OWNER);
        settlement.registerSettlementAccount(
            PROTOCOL_GARDEN,
            CELO_CHAIN_ID,
            address(payerSafe),
            _owners(0x10),
            address(payerRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("payer-permissions")
        );
        settlement.registerSettlementAccount(
            PROVIDER_GARDEN,
            CELO_CHAIN_ID,
            address(beneficiarySafe),
            _owners(0x20),
            address(beneficiaryRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("beneficiary-permissions")
        );
        settlement.setCcipRoute(CELO_SELECTOR, address(executor), 1_000_000, 1, 0);
        settlement.setFeeReserveMinimum(1);
        settlement.fundFees{ value: 1 }();
        settlement.setPaused(false);

        executor.configureGardenRoute(
            PROTOCOL_GARDEN,
            address(payerSafe),
            address(payerRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("payer-permissions")
        );
        executor.configureGardenRoute(
            PROVIDER_GARDEN,
            address(beneficiarySafe),
            address(beneficiaryRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("beneficiary-permissions")
        );
        executor.setCaps(4, 1000 ether, 4000 ether);
        executor.setFeePolicy(0, 0);
        executor.setPeriodicCap(1 days, 10_000 ether);
        executor.setAcknowledgmentFeeReserveMinimum(1);
        executor.fundAcknowledgmentFees{ value: 1 }();
        executor.setPaused(false);
        vm.stopPrank();

        token.setBalance(address(payerSafe), 1000 ether);
        pooling.setCommitment(1, _gardenRequest());
    }

    function testGardenBeneficiaryCommandExecutesAndAcknowledgesEndToEnd() public {
        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 disbursementId = settlement.prepareGardenBeneficiaryPayout(planId);
        settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        assertEq(arbitrumRouter.lastDestinationSelector(), CELO_SELECTOR);
        celoRouter.deliver(
            address(executor),
            arbitrumRouter.lastMessageId(),
            ARBITRUM_SELECTOR,
            address(settlement),
            arbitrumRouter.lastData()
        );
        assertEq(token.balanceOf(address(beneficiarySafe)), 100 ether);
        assertEq(celoRouter.lastDestinationSelector(), ARBITRUM_SELECTOR);

        arbitrumRouter.deliver(
            address(settlement), celoRouter.lastMessageId(), CELO_SELECTOR, address(executor), celoRouter.lastData()
        );
        ISettlementModule.Disbursement memory disbursement = settlement.getDisbursement(disbursementId);
        assertEq(uint8(disbursement.state), uint8(ISettlementModule.DisbursementState.Confirmed));
        assertEq(uint8(settlement.payoutPlanStatus(planId)), uint8(ISettlementModule.PayoutPlanStatus.Complete));
    }

    function testExecutionFailureRequeuesIntoNewAttemptAndThenConfirms() public {
        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 disbursementId = settlement.prepareGardenBeneficiaryPayout(planId);
        settlement.dispatchDisbursement(disbursementId);
        executor.setPaused(true);
        executor.setGardenRouteActive(PROVIDER_GARDEN, false);
        executor.setPaused(false);
        vm.stopPrank();

        celoRouter.deliver(
            address(executor),
            arbitrumRouter.lastMessageId(),
            ARBITRUM_SELECTOR,
            address(settlement),
            arbitrumRouter.lastData()
        );
        arbitrumRouter.deliver(
            address(settlement), celoRouter.lastMessageId(), CELO_SELECTOR, address(executor), celoRouter.lastData()
        );
        assertEq(uint8(settlement.getDisbursement(disbursementId).state), uint8(ISettlementModule.DisbursementState.Failed));
        assertEq(token.balanceOf(address(beneficiarySafe)), 0);

        vm.startPrank(OWNER);
        executor.setPaused(true);
        executor.setGardenRouteActive(PROVIDER_GARDEN, true);
        executor.setPaused(false);
        settlement.requeue(disbursementId);
        settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();
        assertEq(settlement.getDisbursement(disbursementId).attempt, 1);

        celoRouter.deliver(
            address(executor),
            arbitrumRouter.lastMessageId(),
            ARBITRUM_SELECTOR,
            address(settlement),
            arbitrumRouter.lastData()
        );
        arbitrumRouter.deliver(
            address(settlement), celoRouter.lastMessageId(), CELO_SELECTOR, address(executor), celoRouter.lastData()
        );
        assertEq(
            uint8(settlement.getDisbursement(disbursementId).state), uint8(ISettlementModule.DisbursementState.Confirmed)
        );
        assertEq(token.balanceOf(address(beneficiarySafe)), 100 ether);
        assertEq(uint8(settlement.payoutPlanStatus(planId)), uint8(ISettlementModule.PayoutPlanStatus.Complete));
    }

    function testCallerFundedAcknowledgmentRetryCompletesWithoutSecondTransfer() public {
        celoRouter.setFee(1);
        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 disbursementId = settlement.prepareGardenBeneficiaryPayout(planId);
        settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        celoRouter.deliver(
            address(executor),
            arbitrumRouter.lastMessageId(),
            ARBITRUM_SELECTOR,
            address(settlement),
            arbitrumRouter.lastData()
        );
        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        ICeloSettlementExecutor.ExecutionResult memory deferred = executor.executionResultOf(dispatched.executionKey);
        assertFalse(deferred.acknowledgmentSent);
        assertEq(token.balanceOf(address(beneficiarySafe)), 100 ether);

        address caller = address(0xC411E2);
        vm.deal(caller, 1);
        vm.prank(caller);
        executor.retryAcknowledgment{ value: 1 }(dispatched.executionKey);
        arbitrumRouter.deliver(
            address(settlement), celoRouter.lastMessageId(), CELO_SELECTOR, address(executor), celoRouter.lastData()
        );

        assertEq(
            uint8(settlement.getDisbursement(disbursementId).state), uint8(ISettlementModule.DisbursementState.Confirmed)
        );
        assertEq(token.balanceOf(address(beneficiarySafe)), 100 ether);
    }

    function _gardenRequest() internal pure returns (ICommitmentPoolingModule.Commitment memory commitment) {
        commitment.state = ICommitmentPoolingModule.CommitmentState.Fulfilled;
        commitment.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        commitment.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        commitment.counterpartyKind = ICommitmentPoolingModule.ClaimType.Garden;
        commitment.providerGarden = PROVIDER_GARDEN;
        commitment.payerGarden = PROTOCOL_GARDEN;
        commitment.consideration = ICommitmentPoolingModule.DeclaredConsideration({
            rail: ICommitmentPoolingModule.ConsiderationRail.CeloSettlement,
            source: address(0),
            token: address(0),
            amount: 100 ether
        });
    }

    function _owners(uint160 base) internal pure returns (address[3] memory owners) {
        owners[0] = address(base + 1);
        owners[1] = address(base + 2);
        owners[2] = address(base + 3);
    }
}
