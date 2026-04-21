import { type Address, type YieldAllocation } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { GardenYieldCard } from "./GardenYieldCard";

const GARDEN_ADDRESS = "0x1234567890AbcdEF1234567890aBcdef12345678" as Address;
const WETH = "0x4200000000000000000000000000000000000006" as Address;

function makeAllocation(
  offset: number,
  totalAmount: bigint,
  cookieJarAmount: bigint,
  fractionsAmount: bigint,
  juiceboxAmount: bigint
): YieldAllocation {
  return {
    gardenAddress: GARDEN_ADDRESS,
    assetAddress: WETH,
    totalAmount,
    cookieJarAmount,
    fractionsAmount,
    juiceboxAmount,
    timestamp: 1_700_000_000 + offset,
    txHash: `0x${offset.toString(16).padStart(64, "0")}`,
  };
}

const ALLOCATIONS: YieldAllocation[] = [
  makeAllocation(
    7 * 86400,
    12_500_000_000_000_000_000n,
    3_125_000_000_000_000_000n,
    4_687_500_000_000_000_000n,
    4_687_500_000_000_000_000n
  ),
  makeAllocation(
    14 * 86400,
    8_400_000_000_000_000_000n,
    2_100_000_000_000_000_000n,
    3_150_000_000_000_000_000n,
    3_150_000_000_000_000_000n
  ),
  makeAllocation(
    21 * 86400,
    5_200_000_000_000_000_000n,
    1_300_000_000_000_000_000n,
    1_950_000_000_000_000_000n,
    1_950_000_000_000_000_000n
  ),
];

const meta: Meta<typeof GardenYieldCard> = {
  title: "Admin/Workflows/Garden/GardenYieldCard",
  component: GardenYieldCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Cumulative yield split card: cookie-jar / fractions / juicebox distribution plus the allocation history list.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GardenYieldCard>;

export const WithAllocations: Story = {
  args: {
    allocations: ALLOCATIONS,
    allocationsLoading: false,
  },
};

export const Empty: Story = {
  args: {
    allocations: [],
    allocationsLoading: false,
  },
};

export const Loading: Story = {
  args: {
    allocations: [],
    allocationsLoading: true,
  },
};

export const ManyAllocations: Story = {
  args: {
    allocations: Array.from({ length: 12 }, (_, i) =>
      makeAllocation(
        (i + 1) * 86400,
        (10_000_000_000_000_000_000n * BigInt(12 - i)) / 12n,
        (2_500_000_000_000_000_000n * BigInt(12 - i)) / 12n,
        (3_750_000_000_000_000_000n * BigInt(12 - i)) / 12n,
        (3_750_000_000_000_000_000n * BigInt(12 - i)) / 12n
      )
    ),
    allocationsLoading: false,
  },
};
