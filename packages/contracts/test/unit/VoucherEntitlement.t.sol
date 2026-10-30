// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { stdStorage, StdStorage } from "forge-std/StdStorage.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentVoucherAcceptance as VoucherAcceptance } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { VoucherEntitlementModule } from "../../src/modules/VoucherEntitlementModule.sol";
import { VoucherMessageCodec } from "../../src/libraries/VoucherMessageCodec.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @dev Mocked transport only. Commitment states, recognition validation and amounts use the real core.
contract VoucherSourceRouterMock {
    bytes public lastData;
    uint256 public nonce;
    uint256 public fee = 1;
    bool public failSend;

    function setFee(uint256 value) external {
        fee = value;
    }

    function setFailSend(bool value) external {
        failSend = value;
    }

    function getFee(uint64, Client.EVM2AnyMessage memory) external view returns (uint256) {
        return fee;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage memory message) external payable returns (bytes32) {
        assert(msg.value == fee && message.tokenAmounts.length == 0 && message.feeToken == address(0));
        require(!failSend, "router send failed");
        lastData = message.data;
        return keccak256(abi.encode(++nonce, message.data));
    }
}

/// @dev Owner, guardian, issuer and router are fictional local stand-ins, never live signer proof.
contract VoucherEntitlementTest is CommitmentPoolingFixture {
    using stdStorage for StdStorage;
    VoucherEntitlementModule private vouchers;
    VoucherSourceRouterMock private router;
    address private constant ISSUER = address(0x1550);
    address private constant AUTHORITY = address(0x1551);
    address private constant GUARDIAN = address(0x1552);
    address private constant PEER = address(0x1553);
    address private constant STEWARD = address(0x1554);
    address private constant SECOND = address(0xB001);
    address private constant THIRD = address(0xB002);
    address private constant TOKEN = address(0x701);
    uint64 private constant PEER_SELECTOR = 100;

    function setUp() public {
        _setUpProductionFixture();
        hats.setOperator(POOL_GARDEN, STEWARD, true);
        _setMember(SECOND);
        _setMember(THIRD);
        router = new VoucherSourceRouterMock();
        VoucherEntitlementModule implementation = new VoucherEntitlementModule(address(router));
        vouchers = VoucherEntitlementModule(
            payable(address(
                    new ERC1967Proxy(
                        address(implementation),
                        abi.encodeCall(
                            VoucherEntitlementModule.initialize,
                            (address(this), GUARDIAN, PEER_SELECTOR, uint256(100), PEER, address(module), address(hats))
                        )
                    )
                ))
        );
        module.setPaused(true);
        VoucherAcceptance(address(module)).pinEarnedVoucherModule(address(vouchers));
        module.setPaused(false);
        vouchers.setIssuerAuthority(ISSUER, TOKEN, AUTHORITY);
        vouchers.setFeeReserveMinimum(1);
        vm.deal(address(vouchers), 1);
        vouchers.unpause();
        vm.deal(STEWARD, 10 ether);
    }

    function testVoucherEntitlement_revertsWhenProtocolOwnerIsNotGardenSteward() public {
        uint256 id = _createOffer(keccak256("voucher-owner-isolation"));
        VoucherEntitlementModule.TermsInput memory input = _terms(100);
        vm.expectRevert(VoucherEntitlementModule.NotVoucherSteward.selector);
        vouchers.registerTerms(id, input);
    }

    function testVoucherEntitlement_rejectsGardenForgedIssuerAuthorityAndDifferentAsset() public {
        uint256 id = _createOffer(keccak256("voucher-issuer-isolation"));
        VoucherEntitlementModule.TermsInput memory input = _terms(100);
        input.issuerAuthority = STEWARD;
        vm.expectRevert(VoucherEntitlementModule.InvalidVoucherTerms.selector);
        vm.prank(STEWARD);
        vouchers.registerTerms(id, input);
        input = _terms(100);
        input.token = address(0xBAD);
        vm.expectRevert(VoucherEntitlementModule.InvalidVoucherTerms.selector);
        vm.prank(STEWARD);
        vouchers.registerTerms(id, input);
        input = _terms(100);
        input.issuer = address(0x1555);
        vm.expectRevert(VoucherEntitlementModule.InvalidVoucherTerms.selector);
        vm.prank(STEWARD);
        vouchers.registerTerms(id, input);
        input = _terms(type(uint256).max); // No finite ERC-20 allowance can authorize this amount.
        vm.expectRevert(VoucherEntitlementModule.InvalidVoucherTerms.selector);
        vm.prank(STEWARD);
        vouchers.registerTerms(id, input);
    }

    function testVoucherEntitlement_requiresIssuerAndCreatorBeforeCandidateConsent() public {
        uint256 id = _createOffer(keccak256("voucher-freeze-order"));
        _register(id, 100);
        vm.expectRevert(VoucherEntitlementModule.IssuerApprovalRequired.selector);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, 1);
        vm.expectRevert(VoucherEntitlementModule.NotIssuerAuthority.selector);
        vm.prank(STEWARD);
        vouchers.approveTerms(id, 1);
        vm.prank(AUTHORITY);
        vouchers.approveTerms(id, 1);
        vm.expectRevert(VoucherEntitlementModule.CreatorMustFreezeTerms.selector);
        vm.prank(CLAIMANT);
        vouchers.consentTerms(id, 1);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, 1);
        assertTrue(vouchers.getTerms(id).frozen);
    }

    function testVoucherEntitlement_updateThenStaleConsentCannotCreateEntitlement() public {
        uint256 id = _createOffer(keccak256("voucher-stale-revision"));
        _register(id, 100);
        vm.prank(AUTHORITY);
        vouchers.approveTerms(id, 1);
        _register(id, 200);
        vm.expectRevert(VoucherEntitlementModule.WrongTermsRevision.selector);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, 1);
        vm.expectRevert(VoucherEntitlementModule.IssuerApprovalRequired.selector);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, 2);
        _consent(id, 2);
        _acceptOffer(id);
        _fulfill(id, false);
        bytes32 entitlement = _prepare(id, _soloEntries());
        VoucherMessageCodec.Command memory command = VoucherMessageCodec.decodeCommand(vouchers.getCommand(entitlement));
        assertEq(command.totalUnits, 200);
        assertEq(command.revision, 2);
    }

    function testVoucherEntitlement_consentThenUpdateRejectedBeforeEitherAcceptancePath() public {
        uint256 id = _createOffer(keccak256("voucher-frozen-open"));
        _register(id, 100);
        _consent(id, 1);
        VoucherEntitlementModule.TermsInput memory input = _terms(200);
        vm.expectRevert(VoucherEntitlementModule.TermsFrozen.selector);
        vm.prank(STEWARD);
        vouchers.registerTerms(id, input);
        _acceptOffer(id);
        vm.expectRevert(VoucherEntitlementModule.TermsNotPreAcceptance.selector);
        vm.prank(CLAIMANT);
        vouchers.consentTerms(id, 1);

        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("voucher-frozen-gated"));
        params.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        uint256 gatedId = module.createCommitment(params);
        _register(gatedId, 300);
        _consent(gatedId, 1);
        vm.prank(CLAIMANT);
        module.claimCommitment(gatedId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        vm.expectRevert(VoucherEntitlementModule.TermsFrozen.selector);
        vm.prank(STEWARD);
        vouchers.registerTerms(gatedId, input);
        module.acceptClaim(gatedId, CLAIMANT);
        assertEq(vouchers.getTerms(gatedId).agreed.totalUnits, 300);
        assertEq(vouchers.consentRevision(gatedId, CLAIMANT), 1);
    }

    function testVoucherEntitlement_directCoreAcceptanceRejectsMissingCounterpartyConsent() public {
        uint256 id = _createOffer(keccak256("voucher-missing-consent"));
        _register(id, 100);
        vm.prank(AUTHORITY);
        vouchers.approveTerms(id, 1);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, 1);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        _acceptOffer(id);
        assertEq(uint256(module.getCommitment(id).state), uint256(ICommitmentPoolingModule.CommitmentState.Offered));
    }

    function testVoucherEntitlement_gatedAcceptanceWaitsForActualCandidateConsent() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("gated-earned-consent"));
        params.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        _register(id, 100);
        vm.prank(AUTHORITY);
        vouchers.approveTerms(id, 1);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, 1);
        vm.prank(CLAIMANT);
        module.claimCommitment(id, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        module.acceptClaim(id, CLAIMANT);
        assertTrue(module.getPendingClaim(id, CLAIMANT).active);
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(id).acceptedRevision, 0);
        vm.prank(CLAIMANT);
        vouchers.consentTerms(id, 1);
        module.acceptClaim(id, CLAIMANT);
        VoucherAcceptance.EarnedVoucherBinding memory binding =
            VoucherAcceptance(address(module)).getEarnedVoucherBinding(id);
        assertEq(binding.acceptedRevision, 1);
        assertEq(binding.acceptedTermsHash, vouchers.getTerms(id).termsHash);
        assertEq(binding.acceptedCounterparty, CLAIMANT);
    }

    function testVoucherEntitlement_termsUpdateDuringPendingClaimRequiresLatestExactConsent() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("pending-earned-race"));
        params.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        _register(id, 100);
        vm.prank(CLAIMANT);
        module.claimCommitment(id, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        _register(id, 200);
        vm.prank(AUTHORITY);
        vouchers.approveTerms(id, 2);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, 2);
        vm.expectRevert(VoucherEntitlementModule.WrongTermsRevision.selector);
        vm.prank(CLAIMANT);
        vouchers.consentTerms(id, 1);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        module.acceptClaim(id, CLAIMANT);
        vm.prank(CLAIMANT);
        vouchers.consentTerms(id, 2);
        module.acceptClaim(id, CLAIMANT);
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(id).acceptedRevision, 2);
    }

    function testVoucherEntitlement_guardAuthenticatesCoreAndEveryExpectedFact() public {
        uint256 id = _createConsentedOffer(keccak256("guard-view-exact-facts"), 100);
        bytes32 termsHash = vouchers.getTerms(id).termsHash;
        vm.expectRevert(VoucherEntitlementModule.NotCommitmentPooling.selector);
        vouchers.validateEarnedVoucherAcceptance(id, 1, termsHash, CREATOR, CLAIMANT);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        vm.prank(address(module));
        vouchers.validateEarnedVoucherAcceptance(id, 2, termsHash, CREATOR, CLAIMANT);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        vm.prank(address(module));
        vouchers.validateEarnedVoucherAcceptance(id, 1, keccak256("different terms"), CREATOR, CLAIMANT);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        vm.prank(address(module));
        vouchers.validateEarnedVoucherAcceptance(id, 1, termsHash, CREATOR, SECOND);
    }

    function testVoucherEntitlement_pauseOrMissingIssuerApprovalCannotBeBypassedByCoreOwner() public {
        uint256 id = _createOffer(keccak256("guard-issuer-and-pause"));
        _register(id, 100);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        _acceptOffer(id);
        _consent(id, 1);
        vouchers.pause();
        vm.expectRevert(VoucherEndpoint.VoucherPaused.selector);
        _acceptOffer(id);
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(id).acceptedRevision, 0);
        vouchers.unpause();
        _acceptOffer(id);
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(id).acceptedRevision, 1);
    }

    function testVoucherEntitlement_unpinnedRegistrationRollsBackSourceRevisionAndCoreBinding() public {
        uint256 id = _createOffer(keccak256("atomic-binding-authority"));
        VoucherEntitlementModule implementation = new VoucherEntitlementModule(address(router));
        VoucherEntitlementModule unpinned = VoucherEntitlementModule(
            payable(address(
                    new ERC1967Proxy(
                        address(implementation),
                        abi.encodeCall(
                            VoucherEntitlementModule.initialize,
                            (address(this), GUARDIAN, PEER_SELECTOR, uint256(100), PEER, address(module), address(hats))
                        )
                    )
                ))
        );
        unpinned.setIssuerAuthority(ISSUER, TOKEN, AUTHORITY);
        unpinned.unpause();
        VoucherEntitlementModule.TermsInput memory input = _terms(100);
        vm.expectRevert(VoucherAcceptance.UnregisteredEarnedVoucherModule.selector);
        vm.prank(STEWARD);
        unpinned.registerTerms(id, input);
        assertEq(unpinned.getTerms(id).revision, 0);
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(id).revision, 0);
        _register(id, 100);
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(id).module, address(vouchers));
    }

    function testVoucherEntitlement_exchangeRequiresEachCreatorsExplicitCounterpartyConsent() public {
        uint256 a = _createOffer(keccak256("earned-exchange-a"));
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("earned-exchange-b"));
        params.counterCommitmentId = a;
        vm.prank(CLAIMANT);
        uint256 b = module.createCommitment(params);
        _register(a, 100);
        _register(b, 200);
        vm.startPrank(AUTHORITY);
        vouchers.approveTerms(a, 1);
        vouchers.approveTerms(b, 1);
        vm.stopPrank();
        vm.prank(CREATOR);
        vouchers.consentTerms(a, 1);
        vm.prank(CLAIMANT);
        vouchers.consentTerms(b, 1);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        vm.prank(CREATOR);
        module.acceptExchange(b);
        vm.prank(CLAIMANT);
        vouchers.consentTerms(a, 1);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        vm.prank(CREATOR);
        module.acceptExchange(b);
        assertEq(uint256(module.getCommitment(a).state), uint256(ICommitmentPoolingModule.CommitmentState.Offered));
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(a).acceptedRevision, 0);
        vm.prank(CREATOR);
        vouchers.consentTerms(b, 1);
        vm.prank(CREATOR);
        module.acceptExchange(b);
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(a).acceptedCounterparty, CLAIMANT);
        assertEq(VoucherAcceptance(address(module)).getEarnedVoucherBinding(b).acceptedCounterparty, CREATOR);
    }

    function testVoucherEntitlement_legacyAcceptanceStillGainsNoImplicitVoucherEntitlement() public {
        uint256 legacy = _createOffer(keccak256("voucher-legacy"));
        _acceptOffer(legacy);
        _fulfill(legacy, false);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _soloEntries();
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        vm.prank(STEWARD);
        vouchers.prepareDistribution(legacy, entries, _hash(legacy, entries));
        VoucherEntitlementModule.TermsInput memory input = _terms(100);
        vm.expectRevert(VoucherEntitlementModule.TermsNotPreAcceptance.selector);
        vm.prank(STEWARD);
        vouchers.registerTerms(legacy, input);
    }

    function testVoucherEntitlement_storesApprovedAuthorityDespiteFutureRegistryChange() public {
        uint256 id = _createOffer(keccak256("voucher-authority-snapshot"));
        _register(id, 100);
        _consent(id, 1);
        vouchers.pause();
        vouchers.setIssuerAuthority(ISSUER, TOKEN, address(0xBAAD));
        vouchers.unpause();
        _acceptOffer(id);
        _fulfill(id, false);
        bytes32 entitlement = _prepare(id, _soloEntries());
        VoucherMessageCodec.Command memory command = VoucherMessageCodec.decodeCommand(vouchers.getCommand(entitlement));
        assertEq(command.issuerAuthority, AUTHORITY);
        assertEq(command.issuer, ISSUER);
    }

    function testVoucherEntitlement_realRecognitionConservesTinyAndMaximumTotals() public {
        uint256 id = _createConsentedOffer(keccak256("voucher-rounding"), 2);
        _acceptOffer(id);
        _fulfill(id, true);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _threeEntries();
        bytes32 entitlement = _prepare(id, entries);
        VoucherMessageCodec.Command memory command = VoucherMessageCodec.decodeCommand(vouchers.getCommand(entitlement));
        assertEq(command.amounts[0], 1);
        assertEq(command.amounts[1], 1);
        assertEq(command.amounts[2], 0);
        assertEq(command.recipients.length, 3);
        assertEq(command.totalUnits, command.amounts[0] + command.amounts[1] + command.amounts[2]);
        assertEq(command.recognitionHash, _hash(id, entries));
        assertEq(command.destinationChainId, 100);
        assertEq(command.destinationAdapter, PEER);
        assertEq(command.sourceModule, address(vouchers));
        assertEq(command.sourceChainId, block.chainid);
        assertEq(entitlement, VoucherMessageCodec.entitlementId(command));
        uint256 maxId = _createConsentedOffer(keccak256("voucher-max-rounding"), type(uint256).max - 1);
        _acceptOffer(maxId);
        _fulfill(maxId, true);
        command = VoucherMessageCodec.decodeCommand(vouchers.getCommand(_prepare(maxId, entries)));
        assertEq(command.amounts[0] + command.amounts[1] + command.amounts[2], type(uint256).max - 1);
    }

    function testFuzz_VoucherEntitlement_exactConservationFromRealCanonicalWeights(uint128 total) public {
        total = uint128(bound(total, 1, type(uint128).max));
        uint256 id = _createConsentedOffer(keccak256("voucher-conservation-fuzz"), total);
        _acceptOffer(id);
        _fulfill(id, true);
        VoucherMessageCodec.Command memory command =
            VoucherMessageCodec.decodeCommand(vouchers.getCommand(_prepare(id, _threeEntries())));
        assertEq(command.amounts[0] + command.amounts[1] + command.amounts[2], total);
        assertGe(command.amounts[0], command.amounts[1]);
        assertGe(command.amounts[1], command.amounts[2]);
    }

    function testVoucherEntitlement_realRecognitionRejectsOmittedUnsortedOrAlteredWeights() public {
        uint256 id = _createConsentedOffer(keccak256("voucher-recognition-authority"), 10_000);
        _acceptOffer(id);
        _fulfill(id, true);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _threeEntries();
        entries[0].recognitionWeightBps = 3333;
        entries[2].recognitionWeightBps = 3333;
        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        vm.prank(STEWARD);
        vouchers.prepareDistribution(id, entries, _hash(id, entries));
        entries = _soloEntries();
        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        vm.prank(STEWARD);
        vouchers.prepareDistribution(id, entries, _hash(id, entries));
        entries = _threeEntries();
        (entries[0], entries[1]) = (entries[1], entries[0]);
        vm.expectRevert(ICommitmentPoolingModule.InvalidAllocation.selector);
        vm.prank(STEWARD);
        vouchers.prepareDistribution(id, entries, _hash(id, entries));
        assertEq(vouchers.distributionOfCommitment(id), bytes32(0));
    }

    function testVoucherEntitlement_disputeFulfilledQualifiesWithoutPersonalConfirmationClaim() public {
        uint256 id = _createConsentedOffer(keccak256("voucher-dispute-fulfilled"), 100);
        _acceptOffer(id);
        _ready(id, false);
        vm.prank(CREATOR);
        module.raiseDispute(id, "fictional dispute");
        module.resolveDispute(id, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "fictional resolution");
        _prepare(id, _soloEntries());
        assertEq(module.getCommitment(id).confirmationCount, 0);
    }

    function testVoucherEntitlement_poolFallbackFulfilledQualifies() public {
        module.registerPool(ROOT_GARDEN, ICommitmentPoolingModule.PoolType.Protocol);
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("voucher-fallback-fulfilled"));
        params.protocolFallbackEnabled = true;
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        _register(id, 100);
        _consent(id, 1);
        _acceptOffer(id);
        vm.prank(CREATOR);
        module.addContributor(id, CLAIMANT);
        _ready(id, false);
        vm.prank(STEWARD);
        module.confirmFulfillmentAsFallback(id, "ordinary confirmer joined provider roster");
        _prepare(id, _soloEntries());
        assertEq(uint256(module.getCommitment(id).state), uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled));
    }

    function testVoucherEntitlement_preparationWaitsForFulfilledAndCannotReplacePayload() public {
        uint256 id = _createConsentedOffer(keccak256("voucher-frozen-command"), 100);
        _acceptOffer(id);
        ICommitmentPoolingModule.RecognitionEntry[] memory entries = _soloEntries();
        vm.expectRevert(VoucherEntitlementModule.CommitmentNotFulfilled.selector);
        vm.prank(STEWARD);
        vouchers.prepareDistribution(id, entries, _hash(id, entries));
        _fulfill(id, false);
        bytes32 entitlement = _prepare(id, entries);
        bytes memory original = vouchers.getCommand(entitlement);
        vm.expectRevert(VoucherEntitlementModule.DistributionAlreadyPrepared.selector);
        vm.prank(STEWARD);
        vouchers.prepareDistribution(id, entries, _hash(id, entries));
        assertEq(vouchers.getCommand(entitlement), original);
    }

    function testVoucherEntitlement_timeoutAndTransportRetriesKeepIdentityAndExactBytes() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-timeout"));
        _dispatch(entitlement);
        bytes memory original = router.lastData();
        vm.warp(block.timestamp + 365 days);
        assertEq(
            uint256(vouchers.getDistribution(entitlement).state), uint256(VoucherEntitlementModule.DeliveryState.Pending)
        );
        _dispatch(entitlement);
        assertEq(router.lastData(), original);
        assertEq(vouchers.getCommand(entitlement), original);
        assertEq(router.nonce(), 2);
    }

    function testVoucherEntitlement_failedResultRepairAndLateSuccessRemainIndependentOfCore() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-result-recovery"));
        _dispatch(entitlement);
        _deliver(keccak256("ack-failure"), _ack(entitlement, 1, false));
        assertEq(
            uint256(vouchers.getDistribution(entitlement).state), uint256(VoucherEntitlementModule.DeliveryState.Failed)
        );
        bytes memory original = vouchers.getCommand(entitlement);
        _dispatch(entitlement);
        _deliver(keccak256("ack-repeat-observation"), _ack(entitlement, 1, false));
        assertEq(
            uint256(vouchers.getDistribution(entitlement).state), uint256(VoucherEntitlementModule.DeliveryState.Pending)
        );
        vouchers.pause(); // authenticated return reconciliation remains available during an emergency stop
        _deliver(keccak256("ack-success"), _ack(entitlement, 2, true));
        assertEq(
            uint256(vouchers.getDistribution(entitlement).state), uint256(VoucherEntitlementModule.DeliveryState.Delivered)
        );
        VoucherMessageCodec.Ack memory lateFailure = _ack(entitlement, 3, false);
        vm.expectRevert(VoucherEntitlementModule.ConflictingVoucherResult.selector);
        _deliver(keccak256("ack-later-failure"), lateFailure);
        assertEq(vouchers.getCommand(entitlement), original);
        assertEq(
            uint256(module.getCommitment(vouchers.getDistribution(entitlement).commitmentId).state),
            uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
        );
        vouchers.unpause();
        vm.expectRevert(VoucherEntitlementModule.VoucherAlreadyDelivered.selector);
        vm.prank(STEWARD);
        vouchers.dispatch(entitlement);
    }

    function testVoucherEntitlement_rejectsConflictingAcknowledgmentOrTransportReuse() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-ack-conflicts"));
        _dispatch(entitlement);
        bytes32 messageId = keccak256("same-ack-message");
        _deliver(messageId, _ack(entitlement, 1, false));
        _deliver(messageId, _ack(entitlement, 1, false));
        VoucherMessageCodec.Ack memory success = _ack(entitlement, 2, true);
        vm.expectRevert(VoucherEntitlementModule.ConflictingTransportMessage.selector);
        _deliver(messageId, success);
        success.resultSequence = 1;
        vm.expectRevert(VoucherEntitlementModule.ConflictingVoucherResult.selector);
        _deliver(keccak256("same-sequence-new-result"), success);
        VoucherMessageCodec.Ack memory ack = _ack(entitlement, 2, true);
        ack.payloadHash = keccak256("different economics");
        vm.expectRevert(VoucherEntitlementModule.ConflictingVoucherResult.selector);
        _deliver(keccak256("bad-hash"), ack);
        ack = _ack(entitlement, 2, true);
        ack.version = 2;
        vm.expectRevert(VoucherMessageCodec.UnsupportedVoucherMessage.selector);
        _deliver(keccak256("bad-version"), ack);
    }

    function testVoucherEntitlement_rejectsRouterPeerChainAndAttachedTokens() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-return-authentication"));
        _dispatch(entitlement);
        Client.Any2EVMMessage memory message = _message(keccak256("auth"), _ack(entitlement, 1, true));
        vm.expectRevert();
        vouchers.ccipReceive(message);
        message.sourceChainSelector++;
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        vm.prank(address(router));
        vouchers.ccipReceive(message);
        message.sourceChainSelector = PEER_SELECTOR;
        message.sender = abi.encode(address(0xBAAD));
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        vm.prank(address(router));
        vouchers.ccipReceive(message);
        message.sender = abi.encode(PEER);
        message.destTokenAmounts = new Client.EVMTokenAmount[](1);
        message.destTokenAmounts[0] = Client.EVMTokenAmount(TOKEN, 1);
        vm.expectRevert(VoucherEndpoint.AttachedTokensForbidden.selector);
        vm.prank(address(router));
        vouchers.ccipReceive(message);
    }

    function testVoucherEntitlement_guardianCanOnlyPauseAndOwnerUpgradesWithoutWaiting() public {
        VoucherEntitlementModule replacement = new VoucherEntitlementModule(address(router));
        vm.prank(GUARDIAN);
        vouchers.pause();
        vm.expectRevert();
        vm.prank(GUARDIAN);
        vouchers.unpause();
        vm.expectRevert();
        vm.prank(GUARDIAN);
        vouchers.scheduleUpgrade(address(replacement));
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        vouchers.upgradeTo(address(replacement));
        uint256 scheduledAt = block.timestamp;
        vouchers.scheduleUpgrade(address(replacement));
        assertEq(vouchers.upgradeAvailableAt(), scheduledAt);
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(GUARDIAN);
        vouchers.cancelUpgrade();
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(GUARDIAN);
        vouchers.upgradeTo(address(replacement));
        vouchers.upgradeTo(address(replacement));
        assertEq(block.timestamp, scheduledAt);
        assertEq(vouchers.UPGRADE_DELAY(), 0);
        assertTrue(vouchers.paused());
        assertEq(vouchers.owner(), address(this));
        assertEq(vouchers.guardian(), GUARDIAN);
        assertEq(vouchers.commitmentPooling().getPool(poolId).garden, POOL_GARDEN);
        assertEq(vouchers.upgradeAvailableAt(), 0);
    }

    function testVoucherEntitlement_upgradeBindsCodehashRouterAndPause() public {
        VoucherEntitlementModule wrongRouter = new VoucherEntitlementModule(address(0xBAAD));
        vouchers.scheduleUpgrade(address(wrongRouter));
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        vouchers.upgradeTo(address(wrongRouter));
        vouchers.pause();
        vm.expectRevert(VoucherEndpoint.ImmutableEndpointMismatch.selector);
        vouchers.upgradeTo(address(wrongRouter));
        VoucherEntitlementModule changedCode = new VoucherEntitlementModule(address(router));
        vouchers.scheduleUpgrade(address(changedCode));
        vm.etch(address(changedCode), hex"00");
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        vouchers.upgradeTo(address(changedCode));
    }

    function testVoucherEntitlement_upgradeRequiresTheExactUncancelledSchedule() public {
        VoucherEntitlementModule replacement = new VoucherEntitlementModule(address(router));
        VoucherEntitlementModule different = new VoucherEntitlementModule(address(router));
        vouchers.pause();
        vouchers.scheduleUpgrade(address(replacement));
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        vouchers.upgradeTo(address(different));
        assertEq(vouchers.scheduledImplementation(), address(replacement));
        vouchers.cancelUpgrade();
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        vouchers.upgradeTo(address(replacement));
        assertEq(vouchers.scheduledImplementation(), address(0));
        assertEq(vouchers.scheduledCodehash(), bytes32(0));
        assertEq(vouchers.upgradeAvailableAt(), 0);
    }

    function testVoucherEntitlement_upgradeCannotChangeLocalChainIdentity() public {
        uint256 localChain = block.chainid;
        vm.chainId(localChain + 1);
        VoucherEntitlementModule replacement = new VoucherEntitlementModule(address(router));
        vm.chainId(localChain);
        vouchers.pause();
        vouchers.scheduleUpgrade(address(replacement));
        vm.expectRevert(VoucherEndpoint.ImmutableEndpointMismatch.selector);
        vouchers.upgradeTo(address(replacement));
        assertEq(vouchers.scheduledImplementation(), address(replacement));
        assertEq(vouchers.LOCAL_CHAIN_ID(), localChain);
    }

    function testVoucherEntitlement_unconfiguredFeeFloorBlocksDispatch() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-unconfigured-floor"));
        // Simulate the zero-valued appended slot of an existing proxy before migration configuration.
        stdstore.target(address(vouchers)).sig("feeReserveMinimum()").checked_write(uint256(0));
        vm.expectRevert(VoucherEntitlementModule.FeeReserveFloorNotConfigured.selector);
        _dispatch(entitlement);
    }

    function testVoucherEntitlement_administrativeCloseoutStopsSourceRetry() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-closeout"));
        _dispatch(entitlement);
        vouchers.closeDispatch(entitlement, keccak256("reviewed-evidence"));
        vm.expectRevert(VoucherEntitlementModule.VoucherDispatchIsClosed.selector);
        _dispatch(entitlement);
    }

    function testVoucherEntitlement_pauseAndFeeExhaustionAreRecoverableWithoutPayloadChange() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-source-pause"));
        bytes memory command = vouchers.getCommand(entitlement);
        vm.deal(address(vouchers), 0);
        vm.expectRevert(abi.encodeWithSelector(VoucherEndpoint.InsufficientTransportFee.selector, 1, 0));
        vm.prank(STEWARD);
        vouchers.dispatch(entitlement);
        assertEq(
            uint256(vouchers.getDistribution(entitlement).state), uint256(VoucherEntitlementModule.DeliveryState.Prepared)
        );
        vouchers.pause();
        vm.expectRevert(VoucherEndpoint.VoucherPaused.selector);
        vm.prank(STEWARD);
        vouchers.dispatch(entitlement);
        vouchers.unpause();
        vm.deal(address(vouchers), 1);
        _dispatch(entitlement);
        assertEq(vouchers.getCommand(entitlement), command);
    }

    function testVoucherEntitlement_feeFloorConfigurationRequiresPausedOwnerAndPositiveMinimum() public {
        vm.expectRevert(VoucherEntitlementModule.InvalidFeeReserveMinimum.selector);
        vouchers.setFeeReserveMinimum(10);
        vouchers.pause();
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(GUARDIAN);
        vouchers.setFeeReserveMinimum(10);
        vm.expectRevert(VoucherEntitlementModule.InvalidFeeReserveMinimum.selector);
        vouchers.setFeeReserveMinimum(0);
        vouchers.setFeeReserveMinimum(10);
        assertEq(vouchers.feeReserveMinimum(), 10);
    }

    function testVoucherEntitlement_initialAndRetryRetainFloorAtBothBoundaries() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-floor-boundaries"));
        vouchers.pause();
        vouchers.setFeeReserveMinimum(10);
        vouchers.unpause();
        bytes memory command = vouchers.getCommand(entitlement);
        for (uint256 attempt; attempt < 2; attempt++) {
            VoucherEntitlementModule.Distribution memory before = vouchers.getDistribution(entitlement);
            vm.deal(address(vouchers), 10);
            uint256 routerBalance = address(router).balance;
            vm.expectRevert(abi.encodeWithSelector(VoucherEntitlementModule.FeeReserveFloorViolated.selector, 10, 9));
            vm.prank(STEWARD);
            vouchers.dispatch(entitlement);
            assertEq(address(vouchers).balance, 10);
            assertEq(address(router).balance, routerBalance);
            assertEq(router.nonce(), attempt);
            assertEq(abi.encode(vouchers.getDistribution(entitlement)), abi.encode(before));
            assertEq(vouchers.getCommand(entitlement), command);
            // Exact floor on initial send; above floor on retry.
            vm.deal(address(vouchers), 11 + attempt);
            vm.prank(STEWARD);
            vouchers.dispatch(entitlement);
            assertEq(address(vouchers).balance, 10 + attempt);
            assertEq(router.nonce(), attempt + 1);
            assertEq(router.lastData(), command);
        }
    }

    function testVoucherEntitlement_feeIncreaseRequiresTopupAndRetryRetainsExactFloor() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-changing-fee"));
        vouchers.pause();
        vouchers.setFeeReserveMinimum(10);
        vouchers.unpause();
        vm.deal(address(vouchers), 12);
        vm.prank(STEWARD);
        vouchers.dispatch(entitlement);
        assertEq(address(vouchers).balance, 11); // initial send above the floor
        bytes memory command = vouchers.getCommand(entitlement);
        bytes32 messageId = vouchers.getDistribution(entitlement).lastMessageId;
        router.setFee(3);
        vm.expectRevert(abi.encodeWithSelector(VoucherEntitlementModule.FeeReserveFloorViolated.selector, 10, 8));
        vm.prank(STEWARD);
        vouchers.dispatch(entitlement);
        assertEq(vouchers.getDistribution(entitlement).lastMessageId, messageId);
        assertEq(router.nonce(), 1);
        vm.prank(STEWARD);
        vouchers.dispatch{ value: 2 }(entitlement);
        assertEq(address(vouchers).balance, 10); // retry exactly at the floor
        assertEq(router.nonce(), 2);
        assertEq(router.lastData(), command);
        assertEq(vouchers.getCommand(entitlement), command);
    }

    function testVoucherEntitlement_routerFailurePreservesPendingCommandAndHistory() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-router-failure"));
        _dispatch(entitlement);
        VoucherEntitlementModule.Distribution memory before = vouchers.getDistribution(entitlement);
        uint256 stewardBalance = STEWARD.balance;
        uint256 routerBalance = address(router).balance;
        router.setFailSend(true);
        vm.expectRevert("router send failed");
        _dispatch(entitlement);
        assertEq(STEWARD.balance, stewardBalance);
        assertEq(address(router).balance, routerBalance);
        assertEq(address(vouchers).balance, 1);
        assertEq(abi.encode(vouchers.getDistribution(entitlement)), abi.encode(before));
        assertEq(router.nonce(), 1);
        router.setFailSend(false);
        _dispatch(entitlement);
        assertEq(router.lastData(), vouchers.getCommand(entitlement));
        assertEq(router.nonce(), 2);
    }

    function testVoucherEntitlement_closeoutRejectsWrongActorUnknownPreparedDeliveredAndEmptyEvidence() public {
        bytes32 entitlement = _preparedSolo(keccak256("voucher-closeout-rejections"));
        bytes32 evidence = keccak256("reviewed-evidence");
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(STEWARD);
        vouchers.closeDispatch(entitlement, evidence);
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(GUARDIAN);
        vouchers.closeDispatch(entitlement, evidence);
        vm.expectRevert(VoucherEntitlementModule.UnknownVoucherEntitlement.selector);
        vouchers.closeDispatch(keccak256("unknown"), evidence);
        vm.expectRevert(VoucherEntitlementModule.InvalidDispatchCloseout.selector);
        vouchers.closeDispatch(entitlement, evidence);
        _dispatch(entitlement);
        vm.expectRevert(VoucherEntitlementModule.InvalidDispatchCloseout.selector);
        vouchers.closeDispatch(entitlement, bytes32(0));
        _deliver(keccak256("paid-before-close"), _ack(entitlement, 1, true));
        vm.expectRevert(VoucherEntitlementModule.VoucherAlreadyDelivered.selector);
        vouchers.closeDispatch(entitlement, evidence);
        assertEq(vouchers.dispatchCloseoutEvidence(entitlement), bytes32(0));
    }

    function testVoucherEntitlement_closedPendingAndFailedRewardsStillReconcileWhilePaused() public {
        _assertClosedRewardReconciles(false);
        _assertClosedRewardReconciles(true);
    }

    function _assertClosedRewardReconciles(bool failed) private {
        bytes32 entitlement = _preparedSolo(keccak256(abi.encode("voucher-closed-late-success", failed)));
        _dispatch(entitlement);
        if (failed) _deliver(keccak256("failed-before-close"), _ack(entitlement, 1, false));
        bytes memory command = vouchers.getCommand(entitlement);
        VoucherEntitlementModule.Distribution memory before = vouchers.getDistribution(entitlement);
        bytes32 evidence = keccak256("reviewed-unresolved-dispatch");
        vouchers.pause();
        vouchers.closeDispatch(entitlement, evidence);
        vouchers.closeDispatch(entitlement, evidence);
        assertEq(abi.encode(vouchers.getDistribution(entitlement)), abi.encode(before));
        vm.expectRevert(VoucherEntitlementModule.ConflictingDispatchCloseout.selector);
        vouchers.closeDispatch(entitlement, keccak256("changed-evidence"));
        _deliver(keccak256(abi.encode("late-failure", failed)), _ack(entitlement, 2, false));
        _deliver(keccak256(abi.encode("late-success", failed)), _ack(entitlement, 3, true));
        _deliver(keccak256(abi.encode("duplicate-success", failed)), _ack(entitlement, 3, true));
        vouchers.closeDispatch(entitlement, evidence); // identical administrative request remains idempotent
        assertEq(vouchers.dispatchCloseoutEvidence(entitlement), evidence);
        assertEq(
            uint8(vouchers.getDistribution(entitlement).state), uint8(VoucherEntitlementModule.DeliveryState.Delivered)
        );
        assertEq(vouchers.getCommand(entitlement), command);
        assertEq(vouchers.distributionOfCommitment(before.commitmentId), entitlement);
        assertEq(
            uint8(module.getCommitment(before.commitmentId).state),
            uint8(ICommitmentPoolingModule.CommitmentState.Fulfilled)
        );
        vouchers.unpause();
        vm.expectRevert(VoucherEntitlementModule.DistributionAlreadyPrepared.selector);
        _prepare(before.commitmentId, _soloEntries());
    }

    function _terms(uint256 total) private view returns (VoucherEntitlementModule.TermsInput memory) {
        return VoucherEntitlementModule.TermsInput(
            ISSUER, AUTHORITY, TOKEN, total, vouchers.RECOGNITION_POLICY(), keccak256("fictional-service-terms"), 0
        );
    }

    function _register(uint256 id, uint256 total) private {
        VoucherEntitlementModule.TermsInput memory input = _terms(total);
        vm.prank(STEWARD);
        vouchers.registerTerms(id, input);
    }

    function _consent(uint256 id, uint64 revision) private {
        vm.prank(AUTHORITY);
        vouchers.approveTerms(id, revision);
        vm.prank(CREATOR);
        vouchers.consentTerms(id, revision);
        vm.prank(CLAIMANT);
        vouchers.consentTerms(id, revision);
    }

    function _createConsentedOffer(bytes32 key, uint256 total) private returns (uint256 id) {
        id = _createOffer(key);
        _register(id, total);
        _consent(id, 1);
    }

    function _ready(uint256 id, bool three) private {
        address[] memory credited = new address[](three ? 3 : 1);
        credited[0] = CREATOR;
        if (three) {
            vm.startPrank(CREATOR);
            module.addContributor(id, SECOND);
            module.addContributor(id, THIRD);
            vm.stopPrank();
            credited[1] = SECOND;
            credited[2] = THIRD;
        }
        vm.prank(CREATOR);
        module.attachEvidence(id, "fictional-evidence", credited);
        module.markReadyForConfirmation(id, "ready for local voucher fixture");
    }

    function _fulfill(uint256 id, bool three) private {
        _ready(id, three);
        vm.prank(CLAIMANT);
        module.confirmFulfillment(id);
    }

    function _soloEntries() private pure returns (ICommitmentPoolingModule.RecognitionEntry[] memory entries) {
        entries = new ICommitmentPoolingModule.RecognitionEntry[](1);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry(CREATOR, 10_000);
    }

    function _threeEntries() private pure returns (ICommitmentPoolingModule.RecognitionEntry[] memory entries) {
        // Numeric ordering is SECOND, THIRD, CREATOR. Equal credit under 20/80 gives 3334/3334/3332.
        entries = new ICommitmentPoolingModule.RecognitionEntry[](3);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry(SECOND, 3334);
        entries[1] = ICommitmentPoolingModule.RecognitionEntry(THIRD, 3334);
        entries[2] = ICommitmentPoolingModule.RecognitionEntry(CREATOR, 3332);
    }

    function _hash(uint256 id, ICommitmentPoolingModule.RecognitionEntry[] memory entries) private view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, id, entries));
    }

    function _prepare(uint256 id, ICommitmentPoolingModule.RecognitionEntry[] memory entries) private returns (bytes32) {
        vm.prank(STEWARD);
        return vouchers.prepareDistribution(id, entries, _hash(id, entries));
    }

    function _preparedSolo(bytes32 key) private returns (bytes32) {
        uint256 id = _createConsentedOffer(key, 100);
        _acceptOffer(id);
        _fulfill(id, false);
        return _prepare(id, _soloEntries());
    }

    function _dispatch(bytes32 entitlement) private {
        vm.prank(STEWARD);
        vouchers.dispatch{ value: 1 }(entitlement);
    }

    function _ack(bytes32 entitlement, uint64 sequence, bool success)
        private
        view
        returns (VoucherMessageCodec.Ack memory)
    {
        return VoucherMessageCodec.Ack(
            1,
            entitlement,
            vouchers.getDistribution(entitlement).payloadHash,
            sequence,
            success,
            success ? bytes32(0) : keccak256("fictional reserve failure")
        );
    }

    function _message(
        bytes32 messageId,
        VoucherMessageCodec.Ack memory ack
    )
        private
        pure
        returns (Client.Any2EVMMessage memory)
    {
        return Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: PEER_SELECTOR,
            sender: abi.encode(PEER),
            data: VoucherMessageCodec.encodeAck(ack),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    function _deliver(bytes32 messageId, VoucherMessageCodec.Ack memory ack) private {
        vm.prank(address(router));
        vouchers.ccipReceive(_message(messageId, ack));
    }
}
