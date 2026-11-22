import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, within } from "storybook/test";
import { STORYBOOK_PRIMARY_ADMIN_GARDEN } from "../../../../../shared/.storybook/adminFixtures";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  STORY_CALENDAR_WORKS,
  storyBusyDay,
  storyWorkCalendar,
} from "../../../../../shared/.storybook/workCalendarFixtures";
import { WorkDayDialog } from "./WorkDayDialog";

const meta = {
  title: "Admin/Workflows/Garden/WorkDayDialog",
  component: WorkDayDialog,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter()],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "One calendar day's work, opened from the Activity calendar: a dialog on desktop and a bottom sheet on a phone. A row opens its record in Review, and View in Work opens Review's list for the same garden and day.",
      },
    },
  },
  args: {
    gardenId: STORYBOOK_PRIMARY_ADMIN_GARDEN.id,
    calendar: storyWorkCalendar(STORY_CALENDAR_WORKS, {}, storyBusyDay()),
  },
} satisfies Meta<typeof WorkDayDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BusyDay: Story = {
  tags: ["storybook-ci"],
  play: async ({ args }) => {
    const dialog = await screen.findByRole("dialog");
    // The dialog says what the calendar counted for the day, and lists exactly that work.
    await expect(
      within(dialog).getByText("3 submissions: 1 approved, 2 pending")
    ).toBeInTheDocument();
    const list = within(dialog).getByRole("list", { name: "Work submitted this day" });
    await expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    await expect(within(dialog).getByRole("button", { name: "View in Work" })).toBeEnabled();
    await userEvent.keyboard("{Escape}");
    await expect(args.calendar.handleCloseDay).toHaveBeenCalled();
  },
};
