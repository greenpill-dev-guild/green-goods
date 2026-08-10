// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ICreditRegistry } from "../../src/interfaces/ICreditRegistry.sol";
import { CreditRegistry } from "../../src/registries/Credit.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";
import { CreditSettlementLookupMock } from "../helpers/CreditSettlementLookupMock.sol";

contract CreditRegistryTest is CommitmentPoolingFixture {
    address internal constant TOKEN = address(0xDA1);
    address internal constant EXECUTOR = address(0xE0EC);
    address internal constant REQUESTING_STEWARD = address(0x57E0A4D);

    CreditRegistry internal credit;
    CreditSettlementLookupMock internal settlementLookup;

    event RepaymentRecorded(
        uint256 indexed loanId,
        uint256 amount,
        uint256 repaidAmount,
        uint256 newOutstanding,
        uint32 installmentsPaid,
        bytes32 indexed executionRef,
        address indexed recordedBy
    );

    function setUp() public {
        _setUpProductionFixture();
        settlementLookup = new CreditSettlementLookupMock();
        settlementLookup.configure(address(0), address(hats), address(module));
        CreditRegistry implementation = new CreditRegistry();
        credit = CreditRegistry(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        CreditRegistry.initialize,
                        (address(this), address(hats), address(module), address(settlementLookup))
                    )
                )
            )
        );
        settlementLookup.configure(address(credit), address(hats), address(module));
        credit.setPaused(false);
        credit.configurePoolCredit(poolId, TOKEN, 100 ether, true);
    }

    function testCreditRegistry_requestApproveDisburseAndRepayInInstallments() public {
        uint256 loanId = _request(CREATOR, 80 ether, 0);
        credit.approveLoan(loanId);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.Treasury, keccak256("treasury-disbursement"));
        credit.recordRepayment(loanId, 30 ether, keccak256("repayment-one"));

        ICreditRegistry.Loan memory partiallyRepaid = credit.getLoan(loanId);
        assertEq(uint8(partiallyRepaid.state), uint8(ICreditRegistry.LoanState.Disbursed));
        assertEq(partiallyRepaid.repaidAmount, 30 ether);
        assertEq(credit.outstandingOf(poolId, CREATOR), 50 ether);

        credit.recordRepayment(loanId, 50 ether, keccak256("repayment-two"));
        ICreditRegistry.Loan memory repaid = credit.getLoan(loanId);
        assertEq(uint8(repaid.state), uint8(ICreditRegistry.LoanState.Repaid));
        assertEq(repaid.installmentsPaid, 2);
        assertEq(credit.outstandingOf(poolId, CREATOR), 0);
        assertEq(credit.amountDue(loanId), 0);
    }

    function testCreditRegistry_stewardOnBehalfIsExplicitAndCurrentMemberOnly() public {
        ICreditRegistry.RequestLoanParams memory params = _params(25 ether, 0);
        params.onBehalfOf = CREATOR;
        uint256 loanId = credit.requestLoan(params);
        ICreditRegistry.Loan memory loan = credit.getLoan(loanId);
        assertEq(loan.borrower, CREATOR);
        assertEq(loan.requestedBy, address(this));

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.NotPoolSteward.selector, CLAIMANT, poolId));
        vm.prank(CLAIMANT);
        credit.requestLoan(params);

        params.onBehalfOf = CLAIMANT;
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.InvalidOnBehalfOf.selector, CLAIMANT));
        vm.prank(CLAIMANT);
        credit.requestLoan(params);

        address nonMember = address(0xBAD);
        params.onBehalfOf = nonMember;
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.NotPoolMember.selector, nonMember, poolId));
        credit.requestLoan(params);
    }

    function testCreditRegistry_borrowerCannotApproveOwnLoanEvenWhenAlsoAuthorizedAsSteward() public {
        _setMember(address(this));
        uint256 loanId = _request(address(this), 10 ether, 0);
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.SelfApproval.selector, loanId, address(this)));
        credit.approveLoan(loanId);
    }

    function testCreditRegistry_borrowerCannotRecordOwnRepaymentWhenAlsoAnAuthorizedRecorder() public {
        uint256 loanId = _approvedAndDisbursed(CREATOR, 10 ether, keccak256("borrower-recorder-disbursement"));
        hats.setOperator(POOL_GARDEN, CREATOR, true);
        credit.addExecutor(poolId, CREATOR);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.BorrowerCannotRecordRepayment.selector, loanId, CREATOR));
        vm.prank(CREATOR);
        credit.recordRepayment(loanId, 10 ether, keccak256("borrower-self-attested-repayment"));

        assertEq(credit.amountDue(loanId), 10 ether);
        assertEq(credit.outstandingOf(poolId, CREATOR), 10 ether);
    }

    function testCreditRegistry_poolCreditUsesOneImmutableTokenDenomination() public {
        ICreditRegistry.PoolCreditConfig memory config = credit.poolCreditConfig(poolId);
        assertEq(config.token, TOKEN);

        ICreditRegistry.RequestLoanParams memory params = _params(10 ether, 0);
        address otherToken = address(0xDA2);
        params.token = otherToken;
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.PoolCreditTokenMismatch.selector, poolId, TOKEN, otherToken));
        vm.prank(CREATOR);
        credit.requestLoan(params);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.PoolCreditTokenLocked.selector, poolId, TOKEN, otherToken));
        credit.configurePoolCredit(poolId, otherToken, 100 ether, true);
        vm.expectRevert(ICreditRegistry.TokenRequired.selector);
        credit.configurePoolCredit(poolId, address(0), 100 ether, true);
    }

    function testCreditRegistry_borrowerStewardCanCancelAnApprovedLoan() public {
        uint256 loanId = _request(CREATOR, 10 ether, 0);
        credit.approveLoan(loanId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.CancellationNotAllowed.selector, loanId, ICreditRegistry.LoanState.Approved
            )
        );
        vm.prank(CREATOR);
        credit.cancelLoan(loanId, "bafy-borrower-not-yet-steward");

        hats.setOperator(POOL_GARDEN, CREATOR, true);
        vm.prank(CREATOR);
        credit.cancelLoan(loanId, "bafy-borrower-steward-cancelled");

        ICreditRegistry.Loan memory cancelled = credit.getLoan(loanId);
        assertEq(uint8(cancelled.state), uint8(ICreditRegistry.LoanState.Cancelled));
        assertEq(cancelled.reasonCID, "bafy-borrower-steward-cancelled");
        assertFalse(credit.isCapReserved(loanId));
        assertEq(credit.activeReservationCount(), 0);
    }

    function testCreditRegistry_approvalRevalidatesTheOriginalRequesterAuthority() public {
        uint256 selfRequestedLoanId = _request(CREATOR, 10 ether, 0);
        hats.setGardener(POOL_GARDEN, CREATOR, false);
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.NotPoolMember.selector, CREATOR, poolId));
        credit.approveLoan(selfRequestedLoanId);

        hats.setGardener(POOL_GARDEN, CREATOR, true);
        hats.setOperator(POOL_GARDEN, REQUESTING_STEWARD, true);
        ICreditRegistry.RequestLoanParams memory params = _params(10 ether, 0);
        params.onBehalfOf = CREATOR;
        vm.prank(REQUESTING_STEWARD);
        uint256 stewardRequestedLoanId = credit.requestLoan(params);

        hats.setOperator(POOL_GARDEN, REQUESTING_STEWARD, false);
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.NotPoolSteward.selector, REQUESTING_STEWARD, poolId));
        credit.approveLoan(stewardRequestedLoanId);
    }

    function testCreditRegistry_capIsRecheckedAfterInterveningDisbursementAtApproval() public {
        uint256 firstLoanId = _request(CREATOR, 60 ether, 0);
        uint256 secondLoanId = _request(CREATOR, 60 ether, 0);
        credit.approveLoan(firstLoanId);
        credit.recordDisbursed(firstLoanId, ICreditRegistry.LoanRail.Jar, keccak256("first-cap-use"));

        vm.expectRevert(
            abi.encodeWithSelector(ICreditRegistry.BorrowerCapExceeded.selector, poolId, CREATOR, 60 ether, 40 ether)
        );
        credit.approveLoan(secondLoanId);
    }

    function testCreditRegistry_approvedLoansReserveCapBeforeAnyRailCanDisburse() public {
        uint256 firstLoanId = _request(CREATOR, 60 ether, 0);
        uint256 secondLoanId = _request(CREATOR, 60 ether, 0);
        credit.approveLoan(firstLoanId);
        assertEq(credit.reservedOutstandingOf(poolId, CREATOR), 60 ether);
        assertTrue(credit.isCapReserved(firstLoanId));

        vm.expectRevert(
            abi.encodeWithSelector(ICreditRegistry.BorrowerCapExceeded.selector, poolId, CREATOR, 60 ether, 40 ether)
        );
        credit.approveLoan(secondLoanId);
    }

    function testCreditRegistry_capIsRecheckedAfterInterveningDisbursementAtRecording() public {
        credit.configurePoolCredit(poolId, TOKEN, 120 ether, true);
        uint256 firstLoanId = _request(CREATOR, 60 ether, 0);
        uint256 secondLoanId = _request(CREATOR, 60 ether, 0);
        credit.approveLoan(firstLoanId);
        credit.approveLoan(secondLoanId);
        credit.recordDisbursed(firstLoanId, ICreditRegistry.LoanRail.Jar, keccak256("first-approved-cap-use"));
        credit.configurePoolCredit(poolId, TOKEN, 100 ether, true);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.BorrowerCapExceeded.selector, poolId, CREATOR, 60 ether, 0));
        credit.recordDisbursed(secondLoanId, ICreditRegistry.LoanRail.Jar, keccak256("second-cap-use"));
    }

    function testCreditRegistry_commitmentLinkIsUniqueAndCancellationClearsOnlyTheLiveLink() public {
        uint256 commitmentId = _createOffer(keccak256("credit-linked-offer"));
        uint256 loanId = _request(CREATOR, 20 ether, commitmentId);
        assertEq(credit.loanOfCommitment(commitmentId), loanId);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.CommitmentLoanExists.selector, commitmentId, loanId));
        _request(CREATOR, 20 ether, commitmentId);

        vm.prank(CREATOR);
        credit.cancelLoan(loanId, "bafy-borrower-cancelled");
        assertEq(credit.loanOfCommitment(commitmentId), 0);
        uint256 replacementLoanId = _request(CREATOR, 20 ether, commitmentId);
        assertEq(credit.loanOfCommitment(commitmentId), replacementLoanId);
    }

    function testCreditRegistry_repaymentRejectsZeroOverpaymentAndReplayAcrossLoans() public {
        uint256 firstLoanId = _approvedAndDisbursed(CREATOR, 40 ether, keccak256("first-disbursement"));
        uint256 secondLoanId = _request(CLAIMANT, 20 ether, 0);
        credit.approveLoan(secondLoanId);

        vm.expectRevert(ICreditRegistry.RepaymentAmountRequired.selector);
        credit.recordRepayment(firstLoanId, 0, keccak256("zero-repayment"));
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.RepaymentExceedsBalance.selector, 41 ether, 40 ether));
        credit.recordRepayment(firstLoanId, 41 ether, keccak256("overpayment"));
        vm.expectRevert(
            abi.encodeWithSelector(ICreditRegistry.ExecutionRefUsed.selector, keccak256("first-disbursement"), firstLoanId)
        );
        credit.recordDisbursed(secondLoanId, ICreditRegistry.LoanRail.Treasury, keccak256("first-disbursement"));

        credit.recordRepayment(firstLoanId, 10 ether, keccak256("shared-ref"));
        credit.recordDisbursed(secondLoanId, ICreditRegistry.LoanRail.Treasury, keccak256("second-disbursement"));
        vm.expectRevert(
            abi.encodeWithSelector(ICreditRegistry.ExecutionRefUsed.selector, keccak256("shared-ref"), firstLoanId)
        );
        credit.recordRepayment(secondLoanId, 5 ether, keccak256("shared-ref"));
        assertEq(credit.loanOfExecutionRef(keccak256("shared-ref")), firstLoanId);
    }

    function testCreditRegistry_repaymentEventCarriesTheLoansRemainingBalance() public {
        uint256 firstLoanId = _approvedAndDisbursed(CREATOR, 40 ether, keccak256("event-first-disbursement"));
        _approvedAndDisbursed(CREATOR, 30 ether, keccak256("event-second-disbursement"));
        bytes32 repaymentRef = keccak256("event-first-repayment");

        vm.expectEmit(true, true, true, true, address(credit));
        emit RepaymentRecorded(firstLoanId, 10 ether, 10 ether, 30 ether, 1, repaymentRef, address(this));
        credit.recordRepayment(firstLoanId, 10 ether, repaymentRef);

        assertEq(credit.amountDue(firstLoanId), 30 ether);
        assertEq(credit.outstandingOf(poolId, CREATOR), 60 ether, "aggregate exposure remains separately readable");
    }

    function testCreditRegistry_amountDueIsZeroUntilValueIsDisbursedAndAfterCancellation() public {
        uint256 approvedLoanId = _request(CREATOR, 20 ether, 0);
        assertEq(credit.amountDue(approvedLoanId), 0);

        credit.approveLoan(approvedLoanId);
        assertEq(credit.amountDue(approvedLoanId), 0);
        credit.cancelLoan(approvedLoanId, "bafy-approved-cancelled");
        assertEq(credit.amountDue(approvedLoanId), 0);

        uint256 requestedLoanId = _request(CREATOR, 15 ether, 0);
        vm.prank(CREATOR);
        credit.cancelLoan(requestedLoanId, "bafy-requested-cancelled");
        assertEq(credit.amountDue(requestedLoanId), 0);
    }

    function testCreditRegistry_revertsWhenExpiredTermsAreApproved() public {
        ICreditRegistry.RequestLoanParams memory params = _params(20 ether, 0);
        params.dueDate = uint64(block.timestamp + 1 days);
        vm.prank(CREATOR);
        uint256 expiredRequestId = credit.requestLoan(params);
        vm.warp(uint256(params.dueDate) + 1);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.InvalidDueDate.selector, params.dueDate));
        credit.approveLoan(expiredRequestId);
    }

    function testCreditRegistry_revertsWhenExpiredTermsAreRecorded() public {
        ICreditRegistry.RequestLoanParams memory params = _params(20 ether, 0);
        params.dueDate = uint64(block.timestamp + 1 days);
        vm.prank(CREATOR);
        uint256 expiredApprovedId = credit.requestLoan(params);
        credit.approveLoan(expiredApprovedId);
        vm.warp(uint256(params.dueDate) + 1);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.InvalidDueDate.selector, params.dueDate));
        credit.recordDisbursed(
            expiredApprovedId, ICreditRegistry.LoanRail.Treasury, keccak256("expired-treasury-disbursement")
        );
        assertEq(credit.amountDue(expiredApprovedId), 0);
        assertEq(credit.activeReservationCount(), 1);
    }

    function testCreditRegistry_revertsWhenDependenciesRotateWithActiveReservations() public {
        uint256 loanId = _request(CREATOR, 20 ether, 0);
        credit.approveLoan(loanId);
        assertEq(credit.activeReservationCount(), 1);
        credit.setPaused(true);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.ActiveLoanReservations.selector, uint256(1)));
        credit.setHatsModule(address(0xA11CE));
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.ActiveLoanReservations.selector, uint256(1)));
        credit.setCommitmentPoolingModule(address(0xB0B));
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.ActiveLoanReservations.selector, uint256(1)));
        credit.setSettlementModule(address(0xCE10));
    }

    function testCreditRegistry_poolingIdentityLocksOnFirstPoolScopedMutation() public {
        assertTrue(credit.poolingStateInitialized());
        credit.setPaused(true);
        vm.expectRevert(ICreditRegistry.CommitmentPoolingModuleLocked.selector);
        credit.setCommitmentPoolingModule(address(0xB0B));

        CreditRegistry implementation = new CreditRegistry();
        CreditRegistry fresh = CreditRegistry(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        CreditRegistry.initialize,
                        (address(this), address(hats), address(module), address(settlementLookup))
                    )
                )
            )
        );
        assertFalse(fresh.poolingStateInitialized());
        fresh.setCommitmentPoolingModule(address(0xB0B));
        assertEq(fresh.commitmentPoolingModule(), address(0xB0B));
        fresh.setCommitmentPoolingModule(address(module));
        settlementLookup.configure(address(fresh), address(hats), address(module));
        fresh.setPaused(false);
        fresh.addExecutor(poolId, EXECUTOR);
        assertTrue(fresh.poolingStateInitialized());
        fresh.setPaused(true);
        vm.expectRevert(ICreditRegistry.CommitmentPoolingModuleLocked.selector);
        fresh.setCommitmentPoolingModule(address(0xB0B));
    }

    function testCreditRegistry_defaultIsDueGatedAndRecoverableAcrossInstallments() public {
        uint256 loanId = _approvedAndDisbursed(CREATOR, 40 ether, keccak256("default-disbursement"));
        ICreditRegistry.Loan memory loan = credit.getLoan(loanId);
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.NotDue.selector, loanId, loan.dueDate));
        credit.markDefaulted(loanId, "bafy-too-early");

        vm.warp(uint256(loan.dueDate) + 1);
        credit.markDefaulted(loanId, "bafy-default-record");
        credit.recordRepayment(loanId, 15 ether, keccak256("default-partial"));
        assertEq(uint8(credit.getLoan(loanId).state), uint8(ICreditRegistry.LoanState.Defaulted));
        credit.recordRepayment(loanId, 25 ether, keccak256("default-cleared"));

        ICreditRegistry.Loan memory recovered = credit.getLoan(loanId);
        assertEq(uint8(recovered.state), uint8(ICreditRegistry.LoanState.Repaid));
        assertEq(recovered.repaidAmount, 40 ether);
        assertEq(recovered.reasonCID, "bafy-default-record");
        assertEq(credit.outstandingOf(poolId, CREATOR), 0);
    }

    function testCreditRegistry_executorRemovalImmediatelyRevokesRecordAuthority() public {
        credit.addExecutor(poolId, EXECUTOR);
        uint256 firstLoanId = _request(CREATOR, 20 ether, 0);
        credit.approveLoan(firstLoanId);
        vm.prank(EXECUTOR);
        credit.recordDisbursed(firstLoanId, ICreditRegistry.LoanRail.Jar, keccak256("executor-first"));

        credit.removeExecutor(poolId, EXECUTOR);
        uint256 secondLoanId = _request(CLAIMANT, 20 ether, 0);
        credit.approveLoan(secondLoanId);
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.UnauthorizedRecorder.selector, EXECUTOR, poolId));
        vm.prank(EXECUTOR);
        credit.recordDisbursed(secondLoanId, ICreditRegistry.LoanRail.Jar, keccak256("executor-removed"));
    }

    function testCreditRegistry_pauseBlocksOrdinaryMutationsButPreservesCancelAndDefault() public {
        uint256 requestedLoanId = _request(CREATOR, 20 ether, 0);
        uint256 disbursedLoanId = _approvedAndDisbursed(CLAIMANT, 20 ether, keccak256("pause-default"));
        uint64 dueDate = credit.getLoan(disbursedLoanId).dueDate;
        credit.setPaused(true);

        vm.expectRevert(ICreditRegistry.ModulePaused.selector);
        credit.approveLoan(requestedLoanId);
        vm.expectRevert(ICreditRegistry.ModulePaused.selector);
        credit.recordRepayment(disbursedLoanId, 1 ether, keccak256("paused-repayment"));

        vm.prank(CREATOR);
        credit.cancelLoan(requestedLoanId, "bafy-wind-down");
        vm.warp(uint256(dueDate) + 1);
        credit.markDefaulted(disbursedLoanId, "bafy-paused-default");
        assertEq(uint8(credit.getLoan(requestedLoanId).state), uint8(ICreditRegistry.LoanState.Cancelled));
        assertEq(uint8(credit.getLoan(disbursedLoanId).state), uint8(ICreditRegistry.LoanState.Defaulted));
    }

    function testCreditRegistry_dependenciesAndUpgradeAreOwnerAndPauseGated() public {
        CreditSettlementLookupMock replacementSettlement = _newSettlementLookup(address(credit));
        vm.expectRevert(ICreditRegistry.ModuleMustBePaused.selector);
        credit.setSettlementModule(address(replacementSettlement));

        credit.setPaused(true);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        vm.prank(CREATOR);
        credit.setSettlementModule(address(replacementSettlement));
        vm.expectRevert(ICreditRegistry.ZeroAddress.selector);
        credit.setSettlementModule(address(0));
        credit.setSettlementModule(address(replacementSettlement));

        CreditRegistry nextImplementation = new CreditRegistry();
        bytes memory keepPaused = abi.encodeCall(CreditRegistry.setPaused, (true));
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        vm.prank(CREATOR);
        credit.upgradeToAndCall(address(nextImplementation), keepPaused);
        credit.upgradeToAndCall(address(nextImplementation), keepPaused);
        assertEq(credit.settlementModule(), address(replacementSettlement));
        assertTrue(credit.paused());
        assertEq(credit.nextLoanId(), 1);
    }

    function testCreditRegistry_settlementReplacementCannotOrphanApprovedExposure() public {
        uint256 loanId = _request(CREATOR, 40 ether, 0);
        credit.approveLoan(loanId);
        credit.setPaused(true);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.ActiveLoanReservations.selector, uint256(1)));
        credit.setSettlementModule(address(0x5E771F));

        credit.setPaused(false);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.Jar, keccak256("release-settlement-lock"));
        credit.setPaused(true);
        CreditSettlementLookupMock replacementSettlement = _newSettlementLookup(address(credit));
        credit.setSettlementModule(address(replacementSettlement));
        assertEq(credit.settlementModule(), address(replacementSettlement));
    }

    function testCreditRegistry_settlementCandidateMustImplementTheReciprocalInterface() public {
        credit.setPaused(true);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.InvalidSettlementModule.selector, address(0x5E771F)));
        credit.setSettlementModule(address(0x5E771F));
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.InvalidSettlementModule.selector, address(module)));
        credit.setSettlementModule(address(module));

        CreditSettlementLookupMock mismatched = new CreditSettlementLookupMock();
        mismatched.configure(address(credit), address(hats), address(0xB0B));
        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.SettlementModuleConfigurationMismatch.selector,
                address(mismatched),
                address(credit),
                address(0xB0B),
                address(hats)
            )
        );
        credit.setSettlementModule(address(mismatched));

        CreditSettlementLookupMock unbound = _newSettlementLookup(address(0));
        credit.setSettlementModule(address(unbound));
        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.SettlementModuleConfigurationMismatch.selector,
                address(unbound),
                address(0),
                address(module),
                address(hats)
            )
        );
        credit.setPaused(false);

        unbound.configure(address(credit), address(hats), address(module));
        credit.setPaused(false);
        assertFalse(credit.paused());
    }

    function testCreditRegistry_upgradePreservesNamespacedCapReservations() public {
        uint256 loanId = _request(CREATOR, 40 ether, 0);
        credit.approveLoan(loanId);
        assertEq(credit.reservedOutstandingOf(poolId, CREATOR), 40 ether);

        credit.setPaused(true);
        CreditRegistry nextImplementation = new CreditRegistry();
        credit.upgradeToAndCall(address(nextImplementation), abi.encodeCall(CreditRegistry.setPaused, (true)));

        assertEq(credit.reservedOutstandingOf(poolId, CREATOR), 40 ether);
        assertTrue(credit.isCapReserved(loanId));
        credit.setPaused(false);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.Treasury, keccak256("post-upgrade-disbursement"));
        assertEq(credit.reservedOutstandingOf(poolId, CREATOR), 0);
        assertEq(credit.outstandingOf(poolId, CREATOR), 40 ether);
    }

    function testCreditRegistry_frozenCreditOrdinalsRemainExact() public {
        assertEq(uint8(ICreditRegistry.LoanState.None), 0);
        assertEq(uint8(ICreditRegistry.LoanState.Requested), 1);
        assertEq(uint8(ICreditRegistry.LoanState.Approved), 2);
        assertEq(uint8(ICreditRegistry.LoanState.Disbursed), 3);
        assertEq(uint8(ICreditRegistry.LoanState.Repaid), 4);
        assertEq(uint8(ICreditRegistry.LoanState.Defaulted), 5);
        assertEq(uint8(ICreditRegistry.LoanState.Cancelled), 6);
        assertEq(uint8(ICreditRegistry.LoanRail.None), 0);
        assertEq(uint8(ICreditRegistry.LoanRail.Jar), 1);
        assertEq(uint8(ICreditRegistry.LoanRail.Treasury), 2);
        assertEq(uint8(ICreditRegistry.LoanRail.GDollarSettlement), 3);
    }

    function testCreditRegistry_invalidRequestAndConfigurationInputsFailClosed() public {
        ICreditRegistry.RequestLoanParams memory params = _params(10 ether, 0);
        params.poolId = 0;
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.UnknownPool.selector, uint256(0)));
        vm.prank(CREATOR);
        credit.requestLoan(params);

        params = _params(10 ether, 0);
        params.token = address(0);
        vm.expectRevert(ICreditRegistry.TokenRequired.selector);
        vm.prank(CREATOR);
        credit.requestLoan(params);
        params = _params(0, 0);
        vm.expectRevert(ICreditRegistry.PrincipalRequired.selector);
        vm.prank(CREATOR);
        credit.requestLoan(params);
        params = _params(10 ether, 0);
        params.dueDate = uint64(block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.InvalidDueDate.selector, params.dueDate));
        vm.prank(CREATOR);
        credit.requestLoan(params);
        params = _params(10 ether, 0);
        params.termsCID = "";
        vm.expectRevert(ICreditRegistry.TermsRequired.selector);
        vm.prank(CREATOR);
        credit.requestLoan(params);

        uint256 loanId = _request(CREATOR, 10 ether, 0);
        credit.approveLoan(loanId);
        vm.expectRevert(ICreditRegistry.ExecutionRefRequired.selector);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.Jar, bytes32(0));
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.InvalidRail.selector, ICreditRegistry.LoanRail.None));
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.None, keccak256("none-rail"));
    }

    function testRevert_CreditRegistryCancellationAfterValueWasRecorded() public {
        uint256 loanId = _approvedAndDisbursed(CREATOR, 10 ether, keccak256("cancel-after-value"));
        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.CancellationNotAllowed.selector, loanId, ICreditRegistry.LoanState.Disbursed
            )
        );
        credit.cancelLoan(loanId, "bafy-too-late");
    }

    function testRevert_CreditRegistryAdministrativeAndLifecycleFailureBranchesStayClosed() public {
        vm.expectRevert(ICreditRegistry.ZeroAddress.selector);
        credit.addExecutor(poolId, address(0));
        vm.expectRevert(ICreditRegistry.ZeroAddress.selector);
        credit.removeExecutor(poolId, address(0));

        uint256 requestedLoanId = _request(CREATOR, 10 ether, 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.LoanNotInState.selector, requestedLoanId, ICreditRegistry.LoanState.Requested
            )
        );
        credit.recordRepayment(requestedLoanId, 1 ether, keccak256("requested-repayment"));
        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.LoanNotInState.selector, requestedLoanId, ICreditRegistry.LoanState.Requested
            )
        );
        credit.markDefaulted(requestedLoanId, "bafy-not-disbursed");
        vm.expectRevert(ICreditRegistry.ReasonRequired.selector);
        credit.cancelLoan(requestedLoanId, "");

        credit.approveLoan(requestedLoanId);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.LoanNotInState.selector, requestedLoanId, ICreditRegistry.LoanState.Approved
            )
        );
        credit.approveLoan(requestedLoanId);
        credit.recordDisbursed(requestedLoanId, ICreditRegistry.LoanRail.Treasury, keccak256("default-reason"));
        ICreditRegistry.Loan memory disbursed = credit.getLoan(requestedLoanId);
        vm.warp(uint256(disbursed.dueDate) + 1);
        vm.expectRevert(ICreditRegistry.ReasonRequired.selector);
        credit.markDefaulted(requestedLoanId, "");

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.UnknownLoan.selector, uint256(999)));
        credit.getLoan(999);
        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.UnknownLoan.selector, uint256(999)));
        credit.amountDue(999);

        credit.setPaused(true);
        vm.expectRevert(ICreditRegistry.ZeroAddress.selector);
        credit.setHatsModule(address(0));
        vm.expectRevert(ICreditRegistry.ZeroAddress.selector);
        credit.setCommitmentPoolingModule(address(0));
    }

    function testFuzz_CreditRegistryRepaymentConservesOutstanding(uint96 rawPrincipal, uint96 rawFirstPayment) public {
        uint256 principal = bound(uint256(rawPrincipal), 2, 100 ether);
        uint256 firstPayment = bound(uint256(rawFirstPayment), 1, principal - 1);
        uint256 loanId = _approvedAndDisbursed(CREATOR, principal, keccak256(abi.encode("fuzz", principal)));

        credit.recordRepayment(loanId, firstPayment, keccak256(abi.encode("fuzz-first", firstPayment)));
        ICreditRegistry.Loan memory partialLoan = credit.getLoan(loanId);
        assertEq(partialLoan.repaidAmount + credit.amountDue(loanId), principal);
        assertEq(credit.outstandingOf(poolId, CREATOR), credit.amountDue(loanId));

        credit.recordRepayment(
            loanId, principal - firstPayment, keccak256(abi.encode("fuzz-final", principal, firstPayment))
        );
        assertEq(credit.outstandingOf(poolId, CREATOR), 0);
        assertEq(credit.amountDue(loanId), 0);
        assertEq(uint8(credit.getLoan(loanId).state), uint8(ICreditRegistry.LoanState.Repaid));
    }

    function _newSettlementLookup(address boundCredit) private returns (CreditSettlementLookupMock lookup) {
        lookup = new CreditSettlementLookupMock();
        lookup.configure(boundCredit, address(hats), address(module));
    }

    function _approvedAndDisbursed(
        address borrower,
        uint256 principal,
        bytes32 executionRef
    )
        private
        returns (uint256 loanId)
    {
        loanId = _request(borrower, principal, 0);
        credit.approveLoan(loanId);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.Treasury, executionRef);
    }

    function _request(address borrower, uint256 principal, uint256 commitmentId) private returns (uint256 loanId) {
        ICreditRegistry.RequestLoanParams memory params = _params(principal, commitmentId);
        vm.prank(borrower);
        loanId = credit.requestLoan(params);
    }

    function _params(
        uint256 principal,
        uint256 commitmentId
    )
        private
        view
        returns (ICreditRegistry.RequestLoanParams memory params)
    {
        params = ICreditRegistry.RequestLoanParams({
            poolId: poolId,
            commitmentId: commitmentId,
            token: TOKEN,
            principal: principal,
            dueDate: uint64(block.timestamp + 30 days),
            installmentsTotal: 2,
            termsCID: "bafy-credit-terms",
            onBehalfOf: address(0)
        });
    }
}
