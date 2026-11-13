import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { REPORTING_LAB_MEDIA } from "../../../../shared/.storybook/reportingLabFixtures";
import { GardenActivityScene } from "./GardenActivityScene";
import { buildScenario } from "./scenarios";

const backlog = buildScenario("compost-backlog");

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Walkthrough/Garden Activity",
  component: GardenActivityScene,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Proposed, Storybook only: Garden's Activity tab with the month calendar above its Activity Feed. The tab's split, feed card, chips, day headings, rows, alerts and Key Metrics follow the shipped tab; a day opens its work in a dialog and stays marked while it is open, Places beneath it maps the month's sites with a No location row, and a feed row opens its work the same way. Sample data: Riverbend Compost Collective with a growing backlog, fixed at Jan 16, 2026.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-0", heightClassName: "h-screen" }),
  ],
  args: { dataset: backlog, media: REPORTING_LAB_MEDIA },
} satisfies Meta<typeof GardenActivityScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** January in the calendar, and the feed's recent work beneath it. */
export const Month: Story = {};

/** Jan 3 opened: its four Ward 4 cleanups in a dialog over the calendar. */
export const DayChosen: Story = { args: { day: "2026-01-03" } };

/** A cleanup from Jan 3 opened: performed Jan 2, sent late, waiting thirteen days. */
export const WorkOpen: Story = { args: { day: "2026-01-03", openId: "riverbend-2026-01-03-2" } };

/** A day opens its work in a dialog and stays marked; closing it returns focus to the day. */
export const ChooseADay: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const day = await canvas.findByRole("button", { name: /^Saturday, January 3:/ });
    day.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      await within(document.body).findByRole("dialog", { name: "Saturday, January 3" })
    ).toBeInTheDocument();
    await expect(day).toHaveAttribute("aria-current", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(day).toHaveFocus(), { timeout: 3000 });
  },
};
