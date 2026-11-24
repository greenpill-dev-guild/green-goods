/** @direct-test-subject ./source-upgrade-batch-operator */
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sourceBatchOperatorFixture } from "./source-upgrade-batch-operator.fixtures";
import { runSourceBatchOperator } from "./source-upgrade-batch-operator";
import { SOURCE_EXECUTION_FILES } from "./source-upgrade-execution-store";
import { voucherDigest } from "./voucher-release";

const fixtures: Awaited<ReturnType<typeof sourceBatchOperatorFixture>>[] = [];
async function fixture() {
  const f = await sourceBatchOperatorFixture(runSourceBatchOperator);
  fixtures.push(f);
  return f;
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const f of fixtures.splice(0)) f.cleanup();
});
describe("standard Safe batch release and external receipt adoption", () => {
  it("releases only after all CREATE receipts and the exact atomic rehearsal, preserving the CREATE journal", async () => {
    const f = await fixture();
    const result = await f.export();
    expect(result.state).toBe("safe-transaction-builder-batch-ready");
    expect(JSON.parse(fs.readFileSync(result.output!, "utf8")).transactions).toHaveLength(4);
    expect(fs.readFileSync(path.join(f.directory, SOURCE_EXECUTION_FILES.journal), "utf8")).toBe(f.originalCreates);
  });
  it("rejects an incomplete deployment prefix and any ambiguous CREATE lock", async () => {
    const f = await fixture();
    fs.writeFileSync(path.join(f.directory, SOURCE_EXECUTION_FILES.lock), "public lock fixture");
    await expect(f.export()).rejects.toThrow("lock");
    fs.unlinkSync(path.join(f.directory, SOURCE_EXECUTION_FILES.lock));
    const journal = JSON.parse(f.originalCreates);
    journal.completed.pop();
    fs.writeFileSync(path.join(f.directory, SOURCE_EXECUTION_FILES.journal), JSON.stringify(journal));
    await expect(f.export()).rejects.toThrow("23 CREATE");
  });
  it("rejects a sequential rehearsal or stale atomic Safe hash", async () => {
    const f = await fixture();
    fs.writeFileSync(f.rehearsalPath, JSON.stringify({ ...f.proof, atomicFailureRollback: false }));
    await expect(f.export()).rejects.toThrow("atomic failure/retry");
    fs.writeFileSync(f.rehearsalPath, JSON.stringify({ ...f.proof, safeTransactionHash: "0x" + "11".repeat(32) }));
    await expect(f.export()).rejects.toThrow("hash/nonce");
  });
  it("adopts the actual external executor, normal UI fees and one Safe nonce increment without double charging", async () => {
    const f = await fixture();
    await f.export();
    f.afterSuccess();
    const result = await f.adopt();
    expect(result.state).toBe("atomic-batch-verified");
    expect(result.externalPayer).toBe(f.wallets[3].address);
    expect(result.externalPayer).not.toBe(f.context.manifest.deployer);
    expect(result.safePaymentWei).toBe("0");
    expect(result.safeNonceAfter).toBe(34);
    expect(f.journal().completed.actualCostWei).toBe("5000000000000");
    const saved = JSON.stringify(f.journal());
    expect((await f.adopt()).state).toBe("atomic-batch-already-verified");
    expect(JSON.stringify(f.journal())).toBe(saved);
    expect(fs.readFileSync(path.join(f.directory, SOURCE_EXECUTION_FILES.journal), "utf8")).toBe(f.originalCreates);
  });
  it("records a failed outer attempt and can adopt a successful retry at the unchanged reviewed Safe nonce", async () => {
    const f = await fixture();
    await f.export();
    f.batchReceipt.status = 0;
    await expect(f.adopt()).rejects.toThrow("outer batch reverted");
    expect(f.journal().completed).toBeUndefined();
    expect(Object.keys(f.journal().attempts)).toHaveLength(1);
    // A retry has a new outer transaction hash. It must never rewrite the failed attempt's receipt.
    const previousHash = f.txHash,
      nextHash = "0x" + "ab".repeat(32);
    const originalTx = f.port.getTransaction,
      originalReceipt = f.port.getReceipt;
    f.port.getTransaction = async (h) => (h === nextHash ? { ...f.batchTx, hash: nextHash, nonce: 8 } : originalTx(h));
    f.port.getReceipt = async (h) =>
      h === nextHash ? { ...f.batchReceipt, hash: nextHash, status: 1 } : originalReceipt(h);
    f.afterSuccess();
    expect((await f.adopt(false, nextHash)).state).toBe("atomic-batch-verified");
    expect(Object.keys(f.journal().attempts).sort()).toEqual([previousHash, nextHash].sort());
    expect(f.journal().completed.transactionHash).toBe(nextHash);
  });
  it("rejects Safe ExecutionFailure despite outer status 1 and retains its paid cost", async () => {
    const f = await fixture();
    await f.export();
    f.batchReceipt.logs = [f.event("ExecutionFailure")];
    await expect(f.adopt()).rejects.toThrow("one successful");
    expect(f.journal().completed).toBeUndefined();
    expect(f.journal().attempts[f.txHash].actualCostWei).toBe("5000000000000");
  });
  it("retains an over-budget external payment but refuses to certify the batch", async () => {
    const f = await fixture();
    await f.export();
    f.afterSuccess();
    f.batchReceipt.gasUsed = 1000000n;
    f.batchReceipt.gasPrice = 500000000n;
    f.batchTx.maxFeePerGas = 1000000000n;
    await expect(f.adopt()).rejects.toThrow("cumulative external batch gas");
    expect(f.journal().completed).toBeUndefined();
    expect(f.journal().attempts[f.txHash].actualCostWei).toBe("500000000000000");
  });
  it("rejects nonce drift and changed implementation runtime before exporting a signable file", async () => {
    const f = await fixture();
    f.port.getSafeState = async () => ({ ...f.context.envelope.baseline.safe, nonce: 34 });
    await expect(f.export()).rejects.toThrow("nonce");
    f.port.getSafeState = async () => f.context.envelope.baseline.safe;
    const code = f.port.getCode;
    f.port.getCode = async (address, block) =>
      address === f.context.manifest.pooling.implementation ? "0x6001" : code(address, block);
    await expect(f.export()).rejects.toThrow("implementation runtime");
    expect(fs.existsSync(f.reviewPath)).toBe(false);
  });
  it("recovers a post-receipt read interruption and a dead local adoption lock without another signature or send", async () => {
    const f = await fixture();
    await f.export();
    f.afterSuccess();
    f.failReadOnce();
    await expect(f.adopt()).rejects.toThrow("temporary post-receipt");
    expect(f.journal().completed).toBeUndefined();
    const review = JSON.parse(fs.readFileSync(f.reviewPath, "utf8"));
    fs.writeFileSync(
      path.join(f.directory, "42161-source-safe-batch-execution.lock.json"),
      JSON.stringify({ recordHash: voucherDigest(review), pid: 2147483647, token: "dead fixture process" }),
    );
    expect((await f.adopt(true)).state).toBe("atomic-batch-verified");
    expect(Object.keys(f.journal().attempts)).toHaveLength(1);
  });
});
