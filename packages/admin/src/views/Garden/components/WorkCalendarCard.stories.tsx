import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  STORY_CALENDAR_WORKS,
  storyCutCalendar,
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
  args: { calendar: storyCutCalendar() },
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    // Days after the cut say they were not read, never 0, and the day it stopped in is a minimum.
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("button", { name: /not read/ }).length).toBeGreaterThan(0);
    await expect(
      canvas.getAllByRole("button", { name: /at least 2 submissions/ }).length
    ).toBeGreaterThan(0);
  },
};

export const RefreshFailed: Story = {
  args: { calendar: storyWorkCalendar(STORY_CALENDAR_WORKS, { refreshFailed: true }) },
  tags: ["storybook-ci"],
  play: async ({ args, canvasElement }) => {
    // The last grid stays, and the card says the refresh failed and offers a retry.
    const canvas = within(canvasElement);
    await expect(canvas.getByText("This month could not be refreshed")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Try Again" }));
    await expect(args.calendar.retry).toHaveBeenCalledTimes(1);
    await expect(
      canvas.getAllByRole("button", { name: /3 submissions: 1 approved, 2 pending/ }).length
    ).toBeGreaterThan(0);
  },
};
