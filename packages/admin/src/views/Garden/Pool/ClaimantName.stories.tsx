import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { ClaimantName } from "./ClaimantName";
import { STORY_GARDEN, STORY_MARIA } from "./poolStoryFixtures";

const meta: Meta<typeof ClaimantName> = {
  title: "Admin/Pool/ClaimantName",
  component: ClaimantName,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Who a claim is for, as the steward knows them: a garden by its name, a person by their resolved name, never a bare address.",
      },
    },
  },
  args: {
    chainId: DEFAULT_CHAIN_ID,
    claim: { claimant: STORY_MARIA, claimType: "INDIVIDUAL" },
  },
  decorators: [
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="p-4 text-body-md" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ClaimantName>;

export const Person: Story = {};

/** A garden claims as a party: its name, not its address. */
export const Garden: Story = {
  args: { claim: { claimant: STORY_GARDEN, claimType: "GARDEN" } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("Rio Rainforest Lab")).toBeInTheDocument();
  },
};
