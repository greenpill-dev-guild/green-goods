import { type Address, type FunderLeaderboardEntry } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { FunderRow } from "./FunderRow";

function makeFunder(
  addr: Address,
  yieldGenerated: bigint,
  gardenCount = 2
): FunderLeaderboardEntry {
  return {
    address: addr,
    totalYieldGenerated: yieldGenerated,
    gardenCount,
  } as unknown as FunderLeaderboardEntry;
}

const HIGH = makeFunder(
  "0x1111111111111111111111111111111111111111" as Address,
  10_000_000_000_000_000_000n,
  4
);
const MID = makeFunder(
  "0x2222222222222222222222222222222222222222" as Address,
  3_500_000_000_000_000_000n,
  2
);
const LOW = makeFunder(
  "0x3333333333333333333333333333333333333333" as Address,
  500_000_000_000_000_000n,
  1
);
const ZERO = makeFunder("0x4444444444444444444444444444444444444444" as Address, 0n, 1);

const MAX_YIELD = HIGH.totalYieldGenerated;

const meta: Meta<typeof FunderRow> = {
  title: "Admin/Workflows/Vault/FunderRow",
  component: FunderRow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Single funder row for the ranked supporter view. Shows ENS name or truncated address, cumulative yield generated, gardens supported count, and a proportional yield bar keyed to the current maximum. ENS lookup uses wagmi and returns `null` in Storybook — the address fallback is exercised instead.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FunderRow>;

export const TopFunder: Story = {
  args: { funder: HIGH, maxYield: MAX_YIELD },
};

export const MidFunder: Story = {
  args: { funder: MID, maxYield: MAX_YIELD },
};

export const LowFunder: Story = {
  args: { funder: LOW, maxYield: MAX_YIELD },
};

export const NoYield: Story = {
  args: { funder: ZERO, maxYield: MAX_YIELD },
};
