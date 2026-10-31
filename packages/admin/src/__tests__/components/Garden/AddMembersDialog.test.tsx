/**
 * AddMembersDialog Component Tests
 *
 * Multi-add staging semantics: resolved addresses stage into a fixed-height
 * list with the role picked for each person, the batch commits on submit, and
 * failed writes stay staged for retry. Someone who already holds the picked
 * role never reaches the list, so the wallet is never asked to sign for nothing.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AddMembersOutcome,
  useAddMembersBatch,
} from "@green-goods/shared/hooks/garden/useGardenOperations";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { parseAndFormatError } from "@green-goods/shared/utils/errors/contract-errors";
import { renderWithProviders as render } from "../../test-utils";

vi.mock("@green-goods/shared/hooks/admin-ui/useDirtyClose", async () => {
  const { useState } = await import("react");
  return {
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

vi.mock("@green-goods/shared/hooks/blockchain/useEnsAddress", () => ({
  // Hex-only tests: ENS lookups stay inert so no network/query wiring is hit.
  useEnsAddress: () => ({ data: undefined, isFetching: false }),
}));

vi.mock("@green-goods/shared/utils/blockchain/ens", () => ({
  resolveEnsAddress: vi.fn(async () => null),
}));

// The chain's answer to "does this person wear the role's hat". Default: not
// answered yet, so the roster's answer stands.
const mockUseGardenRoleHat = vi.fn();
vi.mock("@green-goods/shared/hooks/roles/useGardenRoleHat", () => ({
  useGardenRoleHat: (...args: unknown[]) => mockUseGardenRoleHat(...args),
}));

vi.mock("@/components/EnsAddressText", () => ({
  EnsAddressText: ({ address }: { address: string }) => createElement("span", null, address),
}));

// The staged list names each person through the shared address display; nobody here has
// published a name, so each reads as a short address with the full one in its title.
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));

/** The staged person's name in the Add Members queue. */
const stagedName = (address: Address) =>
  within(screen.getByRole("group", { name: "Members to add" })).getByTitle(
    new RegExp(`· ${address}$`)
  );

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
const GARDEN = "0x9999999999999999999999999999999999999999" as Address;

const NO_MEMBERS: Record<GardenRole, Address[]> = {
  owner: [],
  steward: [],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};
// ADDRESS_A already gardens here.
const WITH_GARDENER_A: Record<GardenRole, Address[]> = { ...NO_MEMBERS, gardener: [ADDRESS_A] };

type AddMembersBatch = ReturnType<typeof useAddMembersBatch>;

const SIGNER = "0x3333333333333333333333333333333333333333" as Address;
const OTHER_SIGNER = "0x4444444444444444444444444444444444444444" as Address;
const ROW_A = { address: ADDRESS_A, role: "gardener" as const };
const ROW_B = { address: ADDRESS_B, role: "gardener" as const };
const NOTHING: AddMembersOutcome = {
  added: [],
  alreadyHeld: [],
  refused: [],
  notSent: [],
  notBatchable: [],
  unknown: [],
};
const HOLD_ON_A = {
  operationIds: ["held-add"],
  rows: [ROW_A],
  onChain: [{ ...ROW_A, wearsRole: true }],
};

function batchWith(overrides: Partial<AddMembersBatch> = {}): AddMembersBatch {
  return {
    account: SIGNER,
    hold: null,
    saved: [],
    lastReadAt: 0,
    isSettlingHold: false,
    checkAgain: vi.fn(async () => undefined),
    moveOn: vi.fn(async () => undefined),
    available: true,
    signaturesFor: (count) => Math.ceil(count / 10),
    add: vi.fn<AddMembersBatch["add"]>(async () => NOTHING),
    ...overrides,
  };
}

async function stage(user: ReturnType<typeof userEvent.setup>, ...addresses: Address[]) {
  const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
  for (const address of addresses) {
    await user.click(input);
    await user.paste(address);
    await user.click(screen.getByRole("button", { name: "Add" }));
  }
}

const stagedList = () => within(screen.getByRole("group", { name: "Members to add" }));

describe("components/Garden/AddMembersDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onAdd: vi.fn(async () => ({ success: true })),
    gardenAddress: GARDEN,
    roleMembers: NO_MEMBERS,
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardenRoleHat.mockReturnValue({ wearsHat: undefined, isLoading: false, isError: false });
  });

  it("stages resolved addresses into the reserved list and clears the input", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(stagedName(ADDRESS_A)).toBeInTheDocument();
    });
    expect(input).toHaveValue("");
    // The staging region exists even before entries (reserved geometry).
    expect(screen.getByRole("group", { name: "Members to add" })).toBeInTheDocument();
  });

  it("commits the staged batch for the selected role and closes on success", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(input);
    await user.paste(ADDRESS_B);

    // Typed-but-unstaged address folds into the batch — one staged + one typed.
    // Every row shares the role, so the button names it.
    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));

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
    const user = userEvent.setup({ delay: null });
    const onAdd = vi
      .fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValue({ success: true });
    render(createElement(AddMembersDialog, { ...defaultProps, onAdd }));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(input);
    await user.paste(ADDRESS_B);
    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));

    // First write failed → its address stays staged, the dialog stays open.
    await waitFor(() => {
      expect(screen.getByText("Failed to add member")).toBeInTheDocument();
    });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
    expect(stagedName(ADDRESS_A)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 1 Gardener" })).toBeInTheDocument();
  });

  it("submits a typed address directly without requiring the stage step", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add 1 Gardener" }));

    await waitFor(() => {
      expect(defaultProps.onAdd).toHaveBeenCalledWith("gardener", ADDRESS_A);
    });
  });

  it("keeps invalid typed entries from becoming commit-ready", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste("not-a-wallet");

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Gardeners" })).toBeDisabled();
    expect(defaultProps.onAdd).not.toHaveBeenCalled();
  });

  it("refuses a role the person already holds, then lets them be promoted", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, { ...defaultProps, roleMembers: WITH_GARDENER_A }));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);

    // Calm guidance, not an error: the address is fine, only this role is taken.
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(
      screen.getByText(/is already a Gardener\. Choose another role to add them\./)
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");

    await user.selectOptions(screen.getByLabelText("Role"), "steward");
    expect(screen.getByText(/is currently a Gardener\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add" }));

    // The row names the role being added and the roles held today.
    const list = screen.getByRole("group", { name: "Members to add" });
    expect(within(list).getByText("Steward")).toBeInTheDocument();
    expect(within(list).getByText("Currently a Gardener")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add 1 Steward" }));
    await waitFor(() => {
      expect(defaultProps.onAdd).toHaveBeenCalledWith("steward", ADDRESS_A);
    });
  });

  it("lets the chain overrule a roster that has not caught up with a revoke", async () => {
    const user = userEvent.setup({ delay: null });
    // The roster still lists ADDRESS_A as a gardener, but the hat is gone on chain.
    mockUseGardenRoleHat.mockReturnValue({ wearsHat: false, isLoading: false, isError: false });
    render(createElement(AddMembersDialog, { ...defaultProps, roleMembers: WITH_GARDENER_A }));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);

    expect(mockUseGardenRoleHat).toHaveBeenLastCalledWith(GARDEN, ADDRESS_A, "gardener", {
      enabled: true,
    });
    expect(screen.queryByText(/is already a Gardener/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add" }));
    // The staged row trusts the chain too: no "Currently a Gardener" beside Gardener.
    const list = screen.getByRole("group", { name: "Members to add" });
    expect(within(list).getByText("Gardener")).toBeInTheDocument();
    expect(within(list).queryByText(/Currently/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add 1 Gardener" }));
    await waitFor(() => {
      expect(defaultProps.onAdd).toHaveBeenCalledWith("gardener", ADDRESS_A);
    });
  });

  it("refuses a role the chain shows was just granted, before the roster catches up", async () => {
    const user = userEvent.setup({ delay: null });
    // Nobody is on the roster yet, but ADDRESS_A already wears the gardener hat.
    mockUseGardenRoleHat.mockReturnValue({ wearsHat: true, isLoading: false, isError: false });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);

    expect(mockUseGardenRoleHat).toHaveBeenLastCalledWith(GARDEN, ADDRESS_A, "gardener", {
      enabled: true,
    });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByText(/is already a Gardener/)).toBeInTheDocument();
  });

  it("keeps each row's role when the picker changes and names a mixed list", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.selectOptions(screen.getByLabelText("Role"), "steward");
    await user.click(input);
    await user.paste(ADDRESS_B);
    await user.click(screen.getByRole("button", { name: "Add" }));

    const list = screen.getByRole("group", { name: "Members to add" });
    expect(within(list).getByText("Gardener")).toBeInTheDocument();
    expect(within(list).getByText("Steward")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add 2 Members" }));

    await waitFor(() => {
      expect(defaultProps.onAdd).toHaveBeenCalledWith("gardener", ADDRESS_A);
      expect(defaultProps.onAdd).toHaveBeenCalledWith("steward", ADDRESS_B);
    });
  });

  it("says when a person is already in the list", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(input);
    await user.paste(ADDRESS_A);

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByText(/is already in the list as a Gardener\./)).toBeInTheDocument();
  });

  it("opens on a prefilled person without treating it as unsaved input", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      createElement(AddMembersDialog, {
        ...defaultProps,
        roleMembers: WITH_GARDENER_A,
        initialAddress: ADDRESS_A,
      })
    );

    expect(screen.getByLabelText(/Ethereum Address or ENS Name/)).toHaveValue(ADDRESS_A);
    expect(screen.getByText(/is already a Gardener\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("confirms before discarding a staged batch on dialog dismiss", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(stagedName(ADDRESS_A)).toBeInTheDocument();
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

  it("says how many signatures a list takes, whichever way it goes", async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(createElement(AddMembersDialog, defaultProps));
    expect(screen.queryByText(/signature/)).not.toBeInTheDocument();

    await stage(user, ADDRESS_A, ADDRESS_B);
    expect(screen.getByText("2 signatures")).toBeInTheDocument();

    rerender(createElement(AddMembersDialog, { ...defaultProps, batch: batchWith() }));
    expect(screen.getByText("1 signature")).toBeInTheDocument();
  });

  it("adds a list through one call and closes once every row has landed", async () => {
    const user = userEvent.setup({ delay: null });
    const batch = batchWith();
    render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    await stage(user, ADDRESS_A, ADDRESS_B);
    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));

    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalledTimes(1));
    expect(vi.mocked(batch.add).mock.calls[0][0]).toEqual([ROW_A, ROW_B]);
    expect(defaultProps.onAdd).not.toHaveBeenCalled();
  });

  it("sends one person the usual way", async () => {
    const user = userEvent.setup({ delay: null });
    const batch = batchWith();
    render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    await stage(user, ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Add 1 Gardener" }));
    await waitFor(() => expect(defaultProps.onAdd).toHaveBeenCalledTimes(1));
    expect(batch.add).not.toHaveBeenCalled();
  });

  it("asks before a list past its ceilings takes more signatures than it promised", async () => {
    const user = userEvent.setup({ delay: null });
    const batch = batchWith({
      add: vi.fn(async () => ({ ...NOTHING, notBatchable: [ROW_A, ROW_B] })),
    });
    render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    await stage(user, ADDRESS_A, ADDRESS_B);
    expect(screen.getByText("1 signature")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));

    expect(await screen.findByText(/can’t share one signature right now/)).toBeInTheDocument();
    expect(screen.getByText("2 signatures")).toBeInTheDocument();
    expect(defaultProps.onAdd).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));
    await waitFor(() => expect(defaultProps.onAdd).toHaveBeenCalledTimes(2));
    expect(batch.add).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalledTimes(1));
  });

  it("gives a changed list another try under one signature", async () => {
    const user = userEvent.setup({ delay: null });
    const batch = batchWith({
      add: vi.fn(async () => ({ ...NOTHING, notBatchable: [ROW_A, ROW_B] })),
    });
    render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    await stage(user, ADDRESS_A, ADDRESS_B);
    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));
    expect(await screen.findByText("2 signatures")).toBeInTheDocument();

    await stage(user, "0x5555555555555555555555555555555555555555" as Address);
    expect(screen.getByText("1 signature")).toBeInTheDocument();
  });

  it("says why a list stopped before anything went out", async () => {
    const user = userEvent.setup({ delay: null });
    const failure = new Error("NotGardenOwner");
    const batch = batchWith({
      add: vi.fn(async () => ({ ...NOTHING, notSent: [ROW_A, ROW_B], failure })),
    });
    render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    await stage(user, ADDRESS_A, ADDRESS_B);
    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));

    expect(await screen.findByText(parseAndFormatError(failure).message)).toBeInTheDocument();
    expect(screen.queryByText("Failed to add member")).not.toBeInTheDocument();
    expect(stagedList().getAllByRole("listitem")).toHaveLength(2);
  });

  it("leaves another account's unsettled rows behind", async () => {
    const user = userEvent.setup({ delay: null });
    const batch = batchWith({ hold: HOLD_ON_A, lastReadAt: 1 });
    const { rerender } = render(createElement(AddMembersDialog, { ...defaultProps, batch }));
    expect(await screen.findByText("Not confirmed yet · On chain now")).toBeInTheDocument();
    await stage(user, ADDRESS_B);

    // A wallet dropping and coming back is the same person, so the draft stays.
    rerender(
      createElement(AddMembersDialog, { ...defaultProps, batch: batchWith({ account: null }) })
    );
    rerender(
      createElement(AddMembersDialog, { ...defaultProps, batch: batchWith({ account: SIGNER }) })
    );
    expect(stagedList().getAllByRole("listitem")).toHaveLength(2);

    rerender(
      createElement(AddMembersDialog, {
        ...defaultProps,
        batch: batchWith({ account: OTHER_SIGNER }),
      })
    );
    await waitFor(() => expect(stagedList().queryAllByRole("listitem")).toHaveLength(0));
    expect(screen.getByRole("button", { name: "Add Gardeners" })).toBeDisabled();
  });

  it("keeps a refused row's reason, and sends the rest only once the person changes the list", async () => {
    const user = userEvent.setup({ delay: null });
    const reason = "This person can't hold this role";
    const batch = batchWith({
      add: vi.fn(async () => ({
        ...NOTHING,
        refused: [{ ...ROW_A, reason }],
        notSent: [ROW_B],
      })),
    });
    render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    await stage(user, ADDRESS_A, ADDRESS_B);
    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));

    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.getByText(/We can’t add 1 person, so nothing was sent/)).toBeInTheDocument();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
    expect(defaultProps.onAdd).not.toHaveBeenCalled();

    await user.click(stagedList().getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add 1 Gardener" }));
    await waitFor(() => expect(defaultProps.onAdd).toHaveBeenCalledWith("gardener", ADDRESS_B));
    expect(batch.add).toHaveBeenCalledTimes(1);
  });

  it("stays open with an unknown add, and takes off the rows that did land", async () => {
    const user = userEvent.setup({ delay: null });
    const batch = batchWith({
      add: vi.fn(async (_rows, onLanded) => {
        onLanded?.([ROW_A]);
        return {
          ...NOTHING,
          added: [{ ...ROW_A, transactionHash: `0x${"ab".repeat(32)}` as const }],
          unknown: [ROW_B],
        };
      }),
    });
    render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    await stage(user, ADDRESS_A, ADDRESS_B);
    await user.click(screen.getByRole("button", { name: "Add 2 Gardeners" }));

    await waitFor(() => expect(stagedName(ADDRESS_B)).toBeInTheDocument());
    await waitFor(() => expect(stagedList().getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByText("Failed to add member")).not.toBeInTheDocument();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("locks a held row and leaves it out of the send, until a read or moving on settles it", async () => {
    const user = userEvent.setup({ delay: null });
    const batch = batchWith({ hold: HOLD_ON_A, lastReadAt: 1 });
    const { rerender } = render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    expect(await screen.findByText("Not confirmed yet · On chain now")).toBeInTheDocument();
    expect(stagedList().getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Gardeners" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move On" }));
    expect(batch.moveOn).toHaveBeenCalledTimes(1);

    // Held rows hold no unsaved input of the person's, and the draft can't drop them.
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    expect(stagedName(ADDRESS_A)).toBeInTheDocument();

    // Others can still go, without the held row.
    await stage(user, ADDRESS_B);
    expect(screen.getByRole("button", { name: "Add 1 Gardener" })).toBeEnabled();

    // Moved on, unproven: the row is the person's again.
    const movedOn = { ...batch, hold: null, lastReadAt: 2 };
    rerender(createElement(AddMembersDialog, { ...defaultProps, batch: movedOn }));
    await waitFor(() =>
      expect(stagedList().getAllByRole("button", { name: "Remove" })[0]).toBeEnabled()
    );
    expect(screen.getByRole("button", { name: "Add 2 Gardeners" })).toBeEnabled();

    // A later read proved it landed: it leaves the list.
    const landed = { ...batch, hold: null, saved: [ROW_A], lastReadAt: 3 };
    rerender(createElement(AddMembersDialog, { ...defaultProps, batch: landed }));
    await waitFor(() => expect(stagedList().getAllByRole("listitem")).toHaveLength(1));
  });

  it("waits for the chain before it lets anyone send", async () => {
    const user = userEvent.setup({ delay: null });
    const batch = batchWith({ isSettlingHold: true });
    render(createElement(AddMembersDialog, { ...defaultProps, batch }));

    await stage(user, ADDRESS_A);
    expect(screen.getByRole("button", { name: "Add 1 Gardener" })).toBeDisabled();
  });

  it("lets the footer Cancel exit directly without a discard confirm", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(AddMembersDialog, defaultProps));

    const input = screen.getByLabelText(/Ethereum Address or ENS Name/);
    await user.click(input);
    await user.paste(ADDRESS_A);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
