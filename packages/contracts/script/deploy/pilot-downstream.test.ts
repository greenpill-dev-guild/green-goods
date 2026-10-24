// TEST-QUALITY: allow-small-test-file - Transaction envelope and canonicality failures must stop this one-shot operator before a deployment can become a completed checkpoint.
import { describe, expect, it } from "vitest";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import type { SourceUpgradePlan } from "../utils/source-upgrade-release";
import type { SourceExecutionJournal } from "../utils/source-upgrade-execution-types";
import { assertDownstreamReceipt, sourceImplementationCheckpoint } from "./pilot-downstream";
const sender = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
function fixture() {
  const tx = {
    chainId: 100,
    from: sender,
    nonce: 0,
    to: null,
    value: "0",
    data: "0x6000",
    address: "0x0000000000000000000000000000000000001234",
  };
  const bound = { gasLimit: "100000" };
  const sent = {
    hash: "0x" + "11".repeat(32),
    from: sender,
    nonce: 0,
    to: null,
    data: tx.data,
    value: 0n,
    chainId: 100n,
    gasLimit: 100000n,
    maxFeePerGas: 2000000000n,
    maxPriorityFeePerGas: 1000000000n,
    blockNumber: 123,
    blockHash: "0x" + "22".repeat(32),
  } as TransactionResponse;
  const receipt = {
    hash: sent.hash,
    blockNumber: 123,
    blockHash: sent.blockHash,
    status: 1,
    gasUsed: 90000n,
    gasPrice: 1000000000n,
    contractAddress: tx.address,
  } as TransactionReceipt;
  return { tx, bound, sent, receipt };
}
describe("downstream deployer receipt boundary", () => {
  it("accepts the exact zero-value envelope and canonical successful CREATE", () => {
    const f = fixture();
    expect(() => assertDownstreamReceipt(f.tx, f.bound, f.sent, f.receipt, f.receipt.blockHash)).not.toThrow();
  });
  it.each([
    "value",
    "nonce",
    "chainId",
    "data",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
  ] as const)("rejects changed transaction %s", (key) => {
    const f = fixture();
    const changes = {
      value: 1n,
      nonce: 1,
      chainId: 42161n,
      data: "0x6001",
      maxFeePerGas: 3000000000n,
      maxPriorityFeePerGas: 2000000000n,
    };
    expect(() =>
      assertDownstreamReceipt(
        f.tx,
        f.bound,
        { ...f.sent, [key]: changes[key] } as TransactionResponse,
        f.receipt,
        f.receipt.blockHash,
      ),
    ).toThrow();
  });
  it.each([
    "hash",
    "blockHash",
    "contractAddress",
    "gasUsed",
    "gasPrice",
  ] as const)("rejects changed receipt %s", (key) => {
    const f = fixture();
    const changes = {
      hash: "0x" + "33".repeat(32),
      blockHash: "0x" + "44".repeat(32),
      contractAddress: sender,
      gasUsed: 100001n,
      gasPrice: 2000000001n,
    };
    expect(() =>
      assertDownstreamReceipt(
        f.tx,
        f.bound,
        f.sent,
        { ...f.receipt, [key]: changes[key] } as TransactionReceipt,
        f.receipt.blockHash,
      ),
    ).toThrow();
  });
  it("rejects a receipt removed from the canonical chain", () => {
    const f = fixture();
    expect(() => assertDownstreamReceipt(f.tx, f.bound, f.sent, f.receipt, "0x" + "55".repeat(32))).toThrow(
      "Canonical",
    );
  });
});

describe("source implementation checkpoint identity", () => {
  const pooling = "0xC186ee4BaA1094E73d33b8AFB519DF73Fe4F6c4d";
  const settlement = "0xaa8bd756588d83262AFbBc47c573bADded2333ac";
  function sourceFixture() {
    const deployments = Array.from({ length: 23 }, (_, i) => ({
      key: `fixture-library-${i}`,
      kind: "library",
      address: sender,
    }));
    deployments[14] = {
      key: "src/modules/CommitmentPooling.sol:CommitmentPoolingModule",
      kind: "implementation",
      address: pooling,
    };
    deployments[22] = {
      key: "src/modules/SettlementModule.sol:SettlementModule",
      kind: "implementation",
      address: settlement,
    };
    const completed = deployments.map((_, i) => ({
      step: i + 1,
      runtimeHash: "0x" + (i + 1).toString(16).padStart(64, "0"),
    }));
    return {
      plan: { deployments } as Pick<SourceUpgradePlan, "deployments">,
      completed: completed as SourceExecutionJournal["completed"],
    };
  }
  it("selects the deployed Pooling implementation before the Settlement libraries", () => {
    const f = sourceFixture();
    const selected = sourceImplementationCheckpoint(f.plan, f.completed, "pooling");
    expect(selected.planned.address).toBe(pooling);
    expect(selected.checkpoint.step).toBe(15);
  });
  it("keeps the Settlement implementation paired with its own receipt", () => {
    const f = sourceFixture();
    const selected = sourceImplementationCheckpoint(f.plan, [...f.completed].reverse(), "settlement");
    expect(selected.planned.address).toBe(settlement);
    expect(selected.checkpoint.step).toBe(23);
  });
  it("rejects a missing implementation or its missing receipt checkpoint", () => {
    const f = sourceFixture();
    expect(() =>
      sourceImplementationCheckpoint(
        f.plan,
        f.completed.filter((c) => c.step !== 15),
        "pooling",
      ),
    ).toThrow("checkpoint");
    f.plan.deployments[14].key = "wrong-contract";
    expect(() => sourceImplementationCheckpoint(f.plan, f.completed, "pooling")).toThrow("checkpoint");
  });
});
