import { formatEther, type Hex } from "viem";
import type { Address } from "../../types/domain";

/** The chain reads a funding check needs. A viem public client provides them. */
export interface WalletFundingReader {
  getBalance(args: { address: Address }): Promise<bigint>;
  estimateGas(args: { account: Address; to: Address; data: Hex; value: bigint }): Promise<bigint>;
  estimateFeesPerGas(): Promise<{ maxFeePerGas?: bigint; gasPrice?: bigint }>;
}

export interface WalletTransaction {
  account: Address;
  to: Address;
  data: Hex;
  /** ETH sent with the call, on top of gas. */
  value?: bigint;
}

/**
 * The connected wallet holds less ETH than a transaction needs. The message
 * opens with "Insufficient funds" so `parseContractError` classifies it with
 * the balance errors a node reports for the same shortfall.
 */
export class WalletCannotFundTransactionError extends Error {
  readonly required: bigint;
  readonly balance: bigint;

  constructor(params: { required: bigint; balance: bigint }) {
    super(
      `Insufficient funds: the transaction needs ${formatEther(params.required)} ETH and the wallet holds ${formatEther(params.balance)} ETH.`
    );
    this.name = "WalletCannotFundTransactionError";
    this.required = params.required;
    this.balance = params.balance;
  }
}

/**
 * Confirms a wallet can pay for a transaction before the wallet is asked to sign it.
 *
 * A wallet handed a transaction it cannot pay for has nothing it can submit:
 * Rabby over WalletConnect opens and shows no request at all. Checking here keeps
 * the user in the app, where the shortfall can be explained. The gas estimate
 * also executes the call, so a transaction that would revert fails here instead
 * of inside the wallet.
 *
 * Gas is priced at the fee cap viem would send (`maxFeePerGas`). A wallet that
 * pads the gas limit or fee further can still ask for slightly more.
 */
export async function assertWalletCanFundTransaction(
  reader: WalletFundingReader,
  transaction: WalletTransaction
): Promise<void> {
  const value = transaction.value ?? 0n;
  const balance = await reader.getBalance({ address: transaction.account });
  // A node refuses to estimate a call whose value the sender cannot cover.
  if (balance < value) {
    throw new WalletCannotFundTransactionError({ required: value, balance });
  }

  const [gas, fees] = await Promise.all([
    reader.estimateGas({
      account: transaction.account,
      to: transaction.to,
      data: transaction.data,
      value,
    }),
    reader.estimateFeesPerGas(),
  ]);
  const required = value + gas * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n);
  if (balance < required) {
    throw new WalletCannotFundTransactionError({ required, balance });
  }
}
