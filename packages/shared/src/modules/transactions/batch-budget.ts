import { encodeFunctionData, isAddress, isHex, size } from "viem";
import type { UserOperation } from "viem/account-abstraction";
import type { BatchBudget, BatchQuote } from "./batch-types";
import type { ContractCall } from "./types";

function quantity(value: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error("batch-invalid-budget");
  return BigInt(value);
}
export function assertBatchBudget(budget: BatchBudget): void {
  if (
    !budget ||
    !Number.isSafeInteger(budget.maxCalls) ||
    budget.maxCalls < 1 ||
    !Number.isSafeInteger(budget.maxCalldataBytes) ||
    budget.maxCalldataBytes < 1 ||
    !["required", "wallet"].includes(budget.sponsorship) ||
    [budget.maxGas, budget.maxFeePerGas, budget.maxFee].some((value) => quantity(value) <= 0n)
  )
    throw new Error("batch-invalid-budget");
}
export function assertBatchCalls(calls: readonly ContractCall[], budget: BatchBudget): void {
  assertBatchBudget(budget);
  const bytes = calls.reduce(
    (total, call) =>
      total +
      size(
        encodeFunctionData({
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        })
      ),
    0
  );
  if (!calls.length || calls.length > budget.maxCalls || bytes > budget.maxCalldataBytes)
    throw new Error("batch-budget-exceeded");
}
export function assertBatchQuote(budget: BatchBudget, quote: BatchQuote): void {
  assertBatchBudget(budget);
  const gas = quantity(quote.gas);
  const fee = quantity(quote.maxFeePerGas);
  const cost = quantity(quote.maxFee);
  if (
    gas <= 0n ||
    fee <= 0n ||
    cost !== gas * fee ||
    !["wallet", "user-operation"].includes(quote.authority)
  )
    throw new Error("batch-invalid-quote");
  if (
    budget.sponsorship === "required" &&
    (!quote.sponsored || quote.authority !== "user-operation")
  )
    throw new Error("batch-sponsorship-required");
  if (budget.sponsorship === "wallet" && (quote.sponsored || quote.authority !== "wallet"))
    throw new Error("batch-fee-payer-mismatch");
  if (
    gas > quantity(budget.maxGas) ||
    fee > quantity(budget.maxFeePerGas) ||
    cost > quantity(budget.maxFee)
  )
    throw new Error("batch-budget-exceeded");
}

/** The prepared UserOperation includes deployment/validation and paymaster overhead before WebAuthn. */
export function quoteUserOperation(
  operation: Partial<UserOperation<"0.7">>,
  budget: BatchBudget
): BatchQuote {
  assertBatchBudget(budget);
  const gasParts = [
    operation.callGasLimit,
    operation.verificationGasLimit,
    operation.preVerificationGas,
    operation.paymasterVerificationGasLimit ?? 0n,
    operation.paymasterPostOpGasLimit ?? 0n,
  ];
  if (
    gasParts.some((gas) => typeof gas !== "bigint" || gas < 0n) ||
    !operation.callGasLimit ||
    !operation.verificationGasLimit ||
    !operation.preVerificationGas ||
    typeof operation.maxFeePerGas !== "bigint" ||
    operation.maxFeePerGas <= 0n ||
    typeof operation.maxPriorityFeePerGas !== "bigint" ||
    operation.maxPriorityFeePerGas < 0n ||
    operation.maxPriorityFeePerGas > operation.maxFeePerGas ||
    !operation.callData ||
    !isHex(operation.callData, { strict: true })
  )
    throw new Error("batch-invalid-quote");
  if (
    !operation.paymaster ||
    !isAddress(operation.paymaster) ||
    /^0x0{40}$/i.test(operation.paymaster)
  )
    throw new Error("batch-sponsorship-required");
  if (size(operation.callData) > budget.maxCalldataBytes) throw new Error("batch-budget-exceeded");
  const gas = gasParts.reduce<bigint>((total, part) => total + part!, 0n);
  const quote: BatchQuote = {
    gas: gas.toString(),
    maxFeePerGas: operation.maxFeePerGas.toString(),
    maxFee: (gas * operation.maxFeePerGas).toString(),
    sponsored: true,
    authority: "user-operation",
  };
  assertBatchQuote(budget, quote);
  return quote;
}
