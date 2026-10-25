import {
  useGardenOpenCycles,
  useGardenOpenPromises,
  useGardenRecentActivity,
} from "@green-goods/shared/hooks/garden/useGardenJournal";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, within } from "storybook/test";
import { withRouter, withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import {
  JOURNAL_CYCLES,
  JOURNEY_CYCLE_NAMES,
  JOURNEY_GARDEN,
  JournalLocales,
  JournalPhone,
  openCyclesFixture,
  openPromisesFixture,
  recentActivityFixture,
} from "../../../../../shared/.storybook/homeJournalFixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { HighlightsCarousel } from "./HighlightsCarousel";

type Reads = {
  cycles?: ReturnType<typeof openCyclesFixture>;
  activity?: ReturnType<typeof recentActivityFixture>;
  promises?: ReturnType<typeof openPromisesFixture>;
};

/** Every story reads the journal through these three hooks, so each sets all three. */
const withReads =
  ({ cycles, activity, promises }: Reads = {}) =>
  () => {
    mocked(useGardenOpenCycles).mockReturnValue(cycles ?? openCyclesFixture());
    mocked(useGardenRecentActivity).mockReturnValue(activity ?? recentActivityFixture());
    mocked(useGardenOpenPromises).mockReturnValue(promises ?? openPromisesFixture());
    return resetHookMocks(useGardenOpenCycles, useGardenRecentActivity, useGardenOpenPromises);
  };

/**
 * The Highlights carousel at the top of Home's journal (DL-127): one row of equal 280×112 cards
 * with the next one peeking. The garden's open season and campaign lead, each opening its
 * details sheet, then its newest work with a photo and the newest ask open to take up. A read
 * still loading or one that failed adds no card, and with no card the carousel is absent.
 * Fictional data from the client journeys.
 */
const meta: Meta<typeof HighlightsCarousel> = {
  title: "Client/Home/HighlightsCarousel",
  component: HighlightsCarousel,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { gardenId: JOURNEY_GARDEN },
  decorators: [withSeededQueryClient(JOURNEY_CYCLE_NAMES), withRouter(["/home"])],
  render: (args) => (
    <JournalPhone width={390}>
      <HighlightsCarousel {...args} />
    </JournalPhone>
  ),
};

export default meta;
type Story = StoryObj<typeof HighlightsCarousel>;

/** The season and the campaign first, then the newest work and the open ask, all one size. */
export const Default: Story = {
  tags: ["storybook-ci"],
  beforeEach: withReads(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "Highlights" })).toBeVisible();
    const cards = within(canvas.getByRole("list")).getAllByRole("button");
    await expect(cards.map((card) => card.dataset.highlight)).toEqual([
      "cycle",
      "cycle",
      "work",
      "ask",
    ]);
    // Every card keeps the one frame, whatever it holds, so none changes the row's height.
    for (const card of cards) {
      const box = card.getBoundingClientRect();
      await expect(Math.round(box.width)).toBe(280);
      await expect(Math.round(box.height)).toBe(112);
    }
    // The next card peeks inside the 390px phone, so the row reads as swipeable.
    await expect(cards[1]!.getBoundingClientRect().left).toBeLessThan(390);
    await expect(cards[0]).toHaveTextContent("36 days left");
  },
};

/** The narrow phone: the same cards, with less of the next one showing. */
export const Narrow: Story = {
  beforeEach: withReads(),
  render: (args) => (
    <JournalPhone width={360}>
      <HighlightsCarousel {...args} />
    </JournalPhone>
  ),
};

/** English, Spanish and Portuguese at 390 and 360px. */
export const Locales: Story = {
  beforeEach: withReads(),
  render: (args) => <JournalLocales render={() => <HighlightsCarousel {...args} />} />,
};

/** A garden with no open season or campaign: the newest work and the open ask only. */
export const WithoutSeasons: Story = {
  beforeEach: withReads({ cycles: openCyclesFixture({ status: "empty" }) }),
  render: (args) => <JournalLocales render={() => <HighlightsCarousel {...args} />} />,
};

/** No season, no work with a photo and no open ask: the carousel is absent. */
export const NoCards: Story = {
  beforeEach: withReads({
    cycles: openCyclesFixture({ status: "empty" }),
    activity: recentActivityFixture({ status: "empty" }),
    promises: openPromisesFixture({ status: "empty" }),
  }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-component='HighlightsCarousel']")).toBeNull();
  },
};

/** One cycle only, still at the one card size. */
export const OneSeason: Story = {
  beforeEach: withReads({
    cycles: openCyclesFixture({
      status: "ready",
      items: JOURNAL_CYCLES.slice(0, 1),
      savedAt: null,
    }),
    activity: recentActivityFixture({ status: "empty" }),
    promises: openPromisesFixture({ status: "empty" }),
  }),
};
