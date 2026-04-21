import { type Address, PoolType } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withRouter } from "../../../../shared/.storybook/decorators";
import { GardenCommunityCard } from "./GardenCommunityCard";

const GARDEN_ID = "0x1234567890123456789012345678901234567890";

const HYPERCERT_POOL = {
  poolType: PoolType.Hypercert,
  poolAddress: "0x00000000000000000000000000000000000Aaab1" as Address,
};

const ACTION_POOL = {
  poolType: PoolType.Action,
  poolAddress: "0x00000000000000000000000000000000000Aaab2" as Address,
};

const meta: Meta<typeof GardenCommunityCard> = {
  title: "Admin/Workflows/Garden/GardenCommunityCard",
  component: GardenCommunityCard,
  tags: ["autodocs"],
  decorators: [withRouter(["/garden"])],
  parameters: {
    docs: {
      description: {
        component:
          "Garden community status: weight scheme, connected signal pools, and a CTA to deploy pools when missing.",
      },
    },
  },
  args: {
    gardenId: GARDEN_ID,
    canManage: true,
    isCreatingPools: false,
    onCreatePools: fn(async () => undefined),
    onScheduleRefetch: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof GardenCommunityCard>;

export const ConnectedWithPools: Story = {
  args: {
    community: { weightScheme: 0 },
    communityLoading: false,
    pools: [HYPERCERT_POOL, ACTION_POOL],
  },
};

export const ConnectedWithoutPools: Story = {
  args: {
    community: { weightScheme: 1 },
    communityLoading: false,
    pools: [],
  },
};

export const Loading: Story = {
  args: {
    community: undefined,
    communityLoading: true,
    pools: [],
  },
};

export const NotConnected: Story = {
  args: {
    community: undefined,
    communityLoading: false,
    pools: [],
  },
};

export const ReadOnly: Story = {
  args: {
    community: { weightScheme: 2 },
    communityLoading: false,
    pools: [HYPERCERT_POOL],
    canManage: false,
  },
};

export const CreatingPools: Story = {
  args: {
    community: { weightScheme: 0 },
    communityLoading: false,
    pools: [],
    isCreatingPools: true,
  },
};
