import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { PendingPhotoTile } from "./PendingPhotoTile";

/**
 * A HEIC photo picked before its decoder was on the device. Most browsers
 * cannot draw one, so the composer shows this in the photo's place until the
 * photo converts; only a photo that will not decode asks for a choice.
 */
const meta: Meta<typeof PendingPhotoTile> = {
  title: "Client/Work/PendingPhotoTile",
  component: PendingPhotoTile,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  decorators: [
    (Story) => (
      <div className="w-[328px] bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    state: "waiting",
    name: "IMG_2041.HEIC",
    onRetry: fn(),
    onRemove: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof PendingPhotoTile>;

export const Waiting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Photo kept")).toBeVisible();
    await expect(canvas.getByText("It converts when the app is ready.")).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const Converting: Story = {
  args: { state: "converting" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Converting photo...")).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const CouldNotConvert: Story = {
  args: { state: "failed" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("This photo couldn't be converted")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Try Again" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "Remove" }));
    await expect(args.onRemove).toHaveBeenCalledOnce();
  },
};
