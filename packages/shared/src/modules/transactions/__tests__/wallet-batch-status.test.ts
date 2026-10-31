import { describe, expect, it } from "vitest";
import { walletBatchExecution } from "../wallet-batch-status";

const reference = {
  kind: "wallet-calls",
  id: "opaque:batch",
  chainId: 42161,
  account: "0x1111111111111111111111111111111111111111",
} as const;
const hash = `0x${"a".repeat(64)}` as const;
describe("wallet batch protocol outcomes", () => {
  it.each([
    { status: "success", statusCode: 200, receipt: "success", expected: "confirmed" },
    { status: "failure", statusCode: 500, receipt: "reverted", expected: "reverted" },
    { status: "failure", statusCode: 600, receipt: "reverted", expected: "unresolved" },
    { status: "success", statusCode: 100, receipt: "success", expected: "unresolved" },
  ])("requires consistent protocol and receipt evidence: $statusCode", ({
    status,
    statusCode,
    receipt,
    expected,
  }) => {
    expect(
      walletBatchExecution(reference, {
        atomic: true,
        chainId: 42161,
        status,
        statusCode,
        receipts: [{ transactionHash: hash, status: receipt }],
      }).status
    ).toBe(expected);
  });
  it("rejects wrong-chain and non-atomic success while retaining receipt evidence", () => {
    for (const patch of [{ chainId: 42220 }, { atomic: false }]) {
      const result = walletBatchExecution(reference, {
        chainId: 42161,
        atomic: true,
        status: "success",
        ...patch,
        receipts: [{ transactionHash: hash, status: "success" }],
      });
      expect(result.status).toBe("unresolved");
      expect(result.receipts).toHaveLength(1);
    }
  });
  it("does not confirm missing, duplicate, or malformed receipt identities", () => {
    for (const receipts of [
      [],
      [{ status: "success", transactionHash: "not-a-hash" as `0x${string}` }],
      [
        { status: "success", transactionHash: hash },
        { status: "success", transactionHash: hash },
      ],
    ]) {
      expect(
        walletBatchExecution(reference, {
          atomic: true,
          chainId: 42161,
          status: "success",
          receipts,
        }).status
      ).toBe("unresolved");
    }
  });
});
