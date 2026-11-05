import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { BatchHoldAlert } from "./BatchHoldAlert";

const meta: Meta<typeof BatchHoldAlert> = {
  title: "Admin/Workflows/Garden/BatchHoldAlert",
  component: BatchHoldAlert,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "What a dialog shows when nobody can say yet whether its last send landed. What it sent stays locked until the person checks again and it has landed, or they choose to move on. Edit Garden and Add Members each bring their own words and show what the chain holds.",
      },
    },
  },
  args: {
    title: "We couldn’t confirm the last people you added.",
    body: "They could still be added, so they stay locked until you check again or move on.",
    hasUnreadValues: false,
    isSettling: false,
    isSaving: false,
    onCheckAgain: fn(),
    onMoveOn: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof BatchHoldAlert>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Check Again" }));
    await expect(args.onCheckAgain).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole("button", { name: "Move On" }));
    await expect(args.onMoveOn).toHaveBeenCalledTimes(1);
  },
};

/** Moving on waits until every value has been seen. */
export const SomeValuesUnread: Story = {
  args: { hasUnreadValues: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Some values couldn’t be read just now. Check again to move on.")
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Move On" })).toBeDisabled();
  },
};

/** Another send is in flight, and settling waits for it. */
export const WhileSending: Story = {
  args: { isSaving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Check Again" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Move On" })).toBeDisabled();
  },
};
