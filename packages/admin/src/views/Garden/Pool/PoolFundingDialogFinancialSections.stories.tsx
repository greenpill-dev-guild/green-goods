import type { Meta, StoryObj } from "@storybook/react";
import { PoolFundingDialogFinancialSections } from "./PoolFundingDialogFinancialSections";
import { storyPoolFunding } from "./poolStoryControllers";

const baseSnapshot = storyPoolFunding().snapshot!;

const meta: Meta<typeof PoolFundingDialogFinancialSections> = {
  title: "Admin/Pool/PoolFundingDialogFinancialSections",
  component: PoolFundingDialogFinancialSections,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The financial detail sections for live G$ balance composition, obligations, transit, fee quotes, and execution limits.",
      },
    },
  },
  args: { snapshot: baseSnapshot },
  decorators: [
    (Story) => (
      <div
        className="max-w-3xl space-y-6 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-6"
        data-tone="garden"
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolFundingDialogFinancialSections>;

export const Healthy: Story = {};

export const Insufficient: Story = {
  args: {
    snapshot: {
      ...baseSnapshot,
      balance: { ...baseSnapshot.balance!, value: 100n * 10n ** 18n },
      available: 0n,
      shortfall: 102n * 10n ** 18n,
      suggestedTopUp: 203n * 10n ** 18n,
      fundingState: "insufficient",
    },
  },
};

export const UnavailableFeeQuote: Story = {
  args: {
    snapshot: {
      ...baseSnapshot,
      quotedFees: null,
      feeQuotes: [
        {
          id: "unavailable-quote",
          amount: 100n * 10n ** 18n,
          fee: 1n * 10n ** 18n,
          senderPays: null,
          recipient: "0x2222222222222222222222222222222222222222",
        },
      ],
      settlementReadiness: "unavailable",
      settlementUnavailableReasons: ["fee_quote_unavailable"],
    },
  },
};
