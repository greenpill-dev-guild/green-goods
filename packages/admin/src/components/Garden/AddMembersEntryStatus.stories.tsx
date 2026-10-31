import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { AddMembersEntryStatus } from "./AddMembersEntryStatus";

const ROSA = "0x18c4a9f3b2d1e0f9a8b7c6d5e4f3a2b1c0d9ea67" as Address;

const meta: Meta<typeof AddMembersEntryStatus> = {
  title: "Admin/Workflows/Garden/AddMembersEntryStatus",
  component: AddMembersEntryStatus,
  tags: ["autodocs"],
  decorators: [withSeededQueryClient([[queryKeys.ens.name(ROSA.toLowerCase()), "rosa.eth"]])],
  parameters: {
    docs: {
      description: {
        component:
          "The line under the Add Members address field. It says what the typed entry means: calm supporting text, never an error, because the address is fine and only this role may be taken.",
      },
    },
  },
  args: {
    id: "entry-status",
    typed: ROSA,
    isHexAddress: true,
    resolvedAddress: ROSA,
    isEnsName: false,
    isResolvingEns: false,
    check: { kind: "new" },
    selectedRole: "gardener",
  },
};

export default meta;
type Story = StoryObj<typeof AddMembersEntryStatus>;

/** Someone new: nothing to say, and the line takes no room. */
export const NewPerson: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("#entry-status")).toBeEmptyDOMElement();
  },
};

export const AlreadyInList: Story = {
  args: { check: { kind: "staged", stagedRole: "steward" } },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/is already in the list as a Steward/)
    ).toBeVisible();
  },
};

export const AlreadyHoldsRole: Story = {
  args: { check: { kind: "held" } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/is already a Gardener/)).toBeVisible();
  },
};

export const Promotion: Story = {
  args: {
    check: { kind: "member", currentRoles: ["gardener", "evaluator"] },
    selectedRole: "owner",
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/is currently a Gardener and Evaluator/)
    ).toBeVisible();
  },
};

export const ResolvingName: Story = {
  args: {
    typed: "rosa.eth",
    isHexAddress: false,
    resolvedAddress: null,
    isEnsName: true,
    isResolvingEns: true,
    check: null,
  },
};

export const NameNotFound: Story = {
  args: {
    typed: "nobody.eth",
    isHexAddress: false,
    resolvedAddress: null,
    isEnsName: true,
    check: null,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Enter a valid ENS name or 0x address.")
    ).toBeVisible();
  },
};
