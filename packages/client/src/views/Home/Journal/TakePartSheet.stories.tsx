import {
  type TakePartEntry,
  useGardenOpenCycles,
  useGardenOpenPromises,
} from "@green-goods/shared/hooks/garden/useGardenJournal";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { useLayoutEffect } from "react";
import { IntlProvider } from "react-intl";
import { expect, mocked, screen, userEvent, within } from "storybook/test";
import {
  AUTUMN_PLANTING,
  JOURNEY_CYCLE_NAMES,
  JOURNEY_GARDEN_RECORD,
  SEED_SWAP,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import {
  withClientAppRuntime,
  withRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import {
  JOURNAL_ENTRIES,
  openCyclesFixture,
  openPromisesFixture,
} from "../../../../../shared/.storybook/homeJournalFixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { TakePartSheet } from "./TakePartSheet";

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

type Scene = "all" | "season" | "nothingInCampaign" | "campaignNoLongerListed";

/** How each story opens the sheet, and the open promises the garden's read returns. */
const SCENES: Record<
  Scene,
  { cycleId?: bigint; cycleType?: "SEASON" | "CAMPAIGN"; entries: TakePartEntry[] }
> = {
  all: { entries: JOURNAL_ENTRIES },
  season: { cycleId: AUTUMN_PLANTING.cycleId, entries: JOURNAL_ENTRIES },
  // The campaign's one ask was taken up, so nothing in it is open any more.
  nothingInCampaign: {
    cycleId: SEED_SWAP.cycleId,
    entries: JOURNAL_ENTRIES.filter((entry) => entry.copy.cycleId !== SEED_SWAP.cycleId),
  },
  // A campaign that closed between its details and the sheet: the rail no longer lists it.
  campaignNoLongerListed: {
    cycleId: 404n,
    cycleType: "CAMPAIGN",
    entries: JOURNAL_ENTRIES,
  },
};

function TakePartSheetStory({ scene }: { scene: Scene }) {
  const { cycleId, cycleType } = SCENES[scene];
  useLayoutEffect(() => {
    useUIStore.getState().openTakePartSheet({ cycleId: cycleId?.toString(), cycleType });
    return () => useUIStore.getState().closeTakePartSheet();
  }, [cycleId, cycleType]);
  return (
    <div className="min-h-dvh bg-bg-canvas">
      <TakePartSheet garden={JOURNEY_GARDEN_RECORD} />
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
 * The garden's open promises as a tall sheet over Home: every promise the reader could take up,
 * of which Take Part shows the first rows, as the Pool tab's commitment rows under the garden's
 * open seasons and campaigns. See All opens it whole; a cycle's Show Its Promises opens it at
 * that cycle, which the rail widens again. Fictional data from the client journeys.
 */
const meta: Meta<typeof TakePartSheetStory> = {
  title: "Client/Home/TakePartSheet",
  component: TakePartSheetStory,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", viewport: { options: PHONE_VIEWPORTS } },
  globals: { viewport: { value: "homePhone360" } },
  decorators: [
    withLocale,
    withSeededQueryClient(JOURNEY_CYCLE_NAMES),
    withRouter(["/home"]),
    withClientAppRuntime,
  ],
  args: { scene: "all" },
  argTypes: {
    scene: {
      control: "radio",
      options: ["all", "season", "nothingInCampaign", "campaignNoLongerListed"],
    },
  },
  beforeEach: ({ args }) => {
    const { entries } = SCENES[args.scene];
    mocked(useGardenOpenPromises).mockReturnValue({
      ...openPromisesFixture({ status: "ready", items: entries.slice(0, 3), savedAt: null }),
      all: { status: "ready", items: entries, savedAt: null },
    });
    mocked(useGardenOpenCycles).mockReturnValue(openCyclesFixture());
    return resetHookMocks(useGardenOpenPromises, useGardenOpenCycles);
  },
};

export default meta;
type Story = StoryObj<typeof TakePartSheetStory>;

const findSheet = async () => {
  const dialog = await screen.findByRole("dialog", { name: "Take Part" });
  return { dialog, sheet: within(dialog) };
};

const rowsIn = (dialog: HTMLElement) =>
  within(dialog)
    .getAllByRole("button")
    .filter((button) => button.getAttribute("data-component") === "CommitmentRow");

/** See All: every open promise in the garden, the garden named under the title. */
export const SeeAll: Story = {
  tags: ["storybook-ci"],
  play: async () => {
    const { dialog, sheet } = await findSheet();
    await expect(dialog).toHaveAttribute("data-sheet-size", "tall");
    await expect(dialog).toHaveAccessibleDescription("In Riverside Commons Garden");
    await expect(rowsIn(dialog)).toHaveLength(JOURNAL_ENTRIES.length);
    // The open season and campaign lead the list, and none narrows it until one is chosen.
    await expect(sheet.getAllByRole("button", { pressed: false }).length).toBeGreaterThan(0);
    await expect(sheet.queryByRole("button", { pressed: true })).toBeNull();
  },
};

export const SeeAllAt390: Story = { globals: { viewport: { value: "homePhone390" } } };

export const SeeAllSpanish: Story = { parameters: { locale: "es" } };

export const SeeAllPortuguese: Story = { parameters: { locale: "pt" } };

/** Show Its Promises on the season: the list narrowed to it, the season chosen in the rail. */
export const AtTheSeason: Story = {
  args: { scene: "season" },
  play: async () => {
    const { dialog } = await findSheet();
    await expect(within(dialog).getByRole("button", { pressed: true })).toBeVisible();
    await expect(rowsIn(dialog)).toHaveLength(
      JOURNAL_ENTRIES.filter((entry) => entry.copy.cycleId === AUTUMN_PLANTING.cycleId).length
    );
  },
};

/** A campaign with nothing open: one row says so, and how to see them all again. */
export const NothingOpenInTheCampaign: Story = {
  tags: ["storybook-ci"],
  args: { scene: "nothingInCampaign" },
  play: async () => {
    const { sheet } = await findSheet();
    await expect(sheet.getByText("Nothing open in this campaign")).toBeVisible();
    await expect(sheet.getByText("Tap it again to see them all")).toBeVisible();
  },
};

export const NothingOpenInTheCampaignAt390: Story = {
  args: { scene: "nothingInCampaign" },
  globals: { viewport: { value: "homePhone390" } },
};

/**
 * Show Its Promises on a campaign the rail no longer lists (it closed on a refetch): the list
 * stays the campaign's rather than widening to the garden's, nothing in the rail is chosen, and
 * the one row offers See All, since the card to tap again is gone.
 */
export const CampaignNoLongerListed: Story = {
  tags: ["storybook-ci"],
  args: { scene: "campaignNoLongerListed" },
  play: async ({ canvasElement }) => {
    const { dialog, sheet } = await findSheet();
    await expect(sheet.getByText("Nothing open in this campaign")).toBeVisible();
    await expect(sheet.queryByText("Tap it again to see them all")).toBeNull();
    await expect(sheet.queryByRole("button", { pressed: true })).toBeNull();
    await userEvent.click(sheet.getByRole("button", { name: "See All" }));
    await expect(rowsIn(dialog)).toHaveLength(JOURNAL_ENTRIES.length);
    await expect(canvasElement).toBeInTheDocument();
  },
};

export const NothingOpenInTheCampaignSpanish: Story = {
  args: { scene: "nothingInCampaign" },
  parameters: { locale: "es" },
};

export const NothingOpenInTheCampaignPortuguese: Story = {
  args: { scene: "nothingInCampaign" },
  parameters: { locale: "pt" },
};
