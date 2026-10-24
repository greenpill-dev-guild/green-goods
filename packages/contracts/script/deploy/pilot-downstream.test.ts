// TEST-QUALITY: allow-small-test-file - Transaction envelope and canonicality failures must stop this one-shot operator before a deployment can become a completed checkpoint.
import { describe, expect, it } from "vitest";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { assertDownstreamReceipt } from "./pilot-downstream";
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
