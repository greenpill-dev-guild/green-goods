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
  SEED_SWAP,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import {
  withClientAppRuntime,
  withRouter,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
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

/** A season, or a campaign with no brief, keeps the details as they were. */
export const SeasonWithoutBrief: Story = {
  args: { cycle: AUTUMN_PLANTING },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Autumn Planting 2026" }));
    await expect(sheet.queryByRole("heading", { name: "How the brief works" })).toBeNull();
  },
};
