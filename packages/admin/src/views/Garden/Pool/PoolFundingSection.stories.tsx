import type { Meta, StoryObj } from "@storybook/react";
import { PoolFundingSection } from "./PoolFundingSection";
import { storyPoolFunding } from "./poolStoryControllers";

const meta: Meta<typeof PoolFundingSection> = {
  title: "Admin/Pool/PoolFundingSection",
  component: PoolFundingSection,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The compact read-only funding summary shared by Garden and Protocol pools. Live balance, obligations, derived availability, route readiness, and freshness stay visually distinct from settlement actions.",
      },
    },
  },
  args: {
    funding: storyPoolFunding(),
    onOpenDetails: () => undefined,
  },
  decorators: [
    (Story) => (
      <div
        className="max-w-sm rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface-container-lowest))] p-4"
        data-tone="garden"
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolFundingSection>;

export const Healthy: Story = {};

export const ProtocolPool: Story = {
  args: { protocolContext: true },
};

export const Loading: Story = {
  args: {
    funding: storyPoolFunding({ snapshot: null, isLoading: true, isFetching: true }),
  },
};

export const LastKnownBalance: Story = {
  args: {
    funding: storyPoolFunding({ isError: true, hasStaleBalance: true }),
  },
};
