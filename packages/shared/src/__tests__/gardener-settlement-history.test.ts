import { describe, expect, it, vi } from "vitest";
import { getGardenerSettlementHistory } from "../modules/commitment-pooling/data-gardener-settlement";
import type { GraphQLReader } from "../modules/data/graphql-client";

const ACCOUNT = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD";
const PAYOUT = {
  id: "42161-2-contributor",
  chainId: 42161,
  payoutPlanId: "2",
  commitmentId: "3",
  contributor: ACCOUNT.toLowerCase(),
  recipient: ACCOUNT.toLowerCase(),
  amount: "100",
  paymentSnapshotVersion: 1,
  recognitionWeightBps: 10000,
  paymentWeightBps: 10000,
  disbursementId: "4",
  disbursementEntityId: "42161-4",
  editedBy: ACCOUNT,
  createdAt: 100,
  updatedAt: 100,
};

function setup(state: string | null, execution: Record<string, unknown> | null = null) {
  const query = vi.fn(async (_document: unknown, _variables: unknown, operation: string) => {
    const rows: Record<string, unknown[]> = {
      getGardenerContributorPayouts: [PAYOUT],
      CommitmentPayoutPlanByIds: [
        { id: "42161-2", chainId: 42161, payoutPlanId: "2", commitmentId: "3", updatedAt: 100 },
      ],
      CommitmentByIds: [{ id: "42161-3", metadataCID: "bafy-metadata" }],
      DisbursementByIds: state
        ? [
            {
              id: "42161-4",
              chainId: 42161,
              disbursementId: "4",
              state,
              executionKey: "0xabc",
              dispatchedAt: 100,
              confirmedAt: state === "CONFIRMED" ? 120 : null,
              updatedAt: 120,
              cancelledFromState: "FAILED",
            },
          ]
        : [],
      getGardenerSettlementExecutions: execution ? [{ executionKey: "0xabc", ...execution }] : [],
    };
    const entity =
      operation === "getGardenerContributorPayouts"
        ? "ContributorPayout"
        : operation === "getGardenerSettlementExecutions"
          ? "SettlementExecution"
          : operation.replace("ByIds", "");
    return { data: { [entity]: rows[operation] ?? [] } };
  });
  return { query, reader: { query } as unknown as GraphQLReader };
}

describe("gardener settlement history", () => {
  it.each([
    ["QUEUED", null, "queued"],
    ["DISPATCHED", null, "dispatched"],
    [
      "DISPATCHED",
      { status: "SUCCESS", acknowledgmentSent: false },
      "executed-acknowledgment-pending",
    ],
    [
      "DISPATCHED",
      { status: "SUCCESS", acknowledgmentSent: true },
      "executed-acknowledgment-pending",
    ],
    ["DISPATCHED", { status: "FAILED", acknowledgmentSent: false }, "dispatched"],
    ["CONFIRMED", null, "confirmed"],
    ["FAILED", null, "failed"],
    ["CANCELLED", null, "cancelled"],
    ["UNKNOWN", null, "unknown"],
    [null, null, "not-started"],
  ])("derives %s with %j as %s", async (state, execution, expected) => {
    const { reader } = setup(state, execution);
    const receipts = await getGardenerSettlementHistory(42161, ACCOUNT, { reader, now: 200 });
    expect(receipts[0].delivery.status).toBe(expected);
    expect(receipts[0]).toMatchObject({
      amount: 100n,
      commitmentId: 3n,
      chainId: 42220,
      title: null,
    });
  });

  it("queries contributor identity and source chain, joins execution keys, and marks delayed dispatch", async () => {
    const { reader, query } = setup("DISPATCHED");
    const receipts = await getGardenerSettlementHistory(42161, ACCOUNT, { reader, now: 2000 });
    expect(receipts[0].delivery.status).toBe("delivery-delayed");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("contributor: { _eq: $account }"),
      { chainId: 42161, account: ACCOUNT.toLowerCase() },
      "getGardenerContributorPayouts"
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("sourceChainId: { _eq: $sourceChainId }"),
      { sourceChainId: 42161, executionKeys: ["0xabc"] },
      "getGardenerSettlementExecutions"
    );
  });

  it("retains receipts when commitment metadata relations fail", async () => {
    const { reader, query } = setup("CONFIRMED");
    const original = query.getMockImplementation()!;
    query.mockImplementation(async (doc, variables, operation) => {
      if (operation === "CommitmentByIds") throw new Error("metadata unavailable");
      return original(doc, variables, operation);
    });
    const receipts = await getGardenerSettlementHistory(42161, ACCOUNT, { reader });
    expect(receipts[0]).toMatchObject({
      commitmentId: 3n,
      metadataCID: null,
      title: null,
      metadataUnavailable: true,
      delivery: { status: "confirmed" },
    });
  });

  it("sorts recent receipts first with stable ID tie breaking", async () => {
    const { reader, query } = setup("QUEUED");
    query.mockResolvedValueOnce({
      data: {
        ContributorPayout: [
          { ...PAYOUT, id: "older", createdAt: 50, updatedAt: 50 },
          { ...PAYOUT, id: "z", createdAt: 200, updatedAt: 200 },
          { ...PAYOUT, id: "a", createdAt: 200, updatedAt: 200 },
        ],
      },
    });
    expect(
      (await getGardenerSettlementHistory(42161, ACCOUNT, { reader })).map((row) => row.id)
    ).toEqual(["a", "z", "older"]);
  });
});
