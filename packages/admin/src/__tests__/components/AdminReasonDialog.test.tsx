/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { fireEvent, renderWithProviders, screen, waitFor } from "../test-utils";

function render(onConfirm: (reason: string) => Promise<void>, onError?: (error: unknown) => void) {
  renderWithProviders(
    <AdminReasonDialog
      isOpen
      onClose={() => undefined}
      onConfirm={onConfirm}
      onError={onError}
      title="Pause the pool"
      description="Stops new commitments until you resume."
      confirmLabel="Pause Pool"
    />
  );
}

describe("AdminReasonDialog", () => {
  it("consumes a failed write instead of leaving an unhandled rejection", async () => {
    // The click boundary invokes the handler with `void`, so a rethrow here
    // would escape every error boundary. The mutation layer has already
    // logged and toasted the failure by this point.
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const onConfirm = vi.fn().mockRejectedValue(new Error("wallet refused"));

    render(onConfirm);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "storm damage" } });
    fireEvent.click(screen.getByRole("button", { name: /pause pool/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("storm damage"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off("unhandledRejection", unhandled);

    expect(unhandled).not.toHaveBeenCalled();
    // Still open, with the reason kept, so the steward can try again.
    expect(screen.getByRole("textbox")).toHaveValue("storm damage");
  });

  it("still hands the failure to a caller that asked for it", async () => {
    const error = new Error("pin failed");
    const onError = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(error);

    render(onConfirm, onError);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "beds half pruned" } });
    fireEvent.click(screen.getByRole("button", { name: /pause pool/i }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
  });
});
