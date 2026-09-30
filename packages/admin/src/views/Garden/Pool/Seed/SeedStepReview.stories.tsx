import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { CreationSendMode } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { COMMITMENT_COMPOSER_DEFAULTS } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { Action } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { STORYBOOK_ADMIN_ACTIONS } from "../../../../../../shared/.storybook/adminFixtures";
import { STORY_JOAO, STORY_MARIA } from "../poolStoryFixtures";
import { SeedStepReview, type SeedStepReviewProps } from "./SeedStepReview";
import { seedStatusView } from "./seedStatus";
import {
  SEED_STORY_TRAY_ROWS,
  type SeedStoryPhase,
  storySeedCopies,
  storySeedSending,
} from "./seedStoryTray";
import type { SeedCycleOption } from "./seedStepModel";

// The garden's registered actions, keyed the way the registry keys them: only a
// chain-scoped id resolves to the action UID a requirement row carries.
const SEED_ACTIONS: Action[] = STORYBOOK_ADMIN_ACTIONS.map((action, index) => ({
  ...action,
  id: `${DEFAULT_CHAIN_ID}-${index + 1}`,
}));

const CYCLE_OPTIONS: SeedCycleOption[] = [
  { value: "12", label: "Season · Harvest Season 2026" },
  { value: "13", label: "Campaign · Market rides" },
  { value: "0", label: "No cycle (runs on its own)" },
];

/** The reserve's price on 2026-09-30: $5.00 is about 38,866 G$. */
const PRICE: GoodDollarPriceState = {
  status: "ready",
  price: 128_647_930_734_508n,
  readAt: 1_790_000_000_000,
};
const NOW = 1_790_000_000_000;
const noop = () => undefined;

type ReviewStoryArgs = Omit<SeedStepReviewProps, "status" | "editable"> & {
  phase: SeedStoryPhase;
  mode: CreationSendMode;
};

/** The review at one moment of a Create: only the status row changes. */
function ReviewAt({ phase, mode, ...props }: ReviewStoryArgs) {
  const { formatMessage } = useIntl();
  const count = props.values.count ?? 1;
  const copies = storySeedCopies(phase, count);
  const status = seedStatusView({
    mode,
    isSending: storySeedSending(phase),
    copies,
    // Every story is a first Create, which sends every copy.
    pass: copies,
    total: count,
    grouped: count > 1,
    formatMessage,
  });
  const locked = !["ready", "declined", "refused"].includes(phase);
  return <SeedStepReview {...props} status={status} editable={!status.busy && !locked} />;
}

const meta: Meta<ReviewStoryArgs> = {
  title: "Admin/Pool/SeedStepReview",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The last step of Seed Promises: every answer grouped by the step that asked it, each with an Edit, under one status row. The status row keeps its height through ready, approving, declined, created, sending and partial, so the sections never move. The Reward reads in dollars with the G$ amount beside it, fixed when the promises are created.",
      },
    },
  },
  args: {
    phase: "ready",
    mode: "bundle",
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SERVICE",
      direction: "REQUEST",
      cycleId: "12",
      title: "Household water survey",
      unitLabel: "survey",
      targetUnits: 1,
      dueInDays: 14,
      count: 10,
      openTeam: false,
      confirmers: [STORY_MARIA, STORY_JOAO],
      confirmationThreshold: 1,
      protocolFallbackEnabled: false,
      considerationRail: "CELO_SETTLEMENT",
      considerationUsd: "5.00",
      considerationAmount: "",
    },
    onEditStep: noop,
    others: [],
    isLocked: () => false,
    onEditRow: noop,
    onRemoveRow: noop,
    actions: SEED_ACTIONS,
    chainId: DEFAULT_CHAIN_ID,
    cycleOptions: CYCLE_OPTIONS,
    protocolRegistered: true,
    price: PRICE,
    capacity: { cap: 3, room: 3, full: false, over: false },
    submitError: null,
    queueUnavailable: false,
    now: NOW,
  },
  render: (args) => <ReviewAt {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-3xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<ReviewStoryArgs>;

/** Ten separate promises, ready: one approval asks for all ten. */
export const Ready: Story = {};

export const Approving: Story = { args: { phase: "asking" } };

export const Declined: Story = { args: { phase: "declined" } };

/** The answer was lost: the answers are fixed, and Try Again finishes what the chain has. */
export const Unconfirmed: Story = { args: { phase: "unconfirmed" } };

export const Created: Story = { args: { phase: "created" } };

/** A wallet that can't bundle: one prompt per promise, with a count and a thin bar. */
export const SendingOneByOne: Story = { args: { phase: "sending", mode: "one-by-one" } };

export const PartialResult: Story = { args: { phase: "partial", mode: "one-by-one" } };

export const FinishLater: Story = { args: { phase: "finishLater", mode: "one-by-one" } };

/** One promise on its own: no Grouping section, and the reward spans the row. */
export const Single: Story = {
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
  },
};

export const GardenWork: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "GARDEN_WORK",
      direction: "REQUEST",
      cycleId: "13",
      title: "Canopy survey before the rains",
      unitLabel: "hours",
      targetUnits: 4,
      dueInDays: 45,
      count: 5,
      openTeam: false,
      claimMode: "APPROVAL_GATED",
      requirements: [
        { actionUID: "1", requiredCount: 3 },
        { actionUID: "2", requiredCount: 1 },
      ],
    },
  },
};

/** Today's G$ price can't be read: the review says the rate is taken at Create. */
export const PriceUnavailable: Story = {
  args: { price: { status: "unavailable", reason: "stale" } },
};

export const SeveralInOneSitting: Story = {
  args: { others: SEED_STORY_TRAY_ROWS.slice(1, 3) },
};

/** More offers than the steward may hold open at once: creating is held until one goes. */
export const MoreOffersThanRoom: Story = {
  args: {
    values: {
      ...COMMITMENT_COMPOSER_DEFAULTS,
      kind: "SEASON_CAMPAIGN",
      direction: "OFFER",
      title: "Seed library sorting",
      unitLabel: "hours",
      targetUnits: 3,
      count: 5,
    },
    capacity: { cap: 3, room: 3, full: true, over: true },
  },
};

export const QueueUnavailable: Story = { args: { queueUnavailable: true } };
