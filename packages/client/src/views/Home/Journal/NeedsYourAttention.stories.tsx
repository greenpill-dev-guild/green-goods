import { useCommitmentMetadata } from "@green-goods/shared/commitment-pooling";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  type StewardDuties,
  useStewardDuties,
} from "@green-goods/shared/hooks/garden/useStewardDuties";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Garden, Work } from "@green-goods/shared/types/domain";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, mocked, within } from "storybook/test";
import {
  FENCE_TITLE,
  JOURNEY_GARDEN,
  JOURNEY_GARDEN_RECORD,
  JOURNEY_HELPER,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import { FIXTURE_WORK_MEDIA, hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { PENDING_ACTIONS } from "../../../../../shared/.storybook/pendingWorkFixtures";
import { NeedsYourAttention } from "./NeedsYourAttention";

const PHONE_VIEWPORTS = {
  homePhone360: {
    name: "Phone 360 x 800",
    styles: { width: "360px", height: "800px" },
    type: "mobile",
  },
  homePhone390: {
    name: "Phone 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

const MESSAGES = { en, es, pt } as const;
type Locale = keyof typeof MESSAGES;

type Duty = StewardDuties["duties"][number];

function submitted(id: string, actionUID: number, hours: number): Work {
  return {
    id,
    title: "",
    actionUID,
    gardenerAddress: JOURNEY_HELPER,
    gardenAddress: JOURNEY_GARDEN,
    feedback: "",
    metadata: "",
    media: [FIXTURE_WORK_MEDIA[0]],
    createdAt: hoursAgo(hours),
    status: "pending",
  };
}

const EAST_BEDS = { commitmentId: 12n, metadataCID: "bafy-east-beds" };
const SEED_SWAP = { commitmentId: 14n, metadataCID: "bafy-seed-swap" };
const FENCE = { commitmentId: 7n, metadataCID: "bafy-fence" };

const TITLES = new Map([
  ["bafy-east-beds", { title: "Transplant 36 seedlings into the east beds" }],
  ["bafy-seed-swap", { title: "Host the spring seed swap" }],
  ["bafy-fence", { title: FENCE_TITLE }],
]);

/**
 * What the derivation (`useStewardDuties`) hands a steward of Riverside Commons who wears its
 * steward hat: two works waiting, the older first; take-up requests on two promises, newest first;
 * one promise to confirm. It hands a gardener nothing, whatever waits: each row follows the
 * predicate of its act (useStewardDuties.test.ts proves who gets which).
 */
const REVIEW: Duty = {
  kind: "review",
  count: 2,
  works: [submitted("0x5eed0a11", 2, 50), submitted("0x5eed0a12", 1, 5)],
};
const TAKE_UPS: Duty[] = [
  { kind: "takeUp", count: 2, commitment: EAST_BEDS as never, newestAt: hoursAgo(3) },
  { kind: "takeUp", count: 1, commitment: SEED_SWAP as never, newestAt: hoursAgo(30) },
];
const CONFIRM: Duty = { kind: "confirm", count: 1, commitments: [FENCE as never] };

type Scene = "stewardWaiting" | "stewardNothing" | "gardener" | "readFailed";

const SCENES: Record<Scene, Omit<StewardDuties, "refetch">> = {
  stewardWaiting: { duties: [REVIEW, ...TAKE_UPS, CONFIRM], isLoading: false, isError: false },
  stewardNothing: { duties: [], isLoading: false, isError: false },
  gardener: { duties: [], isLoading: false, isError: false },
  // The work-to-review read failed; the other queues answered.
  readFailed: { duties: [...TAKE_UPS, CONFIRM], isLoading: false, isError: true },
};

interface NeedsYourAttentionStoryProps {
  scene: Scene;
  offline?: boolean;
}

function NeedsYourAttentionStory(_props: NeedsYourAttentionStoryProps) {
  return (
    <div className="min-h-dvh bg-bg-canvas pb-6">
      <NeedsYourAttention garden={JOURNEY_GARDEN_RECORD as Garden} />
    </div>
  );
}

/** Stories pick a language through `parameters.locale`; the global decorator stays English. */
const withLocale: Decorator = (Story, context) => {
  const locale = (context.parameters.locale as Locale | undefined) ?? "en";
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </IntlProvider>
  );
};

/**
 * Home's Needs Your Attention (PWA Home step 19, DL-127): the queues in the active garden the
 * account can act on, one row each with its count, each opening its exact queue. It appears
 * only with something to show; for a gardener, or a steward with nothing waiting, it is absent.
 */
const meta: Meta<typeof NeedsYourAttentionStory> = {
  title: "Client/PWA/Home/NeedsYourAttention",
  component: NeedsYourAttentionStory,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", viewport: { options: PHONE_VIEWPORTS } },
  globals: { viewport: { value: "homePhone360" } },
  decorators: [
    withLocale,
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: { scene: "stewardWaiting", offline: false },
  beforeEach: ({ args }) => {
    mocked(useStewardDuties).mockReturnValue({ ...SCENES[args.scene], refetch: fn() });
    mocked(useOnlineStatus).mockReturnValue(!args.offline);
    mocked(useCommitmentMetadata).mockReturnValue({
      byCID: TITLES,
    } as unknown as ReturnType<typeof useCommitmentMetadata>);
    mocked(useActions).mockReturnValue({
      data: PENDING_ACTIONS,
    } as unknown as ReturnType<typeof useActions>);
    return resetHookMocks(useStewardDuties, useOnlineStatus, useCommitmentMetadata, useActions);
  },
};

export default meta;
type Story = StoryObj<typeof NeedsYourAttentionStory>;

/** A steward with work to review, take-up requests on two promises and one promise to confirm. */
export const StewardWithWaiting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Needs Your Attention" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
  },
};

export const StewardWithWaitingAt390: Story = {
  globals: { viewport: { value: "homePhone390" } },
};

export const StewardWithWaitingSpanish: Story = { parameters: { locale: "es" } };

export const StewardWithWaitingPortuguese: Story = { parameters: { locale: "pt" } };

/** Nothing waits for the steward: the section is absent. */
export const StewardNothingWaiting: Story = {
  args: { scene: "stewardNothing" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("heading")).not.toBeInTheDocument();
  },
};

/** A gardener in the same garden: the section is absent while the steward's queues wait. */
export const Gardener: Story = {
  args: { scene: "gardener" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("heading")).not.toBeInTheDocument();
  },
};

/** One queue could not be read: what loaded stays, and the failure says nothing was lost. */
export const ReadFailed: Story = { args: { scene: "readFailed" } };

export const ReadFailedOffline: Story = { args: { scene: "readFailed", offline: true } };

export const ReadFailedPortuguese: Story = {
  args: { scene: "readFailed" },
  parameters: { locale: "pt" },
};
