import { type Address, type AllowlistEntry, TOTAL_UNITS } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { DistributionChart } from "./DistributionChart";

function entry(addr: string, units: bigint, label?: string): AllowlistEntry {
  return { address: addr as Address, units, label };
}

const EVEN_SHARES: AllowlistEntry[] = [
  entry("0x1111111111111111111111111111111111111111", 25_000_000n, "Gardener A"),
  entry("0x2222222222222222222222222222222222222222", 25_000_000n, "Gardener B"),
  entry("0x3333333333333333333333333333333333333333", 25_000_000n, "Gardener C"),
  entry("0x4444444444444444444444444444444444444444", 25_000_000n, "Gardener D"),
];

const WITH_LONG_TAIL: AllowlistEntry[] = [
  entry("0x1111111111111111111111111111111111111111", 40_000_000n, "Lead gardener"),
  entry("0x2222222222222222222222222222222222222222", 25_000_000n, "Operator"),
  entry("0x3333333333333333333333333333333333333333", 15_000_000n, "Contributor A"),
  ...Array.from({ length: 6 }, (_, i) =>
    entry(`0x${String(i + 10).padStart(40, "0")}`, 3_333_333n, `Minor contributor ${i + 1}`)
  ),
];

const meta: Meta<typeof DistributionChart> = {
  title: "Admin/Workflows/Hypercerts/DistributionChart",
  component: DistributionChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Donut chart for an allowlist. Segments under 5% are grouped into an 'Others' wedge with a neutral fill.",
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
type Story = StoryObj<typeof DistributionChart>;

export const EqualShares: Story = {
  args: {
    allowlist: EVEN_SHARES,
    totalUnits: TOTAL_UNITS,
  },
};

export const WithOthersGroup: Story = {
  args: {
    allowlist: WITH_LONG_TAIL,
    totalUnits: TOTAL_UNITS,
  },
};

export const SingleRecipient: Story = {
  args: {
    allowlist: [entry("0x1111111111111111111111111111111111111111", 100_000_000n, "Solo gardener")],
    totalUnits: TOTAL_UNITS,
  },
};

export const Small: Story = {
  args: {
    allowlist: EVEN_SHARES,
    totalUnits: TOTAL_UNITS,
    size: 140,
  },
};
