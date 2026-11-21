import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  STORY_CALENDAR_WORKS,
  storyWorkCalendar,
} from "../../../../../shared/.storybook/workCalendarFixtures";
import { WorkCalendarCard } from "./WorkCalendarCard";

const meta = {
  title: "Admin/Workflows/Garden/WorkCalendarCard",
  component: WorkCalendarCard,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter()],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Garden › Activity's month calendar: every submission of a month on the day it was sent, by the reader's own clock. A day opens its work; below a 34rem container the grid becomes a list of days.",
      },
    },
  },
  args: { calendar: storyWorkCalendar() },
} satisfies Meta<typeof WorkCalendarCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Month: Story = {
  tags: ["storybook-ci"],
  play: async ({ args, canvasElement }) => {
    // The same day opens from the grid and, in a narrow column, from the list of days.
    const canvas = within(canvasElement);
    const busy = canvas.getByRole("button", { name: /3 submissions: 1 approved, 2 pending/ });
    await userEvent.click(busy);
    await expect(args.calendar.handleOpenDay).toHaveBeenCalledTimes(1);
    // Days still to come open nothing: the grid disables them and the list leaves them out.
    for (const later of canvas.queryAllByRole("button", { name: /still to come/ })) {
      await expect(later).toBeDisabled();
    }
  },
};

export const QuietMonth: Story = { args: { calendar: storyWorkCalendar([]) } };

export const EarlierMonth: Story = {
  args: { calendar: storyWorkCalendar(STORY_CALENDAR_WORKS, { isCurrentMonth: false }) },
};

export const Reading: Story = { args: { calendar: storyWorkCalendar([], { state: "loading" }) } };

export const CouldNotBeRead: Story = {
  args: { calendar: storyWorkCalendar([], { state: "error" }) },
};

export const Offline: Story = { args: { calendar: storyWorkCalendar([], { state: "offline" }) } };

export const PartlyRead: Story = {
  args: { calendar: storyWorkCalendar(STORY_CALENDAR_WORKS, { complete: false }) },
};
