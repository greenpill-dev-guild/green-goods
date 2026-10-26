import { useGardenAssessmentRecords } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";
import {
  useActions,
  useGardeners,
  useGardens,
} from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import {
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import type { GardenAccess } from "@green-goods/shared/hooks/garden/useGardenTabs";
import { useWorks } from "@green-goods/shared/hooks/work/useWorks";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import { type GardenSheet, useUIStore } from "@green-goods/shared/stores/useUIStore";
import { type Address, Domain, type Garden } from "@green-goods/shared/types/domain";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { useLayoutEffect } from "react";
import { IntlProvider } from "react-intl";
import { expect, fn, mocked, screen, within } from "storybook/test";
import {
  JOURNEY_GARDEN_RECORD,
  JOURNEY_HELPER,
  JOURNEY_NEIGHBOUR,
  JOURNEY_VIEWER,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import { withClientAppRuntime, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  daysAgo,
  FIXTURE_IMAGE_BANNER,
  FIXTURE_IMAGE_PROFILE,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import { JOURNAL_WORKS } from "../../../../../shared/.storybook/homeJournalFixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { PENDING_ACTIONS } from "../../../../../shared/.storybook/pendingWorkFixtures";
import { GardenSheets } from "./GardenSheets";

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

/** Riverside Commons with a description and its banner. */
const GARDEN: Garden = {
  ...JOURNEY_GARDEN_RECORD,
  bannerImage: FIXTURE_IMAGE_BANNER,
  description:
    "Riverside Commons grows food along the river and shares the harvest with its block.",
};

const ACCESS: Record<"gardener" | "steward", GardenAccess> = {
  gardener: {
    canReview: false,
    canManageRequests: false,
    hasEndowmentDeposits: false,
    showEndowment: false,
    showGovernance: false,
  },
  steward: {
    canReview: true,
    canManageRequests: true,
    hasEndowmentDeposits: false,
    showEndowment: true,
    showGovernance: false,
  },
};

/** The garden's people as the gardeners list names them, matched to the record's roster. */
const GARDENERS = [
  { account: JOURNEY_NEIGHBOUR, username: "tomas" },
  { account: JOURNEY_VIEWER, username: "amara" },
  { account: JOURNEY_HELPER, username: "dele" },
].map(({ account, username }, index) => ({
  id: `gardener-${index}`,
  account,
  username,
  avatar: FIXTURE_IMAGE_PROFILE,
  registeredAt: (STORYBOOK_NOW_SECONDS - 86_400 * (30 * (index + 1))) * 1000,
}));

/** Two garden assessments on record, as Insights lists them read-only. */
const ASSESSMENTS = [
  [Domain.AGRO, "Native canopy returns along the riverbank"],
  [Domain.EDU, "Gardeners learn to restore and care for their soil"],
].map(([domain, title], index) => ({
  summary: {
    id: `assessment-${index}`,
    authorAddress: JOURNEY_NEIGHBOUR,
    gardenAddress: GARDEN.id as Address,
    title,
    description: "A community-led assessment of the changes made during this reporting period.",
    assessmentConfigCID: "",
    domain,
    startDate: daysAgo(90 * (index + 1)),
    endDate: daysAgo(90 * index),
    location: "Riverside District",
    createdAt: daysAgo(90 * index),
  },
  detail: { status: "unavailable" as const },
}));

type Scene = "insights" | "insightsNoBanner" | "gardenersSteward" | "gardenersGardener" | "work";

const SCENES: Record<Scene, { sheet: GardenSheet; garden: Garden; access: GardenAccess }> = {
  insights: { sheet: "insights", garden: GARDEN, access: ACCESS.gardener },
  insightsNoBanner: {
    sheet: "insights",
    garden: { ...GARDEN, bannerImage: "" },
    access: ACCESS.gardener,
  },
  gardenersSteward: { sheet: "gardeners", garden: GARDEN, access: ACCESS.steward },
  gardenersGardener: { sheet: "gardeners", garden: GARDEN, access: ACCESS.gardener },
  work: { sheet: "work", garden: GARDEN, access: ACCESS.steward },
};

/** The reads behind each section, set for one story. */
const withScene = (scene: Scene) => () => {
  mocked(useWorks).mockReturnValue({
    works: JOURNAL_WORKS,
    isFetching: false,
    isLoading: false,
    isError: false,
    isPaused: false,
    availability: "available",
    lastSuccessfulRefresh: STORYBOOK_NOW_SECONDS * 1000,
    refetch: fn(),
  } as unknown as ReturnType<typeof useWorks>);
  mocked(useActions).mockReturnValue({ data: PENDING_ACTIONS } as unknown as ReturnType<
    typeof useActions
  >);
  mocked(useGardeners).mockReturnValue({ data: GARDENERS } as unknown as ReturnType<
    typeof useGardeners
  >);
  // The runtime providers read the garden list; the story answers with this garden, offline.
  mocked(useGardens).mockReturnValue({
    data: [GARDEN],
    isPending: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: fn(),
  } as unknown as ReturnType<typeof useGardens>);
  mocked(useGardenAssessmentRecords).mockReturnValue({
    records: ASSESSMENTS,
    status: "success",
  } as unknown as ReturnType<typeof useGardenAssessmentRecords>);
  // The join-request service is on and its queue is unread: Check Requests is the queue's control.
  mocked(useGardenJoinRequestAvailability).mockReturnValue(true);
  mocked(useGardenJoinRequests).mockReturnValue({
    queue: [],
    nextCursor: undefined,
    rateLimitedRecently: false,
    queueState: { isLoading: false, error: null },
    mutationState: { isLoading: false, error: null },
    loadQueue: fn(async () => undefined),
    resolveRequest: fn(async () => undefined),
  } as unknown as ReturnType<typeof useGardenJoinRequests>);
  mocked(useEnsName).mockReturnValue({ data: null, isLoading: false } as ReturnType<
    typeof useEnsName
  >);
  mocked(useGreenGoodsEnsName).mockReturnValue({ data: null, isLoading: false } as ReturnType<
    typeof useGreenGoodsEnsName
  >);
  return resetHookMocks(
    useWorks,
    useActions,
    useGardeners,
    useGardens,
    useGardenAssessmentRecords,
    useGardenJoinRequestAvailability,
    useGardenJoinRequests,
    useEnsName,
    useGreenGoodsEnsName
  );
};

interface GardenSheetsStoryProps {
  scene: Scene;
}

function GardenSheetsStory({ scene }: GardenSheetsStoryProps) {
  const { garden, access, sheet } = SCENES[scene];
  // The story opens its section as Home's rows do, through the store, and closes it as it
  // unmounts, so no later story starts with a sheet open.
  useLayoutEffect(() => {
    useUIStore.getState().openGardenSheet(sheet);
    return () => useUIStore.getState().closeGardenSheet();
  }, [sheet]);
  return (
    <div className="min-h-dvh bg-bg-canvas">
      <GardenSheets
        garden={garden}
        access={access}
        endowment={{ isOpen: false, onClose: fn() }}
        governance={{ isOpen: false, onClose: fn() }}
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
 * The garden's sections as tall sheets over Home (PWA Home step 10, DL-128): the section's
 * content under the one shared sheet header, the garden named beneath the title. Insights opens
 * with the garden's banner when it has one and keeps the assessments as read-only rows; the
 * Gardeners sheet puts a steward's join-request queue first, with Check Requests and no count;
 * the Work sheet lists the garden's work pending first, as the Work tab does. The sections are
 * the garden page's own components. Fictional data from the client journeys.
 */
const meta: Meta<typeof GardenSheetsStory> = {
  title: "Client/Home/GardenSheets",
  component: GardenSheetsStory,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", viewport: { options: PHONE_VIEWPORTS } },
  globals: { viewport: { value: "homePhone360" } },
  decorators: [withLocale, withRouter(["/home"]), withClientAppRuntime],
  args: { scene: "insights" },
  argTypes: {
    scene: {
      control: "radio",
      options: ["insights", "insightsNoBanner", "gardenersSteward", "gardenersGardener", "work"],
    },
  },
  beforeEach: ({ args }) => withScene(args.scene)(),
};

export default meta;
type Story = StoryObj<typeof GardenSheetsStory>;

const findSheet = async (name: string) => within(await screen.findByRole("dialog", { name }));

/** Insights with the garden's 144px banner, its description and two read-only assessment rows. */
export const InsightsWithBanner: Story = {
  play: async () => {
    const sheet = await findSheet("Insights");
    const dialog = screen.getByRole("dialog", { name: "Insights" });
    await expect(dialog).toHaveAttribute("data-sheet-size", "tall");
    await expect(dialog).toHaveAccessibleDescription("In Riverside Commons Garden");
    const banner = sheet.getByTestId("garden-sheet-banner");
    await expect(Math.round(banner.getBoundingClientRect().height)).toBe(144);
    await expect(sheet.getByRole("heading", { name: "Assessments" })).toBeVisible();
    await expect(sheet.getAllByRole("button", { name: /riverbank|soil/ })).toHaveLength(2);
  },
};

export const InsightsWithBannerAt390: Story = { globals: { viewport: { value: "homePhone390" } } };

export const InsightsWithBannerSpanish: Story = { parameters: { locale: "es" } };

export const InsightsWithBannerPortuguese: Story = { parameters: { locale: "pt" } };

/** A garden with no banner: the sheet opens on its description. */
export const InsightsWithoutBanner: Story = {
  args: { scene: "insightsNoBanner" },
  play: async () => {
    const sheet = await findSheet("Insights");
    await expect(sheet.queryByTestId("garden-sheet-banner")).toBeNull();
    await expect(sheet.getByRole("heading", { name: "Description" })).toBeVisible();
  },
};

/** A steward's Gardeners: the join-request queue first, with Check Requests and no count, then the people. */
export const GardenersForSteward: Story = {
  args: { scene: "gardenersSteward" },
  play: async () => {
    const sheet = await findSheet("Gardeners");
    await expect(sheet.getByRole("heading", { name: "Join Requests" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Check Requests" })).toBeVisible();
    await expect(sheet.getAllByRole("button", { name: /tomas|amara|dele/ })).toHaveLength(3);
  },
};

export const GardenersForStewardAt390: Story = {
  args: { scene: "gardenersSteward" },
  globals: { viewport: { value: "homePhone390" } },
};

export const GardenersForStewardSpanish: Story = {
  args: { scene: "gardenersSteward" },
  parameters: { locale: "es" },
};

export const GardenersForStewardPortuguese: Story = {
  args: { scene: "gardenersSteward" },
  parameters: { locale: "pt" },
};

/** A gardener's Gardeners: the people only, no queue. */
export const GardenersForGardener: Story = {
  args: { scene: "gardenersGardener" },
  play: async () => {
    const sheet = await findSheet("Gardeners");
    await expect(sheet.queryByRole("heading", { name: "Join Requests" })).toBeNull();
    await expect(sheet.getAllByRole("button", { name: /tomas|amara|dele/ })).toHaveLength(3);
  },
};

/** The garden's Work, pending first, as Recent Activity's See All and a steward's duty row open it. */
export const WorkOnPending: Story = {
  args: { scene: "work" },
  play: async () => {
    const sheet = await findSheet("Work");
    await expect(screen.getByRole("dialog", { name: "Work" })).toHaveAccessibleDescription(
      "In Riverside Commons Garden"
    );
    await expect(sheet.getByRole("combobox", { name: "Sort" })).toHaveValue("pending");
    const rows = sheet.getAllByRole("status");
    await expect(rows.map((row) => row.textContent)).toContain("Pending");
  },
};

export const WorkOnPendingAt390: Story = {
  args: { scene: "work" },
  globals: { viewport: { value: "homePhone390" } },
};

export const WorkOnPendingSpanish: Story = {
  args: { scene: "work" },
  parameters: { locale: "es" },
};

export const WorkOnPendingPortuguese: Story = {
  args: { scene: "work" },
  parameters: { locale: "pt" },
};
