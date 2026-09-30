import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { Meta, StoryObj } from "@storybook/react";
import { SeedRewardSection, type SeedRewardSectionProps } from "./SeedRewardSection";

/** The reserve's price on 2026-09-30: $5.00 is about 38,866 G$. */
const PRICE: GoodDollarPriceState = {
  status: "ready",
  price: 128_647_930_734_508n,
  readAt: 1_790_000_000_000,
};

/** The section reads and writes the real composer form, exactly as the flow does. */
function SeedRewardSectionWithForm(args: SeedRewardSectionProps) {
  const form = useCommitmentComposerForm(args.values);
  return <SeedRewardSection {...args} form={form} values={form.watch()} />;
}

const meta: Meta<typeof SeedRewardSection> = {
  title: "Admin/Pool/SeedRewardSection",
  component: SeedRewardSection,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The reward, asked as a question (PRD-1022 D9, D13). Yes pays in G$ through the garden's settlement account and waits, with its reason, until that account is active. The steward types dollars; the field shows the G$ amount at today's rate, and that amount is fixed when the promises are created. When today's price can't be read, the field says why and waits.",
      },
    },
  },
  args: {
    values: { ...COMMITMENT_COMPOSER_DEFAULTS },
    busy: false,
    errorOf: () => undefined,
    settlementActive: true,
    price: PRICE,
    count: 10,
  },
  render: (args) => <SeedRewardSectionWithForm {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedRewardSection>;

export const NoReward: Story = {};

/** $5.00 for each of ten: about 38,866 G$ each, up to $50.00 if all are kept. */
export const FiveDollarsEach: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      considerationRail: "CELO_SETTLEMENT",
      considerationUsd: "5.00",
    },
  },
};

export const SinglePromise: Story = {
  args: { ...FiveDollarsEach.args, count: 1 },
};

/** Yes waits, with its reason, until the garden's settlement account is active. */
export const SettlementNotActive: Story = { args: { settlementActive: false } };

export const PriceOutOfDate: Story = {
  args: { ...FiveDollarsEach.args, price: { status: "unavailable", reason: "stale" } },
};

export const ReservePaused: Story = {
  args: { ...FiveDollarsEach.args, price: { status: "unavailable", reason: "paused" } },
};

export const ReadingPrice: Story = {
  args: { ...FiveDollarsEach.args, price: { status: "loading" } },
};

export const AmountMissing: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      considerationRail: "CELO_SETTLEMENT",
      considerationUsd: "",
    },
    errorOf: (field) =>
      field === "considerationUsd"
        ? "Enter an amount in dollars above zero, like 5.00."
        : undefined,
  },
};
