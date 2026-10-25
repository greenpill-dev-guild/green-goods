// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ISettlementModule as Settlement } from "../../src/interfaces/ISettlementModule.sol";
import {
    ISettlementPersonalServicePurchases as Personal
} from "../../src/interfaces/ISettlementPersonalServicePurchases.sol";
import { ICeloSettlementExecutor } from "../../src/interfaces/ICeloSettlementExecutor.sol";
import { SettlementModule } from "../../src/modules/SettlementModule.sol";
import { CeloSettlementExecutor } from "../../src/modules/CeloSettlementExecutor.sol";
import { PersonalPurchaseStorageLib } from "../../src/lib/Settlement/PersonalPurchaseStorageLib.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { CommitmentPoolingFixture } from "./CommitmentPoolingFixture.sol";
import { SettlementPayerMockRouter } from "../unit/SettlementPayer.t.sol";
import {
    ExecutorMockRouter,
    ExecutorMockGoodDollar,
    ExecutorMockSafe,
    ExecutorMockRoles
} from "../unit/CeloSettlementExecutor.t.sol";

/// @notice Fault injection of an invalid route models a bad configuration/upgrade without adding production setters.
contract PersonalServiceSettlementHarness is SettlementModule {
    constructor(address router, uint64 selector, uint64 destination) SettlementModule(router, selector, destination) { }

    function replaceAccountForTest(address garden, address safe) external {
        _settlementAccounts[garden].account = safe;
    }

    function replaceTokenForTest(address replacement) external {
        gDollarToken = replacement;
    }

    function referencePlanForTest(uint256 id) external view returns (Settlement.CommitmentPayoutPlan memory) {
        return _planState.payoutPlans[id];
    }

    function referenceDisbursementForTest(uint256 id) external view returns (Settlement.Disbursement memory) {
        return _disbursements[id];
    }

    function referenceBatchForTest(uint256 id) external view returns (Settlement.Batch memory) {
        return _batches[id];
    }

    function referencePurchaseForTest(uint256 id) external view returns (Personal.PersonalServicePurchase memory) {
        return PersonalPurchaseStorageLib.state().purchases[id];
    }

    function setViewReasonForTest(uint256 id, string calldata reason) external {
        _disbursements[id].reasonCID = reason;
    }
}

/// @notice Real core and executor; fictional terms, receipt attestations, G$, Safe/Roles and CCIP stand-ins.
abstract contract PersonalServicePurchaseFixture is CommitmentPoolingFixture {
    uint64 internal constant ARBITRUM_SELECTOR = 4_949_039_107_694_359_620;
    uint64 internal constant CELO_SELECTOR = 1_346_049_177_634_351_622;
    uint64 internal constant CELO_CHAIN_ID = 42_220;
    uint256 internal constant PRICE = 100 ether + 1;
    address internal constant BUYER_GARDEN = address(0xBA01);
    address internal constant BUYER = address(0xBA02);
    address internal constant BUYER_STEWARD = address(0xBA03);
    address internal constant PROVIDER_STEWARD = address(0xBA04);
    address internal constant DEPOSITOR = address(0xBA05);
    address internal constant REFUND_ACCOUNT = address(0xBA06);
    address internal constant SECOND_PROVIDER = address(0xA11CF);

    Service internal services;
    Settlement internal settlement;
    Personal internal personal;
    SettlementPayerMockRouter internal sourceRouter;
    ExecutorMockRouter internal celoRouter;
    ExecutorMockGoodDollar internal token;
    ExecutorMockSafe internal buyerSafe;
    ExecutorMockSafe internal protocolSafe;
    ExecutorMockRoles internal buyerRoles;
    ICeloSettlementExecutor internal executor;

    function _setUpPersonalFixture() internal {
        vm.chainId(42_161);
        _setUpProductionFixture();
        services = Service(address(module));
        module.registerPool(BUYER_GARDEN, Core.PoolType.Garden);
        hats.setGardener(BUYER_GARDEN, BUYER, true);
        hats.setOperator(BUYER_GARDEN, BUYER_STEWARD, true);
        hats.setOperator(POOL_GARDEN, PROVIDER_STEWARD, true);
        hats.setGardener(POOL_GARDEN, SECOND_PROVIDER, true);
        sourceRouter = new SettlementPayerMockRouter();
        celoRouter = new ExecutorMockRouter();
        token = new ExecutorMockGoodDollar();
        buyerSafe = new ExecutorMockSafe();
        protocolSafe = new ExecutorMockSafe();
        PersonalServiceSettlementHarness implementation =
            new PersonalServiceSettlementHarness(address(sourceRouter), ARBITRUM_SELECTOR, CELO_CHAIN_ID);
        settlement = Settlement(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        Settlement.initialize, (address(this), address(hats), address(module), ROOT_GARDEN, address(token))
                    )
                )
            )
        );
        personal = Personal(address(settlement));
        CeloSettlementExecutor executorImplementation =
            new CeloSettlementExecutor(address(celoRouter), address(token), CELO_SELECTOR, 42_161);
        executor = ICeloSettlementExecutor(
            address(
                new ERC1967Proxy(
                    address(executorImplementation),
                    abi.encodeCall(
                        ICeloSettlementExecutor.initialize,
                        (address(this), ARBITRUM_SELECTOR, address(settlement), uint8(1))
                    )
                )
            )
        );
        buyerRoles = new ExecutorMockRoles(address(buyerSafe), token);
        ExecutorMockRoles protocolRoles = new ExecutorMockRoles(address(protocolSafe), token);
        buyerRoles.configureMember(address(executor), keccak256("fictional-role"));
        protocolRoles.configureMember(address(executor), keccak256("fictional-role"));
        _registerAccount(ROOT_GARDEN, address(protocolSafe), address(protocolRoles));
        _registerAccount(BUYER_GARDEN, address(buyerSafe), address(buyerRoles));
        settlement.setCcipRoute(CELO_SELECTOR, address(executor), 1_000_000, 1, 0);
        settlement.setFeeReserveMinimum(1);
        settlement.setGardenerDeliveryEnabled(true);
        settlement.setBatchSizeLimit(2);
        vm.deal(address(this), 100);
        settlement.fundFees{ value: 1 }();
        settlement.setPaused(false);
        executor.configureGardenRoute(
            BUYER_GARDEN,
            address(buyerSafe),
            address(buyerRoles),
            keccak256("fictional-role"),
            keccak256("fictional-allowance"),
            keccak256("fictional-permissions")
        );
        executor.setCaps(2, 1000 ether, 4000 ether);
        executor.setFeePolicy(100, 5 ether);
        executor.setPeriodicCap(1 days, 10_000 ether);
        executor.setAcknowledgmentFeeReserveMinimum(1);
        executor.fundAcknowledgmentFees{ value: 1 }();
        executor.setPaused(false);
    }

    function _registerAccount(address garden, address safe, address roles) internal {
        address[3] memory owners = [address(0xD001), address(0xD002), address(0xD003)];
        settlement.registerSettlementAccount(
            garden,
            CELO_CHAIN_ID,
            safe,
            owners,
            roles,
            keccak256("fictional-role"),
            keccak256("fictional-allowance"),
            keccak256("fictional-permissions")
        );
    }

    function _personalOffer(bytes32 key) internal returns (uint256 id) {
        Core.CreateCommitmentParams memory params = _baseParams(key);
        params.claimMode = Core.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        id = module.createCommitment(params);
        services.setServiceOfferTerms(id, 0, _personalTerms(), PRICE);
    }

    function _personalTerms() internal pure returns (Service.ServiceOfferTermsInput memory terms) {
        terms.route = Service.ServicePaymentRoute.PersonalGd;
        terms.serviceTermsRef = keccak256("fictional-course-access");
        terms.remedyTermsRef = keccak256("fictional-full-nondelivery-refund");
    }

    function _request(uint256 id, uint64 nonce) internal returns (bytes32 claimHash) {
        Service.ServiceOfferTerms memory terms = services.getServiceOfferTerms(id);
        vm.prank(BUYER);
        return services.requestServiceClaim(
            id,
            Service.ServiceClaimRequest({
                buyerGarden: BUYER_GARDEN,
                voucherHolder: address(0),
                expectedRevision: terms.revision,
                requestNonce: nonce,
                expectedTermsHash: terms.termsHash
            })
        );
    }

    function _consent(uint256 id) internal view returns (Personal.PersonalPurchaseConsent memory consent) {
        Service.ServiceClaimConsent memory claim = services.getServiceClaimConsent(id, BUYER);
        consent = Personal.PersonalPurchaseConsent({
            commitmentId: id,
            expectedTermsRevision: claim.termsRevision,
            expectedTermsHash: claim.termsHash,
            expectedClaimHash: claim.claimHash,
            expectedRequestNonce: claim.requestNonce,
            buyerGarden: BUYER_GARDEN,
            expectedDestinationChainId: CELO_CHAIN_ID,
            expectedToken: address(token),
            expectedCustodySafe: address(buyerSafe),
            authorizedDepositor: DEPOSITOR,
            refundAccount: REFUND_ACCOUNT,
            expectedPrice: PRICE,
            disclosedGrossAmount: PRICE + 25 ether,
            disclosedNetAmount: PRICE + 25 ether
        });
    }

    function _pledge(uint256 id) internal returns (uint256 fundingId) {
        Personal.PersonalPurchaseConsent memory consent = _consent(id);
        vm.prank(BUYER);
        (fundingId,) = personal.pledgePersonalServicePurchase(consent);
    }

    function _receipt(uint256 fundingId, uint256 received) internal view returns (Personal.VerifiedCeloDeposit memory) {
        return Personal.VerifiedCeloDeposit({
            chainId: CELO_CHAIN_ID,
            token: address(token),
            transactionHash: keccak256(abi.encode("fictional-celo-transfer", fundingId)),
            logIndex: 3,
            blockNumber: 42,
            blockHash: keccak256("fictional-finalized-block"),
            depositingAccount: DEPOSITOR,
            custodySafe: address(buyerSafe),
            grossDebit: received,
            receivedAmount: received
        });
    }

    function _recordDeposit(uint256 fundingId, uint256 received) internal {
        Personal.VerifiedCeloDeposit memory receipt = _receipt(fundingId, received);
        vm.prank(BUYER_STEWARD);
        personal.recordPersonalServiceDeposit(fundingId, receipt);
    }

    function _accept(uint256 id) internal {
        bytes32 hash = services.getServiceClaimConsent(id, BUYER).claimHash;
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
    }

    function _consume(uint256 fundingId) internal {
        vm.prank(BUYER_STEWARD);
        settlement.consumeFunding(fundingId);
    }

    function _ready(uint256 id, bool two) internal {
        address[] memory contributors = new address[](two ? 2 : 1);
        contributors[0] = CREATOR;
        if (two) {
            vm.prank(CREATOR);
            module.addContributor(id, SECOND_PROVIDER);
            contributors[1] = SECOND_PROVIDER;
        }
        vm.prank(CREATOR);
        module.attachEvidence(id, "fictional-service-delivery-evidence", contributors);
        module.markReadyForConfirmation(id, "fictional-service-ready");
    }

    function _fulfill(uint256 id, bool two) internal {
        _ready(id, two);
        vm.prank(BUYER);
        module.confirmFulfillment(id);
    }

    function _recognition(uint256 id) internal view returns (Settlement.RecognitionEntry[] memory entries, bytes32 hash) {
        uint256 count = module.getCommitment(id).eligibleContributorCount;
        entries = new Settlement.RecognitionEntry[](count);
        entries[0] = Settlement.RecognitionEntry(CREATOR, uint16(10_000 / count));
        if (count == 2) entries[1] = Settlement.RecognitionEntry(SECOND_PROVIDER, 5000);
        hash = keccak256(abi.encode(block.chainid, id, entries));
    }

    function _plan(uint256 id) internal returns (uint256 planId) {
        (Settlement.RecognitionEntry[] memory entries, bytes32 hash) = _recognition(id);
        vm.prank(BUYER_STEWARD);
        planId = settlement.createCommitmentPayoutPlan(id, entries, hash);
    }

    function _prepare(uint256 id) internal returns (uint256 planId, uint256 childId) {
        planId = _plan(id);
        vm.startPrank(BUYER_STEWARD);
        settlement.finalizeCommitmentPayoutPlan(planId);
        childId = settlement.prepareContributorPayout(planId, CREATOR);
        vm.stopPrank();
    }

    function _funded(uint256 id, uint256 received) internal returns (uint256 fundingId) {
        _request(id, 1);
        fundingId = _pledge(id);
        _recordDeposit(fundingId, received);
        _accept(id);
        _consume(fundingId);
    }

    function _deliverCommand() internal {
        vm.chainId(CELO_CHAIN_ID);
        celoRouter.deliver(
            address(executor), sourceRouter.lastMessageId(), ARBITRUM_SELECTOR, address(settlement), sourceRouter.lastData()
        );
        vm.chainId(42_161);
    }

    function _deliverResult() internal {
        sourceRouter.deliver(
            address(settlement), keccak256(celoRouter.lastData()), CELO_SELECTOR, address(executor), celoRouter.lastData()
        );
    }

    function _ack(uint256 childId, bool success, Settlement.FailureCode failure) internal {
        Settlement.Disbursement memory child = settlement.getDisbursement(childId);
        sourceRouter.deliver(
            address(settlement),
            keccak256(abi.encode(child.executionKey, success)),
            CELO_SELECTOR,
            address(executor),
            SettlementMessageCodec.encodeAcknowledgment(
                1, child.executionKey, child.commandMessageId, success, uint8(failure)
            )
        );
    }
}
