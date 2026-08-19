/** @vitest-environment jsdom */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../config/query-keys";
import { creditInvalidationKeys } from "../config/query-keys/credit";
import {
  type CreditPoolStats,
  type Loan,
  LoanRail,
  LoanState,
  deriveLoanDisplayState,
  resolveCreditLoanDisclosure,
  selectCommitmentCreditRows,
  selectCreditMutationPolicy,
  selectEditorialCreditPoolStats,
} from "../modules/commitment-pooling";
import { type CreditMutationInput, useCreditMutation } from "../hooks/commitment-pooling/useCredit";
import { createTestQueryClient, renderHookWithProviders } from "./test-utils";

const BORROWER = "0x1111111111111111111111111111111111111111";
const VIEWER = "0x2222222222222222222222222222222222222222";
const TOKEN = "0x3333333333333333333333333333333333333333";
const CREDIT_REGISTRY = "0x8080808080808080808080808080808080808080";

const mocks = vi.hoisted(() => ({
  sender: { sendContractCall: vi.fn() },
  senderAvailable: true,
  mutationErrorHandler: vi.fn(),
}));

vi.mock("../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => (mocks.senderAvailable ? mocks.sender : undefined),
}));

vi.mock("../utils/errors/contract-errors", () => ({
  parseContractError: () => ({ name: "MockCreditError" }),
}));

vi.mock("../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.mutationErrorHandler,
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
  commitmentId: 99n,
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
  garden: "0x4444444444444444444444444444444444444444",
  token: TOKEN,
  borrowerCap: 1_000n,
  enabled: true,
  creditIssued: 500n,
  creditRepaid: 300n,
  creditOutstanding: 200n,
  repaymentRateNumerator: 300n,
  repaymentRateDenominator: 500n,
  defaultRateNumerator: 1n,
  defaultRateDenominator: 4n,
  updatedAt: 2,
};

function sourceContains(root: string, pattern: RegExp): boolean {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory() && sourceContains(path, pattern)) return true;
    if (
      entry.isFile() &&
      /\.(?:ts|tsx)$/.test(entry.name) &&
      pattern.test(readFileSync(path, "utf8"))
    ) {
      return true;
    }
  }
  return false;
}

describe("Credit loan selectors", () => {
  it("derives Repaying without replacing contract hard states", () => {
    expect(deriveLoanDisplayState(loan)).toBe("REPAYING");
    expect(deriveLoanDisplayState({ ...loan, state: LoanState.DEFAULTED })).toBe("DEFAULTED");
    expect(
      deriveLoanDisplayState({
        ...loan,
        state: LoanState.REPAID,
        repaidAmount: 100n,
        outstanding: 0n,
      })
    ).toBe("REPAID");
  });

  it("does not invent a default transition before, at, or after the immutable due date", () => {
    for (const dueDate of [1_699_999_999n, 1_700_000_000n, 1_700_000_001n]) {
      expect(deriveLoanDisplayState({ ...loan, dueDate })).toBe("REPAYING");
      expect(
        deriveLoanDisplayState({
          ...loan,
          dueDate,
          repaidAmount: 0n,
          outstanding: 100n,
        })
      ).toBe(LoanState.DISBURSED);
    }
  });

  it("fails closed for unauthenticated, unrelated, and former-steward viewers", () => {
    expect(
      resolveCreditLoanDisclosure({ viewer: undefined, loan, isCurrentSteward: false })
    ).toEqual({ status: "unauthenticated" });
    expect(resolveCreditLoanDisclosure({ viewer: VIEWER, loan, isCurrentSteward: false })).toEqual({
      status: "hidden",
    });
    expect(
      resolveCreditLoanDisclosure({
        viewer: VIEWER,
        loan,
        isCurrentSteward: false,
      })
    ).toEqual({ status: "hidden" });
  });

  it("shows only the subject or a current pool steward", () => {
    expect(
      resolveCreditLoanDisclosure({ viewer: BORROWER, loan, isCurrentSteward: false })
    ).toEqual({ status: "visible", loan });
    expect(resolveCreditLoanDisclosure({ viewer: VIEWER, loan, isCurrentSteward: true })).toEqual({
      status: "visible",
      loan,
    });
  });

  it("returns aggregate-only editorial data with rational rates", () => {
    const editorial = selectEditorialCreditPoolStats(stats);
    expect(editorial.repaymentRate).toEqual({ numerator: 300n, denominator: 500n });
    expect(editorial.defaultRate).toEqual({ numerator: 1n, denominator: 4n });
    for (const forbidden of ["borrower", "loan", "score", "grade", "rank", "comparison"]) {
      expect(editorial).not.toHaveProperty(forbidden);
    }
  });

  it("keeps loan and consideration status on separate rows", () => {
    expect(selectCommitmentCreditRows({ loan, considerationStatus: "PAID" })).toEqual([
      { axis: "loan", status: "REPAYING", loanId: 11n },
      { axis: "consideration", status: "PAID" },
    ]);
  });
});

describe("Credit query and mutation boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.senderAvailable = true;
    mocks.sender.sendContractCall.mockResolvedValue({ hash: "0xabc" });
  });

  it("isolates every Credit query key by chain and viewer", () => {
    const prefix = queryKeys.credit.all(42161);
    const keys = [
      queryKeys.credit.loan(42161, 11n, BORROWER),
      queryKeys.credit.subjectLoans(42161, 7n, BORROWER, BORROWER),
      queryKeys.credit.poolStats(42161, 7n),
      queryKeys.credit.settlementRelationship(42161, 501n),
    ];
    for (const key of keys) expect(key.slice(0, prefix.length)).toEqual(prefix);
    expect(queryKeys.credit.all(42161)).not.toEqual(queryKeys.credit.all(42220));
    expect(queryKeys.credit.loan(42161, 11n, BORROWER)).not.toEqual(
      queryKeys.credit.loan(42161, 11n, VIEWER)
    );
    expect(queryKeys.credit.subjectLoans(42161, 7n, BORROWER, BORROWER)).not.toEqual(
      queryKeys.credit.subjectLoans(42161, 7n, BORROWER, VIEWER)
    );
  });

  it("returns explicit targeted invalidation without merging credit and consideration caches", () => {
    expect(
      creditInvalidationKeys({
        chainId: 42161,
        loanId: 11n,
        poolId: 7n,
        borrower: BORROWER,
        viewer: BORROWER,
      })
    ).toEqual([
      queryKeys.credit.all(42161),
      queryKeys.credit.loanPrefix(42161, 11n),
      queryKeys.credit.poolStats(42161, 7n),
      queryKeys.credit.subjectLoans(42161, 7n, BORROWER, BORROWER),
    ]);
  });

  it("keeps every Credit write online and rejects G$ repayment before sending", async () => {
    expect(selectCreditMutationPolicy({ action: "requestLoan" })).toEqual({
      available: true,
      mode: "online-only",
      reason: null,
    });
    expect(
      selectCreditMutationPolicy({ action: "recordRepayment", rail: LoanRail.GDOLLAR_SETTLEMENT })
    ).toEqual({
      available: false,
      mode: "online-only",
      reason: "g-dollar-repayment-disabled",
    });

    const { result } = renderHookWithProviders(() =>
      useCreditMutation({ chainId: 42161, creditRegistry: CREDIT_REGISTRY })
    );
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          action: "recordRepayment",
          loanId: 11n,
          poolId: 7n,
          borrower: BORROWER,
          rail: LoanRail.GDOLLAR_SETTLEMENT,
          amount: 10n,
          executionRef: "0x1234",
        })
      ).rejects.toThrow("G$ repayment is disabled");
    });
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(mocks.mutationErrorHandler).toHaveBeenCalled();
  });

  it("maps every supported online action to the frozen CreditRegistry call", async () => {
    const cases: Array<{ input: CreditMutationInput; args: readonly unknown[] }> = [
      {
        input: {
          action: "configurePoolCredit",
          poolId: 7n,
          token: TOKEN,
          borrowerCap: 1_000n,
          enabled: true,
        },
        args: [7n, TOKEN, 1_000n, true],
      },
      { input: { action: "addExecutor", poolId: 7n, executor: VIEWER }, args: [7n, VIEWER] },
      { input: { action: "removeExecutor", poolId: 7n, executor: VIEWER }, args: [7n, VIEWER] },
      {
        input: {
          action: "requestLoan",
          poolId: 7n,
          borrower: BORROWER,
          commitmentId: 99n,
          token: TOKEN,
          principal: 100n,
          dueDate: 1_800_000_000n,
          installmentsTotal: 2,
          termsCID: "ipfs://terms",
          onBehalfOf: BORROWER,
        },
        args: [
          {
            poolId: 7n,
            commitmentId: 99n,
            token: TOKEN,
            principal: 100n,
            dueDate: 1_800_000_000n,
            installmentsTotal: 2,
            termsCID: "ipfs://terms",
            onBehalfOf: BORROWER,
          },
        ],
      },
      { input: { action: "approveLoan", loanId: 11n }, args: [11n] },
      {
        input: {
          action: "recordDisbursed",
          loanId: 11n,
          rail: LoanRail.JAR,
          executionRef: "0x1234",
        },
        args: [11n, 1, "0x1234"],
      },
      {
        input: {
          action: "recordRepayment",
          loanId: 11n,
          rail: LoanRail.TREASURY,
          amount: 10n,
          executionRef: "0x1234",
        },
        args: [11n, 10n, "0x1234"],
      },
      {
        input: { action: "markDefaulted", loanId: 11n, reasonCID: "ipfs://late" },
        args: [11n, "ipfs://late"],
      },
      {
        input: { action: "cancelLoan", loanId: 11n, reasonCID: "ipfs://cancel" },
        args: [11n, "ipfs://cancel"],
      },
      { input: { action: "setPaused", paused: true }, args: [true] },
    ];
    const { result } = renderHookWithProviders(() =>
      useCreditMutation({ chainId: 42161, creditRegistry: CREDIT_REGISTRY })
    );

    for (const testCase of cases) {
      await act(async () => {
        await result.current.mutateAsync(testCase.input);
      });
      expect(mocks.sender.sendContractCall).toHaveBeenLastCalledWith({
        address: CREDIT_REGISTRY,
        abi: expect.any(Array),
        functionName: testCase.input.action,
        args: testCase.args,
        chainId: 42161,
      });
      expect(mocks.sender.sendContractCall.mock.lastCall?.[0]).not.toHaveProperty("value");
    }
  });

  it.each([
    {
      name: "missing transaction sender",
      registry: CREDIT_REGISTRY,
      configure: () => {
        mocks.senderAvailable = false;
      },
      message: "Transaction sender is unavailable",
    },
    {
      name: "zero CreditRegistry address",
      registry: "0x0000000000000000000000000000000000000000",
      configure: () => undefined,
      message: "Credit Registry is not deployed on this chain",
    },
  ])("fails closed for $name and reports mutation context", async ({
    registry,
    configure,
    message,
  }) => {
    configure();
    const { result } = renderHookWithProviders(() =>
      useCreditMutation({ chainId: 42161, creditRegistry: registry as typeof CREDIT_REGISTRY })
    );
    const input = { action: "approveLoan", loanId: 11n } as const;

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow(message);
    });
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(mocks.mutationErrorHandler).toHaveBeenCalledWith(expect.any(Error), {
      metadata: { action: "approveLoan", chainId: 42161, parsedErrorName: "MockCreditError" },
    });
  });

  it("sends supported records through the online transaction sender and invalidates Credit only", async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const input: CreditMutationInput = {
      action: "recordRepayment",
      loanId: 11n,
      poolId: 7n,
      borrower: BORROWER,
      rail: LoanRail.TREASURY,
      amount: 10n,
      executionRef: "0x1234",
    };
    const { result } = renderHookWithProviders(
      () => useCreditMutation({ chainId: 42161, creditRegistry: CREDIT_REGISTRY }),
      { queryClient }
    );
    await act(async () => {
      await expect(result.current.mutateAsync(input)).resolves.toBe("0xabc");
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(mocks.sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CREDIT_REGISTRY,
        functionName: "recordRepayment",
        args: [11n, 10n, "0x1234"],
        chainId: 42161,
      })
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.credit.all(42161) });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: queryKeys.credit.subjectLoans(42161, 7n, BORROWER, BORROWER),
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: queryKeys.commitmentPooling.all(42161),
    });
  });

  it("keeps raw borrower entities and generated indexer types out of client/admin", () => {
    const rawBinding =
      /@green-goods\/indexer|packages\/indexer\/\.envio|modules\/commitment-pooling\/data-credit|\b(?:CreditLoanProjection|LoanEvent|getCreditLoan|getCreditLoansForSubject)\b|\bLoan\s*\(\s*(?:where|limit|order_by)/;
    for (const packageName of ["client", "admin"]) {
      expect(sourceContains(resolve(process.cwd(), `../${packageName}/src`), rawBinding)).toBe(
        false
      );
    }
  });
});
