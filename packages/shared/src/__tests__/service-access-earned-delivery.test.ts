import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import { type Abi, decodeFunctionResult, encodeFunctionResult } from "viem";
import { describe, expect, it, vi } from "vitest";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import { readEarnedRewardDelivery } from "../modules/commitment-pooling/service-access-earned-delivery";
import type { ServiceChainRead } from "../modules/commitment-pooling/service-access-chain";
import type { GraphQLReader } from "../modules/data/graphql-client";
import { AdapterABI } from "../modules/commitment-pooling/service-issuer-abis";

vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: {
    query: vi.fn().mockResolvedValue({
      data: { VoucherDistributionCommand: [], VoucherDistributionAttempt: [] },
    }),
  },
}));

const key = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100" as const,
  commitmentId: 1024n,
  buyer: "0x0000000000000000000000000000000000000200" as const,
};
const adapter = "0x0000000000000000000000000000000000000300" as const;
const ID = `0x${"a".repeat(64)}` as const;
const PAYLOAD = `0x${"b".repeat(64)}` as const;
const MESSAGE = `0x${"c".repeat(64)}` as const;
const ZERO = `0x${"0".repeat(64)}` as const;

function snapshot() {
  const s = createServiceRehearsalSnapshot(key);
  delete s.pilot;
  s.coreState = "FULFILLED";
  Object.assign(s.acceptancePolicy.earned, {
    status: "bound",
    module: key.coreModule,
    termsHash: ID,
    terms: {
      issuer: key.buyer,
      issuerAuthority: key.buyer,
      asset: { chainId: 100, token: key.buyer, decimals: 6, symbol: "TEST" },
      totalUnits: 1_000_000n,
    },
  });
  return s;
}
function chain(
  options: {
    state?: number;
    destination?: "none" | "failed" | "delivered" | "unavailable";
    id?: typeof ID | typeof ZERO;
    mismatch?: boolean;
    wrongCommitment?: boolean;
    reserve?: bigint;
    allowance?: bigint;
  } = {}
) {
  const state = options.state ?? 2;
  const source = {
    commitmentId: options.wrongCommitment ? 999n : key.commitmentId,
    payloadHash: PAYLOAD,
    state,
    resultSequence: state >= 3 ? 1n : 0n,
    resultHash: state >= 3 ? ID : ZERO,
    failureHash: state === 3 ? ID : ZERO,
    lastMessageId: state === 1 ? ZERO : MESSAGE,
  };
  const destination = {
    payloadHash: options.mismatch ? ID : PAYLOAD,
    sequence: options.destination === "none" ? 0n : 2n,
    success: options.destination === "delivered",
    acknowledgmentSequence: 0n,
    failureHash: ID,
    acknowledgmentMessageId: ZERO,
    acknowledgmentFailureHash: ZERO,
  };
  const read = vi.fn<ServiceChainRead>(async ({ functionName }) => {
    if (functionName === "distributionOfCommitment") return options.id ?? ID;
    if (functionName === "balanceOf") return options.reserve ?? 1_000_000n;
    if (functionName === "allowance") return options.allowance ?? 1_000_000n;
    if (functionName === "getExecutionResult" && options.destination === "unavailable")
      throw Error("Destination RPC unavailable");
    const abi = functionName === "getDistribution" ? (EntitlementABI as Abi) : AdapterABI;
    const result = functionName === "getDistribution" ? source : destination;
    return decodeFunctionResult({
      abi,
      functionName,
      data: encodeFunctionResult({ abi, functionName, result }),
    });
  });
  return read;
}

describe("live earned voucher delivery", () => {
  it.each([
    ZERO,
    ID,
  ])("keeps a confirmed reward visible while awaiting preparation or dispatch: %s", async (id) => {
    expect(
      await readEarnedRewardDelivery(snapshot(), adapter, chain({ id, state: 1 }))
    ).toMatchObject({ status: "preparing", amount: 1_000_000n, messageId: null });
  });
  it("does not treat a successful source dispatch as destination delivery", async () => {
    expect(
      await readEarnedRewardDelivery(snapshot(), adapter, chain({ destination: "none" }))
    ).toMatchObject({ status: "on-the-way", messageId: MESSAGE });
  });
  it("recognizes destination success before its acknowledgment reaches the source", async () => {
    const read = chain({ destination: "delivered", reserve: 0n, allowance: 0n });
    expect(await readEarnedRewardDelivery(snapshot(), adapter, read)).toMatchObject({
      status: "received",
      attempts: 2n,
      shortOf: null,
    });
    expect(read.mock.calls.some(([call]) => call.functionName === "balanceOf")).toBe(false);
  });
  it("retains an authenticated source success even when destination reads are unavailable", async () => {
    const read = chain({ state: 4, destination: "unavailable" });
    expect(await readEarnedRewardDelivery(snapshot(), adapter, read)).toMatchObject({
      status: "received",
    });
    expect(read.mock.calls).toHaveLength(2);
  });
  it.each([
    [0n, 1_000_000n, "reserve"],
    [1_000_000n, 0n, "allowance"],
  ] as const)("keeps an actual destination failure recoverable for %s reserve / %s allowance", async (reserve, allowance, shortOf) => {
    expect(
      await readEarnedRewardDelivery(
        snapshot(),
        adapter,
        chain({ destination: "failed", reserve, allowance })
      )
    ).toMatchObject({ status: "waiting", shortOf });
  });
  it("does not call a failed transfer delivered just because the budget is now sufficient", async () => {
    expect(
      await readEarnedRewardDelivery(snapshot(), adapter, chain({ destination: "failed" }))
    ).toMatchObject({ status: "delayed", shortOf: null });
  });
  it.each([
    { mismatch: true },
    { wrongCommitment: true },
    { destination: "unavailable" as const },
  ])("shows unavailable instead of inventing success from inconsistent or missing data: %j", async (options) => {
    expect(
      await readEarnedRewardDelivery(
        snapshot(),
        adapter,
        chain({ destination: "delivered", ...options })
      )
    ).toMatchObject({ status: "unavailable" });
  });
  it("does not read or imply delivery before work is fulfilled", async () => {
    const s = snapshot();
    s.coreState = "ACCEPTED";
    const read = chain();
    expect(await readEarnedRewardDelivery(s, adapter, read)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });
});

function arrivalReader(
  patch: Record<string, unknown> = {},
  commandPatch: Record<string, unknown> = {}
): GraphQLReader {
  const commandId = `100-${adapter}-${ID}`;
  return {
    query: vi.fn().mockResolvedValue({
      data: {
        VoucherDistributionCommand: [
          {
            id: commandId,
            chainId: 100,
            moduleAddress: adapter,
            entitlementId: ID,
            payloadHash: PAYLOAD,
            recordedSeen: true,
            delivered: true,
            latestSequence: "2",
            ...commandPatch,
          },
        ],
        VoucherDistributionAttempt: [
          {
            id: `${commandId}-2`,
            chainId: 100,
            moduleAddress: adapter,
            entitlementId: ID,
            commandEntityId: commandId,
            sequence: "2",
            success: true,
            timestamp: 1792862400,
            ...patch,
          },
        ],
      },
    }),
  };
}

describe("voucher reward arrival time", () => {
  it("reads the successful destination attempt's time before the source acknowledgment arrives", async () => {
    const reader = arrivalReader();
    expect(
      await readEarnedRewardDelivery(
        snapshot(),
        adapter,
        chain({ destination: "delivered" }),
        reader
      )
    ).toMatchObject({ status: "received", receivedAt: 1792862400 });
    expect(reader.query).toHaveBeenCalledWith(
      expect.stringContaining("VoucherDistributionAttempt"),
      expect.objectContaining({ chain: 100, adapter, entitlement: ID, sequence: "2" }),
      "readVoucherRewardArrival"
    );
  });
  it("uses the destination event time after the source has acknowledged that attempt", async () => {
    const reader = arrivalReader(
      { sequence: "1", id: `100-${adapter}-${ID}-1` },
      { latestSequence: "1" }
    );
    expect(
      await readEarnedRewardDelivery(
        snapshot(),
        adapter,
        chain({ state: 4, destination: "unavailable" }),
        reader
      )
    ).toMatchObject({ status: "received", receivedAt: 1792862400 });
  });
  it("keeps source-confirmed delivery when the indexer has no arrival observation", async () => {
    const reader: GraphQLReader = {
      query: vi.fn().mockResolvedValue({ error: new Error("Indexer unavailable") }),
    };
    expect(
      await readEarnedRewardDelivery(snapshot(), adapter, chain({ state: 4 }), reader)
    ).toMatchObject({ status: "received", receivedAt: null });
  });
  it.each([
    { timestamp: 0 },
    { timestamp: -1 },
    { timestamp: "1792862400" },
    { chainId: 42161 },
    { moduleAddress: key.coreModule },
    { entitlementId: MESSAGE },
    { commandEntityId: "foreign" },
    { sequence: "1" },
    { success: false },
    { id: "foreign" },
  ])("does not attach an invalid or unrelated arrival: %j", async (patch) => {
    expect(
      await readEarnedRewardDelivery(
        snapshot(),
        adapter,
        chain({ destination: "delivered" }),
        arrivalReader(patch)
      )
    ).toMatchObject({ status: "received", receivedAt: null });
  });
  it("rejects a command for a different authorized payload", async () => {
    expect(
      await readEarnedRewardDelivery(
        snapshot(),
        adapter,
        chain({ destination: "delivered" }),
        arrivalReader({}, { payloadHash: MESSAGE })
      )
    ).toMatchObject({ status: "received", receivedAt: null });
  });
  it("never reads an arrival time for an undelivered reward", async () => {
    const reader = arrivalReader();
    expect(
      await readEarnedRewardDelivery(snapshot(), adapter, chain({ destination: "none" }), reader)
    ).toMatchObject({ status: "on-the-way", receivedAt: null });
    expect(reader.query).not.toHaveBeenCalled();
  });
});
