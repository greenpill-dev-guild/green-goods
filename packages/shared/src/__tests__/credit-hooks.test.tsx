/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCreditLoan,
  useCreditPoolStats,
  useCreditSubjectLoans,
  useLoanPrincipalRelationship,
} from "../hooks/commitment-pooling/useCredit";
import {
  type CreditPoolStats,
  type Loan,
  LoanRail,
  LoanState,
  type LoanPrincipalRelationship,
} from "../modules/commitment-pooling";
import { renderHookWithProviders } from "./test-utils";

const BORROWER = "0x1111111111111111111111111111111111111111";
const VIEWER = "0x2222222222222222222222222222222222222222";
const TOKEN = "0x3333333333333333333333333333333333333333";

const mocks = vi.hoisted(() => ({
  getCreditLoan: vi.fn(),
  getCreditLoansForSubject: vi.fn(),
  getCreditPoolStats: vi.fn(),
  getLoanPrincipalRelationship: vi.fn(),
}));

vi.mock("../modules/commitment-pooling/data", () => ({
  getCreditLoan: mocks.getCreditLoan,
  getCreditLoansForSubject: mocks.getCreditLoansForSubject,
  getCreditPoolStats: mocks.getCreditPoolStats,
  getLoanPrincipalRelationship: mocks.getLoanPrincipalRelationship,
}));

const loan: Loan = {
  id: "42161-11",
  chainId: 42161,
  loanId: 11n,
  poolId: 7n,
  garden: "0x4444444444444444444444444444444444444444",
  borrower: BORROWER,
  requestedBy: BORROWER,
  recordedBy: VIEWER,
  commitmentId: null,
  token: TOKEN,
  principal: 100n,
  repaidAmount: 40n,
  outstanding: 60n,
  feeAmount: 0n,
  rail: LoanRail.TREASURY,
  disbursementId: null,
  state: LoanState.DISBURSED,
  dueDate: 1_800_000_000n,
  installmentsTotal: 2,
  installmentsPaid: 1,
  attempts: null,
  executionRef: "0x1234",
  termsCID: "ipfs://terms",
  reasonCID: null,
  defaultReasonCID: null,
  recoveredFromDefault: false,
  defaultedAt: null,
  settlementRelationshipEntityId: null,
  createdAt: 1,
  updatedAt: 2,
};

const stats: CreditPoolStats = {
  id: "42161-7",
  chainId: 42161,
  poolId: 7n,
  garden: loan.garden,
  token: TOKEN,
  borrowerCap: 1_000n,
  enabled: false,
  creditIssued: 100n,
  creditRepaid: 40n,
  creditOutstanding: 60n,
  repaymentRateNumerator: 40n,
  repaymentRateDenominator: 100n,
  defaultRateNumerator: 0n,
  defaultRateDenominator: 1n,
  updatedAt: 2,
};

const relationship: LoanPrincipalRelationship = {
  id: "42161-501",
  chainId: 42161,
  disbursementId: 501n,
  creditRegistry: "0x8080808080808080808080808080808080808080",
  loanId: 11n,
  updatedAt: 2,
};

describe("Credit query hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCreditLoan.mockResolvedValue(loan);
    mocks.getCreditLoansForSubject.mockResolvedValue([loan]);
    mocks.getCreditPoolStats.mockResolvedValue(stats);
    mocks.getLoanPrincipalRelationship.mockResolvedValue(relationship);
  });

  it("keeps unauthenticated loan reads idle and returns no personal payload", async () => {
    const { result } = renderHookWithProviders(() =>
      useCreditLoan({ chainId: 42161, loanId: 11n, viewer: undefined, isCurrentSteward: false })
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mocks.getCreditLoan).not.toHaveBeenCalled();
    expect(result.current.disclosure).toEqual({ status: "unauthenticated" });
    expect(result.current.loan).toBeNull();
    expect(result.current).not.toHaveProperty("data");
  });

  it("never exposes the raw loan result to unrelated or former-steward viewers", async () => {
    const { result, rerender } = renderHookWithProviders(
      ({ isCurrentSteward }: { isCurrentSteward: boolean }) =>
        useCreditLoan({ chainId: 42161, loanId: 11n, viewer: VIEWER, isCurrentSteward }),
      { initialProps: { isCurrentSteward: false } }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.disclosure).toEqual({ status: "hidden" });
    expect(result.current.loan).toBeNull();
    expect(result.current).not.toHaveProperty("data");

    rerender({ isCurrentSteward: true });
    await waitFor(() => expect(result.current.loan).toEqual(loan));
    expect(result.current).not.toHaveProperty("data");

    rerender({ isCurrentSteward: false });
    await waitFor(() => expect(result.current.loan).toBeNull());
    expect(result.current.disclosure).toEqual({ status: "hidden" });
    expect(result.current).not.toHaveProperty("data");
  });

  it("shows a loan to its subject without returning a second raw-data escape hatch", async () => {
    const { result } = renderHookWithProviders(() =>
      useCreditLoan({ chainId: 42161, loanId: 11n, viewer: BORROWER, isCurrentSteward: false })
    );

    await waitFor(() => expect(result.current.loan).toEqual(loan));
    expect(result.current.disclosure).toEqual({ status: "visible", loan });
    expect(result.current).not.toHaveProperty("data");
  });

  it("keeps subject lists idle for unrelated viewers and clears cached rows after steward loss", async () => {
    const unrelated = renderHookWithProviders(() =>
      useCreditSubjectLoans({
        chainId: 42161,
        poolId: 7n,
        subject: BORROWER,
        viewer: VIEWER,
        isCurrentSteward: false,
      })
    );
    await waitFor(() => expect(unrelated.result.current.fetchStatus).toBe("idle"));
    expect(mocks.getCreditLoansForSubject).not.toHaveBeenCalled();
    expect(unrelated.result.current.disclosureStatus).toBe("hidden");
    expect(unrelated.result.current.loans).toEqual([]);
    expect(unrelated.result.current).not.toHaveProperty("data");
    unrelated.unmount();

    const steward = renderHookWithProviders(
      ({ isCurrentSteward }: { isCurrentSteward: boolean }) =>
        useCreditSubjectLoans({
          chainId: 42161,
          poolId: 7n,
          subject: BORROWER,
          viewer: VIEWER,
          isCurrentSteward,
        }),
      { initialProps: { isCurrentSteward: true } }
    );
    await waitFor(() => expect(steward.result.current.loans).toEqual([loan]));
    expect(steward.result.current).not.toHaveProperty("data");

    steward.rerender({ isCurrentSteward: false });
    await waitFor(() => expect(steward.result.current.loans).toEqual([]));
    expect(steward.result.current.disclosureStatus).toBe("hidden");
    expect(steward.result.current).not.toHaveProperty("data");
  });

  it("keeps aggregate reads available when pool credit writes are disabled", async () => {
    const { result } = renderHookWithProviders(() =>
      useCreditPoolStats({ chainId: 42161, poolId: 7n })
    );

    await waitFor(() => expect(result.current.stats).toEqual(stats));
    expect(mocks.getCreditPoolStats).toHaveBeenCalledWith(42161, 7n);
  });

  it("keeps zero settlement relationships idle and resolves a present relationship", async () => {
    const { result, rerender } = renderHookWithProviders(
      ({ disbursementId }: { disbursementId: bigint }) =>
        useLoanPrincipalRelationship({ chainId: 42161, disbursementId }),
      { initialProps: { disbursementId: 0n } }
    );
    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mocks.getLoanPrincipalRelationship).not.toHaveBeenCalled();
    expect(result.current.relationship).toBeNull();

    rerender({ disbursementId: 501n });
    await waitFor(() => expect(result.current.relationship).toEqual(relationship));
    expect(mocks.getLoanPrincipalRelationship).toHaveBeenCalledWith(42161, 501n);
  });

  it("surfaces indexer failures without converting them into an empty success", async () => {
    const error = new Error("credit indexer unavailable");
    mocks.getCreditPoolStats.mockRejectedValue(error);
    const { result } = renderHookWithProviders(() =>
      useCreditPoolStats({ chainId: 42161, poolId: 7n })
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.stats).toBeNull();
  });
});
