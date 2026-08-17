import type { Address } from "../../types/domain";
import {
  LoanRail,
  LoanState,
  type CreditPoolStats,
  type Loan,
  type LoanDisplayState,
} from "./types-credit";

export function deriveLoanDisplayState(loan: Loan): LoanDisplayState {
  const totalDue = loan.principal + loan.feeAmount;
  if (
    loan.state === LoanState.DISBURSED &&
    loan.repaidAmount > 0n &&
    loan.repaidAmount < totalDue
  ) {
    return "REPAYING";
  }
  return loan.state;
}

export type CreditLoanDisclosure =
  | { status: "unauthenticated" }
  | { status: "hidden" }
  | { status: "visible"; loan: Loan };

export function resolveCreditLoanDisclosure(input: {
  viewer?: Address;
  loan?: Loan | null;
  isCurrentSteward: boolean;
  wasSteward?: boolean;
}): CreditLoanDisclosure {
  if (!input.viewer) return { status: "unauthenticated" };
  if (!input.loan) return { status: "hidden" };
  const isSubject = input.loan.borrower.toLowerCase() === input.viewer.toLowerCase();
  if (!isSubject && !input.isCurrentSteward) return { status: "hidden" };
  return { status: "visible", loan: input.loan };
}

export function selectEditorialCreditPoolStats(stats: CreditPoolStats) {
  return {
    chainId: stats.chainId,
    poolId: stats.poolId,
    garden: stats.garden,
    token: stats.token,
    creditIssued: stats.creditIssued,
    creditRepaid: stats.creditRepaid,
    creditOutstanding: stats.creditOutstanding,
    repaymentRate: {
      numerator: stats.repaymentRateNumerator,
      denominator: stats.repaymentRateDenominator,
    },
    defaultRate: {
      numerator: stats.defaultRateNumerator,
      denominator: stats.defaultRateDenominator,
    },
  };
}

export function selectCommitmentCreditRows(input: {
  loan?: Loan | null;
  considerationStatus?: string | null;
}) {
  return [
    ...(input.loan
      ? [
          {
            axis: "loan" as const,
            status: deriveLoanDisplayState(input.loan),
            loanId: input.loan.loanId,
          },
        ]
      : []),
    ...(input.considerationStatus
      ? [{ axis: "consideration" as const, status: input.considerationStatus }]
      : []),
  ];
}

export type CreditMutationAction =
  | "configurePoolCredit"
  | "addExecutor"
  | "removeExecutor"
  | "requestLoan"
  | "approveLoan"
  | "recordDisbursed"
  | "recordRepayment"
  | "markDefaulted"
  | "cancelLoan"
  | "setPaused";

export function selectCreditMutationPolicy(input: {
  action: CreditMutationAction;
  rail?: LoanRail;
}) {
  if (input.action === "recordRepayment" && input.rail === LoanRail.GDOLLAR_SETTLEMENT) {
    return {
      available: false,
      mode: "online-only" as const,
      reason: "g-dollar-repayment-disabled" as const,
    };
  }
  return { available: true, mode: "online-only" as const, reason: null };
}
