import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import { ToastStatusIcon } from "./ToastStatusIcon";

/**
 * The status icon a toast shows on its title's line (D23), in the status
 * tokens so it follows the theme. The words carry the status, so the icon is
 * hidden from assistive technology.
 */
const meta: Meta<typeof ToastStatusIcon> = {
  title: "Shared/Feedback/ToastStatusIcon",
  component: ToastStatusIcon,
  tags: ["autodocs", "storybook-ci"],
};

export default meta;
type Story = StoryObj<typeof ToastStatusIcon>;

const STATUSES = ["success", "info", "error", "loading"] as const;

/** Every status, beside the word a toast would put next to it. */
export const AllStatuses: Story = {
  render: () => (
    <ul className="flex flex-col gap-3 text-sm text-text-strong-950">
      {STATUSES.map((status) => (
        <li key={status} className="flex items-center gap-2">
          <ToastStatusIcon status={status} />
          <span>{status}</span>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const icons = canvasElement.querySelectorAll("svg");
    await expect(icons).toHaveLength(STATUSES.length);
    for (const icon of icons) await expect(icon).toHaveAttribute("aria-hidden", "true");
    // Only the loading icon moves.
    await expect(within(canvasElement).getByText("loading").previousElementSibling).toHaveClass(
      "animate-spin"
    );
  },
};
