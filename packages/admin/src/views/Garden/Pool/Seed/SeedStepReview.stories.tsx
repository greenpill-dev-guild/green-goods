import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Action } from "@green-goods/shared/types/domain";
import { COMMITMENT_COMPOSER_DEFAULTS } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_ACTIONS } from "../../../../../../shared/.storybook/adminFixtures";
import { STORY_JOAO, STORY_MARIA } from "../poolStoryFixtures";
import { type SeedReviewTray, SeedStepReview } from "./SeedStepReview";
import { SEED_STORY_TRAY_ROWS } from "./seedStoryTray";
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

const noop = () => undefined;

/** One commitment on its own: no tray to show, and room to spare. */
const LONE_TRAY: SeedReviewTray = {
  others: [],
  currentNotSent: false,
  lastSend: null,
  cap: 24,
  room: 20,
  full: false,
  over: false,
  busy: false,
  onEdit: noop,
  onRemove: noop,
  onRemoveCurrent: noop,
};

const meta: Meta<typeof SeedStepReview> = {
  title: "Admin/Pool/SeedStepReview",
  component: SeedStepReview,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The last step of the seeding console: every answer read back in the order it was asked for, so a steward can check the commitment before it is queued. Nothing is sent from here until Seed is pressed. When several commitments are being seeded in one sitting, the ones added so far are listed above the one under review, and the note says how many times the wallet will ask.",
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
    rewardUnits: { status: "none" },
    submitError: null,
    queueUnavailable: false,
    tray: LONE_TRAY,
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
    // A six-decimal token, like USDC: the review reads 250, never the base units.
    rewardUnits: { status: "ready", decimals: 6, symbol: "USDC" },
  },
};

export const SeedFailed: Story = {
  args: { submitError: "The commitment was not sent, so nothing was created. Try again." },
};

export const QueueUnavailable: Story = {
  args: { queueUnavailable: true },
};

export const SeveralInOneSitting: Story = {
  args: { tray: { ...LONE_TRAY, others: SEED_STORY_TRAY_ROWS.slice(0, 2) } },
};

/** Two were sent and one was not: it stays, marked, with what happened said above it. */
export const SomeNotSent: Story = {
  args: {
    tray: {
      ...LONE_TRAY,
      others: SEED_STORY_TRAY_ROWS.slice(1, 2),
      currentNotSent: true,
      lastSend: { sent: 2, left: 2 },
    },
  },
};

/** More offers than the steward may hold open at once: seeding is held until one goes. */
export const MoreOffersThanRoom: Story = {
  args: {
    tray: {
      ...LONE_TRAY,
      others: SEED_STORY_TRAY_ROWS.slice(0, 2),
      room: 2,
      full: true,
      over: true,
    },
  },
};
