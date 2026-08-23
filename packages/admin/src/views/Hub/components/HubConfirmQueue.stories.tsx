import { DEFAULT_CHAIN_ID } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { STORY_TO_CONFIRM } from "../../Garden/Pool/poolStoryFixtures";
import { HubConfirmQueue } from "./HubConfirmQueue";

const meta: Meta<typeof HubConfirmQueue> = {
  title: "Admin/Hub/HubConfirmQueue",
  component: HubConfirmQueue,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "W13, the Hub's Confirm stage: commitments waiting on the steward with who committed, the title, the garden, N-of-group progress, the eligibility badge and the decision row. Loading and read-error never render as an empty queue.",
      },
    },
  },
  args: {
    chainId: DEFAULT_CHAIN_ID,
    normalizedSearch: "",
    selectedCommitmentId: undefined,
    onOpenCommitment: () => undefined,
    onCloseCommitment: () => undefined,
  },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="hub">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HubConfirmQueue>;

export const Queue: Story = {
  args: { toConfirm: STORY_TO_CONFIRM },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("garden fallback")).toBeVisible();
    await expect(await canvas.findByText("1 of 2 confirmed")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { toConfirm: { ...STORY_TO_CONFIRM, groups: [], fallback: [], count: 0 } },
};

export const Loading: Story = {
  args: { toConfirm: { ...STORY_TO_CONFIRM, groups: [], fallback: [], count: 0, isLoading: true } },
};

export const ReadError: Story = {
  args: { toConfirm: { ...STORY_TO_CONFIRM, groups: [], fallback: [], count: 0, isError: true } },
};
