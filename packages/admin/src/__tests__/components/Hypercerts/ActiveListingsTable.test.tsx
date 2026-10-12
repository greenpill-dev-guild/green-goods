import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render } from "../../test-utils";
const state = vi.hoisted(() => ({
  listings: [] as unknown[],
  isLoading: false,
  error: null as Error | null,
  cancellationError: null as Error | null,
  isChecking: false,
  check: vi.fn(),
  confirmCancelled: vi.fn(),
  pendingCancellation: { orderId: 7, result: { hash: "0xSafeProposal", sponsored: false } },
}));
vi.mock("@green-goods/shared/hooks/hypercerts/useHypercertListings", () => ({
  useHypercertListings: () => state,
}));
vi.mock("@green-goods/shared/hooks/hypercerts/useCancelListing", () => ({
  useCancelListing: () => ({
    cancelListing: vi.fn(),
    isCancelling: true,
    pendingCancellation: state.pendingCancellation,
    isCheckingConfirmation: state.isChecking,
    checkConfirmation: state.check,
    confirmWalletCancellation: state.confirmCancelled,
    error: state.cancellationError,
  }),
}));
import { ActiveListingsTable } from "../../../components/Hypercerts/ActiveListingsTable";
const garden = "0x1111111111111111111111111111111111111111" as const;
describe("cancellation recovery without an active row", () => {
  beforeEach(() => {
    state.listings = [];
    state.isLoading = false;
    state.error = null;
    state.cancellationError = null;
    state.isChecking = false;
    state.check.mockClear();
    state.confirmCancelled.mockReset().mockResolvedValue(undefined);
  });
  it.each([
    "empty",
    "loading",
    "error",
    "expired",
  ])("keeps confirmation reachable with %s listings", (mode) => {
    state.isLoading = mode === "loading";
    state.error = mode === "error" ? new Error("Offline") : null;
    if (mode === "expired")
      state.listings = [
        {
          orderId: 7,
          hypercertId: 1n,
          unitPrice: 1n,
          pricePerUnit: 1n,
          endTime: 1,
          active: false,
          currency: garden,
        },
      ];
    render(<ActiveListingsTable gardenAddress={garden} />);
    fireEvent.click(screen.getByRole("button", { name: "Check confirmation" }));
    expect(state.check).toHaveBeenCalledOnce();
  });
  it("clears a cancelled proposal only after the explicit wallet confirmation", async () => {
    render(<ActiveListingsTable gardenAddress={garden} />);
    fireEvent.click(screen.getByRole("button", { name: "Review Cancellation" }));
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(state.confirmCancelled).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I confirmed cancellation" }));
    await waitFor(() => expect(state.confirmCancelled).toHaveBeenCalledWith(true));
  });

  it.each([
    "loading",
    "error",
    "empty",
  ])("shows terminal cancellation feedback with %s listings", (mode) => {
    state.isLoading = mode === "loading";
    state.error = mode === "error" ? new Error("Offline") : null;
    state.cancellationError = new Error("Cancellation transaction reverted");
    render(<ActiveListingsTable gardenAddress={garden} />);
    expect(screen.getByText("Cancellation transaction reverted")).toBeVisible();
  });
  it("disables the recovery control during its read", () => {
    state.isChecking = true;
    render(<ActiveListingsTable gardenAddress={garden} />);
    expect(screen.getByRole("button", { name: "Check confirmation" })).toBeDisabled();
  });
});
