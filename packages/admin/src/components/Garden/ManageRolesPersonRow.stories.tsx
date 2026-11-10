import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_PROFILE } from "../../../../shared/.storybook/fixtures";
import { blockedRoles } from "./manageRoles";
import { ManageRolesPersonRow } from "./ManageRolesPersonRow";
import {
  ANA,
  CHIDI,
  KWAME,
  manageRolesIdentity,
  personOf,
  RIOLAB,
} from "./manageRolesStoryFixtures";

const asSteward = { address: ANA, isOwner: false, canManage: true };

const meta: Meta<typeof ManageRolesPersonRow> = {
  title: "Admin/Workflows/Garden/ManageRolesPersonRow",
  component: ManageRolesPersonRow,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(manageRolesIdentity(FIXTURE_IMAGE_PROFILE)),
    (Story) => (
      <ul className="max-w-xl">
        <Story />
      </ul>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "One person on Manage Roles: their avatar and name as the directory shows them, then a check chip for each role they hold (DL-049). Roles the viewer cannot remove are locked, and the row says why in words.",
      },
    },
  },
  args: {
    person: personOf(CHIDI),
    chainId: DEFAULT_CHAIN_ID,
    isViewer: false,
    blocked: blockedRoles(personOf(CHIDI), asSteward, 1),
    selected: new Set(),
    onToggle: fn(),
    readOnly: false,
  },
};

export default meta;
type Story = StoryObj<typeof ManageRolesPersonRow>;

export const Open: Story = {};

/** Evaluator picked, Gardener kept: the row's edge darkens with the pick. */
export const OneRolePicked: Story = { args: { selected: new Set(["evaluator"]) } };

/** A steward looking at the owner: every role locked, one reason. */
export const OwnerSeenByASteward: Story = {
  args: {
    person: personOf(RIOLAB),
    blocked: blockedRoles(personOf(RIOLAB), asSteward, 1),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole("checkbox")).toHaveLength(0);
    await expect(
      await canvas.findByText("Only an owner can change an owner's roles.")
    ).toBeVisible();
  },
};

/** A steward looking at another steward: their Steward role locked, the rest open. */
export const PeerSteward: Story = {
  args: {
    person: personOf(KWAME),
    blocked: blockedRoles(personOf(KWAME), asSteward, 1),
  },
};

/** The steward's own row: their Steward role stays out of reach here. */
export const OwnRow: Story = {
  args: {
    person: personOf(ANA),
    isViewer: true,
    blocked: blockedRoles(personOf(ANA), asSteward, 1),
  },
};

/** Someone who cannot manage roles reads them as plain chips. */
export const ReadOnly: Story = { args: { readOnly: true } };
