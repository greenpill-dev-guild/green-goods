import { type Abi, encodeFunctionData, isAddress, keccak256, stringToHex } from "viem";
import type { BatchBudget, BatchScope, PreparedBatch } from "./batch-types";
import type { ContractCall } from "./types";
import { assertBatchBudget } from "./batch-budget";

/** The journal stores every prepared call, so each carries only its own function. */
export function onlyFunction(abi: Abi, functionName: string): Abi {
  return abi.filter((item) => item.type === "function" && item.name === functionName);
}

/** Freeze the reviewed inputs in a fingerprint, independent of any later form edits. */
export function prepareBatch(
  input: BatchScope & {
    id: string;
    domain: string;
    mode: "atomic" | "sequential" | "single-call";
    items: readonly { id: string; call: ContractCall }[];
    budget?: BatchBudget;
  }
): PreparedBatch {
  if (
    !input.id ||
    !input.domain ||
    !isAddress(input.account, { strict: false }) ||
    !Number.isSafeInteger(input.chainId) ||
    input.chainId <= 0 ||
    !["atomic", "sequential", "single-call"].includes(input.mode) ||
    input.items.length === 0
  )
    throw new Error("batch-invalid-intent");
  if (input.budget) assertBatchBudget(input.budget);
  const budget = input.budget ? structuredClone(input.budget) : undefined;
  const ids = new Set<string>();
  const items = input.items.map(({ id, call }) => {
    if (!id || ids.has(id)) throw new Error("batch-duplicate-item");
    ids.add(id);
    if (
      (call.chainId !== undefined && call.chainId !== input.chainId) ||
      (call.account && call.account.toLowerCase() !== input.account.toLowerCase())
    )
      throw new Error("batch-scope-mismatch");
    if (!isAddress(call.address, { strict: false }) || (call.value ?? 0n) < 0n)
      throw new Error("batch-invalid-call");
    const data = encodeFunctionData({
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
    });
    return {
      id,
      call: structuredClone({
        ...call,
        account: input.account,
        chainId: input.chainId,
        value: (call.value ?? 0n).toString(),
        data,
      }),
    };
  });
  if (
    input.mode === "single-call" &&
    items.some(
      ({ call }) =>
        call.address.toLowerCase() !== items[0].call.address.toLowerCase() ||
        call.data !== items[0].call.data ||
        call.value !== items[0].call.value
    )
  )
    throw new Error("batch-single-call-mismatch");
  // A budget is per submitted group, and a sequential operation submits each item as its own.
  const groups =
    input.mode === "sequential"
      ? items.map((item) => [item])
      : [input.mode === "single-call" ? items.slice(0, 1) : items];
  if (
    input.budget &&
    (!Number.isSafeInteger(input.budget.maxCalls) ||
      input.budget.maxCalls < 1 ||
      !Number.isSafeInteger(input.budget.maxCalldataBytes) ||
      input.budget.maxCalldataBytes < 0 ||
      groups.some(
        (group) =>
          group.length > input.budget!.maxCalls ||
          group.reduce((total, item) => total + (item.call.data.length - 2) / 2, 0) >
            input.budget!.maxCalldataBytes
      ))
  )
    throw new Error("batch-budget-exceeded");
  const fingerprint = keccak256(
    stringToHex(
      JSON.stringify([
        input.account.toLowerCase(),
        input.chainId,
        input.domain,
        input.mode,
        items.map(({ id, call }) => [
          id,
          call.address.toLowerCase(),
          call.data.toLowerCase(),
          call.value,
        ]),
        ...(budget ? [budget] : []),
      ])
    )
  );
  return {
    id: input.id,
    account: input.account,
    chainId: input.chainId,
    domain: input.domain,
    mode: input.mode,
    items,
    fingerprint,
    ...(budget ? { budget } : {}),
  };
}

export function assertPreparedBatch(prepared: PreparedBatch): void {
  const rebuilt = prepareBatch({
    ...prepared,
    items: prepared.items.map(({ id, call }) => ({
      id,
      call: { ...call, value: BigInt(call.value) },
    })),
  });
  if (
    rebuilt.fingerprint !== prepared.fingerprint ||
    rebuilt.items.some((item, index) => item.call.data !== prepared.items[index].call.data)
  )
    throw new Error("batch-intent-changed");
}
