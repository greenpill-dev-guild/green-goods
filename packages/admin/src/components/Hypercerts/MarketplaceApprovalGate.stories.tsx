import { type Address, DEFAULT_CHAIN_ID, queryKeys } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { MarketplaceApprovalGate } from "./MarketplaceApprovalGate";

// DevAuthProvider seeds operator role → this address is both
// `walletAddress` and `eoaAddress`. It matches the operator computed
// inside `useMarketplaceApprovals`.
const OPERATOR = "0x04D60647836bcA09c37B379550038BdaaFD82503" as Address;

const approvalsKey = queryKeys.marketplace.approvals(OPERATOR, DEFAULT_CHAIN_ID);

const CHILDREN = (
  <div className="rounded-lg border border-dashed border-stroke-soft p-6 text-center text-sm text-text-sub">
    Fully-approved content renders here (e.g., the “List for yield” button or hypercert table).
  </div>
);

const meta: Meta<typeof MarketplaceApprovalGate> = {
  title: "Admin/Workflows/Hypercerts/MarketplaceApprovalGate",
  component: MarketplaceApprovalGate,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Real `MarketplaceApprovalGate`. Seeds `useMarketplaceApprovals` with fixture approval state; the `grantApprovals` mutation is wired but inert against the mock wagmi transport.",
      },
    },
  },
  args: {
    children: CHILDREN,
  },
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="mx-auto max-w-lg p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MarketplaceApprovalGate>;

export const NeedsBoth: Story = {
  decorators: [
    withSeededQueryClient([[approvalsKey, { exchangeApproved: false, minterApproved: false }]]),
  ],
};

export const NeedsMinterOnly: Story = {
  decorators: [
    withSeededQueryClient([[approvalsKey, { exchangeApproved: true, minterApproved: false }]]),
  ],
};

export const FullyApproved: Story = {
  decorators: [
    withSeededQueryClient([[approvalsKey, { exchangeApproved: true, minterApproved: true }]]),
  ],
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "No seed — `useMarketplaceApprovals` stays in the loading state while the fetch resolves (which it never does against the mock transport).",
      },
    },
  },
};
