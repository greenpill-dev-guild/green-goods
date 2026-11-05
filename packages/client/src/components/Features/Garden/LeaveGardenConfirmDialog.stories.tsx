import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { LeaveGardenConfirmDialog } from "./LeaveGardenConfirmDialog";
const meta = {
  title: "Client/Sheets/LeaveGardenConfirmDialog",
  component: LeaveGardenConfirmDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    gardenName: "Test Community Garden",
    isOwner: false,
    checking: false,
    checkFailed: false,
    availability: "available",
    isLeaving: false,
    failure: null,
    onClose: fn(),
    onConfirm: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof LeaveGardenConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Owner: Story = { args: { isOwner: true } };
export const Leaving: Story = { args: { isLeaving: true } };
export const CheckFailed: Story = { args: { checking: true, checkFailed: true } };
export const Error: Story = {
  args: {
    failure:
      "We could not confirm that you left. Check your connection and the garden before trying again.",
  },
};

export const Unavailable: Story = { args: { availability: "unavailable", checkFailed: true } };
export const AvailabilityUnknown: Story = { args: { availability: "unknown", checkFailed: true } };

export const Recovery: Story = { args: { recovery: true, availability: "unknown" } };
