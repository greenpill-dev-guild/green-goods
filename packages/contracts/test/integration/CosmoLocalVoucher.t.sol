// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { ICeloSettlementExecutor } from "../../src/interfaces/ICeloSettlementExecutor.sol";
import { SettlementModule } from "../../src/modules/SettlementModule.sol";
import { CeloSettlementExecutor } from "../../src/modules/CeloSettlementExecutor.sol";
import { ICommitmentVoucherAcceptance as VoucherAcceptance } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";
import { VoucherEntitlementModule } from "../../src/modules/VoucherEntitlementModule.sol";
import { GnosisVoucherAdapter } from "../../src/modules/GnosisVoucherAdapter.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";
import { AsynchronousSettlementRouter } from "./CCIPSettlement.t.sol";
import { ExecutorMockGoodDollar, ExecutorMockRoles, ExecutorMockSafe } from "../unit/CeloSettlementExecutor.t.sol";

/// @notice Real source core, GardenAccount execution, voucher endpoints and G$ settlement compose
///         across asynchronous messages. Transport, Hats, ERC-20 inventory, G$, Safe and Zodiac
///         are explicit local stand-ins. Chain IDs are switched in one EVM; this is not DON,
///         live Safe, CLC bytecode or member-passkey proof. The GardenAccount is on Arbitrum.
contract CosmoLocalVoucherTest is CommitmentPoolingFixture, ERC6551Helper {
    uint64 private constant ARBITRUM_CHAIN = 42_161;
    uint64 private constant GNOSIS_CHAIN = 100;
    uint64 private constant CELO_CHAIN = 42_220;
    uint64 private constant ARBITRUM_SELECTOR = 4_949_039_107_694_359_620;
    uint64 private constant GNOSIS_SELECTOR = 465_200_170_687_744_372;
    uint64 private constant CELO_SELECTOR = 1_346_049_177_634_351_622;
    address private constant LOCAL_GARDEN_SAFE = address(0x5AFE);
    address private constant LOCAL_ISSUER_SAFE = address(0x15AFE);
    address private constant ISSUER_AUTHORITY = address(0x1551);
    address private constant PAUSE_GUARDIAN = address(0x1552);
    bytes32 private constant ROLE_KEY = keccak256("fictional-role");
    bytes32 private constant ALLOWANCE_KEY = keccak256("fictional-allowance");
    uint256 private constant G_DOLLAR_REWARD = 100 ether;
    uint256 private constant VOUCHER_REWARD = 19;

    struct TransportMessage {
        bytes32 id;
        bytes data;
    }

    struct PaymentProof {
        uint256 planId;
        uint256 disbursementId;
        bytes32 receiptHash;
        TransportMessage command;
    }

    uint256 private protocolPoolId;
    GardenAccount private providerGarden;
    VoucherEntitlementModule private vouchers;
    GnosisVoucherAdapter private adapter;
    AsynchronousSettlementRouter private arbitrumRouter;
    AsynchronousSettlementRouter private gnosisRouter;
    AsynchronousSettlementRouter private celoRouter;
    MockERC20 private voucherToken;
    ExecutorMockGoodDollar private gDollar;
    ExecutorMockSafe private payerSafe;
    ExecutorMockSafe private beneficiarySafe;
    ExecutorMockRoles private payerRoles;
    ExecutorMockRoles private beneficiaryRoles;
    ISettlementModule private settlement;
    ICeloSettlementExecutor private executor;

    function setUp() public {
        vm.chainId(ARBITRUM_CHAIN);
        _setUpProductionFixture();
        _deployERC6551Registry();
        hats.setOwner(ROOT_GARDEN, address(this), true);
        hats.setGardener(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        _deployGardenAccount();
        protocolPoolId = module.registerPool(ROOT_GARDEN, ICommitmentPoolingModule.PoolType.Protocol);
        _openPool(protocolPoolId);
        uint256 providerPool = module.registerPool(address(providerGarden), ICommitmentPoolingModule.PoolType.Garden);
        _openPool(providerPool);
        hats.setOperator(address(providerGarden), CLAIMANT, true);
        arbitrumRouter = new AsynchronousSettlementRouter();
        gnosisRouter = new AsynchronousSettlementRouter();
        celoRouter = new AsynchronousSettlementRouter();
        _deployVoucherEndpoints();
        _deploySettlementRail();
    }

    function testIntegration_CosmoLocalVoucher_failureRecoveryAndLostAckNeverRepeatCompletedGdollar() public {
        uint256 id = _createRequest(keccak256("fictional-joint-reward"));
        _gardenConsent(id);
        _fulfillRequest(id);
        assertEq(module.getCommitment(id).counterparty, address(providerGarden));
        assertEq(module.getCommitment(id).leadProvider, CLAIMANT);
        assertEq(vouchers.consentRevision(id, address(providerGarden)), 1);
        PaymentProof memory payment = _completePayment(id);
        _assertPaymentUnchanged(payment);

        bytes32 entitlement = _prepareVoucher(id);
        TransportMessage memory command = _dispatchVoucher(entitlement);
        vm.chainId(GNOSIS_CHAIN);
        _deliverVoucherCommand(command);
        assertFalse(adapter.getExecutionResult(entitlement).success);
        assertEq(adapter.getExecutionResult(entitlement).sequence, 1);
        assertGt(adapter.failureReason(entitlement).length, 0);
        assertEq(voucherToken.balanceOf(CLAIMANT), 0);
        _relayVoucherAck();
        assertEq(uint8(vouchers.getDistribution(entitlement).state), uint8(VoucherEntitlementModule.DeliveryState.Failed));
        _assertPaymentUnchanged(payment);

        // Transport retry keeps the same authorization; duplicate intake does not spend it.
        TransportMessage memory retryCommand = _dispatchVoucher(entitlement);
        assertEq(retryCommand.data, command.data);
        vm.chainId(GNOSIS_CHAIN);
        _deliverVoucherCommand(retryCommand);
        assertEq(adapter.getExecutionResult(entitlement).sequence, 1);
        vm.startPrank(LOCAL_ISSUER_SAFE);
        voucherToken.approve(address(adapter), VOUCHER_REWARD);
        adapter.safeRetry(entitlement);
        vm.stopPrank();
        assertTrue(adapter.getExecutionResult(entitlement).success);
        assertEq(adapter.getExecutionResult(entitlement).sequence, 2);
        assertEq(voucherToken.balanceOf(CLAIMANT), VOUCHER_REWARD);
        assertEq(voucherToken.allowance(LOCAL_ISSUER_SAFE, address(adapter)), 0);
        _assertPaymentUnchanged(payment);

        // The successful destination result exists without any fresh return delivery.
        vm.chainId(ARBITRUM_CHAIN);
        vm.warp(block.timestamp + 7 days);
        assertEq(uint8(vouchers.getDistribution(entitlement).state), uint8(VoucherEntitlementModule.DeliveryState.Pending));
        assertEq(vouchers.getCommand(entitlement), command.data);
        vm.chainId(GNOSIS_CHAIN);
        adapter.retryAcknowledgment(entitlement); // caller-funded; local transport quote is zero
        _relayVoucherAck();
        assertEq(
            uint8(vouchers.getDistribution(entitlement).state), uint8(VoucherEntitlementModule.DeliveryState.Delivered)
        );

        vm.chainId(GNOSIS_CHAIN);
        _deliverVoucherCommand(command);
        _deliverVoucherCommand(retryCommand);
        assertEq(adapter.getExecutionResult(entitlement).sequence, 2);
        assertEq(voucherToken.balanceOf(CLAIMANT), VOUCHER_REWARD);
        vm.chainId(CELO_CHAIN);
        celoRouter.deliver(
            address(executor), payment.command.id, ARBITRUM_SELECTOR, address(settlement), payment.command.data
        );
        _assertPaymentUnchanged(payment);
        vm.chainId(ARBITRUM_CHAIN);
        assertEq(uint8(module.getCommitment(id).state), uint8(ICommitmentPoolingModule.CommitmentState.Fulfilled));
    }

    function testIntegration_CosmoLocalVoucher_requestedByPersonalConsentCannotReplaceGardenAccountConsent() public {
        uint256 id = _createRequest(keccak256("fictional-personal-is-not-garden"));
        vm.prank(CLAIMANT);
        vouchers.consentTerms(id, 1);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        vm.prank(CLAIMANT);
        module.claimCommitment(id, ICommitmentPoolingModule.ClaimType.Garden, address(providerGarden));
        assertEq(uint256(module.getCommitment(id).state), uint256(ICommitmentPoolingModule.CommitmentState.Requested));
        assertEq(vouchers.consentRevision(id, CLAIMANT), 1);
        assertEq(vouchers.consentRevision(id, address(providerGarden)), 0);
        _gardenConsent(id);
        _fulfillRequest(id);
        assertEq(
            VoucherAcceptance(address(module)).getEarnedVoucherBinding(id).acceptedCounterparty, address(providerGarden)
        );
    }

    function testIntegration_CosmoLocalVoucher_gardenHatAloneCannotExecuteTheActualGardenAccount() public {
        uint256 id = _createRequest(keccak256("fictional-account-authority"));
        bytes memory consent = abi.encodeCall(VoucherEntitlementModule.consentTerms, (id, uint64(1)));
        vm.expectRevert();
        vm.prank(CLAIMANT); // real core steward eligibility is distinct from account execution authority
        providerGarden.execute(address(vouchers), 0, consent, 0);
        assertEq(vouchers.consentRevision(id, address(providerGarden)), 0);
        _gardenConsent(id);
        assertEq(vouchers.consentRevision(id, address(providerGarden)), 1);
    }

    function testIntegration_CosmoLocalVoucher_acceptedGardenConsentCannotBeRewrittenAfterFulfillment() public {
        uint256 id = _createRequest(keccak256("fictional-late-account-consent"));
        _gardenConsent(id);
        _fulfillRequest(id);
        bytes memory consent = abi.encodeCall(VoucherEntitlementModule.consentTerms, (id, uint64(1)));
        vm.expectRevert(VoucherEntitlementModule.TermsNotPreAcceptance.selector);
        vm.prank(LOCAL_GARDEN_SAFE);
        providerGarden.execute(address(vouchers), 0, consent, 0);
        assertEq(vouchers.distributionOfCommitment(id), bytes32(0));
    }

    function _deployGardenAccount() private {
        GardenAccount implementation = new GardenAccount(
            address(0x001), address(0x002), address(0x003), address(0x004), address(0x2001), address(0x2002)
        );
        GardenToken tokenImplementation = new GardenToken(address(implementation));
        GardenToken gardenToken = GardenToken(
            address(
                new ERC1967Proxy(
                    address(tokenImplementation), abi.encodeCall(GardenToken.initialize, (LOCAL_GARDEN_SAFE, address(0)))
                )
            )
        );
        MockERC20 communityToken = new MockERC20();
        vm.startPrank(LOCAL_GARDEN_SAFE);
        gardenToken.setHatsModule(address(hats));
        gardenToken.setCommunityToken(address(communityToken));
        GardenToken.GardenConfig memory config;
        config.name = "Fictional rehearsal garden";
        config.description = "Local account integration fixture";
        config.location = "Fictional";
        config.weightScheme = IGardensModule.WeightScheme.Linear;
        config.gardeners = new address[](0);
        config.stewards = new address[](0);
        providerGarden = GardenAccount(payable(gardenToken.mintGarden(config)));
        vm.stopPrank();
        assertEq(providerGarden.owner(), LOCAL_GARDEN_SAFE);
    }

    function _deployVoucherEndpoints() private {
        VoucherEntitlementModule implementation = new VoucherEntitlementModule(address(arbitrumRouter));
        // Test-only circular peer assembly; no live deployment procedure is asserted.
        vouchers = VoucherEntitlementModule(payable(address(new ERC1967Proxy(address(implementation), ""))));
        vm.chainId(GNOSIS_CHAIN);
        voucherToken = new MockERC20();
        GnosisVoucherAdapter adapterImplementation = new GnosisVoucherAdapter(address(gnosisRouter));
        adapter = GnosisVoucherAdapter(
            payable(address(
                    new ERC1967Proxy(
                        address(adapterImplementation),
                        abi.encodeCall(
                            GnosisVoucherAdapter.initialize,
                            (address(this), PAUSE_GUARDIAN, ARBITRUM_SELECTOR, uint256(ARBITRUM_CHAIN), address(vouchers))
                        )
                    )
                ))
        );
        voucherToken.mint(LOCAL_ISSUER_SAFE, 1000);
        vm.prank(LOCAL_ISSUER_SAFE);
        adapter.configureAsset(address(voucherToken), ISSUER_AUTHORITY, true);
        adapter.unpause();
        vm.chainId(ARBITRUM_CHAIN);
        vouchers.initialize(
            address(this), PAUSE_GUARDIAN, GNOSIS_SELECTOR, GNOSIS_CHAIN, address(adapter), address(module), address(hats)
        );
        module.setPaused(true);
        VoucherAcceptance(address(module)).pinEarnedVoucherModule(address(vouchers));
        module.setPaused(false);
        vouchers.setIssuerAuthority(LOCAL_ISSUER_SAFE, address(voucherToken), ISSUER_AUTHORITY);
        vouchers.unpause();
    }

    function _deploySettlementRail() private {
        gDollar = new ExecutorMockGoodDollar();
        payerSafe = new ExecutorMockSafe();
        beneficiarySafe = new ExecutorMockSafe();
        SettlementModule implementation = new SettlementModule(address(arbitrumRouter), ARBITRUM_SELECTOR, CELO_CHAIN);
        settlement = ISettlementModule(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        ISettlementModule.initialize,
                        (address(this), address(hats), address(module), ROOT_GARDEN, address(gDollar))
                    )
                )
            )
        );
        vm.chainId(CELO_CHAIN);
        CeloSettlementExecutor executorImplementation =
            new CeloSettlementExecutor(address(celoRouter), address(gDollar), CELO_SELECTOR, ARBITRUM_CHAIN);
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
        payerRoles = new ExecutorMockRoles(address(payerSafe), gDollar);
        beneficiaryRoles = new ExecutorMockRoles(address(beneficiarySafe), gDollar);
        payerRoles.configureMember(address(executor), ROLE_KEY);
        beneficiaryRoles.configureMember(address(executor), ROLE_KEY);
        executor.configureGardenRoute(
            ROOT_GARDEN,
            address(payerSafe),
            address(payerRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("fictional-payer-permissions")
        );
        executor.configureGardenRoute(
            address(providerGarden),
            address(beneficiarySafe),
            address(beneficiaryRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("fictional-beneficiary-permissions")
        );
        executor.setCaps(4, 1000 ether, 4000 ether);
        executor.setFeePolicy(0, 0);
        executor.setPeriodicCap(1 days, 10_000 ether);
        executor.setAcknowledgmentFeeReserveMinimum(1);
        vm.deal(address(this), 2 ether);
        executor.fundAcknowledgmentFees{ value: 1 }();
        executor.setPaused(false);
        gDollar.setBalance(address(payerSafe), 1000 ether);
        vm.chainId(ARBITRUM_CHAIN);
        settlement.registerSettlementAccount(
            ROOT_GARDEN,
            CELO_CHAIN,
            address(payerSafe),
            _owners(0x10),
            address(payerRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("fictional-payer-permissions")
        );
        settlement.registerSettlementAccount(
            address(providerGarden),
            CELO_CHAIN,
            address(beneficiarySafe),
            _owners(0x20),
            address(beneficiaryRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("fictional-beneficiary-permissions")
        );
        settlement.setCcipRoute(CELO_SELECTOR, address(executor), 1_000_000, 1, 0);
        settlement.setFeeReserveMinimum(1);
        settlement.fundFees{ value: 1 }();
        settlement.setPaused(false);
    }

    function _createRequest(bytes32 key) private returns (uint256 id) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(key);
        params.poolId = protocolPoolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        params.consideration = ICommitmentPoolingModule.DeclaredConsideration(
            ICommitmentPoolingModule.ConsiderationRail.CeloSettlement, address(0), address(0), G_DOLLAR_REWARD
        );
        vm.prank(CREATOR);
        id = module.createCommitment(params);
        vouchers.registerTerms(
            id,
            VoucherEntitlementModule.TermsInput(
                LOCAL_ISSUER_SAFE,
                ISSUER_AUTHORITY,
                address(voucherToken),
                VOUCHER_REWARD,
                vouchers.RECOGNITION_POLICY(),
                keccak256("fictional-service-terms"),
                0
            )
        );
        vm.prank(ISSUER_AUTHORITY);
        vouchers.approveTerms(id, 1);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, 1);
    }

    function _gardenConsent(uint256 id) private {
        vm.prank(LOCAL_GARDEN_SAFE);
        providerGarden.execute(
            address(vouchers), 0, abi.encodeCall(VoucherEntitlementModule.consentTerms, (id, uint64(1))), 0
        );
    }

    function _fulfillRequest(uint256 id) private {
        vm.prank(CLAIMANT);
        module.claimCommitment(id, ICommitmentPoolingModule.ClaimType.Garden, address(providerGarden));
        address[] memory credited = new address[](1);
        credited[0] = CLAIMANT;
        vm.prank(CLAIMANT);
        module.attachEvidence(id, "fictional-joint-evidence", credited);
        module.markReadyForConfirmation(id, "fictional service ready");
        vm.prank(CREATOR);
        module.confirmFulfillment(id);
    }

    function _completePayment(uint256 id) private returns (PaymentProof memory proof) {
        proof.planId = settlement.createCommitmentPayoutPlan(id, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(proof.planId);
        proof.disbursementId = settlement.prepareGardenBeneficiaryPayout(proof.planId);
        settlement.dispatchDisbursement(proof.disbursementId);
        proof.command = TransportMessage(arbitrumRouter.lastMessageId(), arbitrumRouter.lastData());
        vm.chainId(CELO_CHAIN);
        celoRouter.deliver(address(executor), proof.command.id, ARBITRUM_SELECTOR, address(settlement), proof.command.data);
        vm.chainId(ARBITRUM_CHAIN);
        arbitrumRouter.deliver(
            address(settlement), celoRouter.lastMessageId(), CELO_SELECTOR, address(executor), celoRouter.lastData()
        );
        proof.receiptHash = keccak256(abi.encode(settlement.getDisbursement(proof.disbursementId)));
    }

    function _assertPaymentUnchanged(PaymentProof memory proof) private {
        vm.chainId(ARBITRUM_CHAIN);
        assertEq(
            uint8(settlement.getDisbursement(proof.disbursementId).state),
            uint8(ISettlementModule.DisbursementState.Confirmed)
        );
        assertEq(uint8(settlement.payoutPlanStatus(proof.planId)), uint8(ISettlementModule.PayoutPlanStatus.Complete));
        assertEq(keccak256(abi.encode(settlement.getDisbursement(proof.disbursementId))), proof.receiptHash);
        vm.chainId(CELO_CHAIN);
        assertEq(gDollar.balanceOf(address(payerSafe)), 1000 ether - G_DOLLAR_REWARD);
        assertEq(gDollar.balanceOf(address(beneficiarySafe)), G_DOLLAR_REWARD);
        vm.chainId(ARBITRUM_CHAIN);
    }

    function _prepareVoucher(uint256 id) private returns (bytes32) {
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _recognition();
        return vouchers.prepareDistribution(id, entries, keccak256(abi.encode(block.chainid, id, entries)));
    }

    function _recognition() private pure returns (ICommitmentPoolingModule.RecognitionEntry[] memory entries) {
        entries = new ICommitmentPoolingModule.RecognitionEntry[](1);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry(CLAIMANT, 10_000);
    }

    function _dispatchVoucher(bytes32 entitlement) private returns (TransportMessage memory) {
        vm.chainId(ARBITRUM_CHAIN);
        vouchers.dispatch(entitlement);
        return TransportMessage(arbitrumRouter.lastMessageId(), arbitrumRouter.lastData());
    }

    function _deliverVoucherCommand(TransportMessage memory command) private {
        gnosisRouter.deliver(address(adapter), command.id, ARBITRUM_SELECTOR, address(vouchers), command.data);
    }

    function _relayVoucherAck() private {
        vm.chainId(ARBITRUM_CHAIN);
        arbitrumRouter.deliver(
            address(vouchers), gnosisRouter.lastMessageId(), GNOSIS_SELECTOR, address(adapter), gnosisRouter.lastData()
        );
    }

    function _openPool(uint256 id) private {
        module.setProviderOpenCommitmentCap(id, 128);
        module.setPoolCharter(id, "fictional-charter");
        module.markPoolReady(id);
        module.openPool(id);
    }

    function _owners(uint160 base) private pure returns (address[3] memory owners) {
        owners[0] = address(base + 1);
        owners[1] = address(base + 2);
        owners[2] = address(base + 3);
    }
}
