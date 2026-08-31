import type { Meta, StoryObj } from "@storybook/react";
import { PoolFundingDialogReadinessSections } from "./PoolFundingDialogReadinessSections";
import { storyPoolFunding } from "./poolStoryControllers";

const meta: Meta<typeof PoolFundingDialogReadinessSections> = {
  title: "Admin/Pool/PoolFundingDialogReadinessSections",
  component: PoolFundingDialogReadinessSections,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The account, route, execution-readiness, and separate native CELO network-fee sections of pool funding details.",
      },
    },
  },
  args: { funding: storyPoolFunding() },
  decorators: [
    (Story) => (
      <div
        className="max-w-3xl space-y-6 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-6"
        data-tone="garden"
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolFundingDialogReadinessSections>;

export const Ready: Story = {};

export const AcknowledgmentReserveLow: Story = {
  args: {
    funding: storyPoolFunding({
      snapshot: {
        ...storyPoolFunding().snapshot!,
        settlementReadiness: "unavailable",
        settlementUnavailableReasons: ["acknowledgment_reserve_low"],
      },
    }),
  },
};

export const Stale: Story = {
  args: { funding: storyPoolFunding({ isError: true, hasStaleBalance: true }) },
};
