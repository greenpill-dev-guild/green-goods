import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";
import { STORY_GARDEN } from "../poolStoryFixtures";
import { SeedRewardSection, type SeedRewardSectionProps } from "./SeedRewardSection";
import type { RewardUnits } from "./seedRewardAmount";

// Fixture stand-in for the token a payout is recorded in, in the same shape the
// pool story cast uses for its addresses.
const STORY_REWARD_TOKEN = "0x4444444444444444444444444444444444444444";
/** A six-decimal token, like USDC: 250000000 base units read as 250. */
const STORY_TOKEN_UNITS: RewardUnits = { status: "ready", decimals: 6, symbol: "USDC" };

/** The section reads and writes the real composer form, exactly as the console does. */
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
          "The declared reward, folded away as advanced because most commitments carry none. One rail at a time: an external payout recorded after the fact, or a Celo settlement plan that stays disabled until the garden's settlement account is active. Nothing here pays anyone.",
      },
    },
  },
  args: {
    values: { ...COMMITMENT_COMPOSER_DEFAULTS },
    busy: false,
    errorOf: () => undefined,
    settlementActive: false,
    units: { status: "none" },
  },
  render: (args) => <SeedRewardSectionWithForm {...args} />,
  // The section ships collapsed; every story opens it so the rails are readable.
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText("Advanced: declared reward"));
  },
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

export const ExternalPayout: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      considerationRail: "ARBITRUM_EXTERNAL",
      considerationSource: STORY_GARDEN,
      considerationToken: STORY_REWARD_TOKEN,
      considerationAmount: "250000000",
    },
    units: STORY_TOKEN_UNITS,
  },
};

export const CeloSettlement: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      considerationRail: "CELO_SETTLEMENT",
      considerationAmount: "50000000000000000000",
    },
    settlementActive: true,
    units: { status: "ready", decimals: 18, symbol: "G$" },
  },
};

export const AmountMissing: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      considerationRail: "ARBITRUM_EXTERNAL",
      considerationSource: STORY_GARDEN,
      considerationToken: STORY_REWARD_TOKEN,
      considerationAmount: "",
    },
    errorOf: (field) =>
      field === "considerationAmount" ? "Enter an amount above zero." : undefined,
    units: STORY_TOKEN_UNITS,
  },
};

/** The token does not answer decimals(): the amount waits and says why, rather than guess. */
export const TokenUnreadable: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      considerationRail: "ARBITRUM_EXTERNAL",
      considerationSource: STORY_GARDEN,
      considerationToken: STORY_REWARD_TOKEN,
      considerationAmount: "",
    },
    units: { status: "waiting", reason: "unreadable" },
  },
};
