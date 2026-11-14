import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { buildCalendar } from "./aggregate";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { buildScenario } from "./scenarios";

const compost = buildScenario("compost");
const partial = buildScenario("partial");

function weeksFor(dataset: typeof compost, month: string) {
  return buildCalendar({
    dataset,
    records: dataset.records,
    month,
    groupBy: "submitted",
    at: dataset.reference,
    status: "all",
  }).weeks;
}

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/CalendarMonthGrid",
  component: CalendarMonthGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proposed primitive: one tab stop for the month; the arrow keys move by day and week, Home and End to the week's ends. Each day is AdminListRow's button. Below a 34rem container the month becomes an agenda, newest day first.",
      },
    },
  },
  decorators: [withCanvasFrame({ workspace: "garden", className: "p-4" })],
  args: {
    weeks: weeksFor(compost, "2026-01"),
    noun: "submission",
    locale: "en",
    monthLabel: "January 2026",
    onOpenDay: fn(),
  },
} satisfies Meta<typeof CalendarMonthGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Month: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const today = canvas.getByRole("button", { name: /^Friday, January 16, today/ });
    await expect(today).toHaveAttribute("tabindex", "0");
    today.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByRole("button", { name: /^Thursday, January 15/ })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpenDay).toHaveBeenCalled();
  },
};

export const NotLoadedDays: Story = { args: { weeks: weeksFor(partial, "2026-01") } };

export const Agenda: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};
