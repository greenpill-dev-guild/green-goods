import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { NotificationsIcon } from "./Icon";

/**
 * Home's bell (DL-130): the last launcher in the header, a compact outlined icon button like
 * the ones before it. Its badge is the shared 16px count badge and counts only the garden's
 * events this device has not shown yet; it never carries a standing count.
 */
const meta: Meta<typeof NotificationsIcon> = {
  title: "Client/PWA/Home/NotificationsIcon",
  component: NotificationsIcon,
  args: { onClick: fn() },
};

export default meta;
type Story = StoryObj<typeof NotificationsIcon>;

/** Three events not shown yet: the badge counts them and the name says so. */
export const ThreeNew: Story = {
  tags: ["storybook-ci"],
  args: { newCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bell = canvas.getByRole("button", { name: "Notifications, 3 new" });
    await expect(bell.getBoundingClientRect().height).toBeCloseTo(32, 0);
    const badge = canvas.getByTestId("notifications-badge");
    await expect(badge).toHaveTextContent("3");
    await expect(badge.getBoundingClientRect().height).toBeCloseTo(16, 0);
  },
};

/** Everything seen: no badge, whatever the garden's history holds. */
export const NothingNew: Story = {
  args: { newCount: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Notifications" })).toBeVisible();
    await expect(canvas.queryByTestId("notifications-badge")).toBeNull();
  },
};

/** No garden to list events for: the bell keeps its place and does nothing. */
export const NoGarden: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Notifications" })
    ).toBeDisabled();
  },
};
