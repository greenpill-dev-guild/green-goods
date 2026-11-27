import { encodeFunctionData, hexToBytes, isAddress, isHex, size } from "viem";
import {
  entryPoint07Abi,
  toPackedUserOperation,
  type UserOperation,
} from "viem/account-abstraction";
import type { Address } from "../../types/domain";
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

/**
 * The most gas a bundler takes in one UserOperation. Open-source Alto defaults its
 * `max-gas-per-user-op` to 16M. Pimlico has not confirmed its hosted bundler's limit, so the app
 * keeps Alto's default until it does.
 */
const BUNDLER_MAX_GAS_PER_OPERATION = 16_000_000n;

/** Alto pays its own utility wallet. Counted with no zero byte, the most that address can cost. */
const BUNDLER_BENEFICIARY: Address = "0xffffffffffffffffffffffffffffffffffffffff";

/**
 * The gas open-source Alto counts against that limit when an EntryPoint 0.7 operation is sent
 * (pimlicolabs/alto `fa5f107`): `calculateAA95GasFloor` in `src/executor/utils.ts`, scaled by the
 * default 105% `executorGasMultiplier` in `src/rpc/rpcHandler.ts`. Alto skips the check while it
 * estimates, so an operation it sized can still be refused once signed. It leaves out pre-verification gas but scales call gas by
 * 64/63 and adds fixed overheads, the `handleOps` calldata and 5% on top, so near 16M it runs about
 * 1M above the operation's gas limits added up.
 */
function bundlerSendGas(operation: UserOperation<"0.7">): bigint {
  const calldata = encodeFunctionData({
    abi: entryPoint07Abi,
    functionName: "handleOps",
    args: [[toPackedUserOperation(operation)], BUNDLER_BENEFICIARY],
  });
  const calldataGas = hexToBytes(calldata).reduce<bigint>(
    (gas, byte) => gas + (byte === 0 ? 4n : 16n),
    0n
  );
  const floor =
    ((operation.callGasLimit + (operation.paymasterPostOpGasLimit ?? 0n) + 10_000n) * 64n) / 63n +
    operation.verificationGasLimit +
    (operation.paymasterVerificationGasLimit ?? 0n) +
    30_000n +
    calldataGas;
  return (floor * 105n) / 100n;
}

/**
 * The prepared UserOperation includes deployment/validation and paymaster overhead before WebAuthn.
 * The quote is refused past the budget, and past the bundler's own limit on the gas it counts on
 * send, so the passkey is never asked to sign what the bundler would turn away.
 */
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
    !operation.sender ||
    !isAddress(operation.sender) ||
    typeof operation.nonce !== "bigint" ||
    operation.nonce < 0n ||
    typeof operation.signature !== "string" ||
    !isHex(operation.signature, { strict: true }) ||
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
  if (bundlerSendGas(operation as UserOperation<"0.7">) > BUNDLER_MAX_GAS_PER_OPERATION)
    throw new Error("batch-budget-exceeded");
  return quote;
}
