import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, fn, screen, within } from "storybook/test";
import {
  AUTUMN_PLANTING,
  JOURNEY_CYCLE_NAMES,
  LIVE_PROMISES,
  SEED_SWAP,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import {
  withClientAppRuntime,
  withRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { CycleDetailsSheet } from "./CycleDetailsSheet";

/**
 * A campaign run as a project brief (PRD-1299, SBrief): three separate promises under one brief,
 * each accepted, reviewed and rewarded on its own. Its stewards' note says how they fit
 * together; the core has no brief object, so the note is the campaign's metadata alone.
 * Fictional, from the voucher lab's Tech and Sun brief.
 */
const IMPACT_WEBSITE = {
  ...SEED_SWAP,
  id: "42161-9",
  cycleId: 9n,
  metadataCID: "bafyimpactwebsite",
  liveCommitmentCount: 3n,
  commitmentsDue: 3n,
};
const BRIEF_NOTE =
  "The brief groups the work for people. It isn't a contract: nothing pays out as a team, and " +
  "one promise finishing doesn't finish the others.\nAde confirms each prerequisite before the " +
  "next work is booked.";

/**
 * Autumn Planting's own promises (DL-169): the journey's two offered and three underway, one
 * waiting to be confirmed and one lapsed. Its record says 3 of 7 kept.
 */
const autumnPromise = LIVE_PROMISES[0].row.commitment;
const AUTUMN_PROMISES = [
  ...LIVE_PROMISES.map(({ row }) => row.commitment).filter(({ cycleId }) => cycleId === 3n),
  { ...autumnPromise, id: "42161-91", commitmentId: 91n, derivedState: "READY_FOR_CONFIRMATION" },
  { ...autumnPromise, id: "42161-92", commitmentId: 92n, derivedState: "EXPIRED" },
];
/** What Autumn Planting adds up to: each unit label on its own row. */
const autumnUnits = (unitLabel: string, fulfilledUnits: bigint, expectedUnits: bigint) => ({
  id: `42161-cycle-3-${unitLabel}`,
  chainId: 42161,
  scope: "CYCLE" as const,
  scopeId: 3n,
  poolId: 7n,
  cycleId: 3n,
  unitLabel,
  unitLabelHash: "0x00" as const,
  expectedUnits,
  approvedUnits: fulfilledUnits,
  fulfilledUnits,
  openUnits: expectedUnits - fulfilledUnits,
  updatedAt: 1_790_000_000,
});
/** The cycle reads the details make, seeded so no story reaches the indexer. */
const CYCLE_READ_SEEDS: [readonly unknown[], unknown][] = [
  [
    queryKeys.commitmentPooling.commitments(42161, { chainId: 42161, cycleId: 3n }),
    AUTUMN_PROMISES,
  ],
  [
    queryKeys.commitmentPooling.cycle(42161, 3n),
    {
      cycle: AUTUMN_PLANTING,
      unitSummaries: [autumnUnits("mornings", 5n, 7n), autumnUnits("sessions", 1n, 2n)],
      seriesSummaries: [],
    },
  ],
  [queryKeys.commitmentPooling.commitments(42161, { chainId: 42161, cycleId: 9n }), []],
  [
    queryKeys.commitmentPooling.cycle(42161, 9n),
    { cycle: IMPACT_WEBSITE, unitSummaries: [], seriesSummaries: [] },
  ],
];

const MESSAGES = { en, es, pt } as const;
type Locale = keyof typeof MESSAGES;

/** Stories pick a language through `parameters.locale`; the global decorator stays English. */
const withLocale: Decorator = (Story, context) => {
  const locale = (context.parameters.locale as Locale | undefined) ?? "en";
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </IntlProvider>
  );
};

const meta: Meta<typeof CycleDetailsSheet> = {
  title: "Client/Commitments/CycleDetailsSheet",
  component: CycleDetailsSheet,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  parameters: { layout: "fullscreen" },
  decorators: [
    withLocale,
    withSeededQueryClient([
      ...JOURNEY_CYCLE_NAMES,
      ...CYCLE_READ_SEEDS,
      [
        queryKeys.commitmentPooling.cycleMetadata("bafyimpactwebsite"),
        { status: "resolved", name: "Impact website", brief: BRIEF_NOTE },
      ],
    ]),
    withRouter(["/home"]),
    withClientAppRuntime,
  ],
  args: { cycle: IMPACT_WEBSITE, isOpen: true, onClose: fn(), onShowPromises: fn() },
};

export default meta;
type Story = StoryObj<typeof CycleDetailsSheet>;

/** The campaign's details carry its brief note, under its own heading, after the counts. */
export const CampaignBrief: Story = {
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Impact website" }));
    await expect(sheet.getByRole("heading", { name: "How the brief works" })).toBeVisible();
    await expect(sheet.getByText(/nothing pays out as a team/)).toBeVisible();
    await expect(sheet.getByText(/Ade confirms each prerequisite/)).toBeVisible();
  },
};

export const CampaignBriefSpanish: Story = {
  parameters: { locale: "es" },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Impact website" }));
    await expect(sheet.getByRole("heading", { name: "Cómo funciona el brief" })).toBeVisible();
  },
};

export const CampaignBriefPortuguese: Story = {
  parameters: { locale: "pt" },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Impact website" }));
    await expect(sheet.getByRole("heading", { name: "Como o brief funciona" })).toBeVisible();
  },
};

/** A fact list's rows as label and value, as the reader sees them. */
function factsOf(component: string) {
  return [
    ...document.querySelectorAll(`[data-component="${component}"] [data-component="FactRow"]`),
  ].map((row) => [
    row.querySelector(".gg-fact-label")?.textContent,
    row.querySelector(".gg-fact-value")?.textContent,
  ]);
}

/**
 * Where a season's promises stand, counted from its own promise list, with Kept so far from its
 * record, then what they add up to, one unit label a row (DL-169).
 */
export const SeasonStanding: Story = {
  args: { cycle: AUTUMN_PLANTING },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Autumn Planting 2026" }));
    await expect(sheet.getByRole("heading", { name: "Where its promises stand" })).toBeVisible();
    await expect(factsOf("CyclePromiseStanding")).toEqual([
      ["Open to take up", "2"],
      ["In progress", "3"],
      ["Waiting to be confirmed", "1"],
      ["Kept so far", "3 of 7 kept"],
      ["Withdrawn or lapsed", "1"],
    ]);
    await expect(sheet.getByRole("heading", { name: "What it adds up to" })).toBeVisible();
    await expect(factsOf("CycleUnits")).toEqual([
      ["mornings", "5 of 7"],
      ["sessions", "1 of 2"],
    ]);
  },
};

/** A season, or a campaign with no brief, keeps the details as they were. */
export const SeasonWithoutBrief: Story = {
  args: { cycle: AUTUMN_PLANTING },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Autumn Planting 2026" }));
    await expect(sheet.queryByRole("heading", { name: "How the brief works" })).toBeNull();
    await expect(sheet.getByText("Open")).toBeVisible();
  },
};

/**
 * A season past its end that no steward has closed (DL-162): still Open on chain, it reads Ended,
 * says on which day, and that a steward still needs to close it. Its counts stay as they are.
 */
const ENDED_SEASON = {
  ...AUTUMN_PLANTING,
  startTime: BigInt(daysAgo(60)),
  endTime: BigInt(daysAgo(26)),
};

export const SeasonEnded: Story = {
  args: { cycle: ENDED_SEASON },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Autumn Planting 2026" }));
    await expect(sheet.getByText("Ended")).toBeVisible();
    await expect(
      sheet.getByText(/^Ended \w+ \d+\. A steward still needs to close it\. Promises made/)
    ).toBeVisible();
    await expect(sheet.getByText("3 of 7 kept")).toBeVisible();
  },
};

export const SeasonEndedSpanish: Story = {
  args: { cycle: ENDED_SEASON },
  parameters: { locale: "es" },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Autumn Planting 2026" }));
    await expect(sheet.getByText("Terminada")).toBeVisible();
    await expect(
      sheet.getByText(/^Terminó el .+\. Un responsable aún tiene que cerrarla\. Las promesas/)
    ).toBeVisible();
  },
};

export const SeasonEndedPortuguese: Story = {
  args: { cycle: ENDED_SEASON },
  parameters: { locale: "pt" },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Autumn Planting 2026" }));
    await expect(sheet.getByText("Terminada")).toBeVisible();
    await expect(
      sheet.getByText(/^Terminou em .+\. Um responsável ainda precisa encerrá-la\. As promessas/)
    ).toBeVisible();
  },
};
