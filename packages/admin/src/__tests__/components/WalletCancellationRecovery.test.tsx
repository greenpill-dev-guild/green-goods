import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderWithProviders as render } from "../test-utils";
import { WalletCancellationRecovery } from "../../components/WalletCancellationRecovery";
it("retains the proposal until the owner explicitly confirms cancellation", async () => {
  const confirm = vi.fn().mockResolvedValue(undefined);
  render(<WalletCancellationRecovery onCheck={vi.fn()} onConfirmCancellation={confirm} />);
  fireEvent.click(screen.getByRole("button", { name: "Review Cancellation" }));
  expect(screen.getByRole("alertdialog")).toBeVisible();
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "I confirmed cancellation" }));
  await waitFor(() => expect(confirm).toHaveBeenCalledWith(true));
});
