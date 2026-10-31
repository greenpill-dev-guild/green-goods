import { describe, expect, it } from "vitest";
import {
  createMockContractCall,
  createMockBatchBudget,
} from "../../../__tests__/test-utils/transaction-fakes";
import { prepareBatch, assertPreparedBatch } from "../prepared-batch";

const account = "0x1111111111111111111111111111111111111111" as const;
const input = () => ({
  id: "reviewed",
  account,
  chainId: 42161,
  domain: "settings",
  mode: "atomic" as const,
  items: [{ id: "garden:name", call: createMockContractCall({ account }) }],
});
describe("prepared batch intent", () => {
  it("snapshots the reviewed arguments and detects later calldata corruption", () => {
    const args = [account, 1000n];
    const request = input();
    request.items[0].call.args = args;
    const prepared = prepareBatch(request);
    args[1] = 9999n;
    expect(prepared.items[0].call.args[1]).toBe(1000n);
    expect(() => assertPreparedBatch(prepared)).not.toThrow();
    prepared.items[0].call.data = "0x1234";
    expect(() => assertPreparedBatch(prepared)).toThrow("batch-intent-changed");
  });
  it.each(["account", "chain"])("rejects a mixed %s before submission", (kind) => {
    const request = input();
    if (kind === "account")
      request.items[0].call.account = "0x2222222222222222222222222222222222222222";
    else request.items[0].call.chainId = 42220;
    expect(() => prepareBatch(request)).toThrow("batch-scope-mismatch");
  });
  it("enforces the reviewed call and calldata budget without silently splitting", () => {
    const request = input();
    request.items.push({ id: "garden:description", call: createMockContractCall({ account }) });
    expect(() =>
      prepareBatch({
        ...request,
        budget: createMockBatchBudget({ maxCalls: 2, maxCalldataBytes: 136 }),
      })
    ).not.toThrow();
    expect(() =>
      prepareBatch({
        ...request,
        budget: createMockBatchBudget({ maxCalls: 2, maxCalldataBytes: 135 }),
      })
    ).toThrow("batch-budget-exceeded");
    expect(() =>
      prepareBatch({
        ...request,
        budget: createMockBatchBudget({ maxCalls: 1, maxCalldataBytes: 136 }),
      })
    ).toThrow("batch-budget-exceeded");
  });
  it("rejects empty and duplicate selections and fingerprints the transport choice", () => {
    const request = input();
    expect(() => prepareBatch({ ...request, items: [] })).toThrow("batch-invalid-intent");
    expect(() => prepareBatch({ ...request, items: [...request.items, ...request.items] })).toThrow(
      "batch-duplicate-item"
    );
    expect(prepareBatch(request).fingerprint).not.toBe(
      prepareBatch({ ...request, mode: "sequential" }).fingerprint
    );
  });
});

it("freezes reviewed fee ceilings into the intent fingerprint", () => {
  const limits = createMockBatchBudget();
  const input = {
    id: "budgeted",
    domain: "settings",
    account: "0x1111111111111111111111111111111111111111",
    chainId: 42161,
    mode: "atomic" as const,
    budget: limits,
    items: [{ id: "item", call: createMockContractCall() }],
  };
  const prepared = prepareBatch(input);
  expect(prepared.budget).toEqual(limits);
  limits.maxGas = "1";
  expect(prepared.budget?.maxGas).toBe("5000000");
  expect(prepareBatch(input).fingerprint).not.toBe(prepared.fingerprint);
  prepared.budget!.maxFee = "1";
  expect(() => assertPreparedBatch(prepared)).toThrow("batch-intent-changed");
});
