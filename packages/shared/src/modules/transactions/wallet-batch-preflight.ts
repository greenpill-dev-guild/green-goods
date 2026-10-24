import { encodeFunctionData, type Hex } from "viem";
import type { Address } from "../../types/domain";
import type { BatchBudget, BatchQuote } from "./batch-types";
import { assertBatchCalls, assertBatchQuote } from "./batch-budget";
import type { ContractCall } from "./types";

interface WalletBatchReader {
  getChainId(): Promise<number>;
  estimateGas?(input: { account: Hex; to: Hex; data: Hex; value: bigint }): Promise<bigint>;
  simulateCalls(input: {
    account: Hex;
    calls: readonly { to: Hex; data: Hex; value: bigint }[];
  }): Promise<{
    block: { gasLimit: bigint };
    results: readonly { status: string; gasUsed: bigint }[];
  }>;
  estimateFeesPerGas(): Promise<{ maxFeePerGas?: bigint; gasPrice?: bigint }>;
}

/** Ordered execution estimation; this protocol cannot cap the final fee chosen by the wallet. */
export async function quoteWalletBatch(
  reader: WalletBatchReader,
  calls: readonly ContractCall[],
  budget: BatchBudget
): Promise<BatchQuote> {
  assertBatchCalls(calls, budget);
  const account: Address | undefined = calls[0]?.account;
  const chainId = calls[0]?.chainId;
  if (
    !account ||
    chainId === undefined ||
    (await reader.getChainId()) !== chainId ||
    calls.some(
      (call) => call.chainId !== chainId || call.account?.toLowerCase() !== account.toLowerCase()
    )
  )
    throw new Error("batch-scope-mismatch");
  const encoded = calls.map((call) => ({
    to: call.address as Hex,
    value: call.value ?? 0n,
    data: encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args }),
  }));
  const estimate = async () => {
    if (encoded.length === 1 && reader.estimateGas)
      return reader.estimateGas({ account: account as Hex, ...encoded[0] });
    const simulation = await reader.simulateCalls({ account: account as Hex, calls: encoded });
    if (
      simulation.results.length !== calls.length ||
      simulation.results.some(
        (result) =>
          result.status !== "success" || typeof result.gasUsed !== "bigint" || result.gasUsed <= 0n
      )
    )
      throw new Error("batch-simulation-failed");
    const gas = simulation.results.reduce((total, result) => total + result.gasUsed, 0n);
    if (gas > simulation.block.gasLimit) throw new Error("batch-invalid-quote");
    return gas;
  };
  const [gas, fees] = await Promise.all([estimate(), reader.estimateFeesPerGas()]);
  const fee = fees.maxFeePerGas ?? fees.gasPrice;
  if (!fee || fee <= 0n || gas <= 0n) throw new Error("batch-invalid-quote");
  const quote: BatchQuote = {
    gas: gas.toString(),
    maxFeePerGas: fee.toString(),
    maxFee: (gas * fee).toString(),
    sponsored: false,
    authority: "wallet",
  };
  assertBatchQuote(budget, quote);
  return quote;
}
