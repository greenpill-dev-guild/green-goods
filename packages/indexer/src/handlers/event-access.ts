import type { TransactionWithHash } from "./types";

/**
 * Safely reads the transaction hash from Envio event data.
 * Generated transaction types do not currently expose the field.
 */
export function getTxHash(transaction: unknown): string {
  if (
    typeof transaction !== "object" ||
    transaction === null ||
    !("hash" in transaction) ||
    typeof (transaction as TransactionWithHash).hash !== "string"
  ) {
    throw new Error(
      `Invalid transaction object: expected { hash: string }, got ${JSON.stringify(transaction)}`
    );
  }
  return (transaction as TransactionWithHash).hash;
}
