/**
 * ManageMembersDialog Component Tests
 *
 * The single membership surface: flat roster + role filter chips + remove +
 * the Add Members entry ("keep it simple" collapse of the old roles stack).
 */

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { renderWithProviders as render } from "../../test-utils";

vi.mock("@green-goods/shared/components/AddressDisplay", () => ({
  AddressDisplay: ({ address, className }: { address: string; className?: string }) =>
    createElement("span", { className, "data-testid": "address-display" }, address.slice(0, 10)),
}));

import { ManageMembersDialog } from "../../../components/Garden/ManageMembersDialog";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const GARDENER_A = "0x4444444444444444444444444444444444444444" as Address;
const GARDENER_B = "0x5555555555555555555555555555555555555555" as Address;

const roleMembers: Record<GardenRole, Address[]> = {
  owner: [OWNER],
  steward: [],
  evaluator: [],
  gardener: [GARDENER_A, GARDENER_B],
  funder: [],
  community: [],
};

describe("components/Garden/ManageMembersDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    roleMembers,
    canManage: true,
    isLoading: false,
    onRemoveMember: vi.fn(async () => ({ success: true })),
    onAddMembers: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one flat roster across all roles with the member count", () => {
    render(createElement(ManageMembersDialog, defaultProps));

    expect(screen.getByText("3 members across all roles")).toBeInTheDocument();
    expect(screen.getAllByTestId("address-display")).toHaveLength(3);
  });

  it("filters the roster by role via the filter chips", async () => {
    const user = userEvent.setup();
    render(createElement(ManageMembersDialog, defaultProps));

    await user.click(screen.getByRole("button", { name: /Gardeners · 2/ }));
    expect(screen.getAllByTestId("address-display")).toHaveLength(2);

    // Toggling the active chip returns to the full roster.
    await user.click(screen.getByRole("button", { name: /Gardeners · 2/ }));
    expect(screen.getAllByTestId("address-display")).toHaveLength(3);
  });

  it("shows the empty state when a role filter has no members", async () => {
    const user = userEvent.setup();
    render(createElement(ManageMembersDialog, defaultProps));

    await user.click(screen.getByRole("button", { name: /Stewards · 0/ }));
    expect(screen.getByText("No members found")).toBeInTheDocument();
  });

  it("confirms before removing a member from the row action", async () => {
    const user = userEvent.setup();
    render(createElement(ManageMembersDialog, defaultProps));

    const ownerRow = screen.getByText(OWNER.slice(0, 10)).closest("li") as HTMLElement;
    await user.click(within(ownerRow).getByRole("button", { name: "Remove Owner" }));

    expect(defaultProps.onRemoveMember).not.toHaveBeenCalled();

    const confirm = await screen.findByRole("alertdialog", {
      name: "Confirm Member Removal",
    });
    expect(confirm).toHaveTextContent(OWNER.slice(0, 6));

    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(defaultProps.onRemoveMember).not.toHaveBeenCalled();

    await user.click(within(ownerRow).getByRole("button", { name: "Remove Owner" }));
    await user.click(await screen.findByRole("button", { name: "Remove Member" }));

    expect(defaultProps.onRemoveMember).toHaveBeenCalledWith(OWNER, "owner");
  });

  it("keeps the roster visible and reports a failed confirmed removal", async () => {
    const user = userEvent.setup();
    const onRemoveMember = vi.fn(async () => ({ success: false }));
    render(createElement(ManageMembersDialog, { ...defaultProps, onRemoveMember }));

    const ownerRow = screen.getByText(OWNER.slice(0, 10)).closest("li") as HTMLElement;
    await user.click(within(ownerRow).getByRole("button", { name: "Remove Owner" }));
    await user.click(await screen.findByRole("button", { name: "Remove Member" }));

    expect(await screen.findByText("Failed to remove Owner")).toBeInTheDocument();
    expect(screen.getAllByTestId("address-display")).toHaveLength(3);
  });

  it("opens the Add Members flow from the footer action", async () => {
    const user = userEvent.setup();
    render(createElement(ManageMembersDialog, defaultProps));

    await user.click(screen.getByRole("button", { name: "Add Members" }));
    expect(defaultProps.onAddMembers).toHaveBeenCalledTimes(1);
  });

  it("locks close and add-member affordances while a member write is loading", async () => {
    render(createElement(ManageMembersDialog, { ...defaultProps, isLoading: true }));

    for (const closeButton of screen.getAllByRole("button", { name: "Close" })) {
      expect(closeButton).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Add Members" })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Manage Members" }), { key: "Escape" });

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("hides write affordances for read-only viewers", () => {
    render(createElement(ManageMembersDialog, { ...defaultProps, canManage: false }));

    expect(screen.queryByRole("button", { name: "Add Members" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });
});
