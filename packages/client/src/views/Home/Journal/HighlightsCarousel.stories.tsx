import { useGardenOpenCycles } from "@green-goods/shared/hooks/garden/useGardenJournal";
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
} from "../../../../../shared/.storybook/homeJournalFixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { HighlightsCarousel } from "./HighlightsCarousel";

/** Every story reads the garden's open cycles through this one hook. */
const withCycles =
  (cycles: ReturnType<typeof openCyclesFixture> = openCyclesFixture()) =>
  () => {
    mocked(useGardenOpenCycles).mockReturnValue(cycles);
    return resetHookMocks(useGardenOpenCycles);
  };

/**
 * What's Open at the top of Home's journal (DL-127, DL-133): the garden's open season and
 * campaigns as 280×112 cards in one row with the next one peeking, each opening its details
 * sheet. One open cycle is one card across the row; with none the section is absent. Work and
 * asks keep to Recent Activity and Take Part. Fictional data from the client journeys.
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

/** The season and the campaign, one size each, the next card peeking inside the phone. */
export const Default: Story = {
  tags: ["storybook-ci"],
  beforeEach: withCycles(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "What's Open" })).toBeVisible();
    const cards = within(canvas.getByRole("list")).getAllByRole("button");
    await expect(cards.map((card) => card.dataset.highlight)).toEqual(["cycle", "cycle"]);
    // Every card keeps the one frame, so none changes the row's height.
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
  beforeEach: withCycles(),
  render: (args) => (
    <JournalPhone width={360}>
      <HighlightsCarousel {...args} />
    </JournalPhone>
  ),
};

/** English, Spanish and Portuguese at 390 and 360px. */
export const Locales: Story = {
  beforeEach: withCycles(),
  render: (args) => <JournalLocales render={() => <HighlightsCarousel {...args} />} />,
};

/** One open cycle: one card across the row, not a one-card carousel (DL-133). */
export const OneSeason: Story = {
  tags: ["storybook-ci"],
  beforeEach: withCycles(
    openCyclesFixture({ status: "ready", items: JOURNAL_CYCLES.slice(0, 1), savedAt: null })
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list");
    const [card] = within(list).getAllByRole("button");
    await expect(within(list).getAllByRole("button")).toHaveLength(1);
    // The card fills the list's width inside the phone's 16px gutters.
    await expect(Math.round(card!.getBoundingClientRect().width)).toBe(
      Math.round(list.getBoundingClientRect().width) - 32
    );
    await expect(Math.round(card!.getBoundingClientRect().height)).toBe(112);
  },
};

/** No open season or campaign: the section is absent. */
export const NoCycles: Story = {
  beforeEach: withCycles(openCyclesFixture({ status: "empty" })),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-component='HighlightsCarousel']")).toBeNull();
  },
};
