import type { Meta, StoryObj } from "@storybook/react";
import { PoolFundingDialog } from "./PoolFundingDialog";
import { storyPoolFunding } from "./poolStoryControllers";

const meta: Meta<typeof PoolFundingDialog> = {
  title: "Admin/Pool/PoolFundingDialog",
  component: PoolFundingDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A solid centered detail surface for balance composition, obligations, transit, GoodDollar fees, execution limits, route readiness, and the separate native CELO acknowledgment reserve.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    funding: storyPoolFunding(),
    tone: "garden",
  },
  decorators: [
    (Story) => (
      <div className="min-h-96 p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolFundingDialog>;

export const Garden: Story = {};

export const ProtocolPool: Story = {
  args: { protocolContext: true, tone: "community" },
};

export const RouteMismatch: Story = {
  args: {
    funding: storyPoolFunding({
      snapshot: {
        ...storyPoolFunding().snapshot!,
        safe: null,
        routeAddresses: {
          account: "0x1111111111111111111111111111111111111111",
          indexed: "0x2222222222222222222222222222222222222222",
          live: "0x3333333333333333333333333333333333333333",
        },
        committed: null,
        available: null,
        fundingState: "unavailable",
        fundingUnavailableReasons: ["route_mismatch"],
        settlementReadiness: "unavailable",
        settlementUnavailableReasons: ["route_mismatch"],
      },
    }),
  },
};
