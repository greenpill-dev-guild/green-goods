import { DEFAULT_CHAIN_ID, queryKeys } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { CommitmentDialogPanel } from "./index";
import { POOL_STORY_SEEDS, STORY_GARDEN, storyCommitmentDialog } from "../poolStoryFixtures";

// The panel reads the commitment through the shared controller; the cache
// carries the detail and its timeline so the real component renders over
// fixtures. Roles are chain reads, so the fixture viewer renders the
// bystander's detail: facts, roster and timeline without steward acts.
const dialog = storyCommitmentDialog();
const COMMITMENT_STORY_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  ...POOL_STORY_SEEDS,
  [queryKeys.commitmentPooling.commitment(DEFAULT_CHAIN_ID, 2n), dialog.detail],
  [
    queryKeys.commitmentPooling.activity(DEFAULT_CHAIN_ID, {
      chainId: DEFAULT_CHAIN_ID,
      commitmentId: 2n,
      limit: 50,
    }),
    dialog.events,
  ],
  [queryKeys.commitmentPooling.protocolPool(DEFAULT_CHAIN_ID), { poolId: null, rootGarden: null }],
];

const meta: Meta<typeof CommitmentDialogPanel> = {
  title: "Admin/Pool/CommitmentDialogPanel",
  component: CommitmentDialogPanel,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "W10, one commitment in the steward's dialect: chips, parties, lifecycle, facts, roster and timeline, with the acts the reader's authority and the record's state allow.",
      },
    },
  },
  args: { chainId: DEFAULT_CHAIN_ID, garden: STORY_GARDEN, commitmentId: "2", tone: "garden" },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(COMMITMENT_STORY_SEEDS),
    (Story) => (
      <div className="max-w-xl" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommitmentDialogPanel>;

export const Detail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Proof added")).toBeVisible();
  },
};

export const NotFound: Story = {
  args: { commitmentId: "404" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/couldn’t be loaded/)).toBeVisible();
  },
};
