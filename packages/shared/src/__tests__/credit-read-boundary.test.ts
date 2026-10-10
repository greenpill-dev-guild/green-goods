import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCreditLoan,
  getCreditLoansForSubject,
  getCreditPoolStats,
  getLoanPrincipalRelationship,
} from "../modules/commitment-pooling/data-credit";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));

const BORROWER = "0xAa00000000000000000000000000000000000001";
const GARDEN = "0xBb00000000000000000000000000000000000002";
const TOKEN = "0xCc00000000000000000000000000000000000003";
const REGISTRY = "0xDd00000000000000000000000000000000000004";

const rawLoan = {
  id: "42161-11",
  chainId: "42161",
  loanId: "11",
  creditRegistry: REGISTRY,
  poolId: "7",
  garden: GARDEN,
  borrower: BORROWER,
  requestedBy: BORROWER,
  recordedBy: GARDEN,
  commitmentId: "99",
  token: TOKEN,
  principal: "1000",
  repaidAmount: "250",
  outstanding: "750",
  feeAmount: "0",
  rail: "TREASURY",
  disbursementId: "501",
  state: "DISBURSED",
  dueDate: "1800000000",
  installmentsTotal: "4",
  installmentsPaid: "1",
  attempts: "2",
  executionRef: "0xABCD",
  termsCID: "ipfs://terms",
  reasonCID: null,
  defaultReasonCID: null,
  recoveredFromDefault: false,
  defaultedAt: null,
  settlementRelationshipEntityId: "42161-501",
  createdAt: "1700000000",
  updatedAt: "1700000100",
};

const rowByOperation: Record<string, { field: string; row: Record<string, unknown> }> = {
  getCreditLoan: { field: "Loan", row: rawLoan },
  getCreditLoansForSubject: { field: "Loan", row: rawLoan },
  getCreditPoolStats: {
    field: "CreditPoolStats",
    row: {
      id: "42161-7",
      chainId: "42161",
      poolId: "7",
      garden: GARDEN,
      token: TOKEN,
      borrowerCap: "5000",
      enabled: true,
      creditIssued: "1000",
      creditRepaid: "250",
      creditOutstanding: "750",
      repaymentRateNumerator: "250",
      repaymentRateDenominator: "1000",
      defaultRateNumerator: "0",
      defaultRateDenominator: "1",
      updatedAt: "1700000100",
    },
  },
  getLoanPrincipalRelationship: {
    field: "LoanPrincipalRelationship",
    row: {
      id: "42161-501",
      chainId: "42161",
      disbursementId: "501",
      creditRegistry: REGISTRY,
      loanId: "11",
      updatedAt: "1700000100",
    },
  },
};

describe("Credit public read boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) => {
        const result = rowByOperation[operation];
        return { data: { [result.field]: [result.row] } };
      }
    );
  });

  it("keeps every query chain scoped and borrower lists subject scoped", async () => {
    await getCreditLoan(42161, 11n);
    await getCreditLoansForSubject(42161, 7n, BORROWER);
    await getCreditPoolStats(42161, 7n);
    await getLoanPrincipalRelationship(42161, 501n);

    const calls = Object.fromEntries(
      mocks.query.mock.calls.map(([document, variables, operation]) => [
        operation,
        { document, variables },
      ])
    );
    expect(calls.getCreditLoan.document).toContain("id: { _eq: $id }");
    expect(calls.getCreditLoan.variables).toEqual({ id: "42161-11" });
    expect(calls.getCreditLoansForSubject.document).toContain("chainId: { _eq: $chainId }");
    expect(calls.getCreditLoansForSubject.document).toContain("poolId: { _eq: $poolId }");
    expect(calls.getCreditLoansForSubject.document).toContain("borrower: { _eq: $borrower }");
    expect(calls.getCreditLoansForSubject.variables).toEqual({
      chainId: 42161,
      poolId: "7",
      borrower: BORROWER.toLowerCase(),
    });
    expect(calls.getCreditPoolStats.variables).toEqual({ id: "42161-7" });
    expect(calls.getLoanPrincipalRelationship.variables).toEqual({ id: "42161-501" });
  });

  it("maps indexer scalar strings into the public Credit types", async () => {
    const loan = await getCreditLoan(42161, 11n);
    const stats = await getCreditPoolStats(42161, 7n);
    const relationship = await getLoanPrincipalRelationship(42161, 501n);

    expect(loan).toMatchObject({
      chainId: 42161,
      loanId: 11n,
      borrower: BORROWER.toLowerCase(),
      principal: 1000n,
      repaidAmount: 250n,
      feeAmount: 0n,
      executionRef: "0xabcd",
    });
    expect(stats).toMatchObject({
      poolId: 7n,
      creditIssued: 1000n,
      repaymentRateNumerator: 250n,
      repaymentRateDenominator: 1000n,
    });
    expect(relationship).toMatchObject({
      disbursementId: 501n,
      creditRegistry: REGISTRY.toLowerCase(),
      loanId: 11n,
    });
  });
});
