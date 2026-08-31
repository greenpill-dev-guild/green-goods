import type { Meta, StoryObj } from "@storybook/react";
import { PoolClaimsCard } from "./PoolClaimsCard";
import { storyPool, storyPoolConsole } from "./poolStoryFixtures";

const meta: Meta<typeof PoolClaimsCard> = {
  title: "Admin/Pool/PoolClaimsCard",
  component: PoolClaimsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The claims queue, rendered only while steward-reviewed requests wait. Each row names the stored claimant, the claim type and when; accept and decline are paired opposites keyed to that claimant.",
      },
    },
  },
  args: { onDecline: () => undefined },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolClaimsCard>;

export const Waiting: Story = { args: { console: storyPoolConsole() } };

export const Paused: Story = {
  args: { console: storyPoolConsole({ pool: storyPool({ state: "PAUSED" }) }) },
};
