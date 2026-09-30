import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import {
  AUTUMN_PLANTING,
  JOURNEY_CYCLE_NAMES,
  JOURNEY_CYCLES,
} from "../../../../../../shared/.storybook/clientJourneyFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { CycleRail } from "./CycleRail";

/**
 * The seasons and campaigns a pool is running, as a horizontal rail. Seasons are
 * amber and campaigns sky, each with its glyph, its kind in that colour and a
 * 12px state pill. Tapping a card shows only its promises; its ⓘ opens the
 * details. Each card's counts are its own: a season and a campaign are never summed.
 */
const meta: Meta<typeof CycleRail> = {
  title: "Client/Commitments/CycleRail",
  component: CycleRail,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  parameters: { layout: "fullscreen" },
  decorators: [withSeededQueryClient(JOURNEY_CYCLE_NAMES)],
  args: {
    cycles: JOURNEY_CYCLES,
    selectedCycleId: null,
    onSelect: fn(),
    onShowDetails: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CycleRail>;

export const SeasonAndCampaign: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Autumn Planting 2026")).toBeVisible();
    await expect(canvas.getByText("Seed Swap Weekend")).toBeVisible();
    // The state pill is the 12px pill, the size of the kind word beside it.
    const pill = canvas.getAllByRole("status")[0];
    await expect(pill.getBoundingClientRect().height).toBe(22);
    await expect(getComputedStyle(pill).fontSize).toBe("12px");
    canvas.getByRole("button", { name: "About Autumn Planting 2026" }).click();
    await expect(args.onShowDetails).toHaveBeenCalledWith(AUTUMN_PLANTING);
  },
};

/** One season is one card at full width, with no rail to scroll. */
export const OneSeason: Story = {
  args: { cycles: [AUTUMN_PLANTING] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("group", { name: "Seasons and campaigns" })).toBeNull();
    await expect(canvas.getByRole("button", { name: "About Autumn Planting 2026" })).toBeVisible();
  },
};

/** Tapped, a card turns green with a check; tapping it again shows every promise. */
export const SeasonSelected: Story = {
  args: { selectedCycleId: AUTUMN_PLANTING.cycleId },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const pressed = canvas.getByRole("button", {
      name: "Showing Autumn Planting 2026. Show all promises",
    });
    await expect(pressed).toHaveAttribute("aria-pressed", "true");
    pressed.click();
    await expect(args.onSelect).toHaveBeenCalledWith(null);
  },
};

export const UnnamedCycle: Story = {
  args: { cycles: [{ ...AUTUMN_PLANTING, metadataCID: null }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Show promises in Season" })).toBeVisible();
  },
};

/** An empty rail draws nothing at all; the tab has no gap to explain. */
export const NoCycles: Story = {
  args: { cycles: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("group")).not.toBeInTheDocument();
  },
};
