import {
  voucherAuthorizationIdentity,
  voucherFinalDecisionId,
} from "../modules/commitment-pooling/service-access-voucher-hashes";
import { describe, expect, it, vi } from "vitest";
import { decodeFunctionResult, encodeFunctionResult, type Abi, type AbiParameter } from "viem";
import SourceABI from "@green-goods/contracts/abis/VoucherRedemptionModule.json";
import AcceptanceABI from "@green-goods/contracts/abis/ICommitmentVoucherAcceptance.json";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import { readVoucherServiceSetups } from "../modules/commitment-pooling/service-access-voucher-chain";
import {
  mapVoucherAuthorization,
  mapVoucherFinalResult,
  mapVoucherSetupResult,
} from "../modules/commitment-pooling/service-access-voucher-chain-mappers";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";

const ZERO = `0x${"0".repeat(40)}` as const,
  EMPTY = `0x${"0".repeat(64)}` as const;
const HASH = `0x${"e".repeat(64)}` as const;
const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  commitmentId: 1024n,
  buyer: "0x0000000000000000000000000000000000000200",
};
function empty(p: AbiParameter): unknown {
  if (p.type === "tuple" && "components" in p)
    return Object.fromEntries(p.components.map((v) => [v.name, empty(v)]));
  if (p.type === "address") return ZERO;
  if (p.type === "bytes32") return EMPTY;
  if (p.type === "bool") return false;
  if (p.type.startsWith("uint")) return 0n;
  throw new Error(`Unhandled ABI default ${p.type}`);
}
function blank(abi: Abi, name: string) {
  const f = abi.find((v) => v.type === "function" && v.name === name);
  if (!f || f.type !== "function") throw new Error("Missing real ABI");
  return empty(f.outputs[0]!);
}
function round(abi: Abi, functionName: string, result: unknown) {
  return decodeFunctionResult({
    abi,
    functionName,
    data: encodeFunctionResult({ abi, functionName, result }),
  });
}
function fixture() {
  const s = createServiceRehearsalSnapshot(key),
    original = s.voucherSetups[0]!,
    a = original.authorization;
  const setupResult = {
    version: 2,
    setupId: original.setupId,
    authorizationHash: original.authorizationHash,
    resultSequence: 2n,
    phase: 2,
    decision: 0,
    issuerApproved: true,
    depositReceiptHash: original.source.acceptedEver!.depositReceiptHash,
    depositedUnits: 100n,
    setupRefundedUnits: 0n,
    appliedDecisionId: EMPTY,
    actionSucceeded: true,
    failureHash: EMPTY,
  };
  const table: Record<string, unknown> = {
    voucherAcceptanceProtocolVersion: 1,
    voucherServiceSetupModule: a.sourceModule,
    commitmentPooling: key.coreModule,
    LOCAL_CHAIN_ID: 42161n,
    remoteChainId: 100n,
    remotePeer: a.destinationEscrow,
    paused: false,
    getVoucherServiceAcceptance: round(
      AcceptanceABI as Abi,
      "getVoucherServiceAcceptance",
      original.source.acceptedEver
    ),
    setupOfClaim: original.setupId,
    getSetupAuthorization: round(SourceABI as Abi, "getSetupAuthorization", a),
    getSetup: round(SourceABI as Abi, "getSetup", {
      authorizationHash: original.authorizationHash,
      depositReceiptHash: setupResult.depositReceiptHash,
      decisionId: EMPTY,
      lastPrepareMessageId: HASH,
      lastDecisionMessageId: EMPTY,
      latestResultHash: HASH,
      latestResultSequence: 2n,
      decisionAt: 0n,
      decision: 0,
      latestDestinationPhase: 2,
      depositedUnits: 100n,
      setupRefundedUnits: 0n,
    }),
    getSetupResult: round(SourceABI as Abi, "getSetupResult", setupResult),
    getFinalResult: round(
      SourceABI as Abi,
      "getFinalResult",
      blank(SourceABI as Abi, "getFinalResult")
    ),
  };
  const read = vi.fn(
    async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      if (args?.[0] === HASH) throw new Error("Stale projection setup");
      if (!(functionName in table)) throw new Error(`Missing view ${functionName}`);
      return table[functionName];
    }
  );
  const readBlock = vi.fn(async () => ({
    timestamp: 999999n,
    number: 9007199254740993n,
    hash: HASH,
  }));
  s.voucherSetups = [];
  s.currentVoucherSetupId = null;
  s.sourceTimestamp = null;
  return { s, original, a, setupResult, table, read, readBlock };
}

describe("strict v2 authoritative setup reads", () => {
  it("roundtrips the full real24-field ABI and retains uint64/token values above Number precision", () => {
    const f = fixture();
    const a = {
      ...f.a,
      termsRevision: (1n << 63n) + 7n,
      requestNonce: (1n << 63n) + 9n,
      voucherUnits: 1n << 180n,
    };
    const parsed = mapVoucherAuthorization(
      round(SourceABI as Abi, "getSetupAuthorization", a),
      key,
      a.sourceModule
    );
    expect(parsed).toEqual(a);
    expect(voucherAuthorizationIdentity(parsed).setupId).not.toBe(f.original.setupId);
    for (const patch of [
      { version: 1 },
      { sourceChainId: 100 },
      { token: "malformed" },
      { requestNonce: 9 },
      { termsHash: "0x01" },
    ])
      expect(() => mapVoucherAuthorization({ ...a, ...patch }, key, a.sourceModule)).toThrow();
  });

  it("discovers a permanent accepted receipt without current consent or Indexer availability", async () => {
    const f = fixture();
    f.s.consent = null;
    await readVoucherServiceSetups(f.s, f.read, {
      discoverSetups: async () => {
        throw new Error("Indexer unavailable");
      },
      readBlock: f.readBlock,
    });
    expect(f.s.voucherSetups).toHaveLength(1);
    expect(f.s.voucherSetups[0]).toMatchObject({
      relationship: "prior",
      source: { timestamp: 999999n, acceptedEver: { setupId: f.original.setupId } },
    });
    expect(f.s.sourceBlock).toEqual({ number: 9007199254740993n, hash: HASH, finality: "latest" });
    expect(
      f.read.mock.calls.every(
        ([call]) => !["sendTransaction", "writeContract"].includes(call.functionName)
      )
    ).toBe(true);
    expect(f.s.capabilities.mutation).toBe("local-rehearsal"); // This test starts from a labeled local fixture; reader never grants capability.
  });

  it("isolates an invalid projected row without losing a validated old recovery", async () => {
    const f = fixture();
    await readVoucherServiceSetups(f.s, f.read, {
      discoverSetups: async () => [HASH, f.original.setupId],
      readBlock: f.readBlock,
    });
    expect(f.s.voucherSetups.map((v) => v.setupId)).toEqual([f.original.setupId]);
    expect(f.s.capabilities.reasons).toContain("projection-incomplete");
  });

  it("keeps clock failure unknown and rejects mismatched source/destination pin, payload and receipt facts", async () => {
    const f = fixture();
    await readVoucherServiceSetups(f.s, f.read, {
      readBlock: async () => {
        throw new Error("timeout");
      },
    });
    expect(f.s.sourceTimestamp).toBeNull();
    expect(f.s.voucherSetups).toHaveLength(1);
    expect(f.s.capabilities.reasons).toContain("source-clock-unavailable");
    for (const patch of [
      { remotePeer: key.buyer },
      { commitmentPooling: key.buyer },
      {
        getVoucherServiceAcceptance: {
          ...f.original.source.acceptedEver,
          depositReceiptHash: HASH,
        },
      },
      { getSetup: { ...(f.table.getSetup as object), authorizationHash: HASH } },
    ]) {
      const bad = fixture();
      Object.assign(bad.table, patch);
      await readVoucherServiceSetups(bad.s, bad.read, { readBlock: bad.readBlock });
      expect(bad.s.voucherSetups).toEqual([]);
    }
  });

  it("accepts a frozen final result before the older activation ACK and rejects a different split digest", () => {
    const f = fixture(),
      allocation = {
        approvedDeliveredServiceUnits: 3n,
        releaseVoucherUnits: 40n,
        refundVoucherUnits: 60n,
      };
    const result = {
      protocolVersion: 2,
      setupId: f.original.setupId,
      payloadHash: f.original.authorizationHash,
      sequence: 3n,
      activationDecisionId: HASH,
      decisionId: voucherFinalDecisionId(f.a, HASH, allocation, 60n),
      issuerReturnApprovalAtFreeze: 60n,
      allocation,
      release: { state: 3, attempts: 1n, failureHash: EMPTY },
      refund: { state: 2, attempts: 1n, failureHash: HASH },
    };
    const parsed = mapVoucherFinalResult(
      round(SourceABI as Abi, "getFinalResult", result),
      f.original.setupId,
      f.original.authorizationHash,
      f.a
    );
    expect(parsed).toMatchObject({
      sequence: 3n,
      financiallyClosed: false,
      release: { state: "succeeded" },
      refund: { state: "failed" },
    });
    expect(() =>
      mapVoucherFinalResult(
        { ...result, allocation: { ...allocation, releaseVoucherUnits: 41n } },
        f.original.setupId,
        f.original.authorizationHash,
        f.a
      )
    ).toThrow();
  });

  it.each([
    { phase: 2, actionSucceeded: false, failureHash: HASH },
    { phase: 3, actionSucceeded: false, failureHash: HASH },
    { phase: 5, actionSucceeded: false, failureHash: HASH },
    { phase: 4, actionSucceeded: true },
    { depositedUnits: 50n },
    { depositReceiptHash: HASH },
  ])("rejects contradictory phase or deposit evidence %#", (patch) => {
    const f = fixture();
    expect(() =>
      mapVoucherSetupResult(
        { ...f.setupResult, ...patch },
        f.original.setupId,
        f.original.authorizationHash,
        f.a
      )
    ).toThrow();
  });
});
