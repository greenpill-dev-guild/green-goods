/**
 * Manage Roles (ManageMembersDialog): one row per person with a check chip per role, picks that
 * outlive search and filters, the viewer's rank on every chip, and a review that reads the chain
 * before it removes anything, then says what landed.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RoleRemovalApi,
  RoleRemovalOutcome,
} from "@green-goods/shared/hooks/garden/useGardenOperations";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { renderWithProviders as render } from "../../test-utils";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const VIEWER = "0x2222222222222222222222222222222222222222" as Address;
const PEER = "0x3333333333333333333333333333333333333333" as Address;
const CHIDI = "0x4444444444444444444444444444444444444444" as Address;
const TOMI = "0x5555555555555555555555555555555555555555" as Address;
const NEIGHBOR = "0x6666666666666666666666666666666666666666" as Address;

const NAMES: Record<string, string> = {
  [OWNER]: "riolab",
  [VIEWER]: "ana-souza.eth",
  [PEER]: "kwame.eth",
  [CHIDI]: "chidinma",
  [TOMI]: "tomi.eth",
};
const nameOf = (address: string) => NAMES[address] ?? `${address.slice(0, 6)}…`;

vi.mock("@green-goods/shared/components/AddressDisplay", () => ({
  AddressDisplay: ({
    address,
    children,
  }: {
    address: string;
    children?: (name: string) => ReactNode;
  }) => (children ? children(nameOf(address)) : nameOf(address)),
}));

vi.mock("@green-goods/shared/hooks/ens/useAddressDisplayName", () => ({
  useAddressDisplayName: (address: string) => ({
    preferredName: NAMES[address] ?? null,
    display: nameOf(address),
  }),
}));

vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", () => ({
  useResolvedProfileAvatar: () => ({ avatarUri: undefined }),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/useDirtyClose", async () => {
  const { useState } = await import("react");
  return {
    // State mode of useDirtyClose without the router-bound blocker (no data router here).
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

vi.mock("@green-goods/shared/hooks/garden/useGardenMemberHistory", () => ({
  useGardenMemberHistory: () => ({ members: [], isLoading: false, isError: false }),
}));

import { ManageMembersDialog } from "../../../components/Garden/ManageMembersDialog";

const roleMembers: Record<GardenRole, Address[]> = {
  owner: [OWNER],
  steward: [OWNER, VIEWER, PEER],
  evaluator: [OWNER, VIEWER, PEER, CHIDI, TOMI],
  gardener: [OWNER, VIEWER, PEER, CHIDI, TOMI],
  funder: [],
  community: [NEIGHBOR],
};

/** A chain that answers every check with `held`, and settles every pair with `settle`. */
function fakeRemoval({
  held = () => true,
  settle = () => ({ status: "removed" }),
}: {
  held?: (address: Address, role: GardenRole) => boolean | null;
  settle?: (address: Address, role: GardenRole) => RoleRemovalOutcome;
} = {}) {
  return {
    check: vi.fn<RoleRemovalApi["check"]>(async (rows) =>
      rows.map((row) => held(row.address, row.role))
    ),
    remove: vi.fn<RoleRemovalApi["remove"]>(async (rows, events) =>
      rows.map((row) => {
        events?.onSending?.(row);
        const outcome = settle(row.address, row.role);
        events?.onSettled?.(row, outcome);
        return outcome;
      })
    ),
  } satisfies RoleRemovalApi;
}

function renderDialog(props: Partial<Parameters<typeof ManageMembersDialog>[0]> = {}) {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    roleMembers,
    canManage: true,
    viewerIsOwner: false,
    viewerAddress: VIEWER,
    gardenName: "Rio Rainforest Lab",
    isLoading: false,
    removal: fakeRemoval(),
    onAddMembers: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  const { rerender } = render(createElement(ManageMembersDialog, merged));
  return {
    ...merged,
    rerender: (next: Partial<Parameters<typeof ManageMembersDialog>[0]>) =>
      rerender(createElement(ManageMembersDialog, { ...merged, ...next })),
  };
}

const rowOf = (name: string) =>
  screen.getByText(name).closest("[data-component='ManageRolesPersonRow']") as HTMLElement;
const pick = (user: ReturnType<typeof userEvent.setup>, role: string, name: string) =>
  user.click(screen.getByRole("checkbox", { name: `Remove ${role} from ${name}` }));

describe("components/Garden/ManageMembersDialog (Manage Roles)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists each person once, by the name the directory shows, with a check chip per role", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Manage Roles" })).toBeInTheDocument();
    expect(screen.getByText("Rio Rainforest Lab")).toBeInTheDocument();
    expect(screen.getByText("6 members")).toBeInTheDocument();
    const chidi = within(rowOf("chidinma"));
    expect(
      chidi.getByRole("checkbox", { name: "Remove Evaluator from chidinma" })
    ).not.toBeChecked();
    expect(
      chidi.getByRole("checkbox", { name: "Remove Gardener from chidinma" })
    ).toBeInTheDocument();
  });

  it("locks what a steward cannot remove, and the row says why", () => {
    renderDialog();

    const owner = within(rowOf("riolab"));
    expect(owner.queryAllByRole("checkbox")).toHaveLength(0);
    expect(owner.getByText("Only an owner can change an owner's roles.")).toBeInTheDocument();

    const peer = within(rowOf("kwame.eth"));
    expect(peer.queryByRole("checkbox", { name: "Remove Steward from kwame.eth" })).toBeNull();
    expect(
      peer.getByRole("checkbox", { name: "Remove Evaluator from kwame.eth" })
    ).toBeInTheDocument();
    expect(
      peer.getByText("Only an owner can remove a steward's Steward role.")
    ).toBeInTheDocument();

    const self = within(rowOf("ana-souza.eth"));
    expect(self.getByText("You")).toBeInTheDocument();
    expect(self.getByText("You can't remove your own Steward role here.")).toBeInTheDocument();
    expect(
      self.getByRole("checkbox", { name: "Remove Gardener from ana-souza.eth" })
    ).toBeInTheDocument();
  });

  it("lets an owner remove another owner's roles but never their own Owner or Steward role", () => {
    renderDialog({
      viewerIsOwner: true,
      viewerAddress: OWNER,
      roleMembers: { ...roleMembers, owner: [OWNER, PEER] },
    });

    expect(
      screen.getByRole("checkbox", { name: "Remove Owner from kwame.eth" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Remove Steward from kwame.eth" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Remove Owner from riolab" })).toBeNull();
    expect(
      screen.getByText("You can't remove your own Owner and Steward roles here.")
    ).toBeInTheDocument();
  });

  it("keeps picks through search and filters, counts roles and people apart, and shows or clears picks out of view", async () => {
    const user = userEvent.setup();
    renderDialog();

    await pick(user, "Evaluator", "chidinma");
    await pick(user, "Evaluator", "tomi.eth");
    await pick(user, "Community member", "0x6666…");
    expect(screen.getByText("3 roles from 3 people")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Evaluators" }));
    expect(screen.queryByText("0x6666…")).toBeNull();
    expect(screen.getByText("1 role not shown")).toBeInTheDocument();
    expect(screen.getByText("3 roles from 3 people")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("0x6666…")).toBeInTheDocument();
    expect(screen.queryByText("riolab")).toBeNull();
    expect(screen.queryByText("1 role not shown")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Check the roles to remove.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Removal" })).toBeDisabled();
  });

  it("lets go of Selected once its picks are cleared, so the next pick shows everyone", async () => {
    const user = userEvent.setup();
    renderDialog();

    await pick(user, "Evaluator", "chidinma");
    await user.click(screen.getByRole("button", { name: "Selected" }));
    expect(screen.queryByText("tomi.eth")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await pick(user, "Evaluator", "tomi.eth");
    expect(screen.getByText("chidinma")).toBeInTheDocument();
  });

  it("finds people by the name their row shows, and opens on one person until Show Everyone", async () => {
    const user = userEvent.setup();
    renderDialog({ initialMember: TOMI });

    expect(
      screen.getByText("tomi.eth", { selector: "[data-component='ManageRolesPersonRow'] *" })
    ).toBeInTheDocument();
    expect(screen.queryByText("chidinma")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show Everyone" }));
    expect(screen.getByText("chidinma")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "kwame");
    expect(screen.getByText("kwame.eth")).toBeInTheDocument();
    expect(screen.queryByText("chidinma")).toBeNull();
  });

  it("reviews against the garden, leaves out a role already gone, and removes the rest", async () => {
    const user = userEvent.setup();
    const removal = fakeRemoval({ held: (address) => address !== TOMI });
    const onRosterStale = vi.fn();
    const { onClose } = renderDialog({ removal, onRosterStale });

    await pick(user, "Evaluator", "chidinma");
    await pick(user, "Evaluator", "tomi.eth");
    await pick(user, "Evaluator", "kwame.eth");
    await user.click(screen.getByRole("button", { name: "Review Removal" }));

    const review = screen.getByRole("dialog", { name: "Review Removal" });
    expect(within(review).getByText("Rio Rainforest Lab")).toBeInTheDocument();
    expect(await within(review).findByText("Removes 2 roles from 2 people")).toBeInTheDocument();
    expect(
      within(review).getByText(/1 role was already removed, so it won't be sent\./)
    ).toBeInTheDocument();
    expect(within(review).getByText("Already removed")).toBeInTheDocument();
    expect(within(review).getAllByText("Keeps Gardener")).toHaveLength(2);
    expect(
      within(review).getByText("Their Steward role still covers this on chain.")
    ).toBeInTheDocument();
    expect(within(review).getByText("2 signatures")).toBeInTheDocument();

    await user.click(within(review).getByRole("button", { name: "Remove 2 Roles" }));
    expect(removal.remove).toHaveBeenCalledWith(
      [
        { address: PEER, role: "evaluator" },
        { address: CHIDI, role: "evaluator" },
      ],
      expect.anything()
    );
    expect(await within(review).findByText("2 roles removed")).toBeInTheDocument();
    expect(onRosterStale).toHaveBeenCalledTimes(1);
    await user.click(within(review).getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("says nothing was removed after a declined signature, offers it again, and keeps the pick for Back", async () => {
    const user = userEvent.setup();
    const removal = fakeRemoval({ settle: () => ({ status: "declined" }) });
    renderDialog({ removal });

    await pick(user, "Evaluator", "chidinma");
    await user.click(screen.getByRole("button", { name: "Review Removal" }));
    await user.click(await screen.findByRole("button", { name: "Remove 1 Role" }));

    expect(await screen.findByText("Nothing was removed")).toBeInTheDocument();
    expect(screen.getByText("Not sent")).toBeInTheDocument();
    // A role still held after the run is still theirs.
    expect(screen.getByText("Keeps Evaluator and Gardener")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove 1 Role" }));
    expect(removal.remove).toHaveBeenCalledTimes(2);

    await user.click(await screen.findByRole("button", { name: "Back" }));
    expect(screen.getByRole("checkbox", { name: "Remove Evaluator from chidinma" })).toBeChecked();
  });

  it("holds a removal it could not confirm until Check Again reads where it stands", async () => {
    const user = userEvent.setup();
    let afterRun = false;
    const removal = fakeRemoval({
      held: () => (afterRun ? false : true),
      settle: () => {
        afterRun = true;
        return { status: "unknown" };
      },
    });
    renderDialog({ removal });

    await pick(user, "Evaluator", "chidinma");
    await user.click(screen.getByRole("button", { name: "Review Removal" }));
    await user.click(await screen.findByRole("button", { name: "Remove 1 Role" }));

    expect(await screen.findByText("We couldn't confirm a removal")).toBeInTheDocument();
    // Until a read proves it gone, the role still counts as theirs.
    expect(screen.getByText("Keeps Evaluator and Gardener")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Check Again" }));
    await waitFor(() => expect(screen.getByText("1 role removed")).toBeInTheDocument());
  });

  it("starts over when the signing account changes, so no account signs a review it did not make", async () => {
    const user = userEvent.setup();
    const dialog = renderDialog();

    await pick(user, "Evaluator", "chidinma");
    await user.click(screen.getByRole("button", { name: "Review Removal" }));
    expect(await screen.findByRole("dialog", { name: "Review Removal" })).toBeInTheDocument();

    dialog.rerender({ viewerAddress: PEER });
    expect(await screen.findByRole("dialog", { name: "Manage Roles" })).toBeInTheDocument();
    expect(screen.getByText("Check the roles to remove.")).toBeInTheDocument();
    expect(dialog.removal.remove).not.toHaveBeenCalled();
  });

  it("shows roles without checkboxes to someone who cannot change them", () => {
    renderDialog({ canManage: false });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText("Only owners and stewards can change roles.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review Removal" })).toBeNull();
  });
});
