import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), warn: vi.fn(), valueFunding: vi.fn() }));

vi.mock("../modules/commitment-pooling/funding-valuation", () => ({
  valueFundingReceiptsUsdCents: (...args: unknown[]) => mocks.valueFunding(...args),
}));

vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));
vi.mock("../modules/app/logger", () => ({
  logger: { warn: (...args: unknown[]) => mocks.warn(...args) },
}));
vi.mock("../config/blockchain", () => ({ DEFAULT_CHAIN_ID: 42161 }));

vi.mock("../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

import { getPublicCommitmentImpact } from "../modules/commitment-pooling/data-public-impact";

function containsAddressValue(value: unknown): boolean {
  if (typeof value === "string") return /^0x[0-9a-f]{40}$/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsAddressValue);
}

const TOKEN = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const TX = "0x" + "a".repeat(64);
const KEY = "0x" + "b".repeat(64);
const RECEIVED_AT = 1788220800;

describe("public commitment impact reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.valueFunding.mockResolvedValue(1234n);
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicCommitmentImpactPools")
        return {
          data: {
            CommitmentPool_aggregate: {
              aggregate: {
                sum: {
                  commitmentsOffered: "20",
                  commitmentsRequested: "7",
                  commitmentsFulfilled: "12",
                },
              },
            },
          },
        };
      if (operation === "getPublicCommitmentFundingReceipts")
        return {
          data: {
            Disbursement: [
              {
                id: "42161-1",
                amount: "8000000000000000000",
                token: TOKEN,
                executionKey: KEY,
                celoExecutionTx: undefined,
              },
            ],
          },
        };
      if (operation === "getPublicCommitmentFundingExecutions")
        return {
          data: {
            SettlementExecution: [{ executionKey: KEY, txHash: TX, createdAt: RECEIVED_AT }],
          },
        };
      return {
        data: { Disbursement_aggregate: { aggregate: { sum: { amount: "8000000000000000000" } } } },
      };
    });
  });

  it("returns made and kept counts plus historical dollar funding without addresses", async () => {
    const result = await getPublicCommitmentImpact(42161);
    const documents = mocks.query.mock.calls.map(([document]) => document).join("\n");
    expect(documents).toContain("state: { _eq: CONFIRMED }");
    expect(documents).toContain("kind: { _in: [FUNDING, GARDEN_BENEFICIARY] }");
    expect(documents).not.toContain("OpenCommitmentPool_aggregate");
    expect(documents).not.toMatch(/provider|recipient/i);
    expect(containsAddressValue(result)).toBe(false);
    expect(result).toEqual({
      commitmentsMade: 27n,
      commitmentsFulfilled: 12n,
      confirmedDisbursementTotal: 8000000000000000000n,
      confirmedDisbursementUsdCents: 1234n,
      partialData: false,
      unavailableSources: {
        commitmentPools: false,
        confirmedSettlement: false,
        fundingValuation: false,
      },
    });
    expect(mocks.valueFunding.mock.calls[0][0]).toEqual([
      { amount: 8000000000000000000n, token: TOKEN, receivedAt: RECEIVED_AT },
    ]);
    expect(documents).toContain("chainId: { _eq: 42220 }, sourceChainId: { _eq: $chainId }");
    expect(documents).toContain("status: { _eq: SUCCESS }");
    expect(documents).not.toContain("celoExecutionTx");
  });

  it("keeps closed-pool history in lifetime counts", async () => {
    await getPublicCommitmentImpact(42161);
    const document = mocks.query.mock.calls.find(
      ([, , operation]) => operation === "getPublicCommitmentImpactPools"
    )?.[0];
    expect(document).toContain("registrationSeen: { _eq: true }");
    expect(document).not.toMatch(/state:|cycleId/);
  });

  it("keeps commitment counts publishable when historical valuation fails", async () => {
    mocks.valueFunding.mockRejectedValue(new Error("historical price missing"));
    const result = await getPublicCommitmentImpact(42161);
    expect(result).toMatchObject({
      commitmentsMade: 27n,
      commitmentsFulfilled: 12n,
      confirmedDisbursementTotal: 8000000000000000000n,
      confirmedDisbursementUsdCents: null,
      partialData: true,
      unavailableSources: { fundingValuation: true, confirmedSettlement: false },
    });
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it("does not publish a dollar subtotal when receipt history is incomplete", async () => {
    const normal = mocks.query.getMockImplementation();
    mocks.query.mockImplementation(async (...args) =>
      args[2] === "getPublicCommitmentFundingReceipts"
        ? { data: { Disbursement: [] } }
        : normal?.(...args)
    );
    const result = await getPublicCommitmentImpact(42161);
    expect(result.confirmedDisbursementUsdCents).toBeNull();
    expect(result.unavailableSources.fundingValuation).toBe(true);
    expect(mocks.valueFunding).not.toHaveBeenCalled();
  });

  it("publishes an empty funding record without contacting a price service", async () => {
    const normal = mocks.query.getMockImplementation();
    mocks.query.mockImplementation(async (...args) =>
      args[2] === "getPublicCommitmentImpactSettlement"
        ? { data: { Disbursement_aggregate: { aggregate: { sum: { amount: null } } } } }
        : normal?.(...args)
    );
    const result = await getPublicCommitmentImpact(42161);
    expect(result.confirmedDisbursementUsdCents).toBe(0n);
    expect(result.partialData).toBe(false);
    expect(mocks.valueFunding).not.toHaveBeenCalled();
  });

  it("values every receipt when funding history spans multiple pages", async () => {
    const normal = mocks.query.getMockImplementation();
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: `42161-${String(index + 1).padStart(3, "0")}`,
      amount: "1",
      token: TOKEN,
      executionKey: KEY,
      celoExecutionTx: undefined,
    }));
    mocks.query.mockImplementation(async (...args) => {
      if (args[2] === "getPublicCommitmentImpactSettlement")
        return { data: { Disbursement_aggregate: { aggregate: { sum: { amount: "101" } } } } };
      if (args[2] === "getPublicCommitmentFundingReceipts")
        return { data: { Disbursement: args[1].after ? rows.slice(100) : rows.slice(0, 100) } };
      return normal?.(...args);
    });
    const result = await getPublicCommitmentImpact(42161);
    expect(result.confirmedDisbursementUsdCents).toBe(1234n);
    expect(mocks.valueFunding.mock.calls[0][0]).toHaveLength(101);
    const cursors = mocks.query.mock.calls
      .filter(([, , operation]) => operation === "getPublicCommitmentFundingReceipts")
      .map(([, variables]) => variables.after);
    expect(cursors).toEqual(["", "42161-100"]);
  });

  it.each([
    { executions: [] },
    { executions: [{ executionKey: KEY, txHash: TX, createdAt: 0 }] },
    { executions: [{ executionKey: KEY, txHash: null, createdAt: RECEIVED_AT }] },
    {
      executions: [
        { executionKey: KEY, txHash: TX, createdAt: RECEIVED_AT },
        { executionKey: KEY, txHash: TX, createdAt: RECEIVED_AT },
      ],
    },
  ])("withholds USD when indexed execution evidence is missing or invalid: %j", async ({
    executions,
  }) => {
    const normal = mocks.query.getMockImplementation();
    mocks.query.mockImplementation(async (...args) =>
      args[2] === "getPublicCommitmentFundingExecutions"
        ? { data: { SettlementExecution: executions } }
        : normal?.(...args)
    );
    const result = await getPublicCommitmentImpact(42161);
    expect(result.confirmedDisbursementTotal).toBe(8000000000000000000n);
    expect(result.confirmedDisbursementUsdCents).toBeNull();
    expect(mocks.valueFunding).not.toHaveBeenCalled();
  });

  it("bounds history reads and never publishes a capped subtotal", async () => {
    const normal = mocks.query.getMockImplementation();
    mocks.query.mockImplementation(async (...args) => {
      if (args[2] !== "getPublicCommitmentFundingReceipts") return normal?.(...args);
      const after = Number(args[1].after.split("-")[1] || 0);
      return {
        data: {
          Disbursement: Array.from({ length: 100 }, (_, index) => ({
            id: `42161-${String(after + index + 1).padStart(5, "0")}`,
            amount: "1",
            token: TOKEN,
            executionKey: KEY,
          })),
        },
      };
    });
    const result = await getPublicCommitmentImpact(42161);
    expect(result.confirmedDisbursementUsdCents).toBeNull();
    expect(
      mocks.query.mock.calls.filter((args) => args[2] === "getPublicCommitmentFundingReceipts")
    ).toHaveLength(11);
    expect(mocks.valueFunding).not.toHaveBeenCalled();
  });

  it.each([
    "getPublicCommitmentImpactPools",
    "getPublicCommitmentImpactSettlement",
  ])("preserves independent figures when %s fails", async (failedOperation) => {
    const normal = mocks.query.getMockImplementation();
    mocks.query.mockImplementation(async (...args) =>
      args[2] === failedOperation ? { error: new Error("indexer unavailable") } : normal?.(...args)
    );
    const result = await getPublicCommitmentImpact(42161);
    const poolFailed = failedOperation === "getPublicCommitmentImpactPools";
    expect(result.commitmentsMade).toBe(poolFailed ? null : 27n);
    expect(result.commitmentsFulfilled).toBe(poolFailed ? null : 12n);
    expect(result.confirmedDisbursementUsdCents).toBe(poolFailed ? 1234n : null);
    expect(result.partialData).toBe(true);
  });
});
