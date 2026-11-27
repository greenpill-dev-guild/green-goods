import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import {
  storyCutCalendar,
  storyDayKey,
  storyWorkCalendar,
} from "../../../../../shared/.storybook/workCalendarFixtures";
import { WorkCalendarGrid } from "./WorkCalendarGrid";

const meta = {
  title: "Admin/Workflows/Garden/WorkCalendarGrid",
  component: WorkCalendarGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The calendar's days. From a 34rem container it is a seven-column grid with one tab stop, moved through with the arrow keys; narrower, it is a list of the days that hold work, newest first, with quiet runs said once.",
      },
    },
  },
  args: { calendar: storyWorkCalendar(), monthLabel: "January 2026" },
} satisfies Meta<typeof WorkCalendarGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grid: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const grid = within(canvasElement).getByRole("grid", { name: "January 2026, by day" });
    const days = within(grid).getAllByRole("button");
    // One tab stop for the whole month; the arrows move it a day or a week at a time.
    await expect(days.filter((day) => day.tabIndex === 0)).toHaveLength(1);
    const start = days.find((day) => day.tabIndex === 0) as HTMLElement;
    start.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(document.activeElement).toBe(days[days.indexOf(start) - 1]);
    await userEvent.keyboard("{ArrowUp}");
    await expect(document.activeElement).toBe(days[days.indexOf(start) - 8]);
  },
};

/** The same month in a phone-width column: a list of days, newest first. */
export const DayList: Story = {
  decorators: [
    (Story) => (
      <div className="w-[21rem]">
        <Story />
      </div>
    ),
  ],
};

/**
 * A month cut four days back, at phone width: each day the read never reached is a row of its
 * own that opens its dialog, as the grid's day does, so a phone can reach View in Work.
 */
export const CutDayList: Story = {
  tags: ["storybook-ci"],
  args: { calendar: storyCutCalendar() },
  decorators: DayList.decorators,
  play: async ({ args, canvasElement }) => {
    const list = within(canvasElement).getByRole("list", {
      name: "January 2026, newest day first",
    });
    const unread = within(list).getAllByRole("button", { name: /: not read$/ });
    await expect(unread.length).toBeGreaterThan(0);
    await userEvent.click(unread[unread.length - 1]);
    await expect(args.calendar.handleOpenDay).toHaveBeenCalledWith(storyDayKey(3));
  },
};
