import { describe, expect, it, vi } from "vitest";
import { assertBatchQuote, quoteUserOperation } from "../batch-budget";
import { quoteWalletBatch } from "../wallet-batch-preflight";
import { createMockContractCall } from "../../../__tests__/test-utils/transaction-fakes";
import type { BatchBudget } from "../batch-types";

const account = "0x1111111111111111111111111111111111111111" as const;
const budget: BatchBudget = {
  maxCalls: 5,
  maxCalldataBytes: 1000,
  maxGas: "500",
  maxFeePerGas: "3",
  maxFee: "1000",
  sponsorship: "required",
};
const operation = {
  sender: account,
  callData: "0x1234" as const,
  callGasLimit: 100n,
  verificationGasLimit: 200n,
  preVerificationGas: 50n,
  maxFeePerGas: 2n,
  maxPriorityFeePerGas: 1n,
  paymaster: account,
  paymasterData: "0x" as const,
  paymasterVerificationGasLimit: 75n,
  paymasterPostOpGasLimit: 25n,
};

describe("reviewed batch budgets", () => {
  it("counts account validation, deployment estimate, and both paymaster gas fields", () => {
    expect(quoteUserOperation(operation, budget)).toMatchObject({
      gas: "450",
      maxFeePerGas: "2",
      maxFee: "900",
      sponsored: true,
      authority: "user-operation",
    });
  });
  it.each([
    { maxGas: "449" },
    { maxFee: "899" },
    { maxFeePerGas: "1" },
    { maxCalldataBytes: 1 },
  ])("refuses an operation above a reviewed ceiling: %j", (patch) => {
    expect(() => quoteUserOperation(operation, { ...budget, ...patch })).toThrow(
      "batch-budget-exceeded"
    );
  });
  it("refuses a missing paymaster instead of switching the fee payer", () => {
    expect(() => quoteUserOperation({ ...operation, paymaster: undefined }, budget)).toThrow(
      "batch-sponsorship-required"
    );
  });
  it.each([
    { verificationGasLimit: -1n },
    { preVerificationGas: undefined },
    { maxPriorityFeePerGas: 3n },
    { maxFeePerGas: 0n },
  ])("rejects incomplete or invalid operation estimates: %#", (patch) => {
    expect(() => quoteUserOperation({ ...operation, ...patch }, budget)).toThrow();
  });
  it("rejects a quote whose fee total contradicts its gas and fee cap", () => {
    const quote = quoteUserOperation(operation, budget);
    expect(() => assertBatchQuote(budget, { ...quote, maxFee: "1" })).toThrow(
      "batch-invalid-quote"
    );
  });
});

function wallet() {
  const calls = [createMockContractCall({ account }), createMockContractCall({ account })];
  const reader = {
    getChainId: vi.fn(async () => 42161),
    simulateCalls: vi.fn(async () => ({
      block: { gasLimit: 1000n },
      results: [
        { status: "success", gasUsed: 100n },
        { status: "success", gasUsed: 200n },
      ],
    })),
    estimateFeesPerGas: vi.fn(async () => ({ maxFeePerGas: 2n })),
  };
  return { reader, calls, limits: { ...budget, sponsorship: "wallet" as const } };
}
describe("wallet ordered-batch estimates", () => {
  it("simulates the ordered group once under its actual account and labels wallet fee authority", async () => {
    const { reader, calls, limits } = wallet();
    expect(await quoteWalletBatch(reader, calls, limits)).toMatchObject({
      gas: "300",
      maxFee: "600",
      sponsored: false,
      authority: "wallet",
    });
    expect(reader.simulateCalls).toHaveBeenCalledOnce();
    expect(reader.simulateCalls).toHaveBeenCalledWith(
      expect.objectContaining({ account, calls: expect.any(Array) })
    );
  });
  it("refuses a changed RPC chain before simulation", async () => {
    const { reader, calls, limits } = wallet();
    reader.getChainId.mockResolvedValue(100);
    await expect(quoteWalletBatch(reader, calls, limits)).rejects.toThrow("batch-scope-mismatch");
    expect(reader.simulateCalls).not.toHaveBeenCalled();
  });
  it("refuses partial, reverted, and missing simulation outcomes", async () => {
    const { reader, calls, limits } = wallet();
    reader.simulateCalls.mockResolvedValue({
      block: { gasLimit: 1000n },
      results: [{ status: "failure", gasUsed: 100n }],
    });
    await expect(quoteWalletBatch(reader, calls, limits)).rejects.toThrow(
      "batch-simulation-failed"
    );
  });
  it("refuses unsupported simulation instead of estimating dependent calls separately", async () => {
    const { reader, calls, limits } = wallet();
    reader.simulateCalls.mockRejectedValue(new Error("method not supported"));
    await expect(quoteWalletBatch(reader, calls, limits)).rejects.toThrow("method not supported");
  });
  it("enforces gas and fee ceilings before requesting wallet consent", async () => {
    const { reader, calls, limits } = wallet();
    await expect(quoteWalletBatch(reader, calls, { ...limits, maxFee: "599" })).rejects.toThrow(
      "batch-budget-exceeded"
    );
  });
});

it("uses ordinary transaction estimation for one native call without requiring a batch RPC", async () => {
  const { reader, calls, limits } = wallet();
  const estimateGas = vi.fn(async () => 21064n);
  const quote = await quoteWalletBatch({ ...reader, estimateGas }, calls.slice(0, 1), {
    ...limits,
    maxGas: "100000",
    maxFee: "1000000",
  });
  expect(quote.gas).toBe("21064");
  expect(estimateGas).toHaveBeenCalledOnce();
  expect(reader.simulateCalls).not.toHaveBeenCalled();
});
