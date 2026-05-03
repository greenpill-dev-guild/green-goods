import { type GardenSignalPool, PoolType } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import {
  withAdminIdentity,
  withAdminPrimitiveFrame,
} from "../../../../../shared/.storybook/decorators";
import { GovernancePanel } from "./GovernancePanel";

const SAMPLE_POOL: GardenSignalPool = {
  poolAddress: "0x1234567890abcdef1234567890abcdef12345678",
  poolType: PoolType.Hypercert,
  gardenAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
  communityAddress: "0xfedcba0987654321fedcba0987654321fedcba09",
};

const ACTION_POOL: GardenSignalPool = {
  poolAddress: "0x9999999999999999999999999999999999999999",
  poolType: PoolType.Action,
  gardenAddress: SAMPLE_POOL.gardenAddress,
  communityAddress: SAMPLE_POOL.communityAddress,
};

const meta: Meta<typeof GovernancePanel> = {
  title: "Admin/Conviction/GovernancePanel",
  component: GovernancePanel,
  tags: ["autodocs", "visual-harness"],
  decorators: [withAdminIdentity, withAdminPrimitiveFrame],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tier-5 audit-then-ship integration story. Composes the Tier 3 conviction " +
          "components (WeightAllocator + ProposalCardConviction + ConvictionMeter) with " +
          "the Tier-5 adapter hooks (useConvictionProposalsForPool + " +
          "useConvictionWeightAllocator). " +
          "The hooks fetch from the on-chain registry; in Storybook with no live " +
          "garden the queries resolve empty and the empty-state path is exercised.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GovernancePanel>;

export const NoPool: Story = {
  args: {
    pools: [],
    gardenId: "story-garden",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Pools list is empty — panel renders the 'no conviction pool yet' empty state with a CTA pointing at pool creation.",
      },
    },
  },
};

export const ActionPoolOnly: Story = {
  args: {
    pools: [ACTION_POOL],
    gardenId: "story-garden",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Garden has an Action pool but no Hypercert pool — same empty state as NoPool because conviction voting only renders for HypercertSignalPool.",
      },
    },
  },
};

export const WithHypercertPool: Story = {
  args: {
    pools: [SAMPLE_POOL, ACTION_POOL],
    gardenId: "story-garden",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Garden has a HypercertSignalPool — the panel mounts useConvictionProposalsForPool + useConvictionWeightAllocator. With no live indexer/contract the queries resolve to empty arrays and the 'no registered proposals yet' empty state appears. Use this story to verify the loading-state skeleton and the proposal-list grid layout once fixtures are wired.",
      },
    },
  },
};
