import { type Address, type AllowlistEntry, TOTAL_UNITS } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DistributionConfig } from "./DistributionConfig";

function entry(addr: string, units: bigint, label?: string): AllowlistEntry {
  return { address: addr as Address, units, label };
}

const EVEN_ALLOWLIST: AllowlistEntry[] = [
  entry("0x1111111111111111111111111111111111111111", 25_000_000n, "Gardener A"),
  entry("0x2222222222222222222222222222222222222222", 25_000_000n, "Gardener B"),
  entry("0x3333333333333333333333333333333333333333", 25_000_000n, "Gardener C"),
  entry("0x4444444444444444444444444444444444444444", 25_000_000n, "Gardener D"),
];

function DistributionConfigHarness({
  initialMode = "equal",
  initialAllowlist = EVEN_ALLOWLIST,
}: {
  initialMode?: "equal" | "count" | "value" | "custom";
  initialAllowlist?: AllowlistEntry[];
}) {
  const [mode, setMode] = useState<"equal" | "count" | "value" | "custom">(initialMode);
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>(initialAllowlist);
  return (
    <DistributionConfig
      mode={mode}
      allowlist={allowlist}
      totalUnits={TOTAL_UNITS}
      onModeChange={setMode}
      onAllowlistChange={setAllowlist}
    />
  );
}

const meta: Meta<typeof DistributionConfigHarness> = {
  title: "Admin/Workflows/Hypercerts/Steps/DistributionConfig",
  // storybook-quality-allow state-harness: owns draft state while rendering the real DistributionConfig.
  component: DistributionConfigHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hypercert wizard step 3. Mode selector (equal / count / value / custom) + allowlist table + donut preview. Validates that units sum to TOTAL_UNITS.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DistributionConfigHarness>;

export const EqualMode: Story = {
  args: { initialMode: "equal", initialAllowlist: EVEN_ALLOWLIST },
};

export const CustomMode: Story = {
  args: {
    initialMode: "custom",
    initialAllowlist: [
      entry("0x1111111111111111111111111111111111111111", 40_000_000n, "Lead"),
      entry("0x2222222222222222222222222222222222222222", 35_000_000n, "Operator"),
      entry("0x3333333333333333333333333333333333333333", 25_000_000n, "Contributor"),
    ],
  },
};

export const UnitsMismatch: Story = {
  args: {
    initialMode: "custom",
    initialAllowlist: [
      entry("0x1111111111111111111111111111111111111111", 40_000_000n),
      entry("0x2222222222222222222222222222222222222222", 20_000_000n),
    ],
  },
};

export const EmptyAllowlist: Story = {
  args: {
    initialMode: "custom",
    initialAllowlist: [],
  },
};
