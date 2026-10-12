import type { Address } from "../../types/domain";
import type { TransactionSender } from "./types";

/** Clearing a local checkpoint never cancels its wallet proposal. */
export async function confirmCancelledSubmission(input: {
  confirmedInWallet: boolean;
  sender: TransactionSender | null | undefined;
  account: Address | undefined;
  chainId: number;
  isCurrent: () => boolean;
  clear: () => void;
}) {
  if (!input.confirmedInWallet) throw new Error("wallet-cancellation-confirmation-required");
  if (!input.sender || !input.account) throw new Error("signer-not-ready");
  if (!input.isCurrent()) throw new Error("pending-submission-changed");
  await input.sender.assertOwnership?.(input.account, input.chainId);
  if (!input.isCurrent()) throw new Error("pending-submission-changed");
  input.clear();
}
