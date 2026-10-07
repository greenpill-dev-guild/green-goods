import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render } from "../../test-utils";
const state = vi.hoisted(() => ({
  listings: [] as unknown[],
  isLoading: false,
  error: null as Error | null,
  isChecking: false,
  check: vi.fn(),
}));
vi.mock("@green-goods/shared/hooks/hypercerts/useHypercertListings", () => ({
  useHypercertListings: () => state,
}));
vi.mock("@green-goods/shared/hooks/hypercerts/useCancelListing", () => ({
  useCancelListing: () => ({
    cancelListing: vi.fn(),
    isCancelling: true,
    pendingCancellation: { orderId: 7, result: { hash: "0xSafeProposal", sponsored: false } },
    isCheckingConfirmation: state.isChecking,
    checkConfirmation: state.check,
    error: null,
  }),
}));
import { ActiveListingsTable } from "../../../components/Hypercerts/ActiveListingsTable";
const garden = "0x1111111111111111111111111111111111111111" as const;
describe("cancellation recovery without an active row", () => {
  beforeEach(() => {
    state.listings = [];
    state.isLoading = false;
    state.error = null;
    state.isChecking = false;
    state.check.mockClear();
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
  it("disables the recovery control during its read", () => {
    state.isChecking = true;
    render(<ActiveListingsTable gardenAddress={garden} />);
    expect(screen.getByRole("button", { name: "Check confirmation" })).toBeDisabled();
  });
});
