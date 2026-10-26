import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import {
  type YourWorkOnPhone,
  useYourWorkOnPhone,
} from "@green-goods/shared/hooks/work/useYourWorkOnPhone";
import en from "@green-goods/shared/i18n/en";
import type { Work } from "@green-goods/shared/types/domain";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, mocked, within } from "storybook/test";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import {
  PENDING_ACTIONS,
  pendingWorkFixture,
} from "../../../../../shared/.storybook/pendingWorkFixtures";
import { Continue } from "./Continue";

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

type Scene = "rows" | "oneDraft" | "leftGardenReview" | "empty" | "loading" | "error";

/**
 * A review this phone made in a garden the member has since left: its queued upload is blocked
 * (only a steward can send it), and Continue lists it, as the Your Work badge counts it.
 */
const LEFT_GARDEN_REVIEW: Work = {
  ...pendingWorkFixture("all").submissions[0],
  id: "0xleftgardenreview",
  title: "Hedge laying along the north path",
  gardenerAddress: "0x5eed00000000000000000000000000000000beef",
  gardenAddress: "0x1ef7000000000000000000000000000000000c3d",
  status: "approved",
};

/** The garden's Your Work on this phone, as the frames draw it, for each scene. */
function onPhoneFor(scene: Scene): YourWorkOnPhone {
  const fixture = pendingWorkFixture("all");
  const items =
    scene === "rows"
      ? {
          // Work on the record waits for review in Your Work; only what the queue holds is here.
          submissions: fixture.submissions.filter((work) => work.status === "offline"),
          decisions: [],
          drafts: fixture.drafts,
          proofs: fixture.proofs,
        }
      : scene === "oneDraft"
        ? { submissions: [], decisions: [], drafts: fixture.drafts.slice(0, 1), proofs: [] }
        : scene === "leftGardenReview"
          ? {
              submissions: [],
              decisions: [LEFT_GARDEN_REVIEW],
              drafts: fixture.drafts.slice(0, 1),
              proofs: [],
            }
          : { submissions: [], decisions: [], drafts: [], proofs: [] };
  return {
    ...items,
    decisionFor: (workUID) =>
      workUID === LEFT_GARDEN_REVIEW.id
        ? {
            jobId: "job-left-garden-review",
            status: { state: "blocked" as const, reason: "NotGardenOperator" },
            savedAt: Date.now() - 3 * 60 * 60 * 1000,
          }
        : undefined,
    isLinked: (work) => fixture.linkedWorkIds.has(work.id),
    count:
      items.submissions.length + items.decisions.length + items.drafts.length + items.proofs.length,
    isLoading: scene === "loading",
    isError: scene === "error",
    queueUnreadable: scene === "error",
    refetch: fn(),
  };
}

interface ContinueStoryProps {
  scene: Scene;
  offline?: boolean;
  /** The language, also settable from the URL (`args=locale:es`). */
  locale?: Locale;
}

function ContinueStory(_props: ContinueStoryProps) {
  return (
    <div className="min-h-dvh bg-bg-canvas pb-6">
      <Continue />
    </div>
  );
}

/** Stories pick a language through `parameters.locale` or the `locale` arg; the global decorator stays English. */
const withLocale: Decorator = (Story, context) => {
  const locale =
    (context.parameters.locale as Locale | undefined) ??
    (context.args.locale as Locale | undefined) ??
    "en";
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </IntlProvider>
  );
};

/**
 * Home's Continue (PWA Home step 8, DL-127): the member's own work still on this phone in the
 * active garden's scope, the rows Your Work › Pending lists first (DL-061), at most three, with
 * Open Your Work. Each scene draws the real section; only its data hooks return the frames'
 * records.
 */
const meta: Meta<typeof ContinueStory> = {
  title: "Client/PWA/Home/Continue",
  component: ContinueStory,
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
  args: { scene: "rows", offline: false, locale: "en" },
  beforeEach: ({ args }) => {
    mocked(useYourWorkOnPhone).mockReturnValue(onPhoneFor(args.scene));
    mocked(useOnlineStatus).mockReturnValue(!args.offline);
    // A passkey reader: the background flush sends their proof.
    mocked(useCommitmentJobs).mockReturnValue({
      sendsFromTap: false,
    } as unknown as ReturnType<typeof useCommitmentJobs>);
    mocked(useActions).mockReturnValue({
      data: PENDING_ACTIONS,
    } as unknown as ReturnType<typeof useActions>);
    return resetHookMocks(useYourWorkOnPhone, useOnlineStatus, useCommitmentJobs, useActions);
  },
};

export default meta;
type Story = StoryObj<typeof ContinueStory>;

/** A gardener with blocked work, uploads, drafts and proof: what needs them first, three rows. */
export const Rows: Story = {
  play: async ({ canvasElement }) => {
    const section = within(canvasElement);
    await expect(section.getByRole("heading", { name: "Continue" })).toBeInTheDocument();
    await expect(section.getAllByRole("listitem")).toHaveLength(3);
    await expect(section.getByRole("button", { name: "Open Your Work" })).toBeInTheDocument();
  },
};

export const RowsAt390: Story = { globals: { viewport: { value: "homePhone390" } } };

export const RowsSpanish: Story = { parameters: { locale: "es" } };

export const RowsPortuguese: Story = { parameters: { locale: "pt" } };

/** One draft: the section lists what there is and keeps Open Your Work. */
export const OneDraft: Story = { args: { scene: "oneDraft" } };

/** A review queued for a garden the member has left: listed, with why it can't go, as the badge counts it. */
export const ReviewFromALeftGarden: Story = {
  args: { scene: "leftGardenReview" },
  play: async ({ canvasElement }) => {
    const section = within(canvasElement);
    await expect(section.getByText("Hedge laying along the north path")).toBeInTheDocument();
    await expect(section.getByText("Your review")).toBeInTheDocument();
    await expect(section.getByText("Not a steward")).toBeInTheDocument();
  },
};

/** Offline, the rows say what waits for the connection; nothing is lost. */
export const Offline: Story = { args: { offline: true } };

/** Nothing waits on this phone in this garden: one quiet row with the next step. */
export const Empty: Story = { args: { scene: "empty" } };

export const EmptySpanish: Story = { args: { scene: "empty" }, parameters: { locale: "es" } };

export const EmptyPortuguese: Story = { args: { scene: "empty" }, parameters: { locale: "pt" } };

/** The phone's lists are still being read: a row's frame holds the place. */
export const Loading: Story = { args: { scene: "loading" } };

/** This phone's queue could not be read: nothing was lost, and Try Again reads it again. */
export const ReadFailed: Story = { args: { scene: "error" } };

export const ReadFailedPortuguese: Story = {
  args: { scene: "error" },
  parameters: { locale: "pt" },
};
