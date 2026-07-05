/**
 * AddMembersDialog Component Tests
 *
 * Multi-add staging semantics: resolved addresses stage into a fixed-height
 * list, the batch commits on submit, and failed writes stay staged for retry.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@green-goods/shared";
import { renderWithProviders as render } from "../../test-utils";

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  const { useState } = await import("react");
  return {
    ...actual,
    // Hex-only tests: ENS lookups stay inert so no network/query wiring is hit.
    useEnsAddress: () => ({ data: undefined, isFetching: false }),
    resolveEnsAddress: vi.fn(async () => null),
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

vi.mock("@/components/EnsAddressText", () => ({
  EnsAddressText: ({ address }: { address: string }) =>
    createElement("span", { "data-testid": "staged-address" }, address.slice(0, 10)),
}));

// Stub the confirm to a plain element. The real DiscardChangesDialog mounts the
// Radix AdminConfirmDialog stack, whose portal content flickers out when opened
// over the already-open host dialog in jsdom (making "Discard changes?"
// unfindable). This test asserts the guard wiring (dirty close → confirm shows
// → Discard runs onClose); the real dialog is covered by its own story.
vi.mock("../../../components/DiscardChangesDialog", () => ({
  DiscardChangesDialog: ({ open, onDiscard }: { open: boolean; onDiscard: () => void }) =>
    open
      ? createElement(
          "div",
          { role: "alertdialog" },
          createElement("span", null, "Discard changes?"),
          createElement(
            "button",
            { type: "button", "data-testid": "confirm-discard", onClick: onDiscard },
            "Discard"
          )
        )
      : null,
}));

import { AddMembersDialog } from "../../../components/Garden/AddMembersDialog";

const ADDRESS_A = "0x1111111111111111111111111111111111111111" as Address;
const ADDRESS_B = "0x2222222222222222222222222222222222222222" as Address;

describe("components/Garden/AddMembersDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onAdd: vi.fn(async () => ({ success: true })),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stages resolved addresses into the reserved list and clears the input", async () => {
    const user = userEvent.setup();
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.type(input, ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByTestId("staged-address")).toHaveTextContent(ADDRESS_A.slice(0, 10));
    });
    expect(input).toHaveValue("");
    // The staging region exists even before entries (reserved geometry).
    expect(screen.getByRole("group", { name: "Members to add" })).toBeInTheDocument();
  });

  it("commits the staged batch for the selected role and closes on success", async () => {
    const user = userEvent.setup();
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.type(input, ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(input, ADDRESS_B);

    // Typed-but-unstaged address folds into the batch — one staged + one typed.
    await user.click(screen.getByRole("button", { name: "Add 2 members" }));

    await waitFor(() => {
      expect(defaultProps.onAdd).toHaveBeenCalledTimes(2);
    });
    expect(defaultProps.onAdd).toHaveBeenCalledWith("gardener", ADDRESS_A);
    expect(defaultProps.onAdd).toHaveBeenCalledWith("gardener", ADDRESS_B);
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps failed writes staged for retry and stays open", async () => {
    const user = userEvent.setup();
    const onAdd = vi
      .fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValue({ success: true });
    render(createElement(AddMembersDialog, { ...defaultProps, onAdd }));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.type(input, ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(input, ADDRESS_B);
    await user.click(screen.getByRole("button", { name: "Add 2 members" }));

    // First write failed → its address stays staged, the dialog stays open.
    await waitFor(() => {
      expect(screen.getByText("Failed to add member")).toBeInTheDocument();
    });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("staged-address")).toHaveTextContent(ADDRESS_A.slice(0, 10));
    expect(screen.getByRole("button", { name: "Add 1 member" })).toBeInTheDocument();
  });

  it("submits a typed address directly without requiring the stage step", async () => {
    const user = userEvent.setup();
    render(createElement(AddMembersDialog, defaultProps));

    await user.type(screen.getByLabelText(/Ethereum Address or ENS Name/), ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add 1 member" }));

    await waitFor(() => {
      expect(defaultProps.onAdd).toHaveBeenCalledWith("gardener", ADDRESS_A);
    });
  });

  it("confirms before discarding a staged batch on dialog dismiss", async () => {
    const user = userEvent.setup();
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.type(input, ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.getByTestId("staged-address")).toBeInTheDocument();
    });

    // Closing via the dialog X raises the discard confirm instead of dropping
    // the staged batch (the X/scrim/Escape close vector the contract guards).
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(defaultProps.onClose).not.toHaveBeenCalled();

    // Confirming the discard performs the real close. fireEvent (not user.click)
    // because the stubbed confirm renders inline, outside the still-open host
    // dialog's Radix scroll-lock, which sets pointer-events:none around it.
    fireEvent.click(screen.getByTestId("confirm-discard"));
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("lets the footer Cancel exit directly without a discard confirm", async () => {
    const user = userEvent.setup();
    render(createElement(AddMembersDialog, defaultProps));

    await user.type(screen.getByLabelText(/Ethereum Address or ENS Name/), ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
