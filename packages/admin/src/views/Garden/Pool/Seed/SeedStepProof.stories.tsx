import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { Meta, StoryObj } from "@storybook/react";
import { STORY_ANA, STORY_JOAO, STORY_MARIA } from "../poolStoryFixtures";
import type { SeedMember } from "./SeedConfirmerList";
import { SeedStepProof, type SeedStepProofProps } from "./SeedStepProof";

/** The reserve's price on 2026-09-30: $5.00 is about 38,866 G$. */
const PRICE: GoodDollarPriceState = {
  status: "ready",
  price: 128_647_930_734_508n,
  readAt: 1_790_000_000_000,
};

const MEMBERS: SeedMember[] = [
  { address: STORY_MARIA, role: "steward" },
  { address: STORY_JOAO, role: "gardener" },
  { address: STORY_ANA, role: "gardener" },
  { address: "0x4444444444444444444444444444444444444444", role: "gardener" },
  { address: "0x5555555555555555555555555555555555555555", role: "evaluator" },
];

/** The step reads and writes the real composer form, as the flow does. */
function SeedStepProofWithForm(args: SeedStepProofProps) {
  const form = useCommitmentComposerForm(args.values);
  return <SeedStepProof {...args} form={form} values={form.watch()} />;
}

const meta: Meta<typeof SeedStepProof> = {
  title: "Admin/Pool/SeedStepProof",
  component: SeedStepProof,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Step three of Seed Promises (PRD-1022 screen 04): who confirms, as removable chips picked from the garden's people or typed as a name or an address; whether the Green Goods team may step in; how each promise is taken up; and the reward in dollars, paid in G$. One line says the settings apply to each promise.",
      },
    },
  },
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SERVICE",
      direction: "REQUEST",
      title: "Household water survey",
      unitLabel: "survey",
      count: 10,
    },
    noteId: "seed-proof",
    busy: false,
    errorOf: () => undefined,
    members: MEMBERS,
    protocolRegistered: true,
    settlementActive: true,
    price: PRICE,
  },
  render: (args) => <SeedStepProofWithForm {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SeedStepProof>;

export const NobodyNamedYet: Story = {};

/** Three chosen confirmers fit one row; a fourth wraps only when the row is full. */
export const ChosenConfirmersWithReward: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SERVICE",
      direction: "REQUEST",
      title: "Household water survey",
      unitLabel: "survey",
      count: 10,
      confirmers: [STORY_MARIA, STORY_JOAO, STORY_ANA],
      confirmationThreshold: 1,
      considerationRail: "CELO_SETTLEMENT",
      considerationUsd: "5.00",
    },
  },
};

export const SinglePromise: Story = {
  args: {
    values: { ...COMMITMENT_COMPOSER_DEFAULTS, kind: "SEASON_CAMPAIGN", title: "Market rides" },
  },
};

export const NoProtocolPool: Story = { args: { protocolRegistered: false } };

export const SettlementNotActive: Story = { args: { settlementActive: false } };
