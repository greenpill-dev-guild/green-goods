import { type Action, COMMITMENT_COMPOSER_DEFAULTS, DEFAULT_CHAIN_ID } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_ACTIONS } from "../../../../../../shared/.storybook/adminFixtures";
import { STORY_JOAO, STORY_MARIA } from "../poolStoryFixtures";
import { SeedStepReview } from "./SeedStepReview";
import type { SeedCycleOption } from "./seedStepModel";

// The garden's registered actions, keyed the way the registry keys them: only a
// chain-scoped id resolves to the action UID a requirement row carries.
const SEED_ACTIONS: Action[] = STORYBOOK_ADMIN_ACTIONS.map((action, index) => ({
  ...action,
  id: `${DEFAULT_CHAIN_ID}-${index + 1}`,
}));

const CYCLE_OPTIONS: SeedCycleOption[] = [
  { value: "12", label: "Season · Season of First Rains" },
  { value: "13", label: "Campaign · Market rides" },
  { value: "0", label: "No cycle (runs on its own)" },
];

const meta: Meta<typeof SeedStepReview> = {
  title: "Admin/Pool/SeedStepReview",
  component: SeedStepReview,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The last step of the seeding console: every answer read back in the order it was asked for, so a steward can check the commitment before it is queued. Nothing is sent from here until Seed is pressed.",
      },
    },
  },
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SEASON_CAMPAIGN",
      cycleId: "12",
      title: "Market rides for the co-op",
      unitLabel: "rides",
      targetUnits: 12,
      dueInDays: 30,
    },
    actions: SEED_ACTIONS,
    chainId: DEFAULT_CHAIN_ID,
    cycleOptions: CYCLE_OPTIONS,
    protocolRegistered: true,
    submitError: null,
    queueUnavailable: false,
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
type Story = StoryObj<typeof SeedStepReview>;

export const SeasonOffer: Story = {};

export const GardenWorkWithReward: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "GARDEN_WORK",
      direction: "REQUEST",
      cycleId: "13",
      title: "Canopy survey before the rains",
      unitLabel: "plots",
      targetUnits: 4,
      dueInDays: 45,
      openTeam: false,
      claimMode: "APPROVAL_GATED",
      requirements: [
        { actionUID: "1", requiredCount: 3 },
        { actionUID: "2", requiredCount: 1 },
      ],
      confirmers: [STORY_MARIA, STORY_JOAO],
      confirmationThreshold: 2,
      considerationRail: "ARBITRUM_EXTERNAL",
      considerationAmount: "250000000",
    },
  },
};

export const SeedFailed: Story = {
  args: { submitError: "The commitment could not be queued. Nothing was sent; try again." },
};

export const QueueUnavailable: Story = {
  args: { queueUnavailable: true },
};
