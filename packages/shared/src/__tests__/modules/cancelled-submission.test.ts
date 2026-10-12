import { expect, it, vi } from "vitest";
import { confirmCancelledSubmission } from "../../modules/transactions/cancelled-submission";
import type { TransactionSender } from "../../modules/transactions/types";
it("retains a replaced checkpoint or switched owner while ownership is resolving", async () => {
  let current = true;
  let finish!: () => void;
  const assertOwnership = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const clear = vi.fn();
  const promise = confirmCancelledSubmission({
    confirmedInWallet: true,
    account: "0x1111111111111111111111111111111111111111",
    chainId: 11155111,
    sender: { assertOwnership } as unknown as TransactionSender,
    isCurrent: () => current,
    clear,
  });
  current = false;
  finish();
  await expect(promise).rejects.toThrow("pending-submission-changed");
  expect(clear).not.toHaveBeenCalled();
});
