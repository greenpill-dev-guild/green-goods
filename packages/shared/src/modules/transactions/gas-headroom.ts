/**
 * Gas headroom for calls whose contracts run best-effort work inside try/catch.
 *
 * @module modules/transactions/gas-headroom
 */

import { encodeFunctionData, type Hex } from "viem";
import type { Address } from "../../types/domain";
import type { ContractCall } from "./types";

/** The node's gas estimate for a transaction from `account`. */
export type EstimateTransactionGas = (request: {
  account: Address;
  chainId: number;
  to: Address;
  data: Hex;
  value: bigint;
}) => Promise<bigint>;

/**
 * The estimate plus the most headroom any of the calls asks for.
 *
 * @throws Error when a call asks for anything but a whole, non-negative percent
 */
export function withGasHeadroom(
  estimate: bigint,
  calls: readonly Pick<ContractCall, "gasHeadroomPercent">[]
): bigint {
  let percent = 0;
  for (const { gasHeadroomPercent } of calls) {
    if (gasHeadroomPercent === undefined) continue;
    if (!Number.isSafeInteger(gasHeadroomPercent) || gasHeadroomPercent < 0)
      throw new Error("invalid-gas-headroom");
    percent = Math.max(percent, gasHeadroomPercent);
  }
  return estimate + (estimate * BigInt(percent)) / 100n;
}

/**
 * The gas limit a wallet send sets: the estimate plus the call's headroom, or none for a call that
 * asks for no headroom, which leaves the limit to the wallet.
 */
export async function walletGasLimit(
  call: ContractCall,
  account: Address,
  chainId: number,
  estimate: EstimateTransactionGas
): Promise<bigint | undefined> {
  if (!call.gasHeadroomPercent) return undefined;
  const gas = await estimate({
    account,
    chainId,
    to: call.address,
    data: encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args }),
    value: call.value ?? 0n,
  });
  return withGasHeadroom(gas, [call]);
}
