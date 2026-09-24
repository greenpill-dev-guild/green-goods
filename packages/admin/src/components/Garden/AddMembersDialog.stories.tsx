import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withDataRouter, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { AddMembersDialog } from "./AddMembersDialog";

// Fictional people. Rosa gardens here; Kofi stewards (which also made him an
// evaluator and a gardener); the other two are new to the garden.
const ROSA = "0x18c4a9f3b2d1e0f9a8b7c6d5e4f3a2b1c0d9ea67" as Address;
const KOFI = "0xa5e1f0c2b3d4e5f60718293a4b5c6d7e8f901ee0" as Address;
const NEW_A = "0xc2d4e6f8a0b1c3d5e7f9a1b2c3d4e5f6a7b8f0c1" as Address;
const NEW_B = "0x7f3e2d1c0b9a8f7e6d5c4b3a29181716151413f2" as Address;
const GARDEN = "0x0a1b2c3d4e5f60718293a4b5c6d7e8f901234567" as Address;

const roleMembers: Record<GardenRole, Address[]> = {
  owner: [],
  steward: [KOFI],
  evaluator: [KOFI],
  gardener: [KOFI, ROSA],
  funder: [],
  community: [],
};

const body = () => within(document.body);

async function enter(address: Address) {
  const input = await body().findByLabelText(/Ethereum Address or ENS Name/);
  await userEvent.clear(input);
  await userEvent.click(input);
  await userEvent.paste(address);
}

async function pickRole(role: GardenRole) {
  await userEvent.selectOptions(await body().findByLabelText("Role"), role);
}

async function stage() {
  await userEvent.click(await body().findByRole("button", { name: "Add" }));
}

const meta: Meta<typeof AddMembersDialog> = {
  title: "Admin/Workflows/Garden/AddMembersDialog",
  component: AddMembersDialog,
  tags: ["autodocs"],
  decorators: [
    // The dirty-close guard blocks navigation through `useBlocker`, which only
    // a data router provides.
    withDataRouter("/community/members"),
    withSeededQueryClient([
      [queryKeys.ens.name(ROSA.toLowerCase()), "rosa.eth"],
      [queryKeys.ens.name(KOFI.toLowerCase()), "kofi.eth"],
      [queryKeys.ens.name(NEW_A.toLowerCase()), null],
      [queryKeys.ens.name(NEW_B.toLowerCase()), null],
      // The chain confirms the roster: Rosa wears the gardener hat.
      [queryKeys.role.roleHat(GARDEN.toLowerCase(), ROSA.toLowerCase(), "gardener"), true],
    ]),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Multi-add member dialog: role select + address/ENS input staging into a fixed-height list (the dialog never grows), committed as one batch. Each person keeps the role picked when they were added, and someone who already holds that role cannot be staged, so the wallet is never asked to sign for nothing. Failed writes stay staged for retry. Opens from Manage Members.",
      },
    },
  },
  args: {
    open: true,
    onClose: fn(),
    onAdd: fn(async () => ({ success: true })),
    gardenAddress: GARDEN,
    roleMembers,
    isLoading: false,
    tone: "community",
  },
};

export default meta;
type Story = StoryObj<typeof AddMembersDialog>;

export const Default: Story = {};

/** Rosa already gardens here, so Gardener is refused with a reason, not an error. */
export const DuplicateBlocked: Story = {
  play: async () => {
    await enter(ROSA);
    await expect(await body().findByText(/is already a Gardener/)).toBeVisible();
    await expect(body().getByRole("button", { name: "Add" })).toBeDisabled();
  },
};

/** Picking Steward for Rosa is a promotion: the field says what she holds today. */
export const PromotionHint: Story = {
  play: async () => {
    await pickRole("steward");
    await enter(ROSA);
    await expect(await body().findByText(/is currently a Gardener/)).toBeVisible();
    await expect(body().getByRole("button", { name: "Add" })).toBeEnabled();
  },
};

/** Each row keeps its role; a mixed list is named by members, not by one role. */
export const MixedRoles: Story = {
  play: async () => {
    await enter(NEW_A);
    await stage();
    await pickRole("steward");
    await enter(ROSA);
    await stage();
    await pickRole("funder");
    await enter(NEW_B);
    await stage();
    await expect(await body().findByRole("button", { name: "Add 3 Members" })).toBeEnabled();
  },
};

export const AlreadyInList: Story = {
  play: async () => {
    await enter(NEW_A);
    await stage();
    await enter(NEW_A);
    await expect(await body().findByText(/is already in the list as a Gardener/)).toBeVisible();
  },
};

/** The Manage Roles path: opened for Rosa, the field starts with her. */
export const Prefilled: Story = {
  args: { initialAddress: ROSA },
};

export const HostWriteInFlight: Story = {
  args: {
    isLoading: true,
  },
};

/** The first write fails: that person stays staged for retry, the rest are done. */
export const FailedRetry: Story = {
  args: {
    onAdd: fn(async (_role: GardenRole, address: Address) => ({ success: address !== NEW_A })),
  },
  play: async () => {
    await enter(NEW_A);
    await stage();
    await enter(NEW_B);
    await userEvent.click(await body().findByRole("button", { name: "Add 2 Gardeners" }));
    await expect(await body().findByText("Failed to add member")).toBeVisible();
  },
};
