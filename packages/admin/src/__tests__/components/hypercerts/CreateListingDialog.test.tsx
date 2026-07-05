import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render } from "../../test-utils";

const mockCreateListing = vi.fn();
const mockReset = vi.fn();
const mockUseCreateListing = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  const { useState } = await import("react");
  return {
    ...actual,
    Alert: ({ children }: { children: ReactNode }) =>
      createElement("div", { role: "alert" }, children),
    LISTING_DEFAULTS: {
      durationDays: 30,
      sellLeftover: false,
      maxUnitAmount: 1000n,
    },
    logger: {
      error: (...args: unknown[]) => mockLoggerError(...args),
    },
    useCreateListing: (...args: unknown[]) => mockUseCreateListing(...args),
    // Faithful state-mode reimplementation of useDirtyClose minus the
    // router-bound useBlocker (renderWithProviders has no data router).
    useDirtyClose: ({ isDirty, onClose }: { isDirty: boolean; onClose: () => void }) => {
      const [confirmOpen, setConfirmOpen] = useState(false);
      return {
        onOpenChange: (open: boolean) => {
          if (open) return;
          if (isDirty) setConfirmOpen(true);
          else onClose();
        },
        confirmOpen,
        cancelClose: () => setConfirmOpen(false),
        confirmClose: () => {
          setConfirmOpen(false);
          onClose();
        },
      };
    },
  };
});

import { CreateListingDialog } from "../../../components/Hypercerts/CreateListingDialog";

const DEFAULT_HOOK_STATE = {
  createListing: mockCreateListing,
  step: "idle" as const,
  isCreating: false,
  error: null,
  reset: mockReset,
};

describe("components/Hypercerts/CreateListingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateListing.mockReturnValue(DEFAULT_HOOK_STATE);
  });

  it("shows an actionable error state when listing creation rejects before hook error state updates", async () => {
    mockCreateListing.mockRejectedValueOnce(new Error("Listing failed upstream"));

    render(
      createElement(CreateListingDialog, {
        open: true,
        onOpenChange: vi.fn(),
        gardenAddress: "0x1111111111111111111111111111111111111111",
        hypercertId: 1n,
        fractionId: 2n,
      })
    );

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign & list/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Listing failed upstream");
    });

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(
      within(screen.getByTestId("admin-dialog-actions")).getByRole("button", { name: /close/i })
    ).toBeInTheDocument();
    expect(mockLoggerError).toHaveBeenCalledWith("Failed to create listing", {
      error: expect.any(Error),
    });
  });

  it("returns to the configuration form when retrying after a rejected listing creation", async () => {
    mockCreateListing.mockRejectedValueOnce(new Error("Listing failed upstream"));

    render(
      createElement(CreateListingDialog, {
        open: true,
        onOpenChange: vi.fn(),
        gardenAddress: "0x1111111111111111111111111111111111111111",
        hypercertId: 1n,
        fractionId: 2n,
      })
    );

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign & list/i }));

    const retryButton = await screen.findByRole("button", { name: /try again/i });
    await user.click(retryButton);

    expect(mockReset).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /sign & list/i })).toBeInTheDocument();
  });

  it("confirms before discarding edited pricing on dialog dismiss", async () => {
    const onOpenChange = vi.fn();
    render(
      createElement(CreateListingDialog, {
        open: true,
        onOpenChange,
        gardenAddress: "0x1111111111111111111111111111111111111111",
        hypercertId: 1n,
        fractionId: 2n,
      })
    );

    const user = userEvent.setup();

    // Edit a field so the configure form is dirty, then close via the dialog X.
    await user.type(screen.getByLabelText(/price per unit/i), "9");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
