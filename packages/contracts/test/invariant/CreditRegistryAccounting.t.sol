// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ICreditRegistry } from "../../src/interfaces/ICreditRegistry.sol";
import { CreditRegistry } from "../../src/registries/Credit.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";
import { CreditSettlementLookupMock } from "../helpers/CreditSettlementLookupMock.sol";

contract CreditRepaymentHandler {
    CreditRegistry internal immutable credit;
    uint256 internal immutable loanId;
    uint256 internal nonce;

    constructor(CreditRegistry credit_, uint256 loanId_) {
        credit = credit_;
        loanId = loanId_;
    }

    function repay(uint256 rawAmount) external {
        uint256 due = credit.amountDue(loanId);
        if (due == 0) return;
        uint256 amount = (rawAmount % due) + 1;
        credit.recordRepayment(loanId, amount, keccak256(abi.encode(address(this), ++nonce)));
    }
}

contract CreditRegistryAccountingInvariant is Test, CommitmentPoolingFixture {
    uint256 internal constant PRINCIPAL = 100 ether;

    CreditRegistry internal credit;
    CreditRepaymentHandler internal handler;
    uint256 internal loanId;
    address[] private _targetedContracts;

    /// @dev Inline target support because the repo-pinned forge-std omits StdInvariant.
    function targetContracts() public view returns (address[] memory) {
        return _targetedContracts;
    }

    function setUp() public {
        _setUpProductionFixture();
        CreditSettlementLookupMock settlementLookup = new CreditSettlementLookupMock();
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
        credit.configurePoolCredit(poolId, PRINCIPAL, true);

        ICreditRegistry.RequestLoanParams memory params = ICreditRegistry.RequestLoanParams({
            poolId: poolId,
            commitmentId: 0,
            token: address(0xDA1),
            principal: PRINCIPAL,
            dueDate: uint64(block.timestamp + 30 days),
            installmentsTotal: 0,
            termsCID: "bafy-invariant-credit",
            onBehalfOf: address(0)
        });
        vm.prank(CREATOR);
        loanId = credit.requestLoan(params);
        credit.approveLoan(loanId);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.Jar, keccak256("invariant-disbursement"));

        handler = new CreditRepaymentHandler(credit, loanId);
        credit.addExecutor(poolId, address(handler));
        _targetedContracts.push(address(handler));
    }

    function invariantOutstandingEqualsAmountDue() public {
        assertEq(credit.outstandingOf(poolId, CREATOR), credit.amountDue(loanId));
    }

    function invariantPrincipalIsConserved() public {
        ICreditRegistry.Loan memory loan = credit.getLoan(loanId);
        assertEq(loan.repaidAmount + credit.amountDue(loanId), PRINCIPAL);
    }

    function invariantZeroDueMeansRepaid() public {
        ICreditRegistry.Loan memory loan = credit.getLoan(loanId);
        if (credit.amountDue(loanId) == 0) {
            assertEq(uint8(loan.state), uint8(ICreditRegistry.LoanState.Repaid));
        } else {
            assertEq(uint8(loan.state), uint8(ICreditRegistry.LoanState.Disbursed));
        }
    }
}
