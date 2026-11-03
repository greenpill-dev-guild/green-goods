import { useCommitmentMetadata } from "@green-goods/shared/commitment-pooling";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import type { StewardDuties } from "@green-goods/shared/hooks/garden/useStewardDuties";
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
 * What the derivation (`useStewardDuties`, which HomeJournal calls once) hands a steward of
 * Riverside Commons who wears its steward hat: two works waiting, the older first; three join
 * requests, counted with the grant a signed check in Gardeners left in this browser; take-up
 * requests on two promises, newest first; one promise to confirm. It hands a gardener nothing,
 * whatever waits, and a browser without a grant no join requests: each row follows the
 * predicate of its act (useStewardDuties.test.ts proves who gets which).
 */
const REVIEW: Duty = {
  kind: "review",
  count: 2,
  works: [submitted("0x5eed0a11", 2, 50), submitted("0x5eed0a12", 1, 5)],
};
const JOIN_REQUESTS: Duty = { kind: "joinRequests", count: 3 };
const TAKE_UPS: Duty[] = [
  { kind: "takeUp", count: 2, commitment: EAST_BEDS as never, newestAt: hoursAgo(3) },
  { kind: "takeUp", count: 1, commitment: SEED_SWAP as never, newestAt: hoursAgo(30) },
];
const CONFIRM: Duty = { kind: "confirm", count: 1, commitments: [FENCE as never] };

type Scene = "stewardWaiting" | "stewardNothing" | "gardener" | "readFailed";

const SCENES: Record<Scene, Omit<StewardDuties, "refetch">> = {
  stewardWaiting: {
    duties: [REVIEW, JOIN_REQUESTS, ...TAKE_UPS, CONFIRM],
    isLoading: false,
    isError: false,
  },
  stewardNothing: { duties: [], isLoading: false, isError: false },
  gardener: { duties: [], isLoading: false, isError: false },
  // The work-to-review read failed; the other queues answered.
  readFailed: { duties: [...TAKE_UPS, CONFIRM], isLoading: false, isError: true },
};

interface NeedsYourAttentionStoryProps {
  scene: Scene;
  offline?: boolean;
}

const refetch = fn();

function NeedsYourAttentionStory({ scene }: NeedsYourAttentionStoryProps) {
  return (
    <div className="min-h-dvh bg-bg-canvas pb-6">
      <NeedsYourAttention
        garden={JOURNEY_GARDEN_RECORD as Garden}
        duties={{ ...SCENES[scene], refetch }}
      />
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
    mocked(useOnlineStatus).mockReturnValue(!args.offline);
    mocked(useCommitmentMetadata).mockReturnValue({
      byCID: TITLES,
    } as unknown as ReturnType<typeof useCommitmentMetadata>);
    mocked(useActions).mockReturnValue({
      data: PENDING_ACTIONS,
    } as unknown as ReturnType<typeof useActions>);
    return resetHookMocks(useOnlineStatus, useCommitmentMetadata, useActions);
  },
};

export default meta;
type Story = StoryObj<typeof NeedsYourAttentionStory>;

/**
 * A steward with work to review, join requests, take-up requests on two promises and one promise
 * to confirm.
 */
export const StewardWithWaiting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Needs Your Attention" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(5);
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

/** The join-request row's title in each language, for three waiting. */
const JOIN_REQUEST_TITLES: Record<Locale, string> = {
  en: "3 join requests",
  es: "3 solicitudes para unirse",
  pt: "3 solicitações para entrar",
};

function SceneColumn({ scene, duties }: { scene: string; duties: Duty[] }) {
  return (
    <div style={{ width: 360 }} className="flex shrink-0 flex-col bg-bg-canvas" data-scene={scene}>
      <p className="type-meta px-4 pt-3 text-text-sub">{scene}</p>
      <NeedsYourAttention
        garden={JOURNEY_GARDEN_RECORD as Garden}
        duties={{ duties, isLoading: false, isError: false, refetch }}
      />
    </div>
  );
}

/**
 * A steward with join requests waiting beside the same steward with none waiting, or whose
 * browser holds no count grant, in English, Spanish and Portuguese: the row comes and goes, and
 * the other queues keep their places.
 */
export const JoinRequestsEveryLanguage: Story = {
  globals: { viewport: { value: "desktop" } },
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-6">
      {(Object.keys(MESSAGES) as Locale[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={MESSAGES[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            <SceneColumn
              scene={`${locale}: join requests waiting`}
              duties={[REVIEW, JOIN_REQUESTS, CONFIRM]}
            />
            <SceneColumn scene={`${locale}: none waiting`} duties={[REVIEW, CONFIRM]} />
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const titles = (column: Element) =>
      [...column.querySelectorAll(".gg-item-row-title")].map((title) => title.textContent);
    for (const locale of Object.keys(MESSAGES) as Locale[]) {
      const [waiting, none] = canvasElement.querySelectorAll(
        `[data-locale="${locale}"] [data-scene]`
      );
      await expect(titles(waiting)).toContain(JOIN_REQUEST_TITLES[locale]);
      await expect(titles(none)).toHaveLength(2);
      await expect(titles(none)).not.toContain(JOIN_REQUEST_TITLES[locale]);
    }
  },
};
