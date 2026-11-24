/** @direct-test-subject ./source-upgrade-batch */
import { Interface, keccak256, TypedDataEncoder } from "ethers";
import { describe, expect, it } from "vitest";
import { sourceSafeSigningFixture } from "./source-upgrade-safe-signing.fixtures";
import { SOURCE_SAFE_EXECUTION } from "./source-upgrade-safe-execution";
import { sourceBatchBinaryFixture } from "./source-upgrade-batch-binary.fixtures";
import { resolveCommand } from "../cli/operations.mjs";
import {
  buildSourceSafeBatch,
  sourceBatchBuilderFile,
  assertSourceBatchOuter,
  assertSourceBatchSuccess,
  SOURCE_MULTISEND,
} from "./source-upgrade-batch";

async function fixture() {
  const f = await sourceSafeSigningFixture();
  const abi = new Interface(["function setPaused(bool)", "function upgradeTo(address)"]);
  const target = f.context.manifest.pooling.proxy;
  f.context.plan.ownerCalls = [
    { target: "pooling", action: "pause", to: target, data: abi.encodeFunctionData("setPaused", [true]) },
    { target: "pooling", action: "upgrade", to: target, data: abi.encodeFunctionData("upgradeTo", [target]) },
    { target: "settlement", action: "pause", to: target, data: abi.encodeFunctionData("setPaused", [true]) },
    { target: "settlement", action: "upgrade", to: target, data: abi.encodeFunctionData("upgradeTo", [target]) },
  ].map((c, i) => ({
    ...c,
    from: f.context.manifest.authority.address,
    value: "0",
    operation: 0,
    safeNonce: 33 + i,
  })) as typeof f.context.plan.ownerCalls;
  return { ...f, batch: buildSourceSafeBatch(f.context.plan, 33) };
}
describe("atomic source owner batch", () => {
  it("exposes the batch workflow and explicit resume without accepting CLI owner signing or outer nonce inputs", () => {
    const common = [
      "release",
      "source-upgrades",
      "--plan",
      "p.json",
      "--rehearsal",
      "r.json",
      "--envelope",
      "e.json",
      "--resume-plan",
    ];
    const resolved = resolveCommand([...common, "--mode", "export-safe-batch", "--batch-rehearsal", "atomic.json"]);
    if (!("args" in resolved)) throw Error("Batch export resolved to help");
    expect(resolved.args).toContain("--export-safe-batch");
    expect(() => resolveCommand([...common, "--mode", "adopt-safe-batch", "--batch", "b.json"])).toThrow("receipt");
    expect(() =>
      resolveCommand([
        ...common,
        "--mode",
        "export-safe-batch",
        "--batch-rehearsal",
        "atomic.json",
        "--expected-nonce",
        "1062",
      ]),
    ).toThrow("Unexpected");
    expect(() => resolveCommand(["release", "source-upgrades", "--mode", "plan", "--resume-plan"])).toThrow(
      "Unexpected",
    );
  });
  it("rolls back all four calls on last-call failure, retries atomically and rejects replay on the actual pinned binaries", async () => {
    const proof = await sourceBatchBinaryFixture();
    expect(proof.atomicRollback).toBe(true);
    expect(proof.retrySucceeded).toBe(true);
    expect(proof.replayRejected).toBe(true);
    expect(proof.safeNonceAfter).toBe(1);
  });
  it("exports standard Transaction Builder rows in approved order without inventing owner signatures", async () => {
    const f = await fixture();
    const file = sourceBatchBuilderFile(f.context.plan, false);
    expect(file.version).toBe("1.0");
    expect(file.chainId).toBe("42161");
    expect(file.meta.createdFromSafeAddress).toBe(f.context.manifest.authority.address);
    expect(file.transactions.map((r) => r.data)).toEqual(f.context.plan.ownerCalls.map((r) => r.data));
    expect(file.transactions.every((r) => r.value === "0")).toBe(true);
    expect(file.meta.description).toContain("DRAFT");
  });
  it("encodes one delegatecall to pinned MultiSendCallOnly with four inner CALLs and one Safe nonce", async () => {
    const f = await fixture();
    expect(f.batch.message.to).toBe(SOURCE_MULTISEND.address);
    expect(f.batch.message.operation).toBe(1);
    expect(f.batch.message.nonce).toBe(33);
    expect(f.batch.safeTransactionHash).toBe(
      TypedDataEncoder.hash(f.batch.domain, { SafeTx: f.batch.types.SafeTx }, f.batch.message),
    );
    const multi = new Interface(["function multiSend(bytes)"]);
    let packed = multi.decodeFunctionData("multiSend", f.batch.message.data)[0].slice(2);
    const seen: string[] = [];
    while (packed.length) {
      expect(packed.slice(0, 2)).toBe("00");
      expect(BigInt("0x" + packed.slice(42, 106))).toBe(0n);
      const length = Number(BigInt("0x" + packed.slice(106, 170)));
      seen.push("0x" + packed.slice(170, 170 + length * 2));
      packed = packed.slice(170 + length * 2);
    }
    expect(seen).toEqual(f.context.plan.ownerCalls.map((r) => r.data));
  });
  it("rejects reordered calls and nonzero native values before export", async () => {
    const f = await fixture();
    f.context.plan.ownerCalls.reverse();
    expect(() => buildSourceSafeBatch(f.context.plan, 33)).toThrow("order");
    f.context.plan.ownerCalls.reverse();
    f.context.plan.ownerCalls[0].value = "1" as "0";
    expect(() => buildSourceSafeBatch(f.context.plan, 33)).toThrow("zero");
  });
  it("accepts normal external Safe calldata but rejects wrapping, changed gas refunds and empty signatures", async () => {
    const f = await fixture(),
      b = f.batch.message;
    const values = [
      b.to,
      b.value,
      b.data,
      b.operation,
      b.safeTxGas,
      b.baseGas,
      b.gasPrice,
      b.gasToken,
      b.refundReceiver,
      "0x1234",
    ];
    const encode = (v: unknown[]) => SOURCE_SAFE_EXECUTION.encodeFunctionData("execTransaction", v);
    expect(() => assertSourceBatchOuter(encode(values), f.batch)).not.toThrow();
    for (const [index, replacement] of [
      [3, 0],
      [4, 1],
      [9, "0x"],
    ] as const) {
      const changed = [...values];
      changed[index] = replacement;
      expect(() => assertSourceBatchOuter(encode(changed), f.batch)).toThrow();
    }
  });
  it("requires exact Safe event hash and rejects ExecutionFailure even with outer success", async () => {
    const f = await fixture();
    const abi = new Interface([
      "event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)",
      "event ExecutionFailure(bytes32 indexed txHash,uint256 payment)",
    ]);
    const log = (name: string, hash = f.batch.safeTransactionHash) => ({
      address: f.context.manifest.authority.address,
      ...abi.encodeEventLog(abi.getEvent(name)!, [hash, 0]),
    });
    expect(() => assertSourceBatchSuccess([log("ExecutionSuccess")], f.batch)).not.toThrow();
    expect(() => assertSourceBatchSuccess([log("ExecutionFailure")], f.batch)).toThrow();
    expect(() => assertSourceBatchSuccess([log("ExecutionSuccess"), log("ExecutionFailure")], f.batch)).toThrow();
    expect(() => assertSourceBatchSuccess([log("ExecutionSuccess", keccak256("0x1234"))], f.batch)).toThrow();
  });
});
