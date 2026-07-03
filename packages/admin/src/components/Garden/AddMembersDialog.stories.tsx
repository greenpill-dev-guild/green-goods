import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AddMembersDialog } from "./AddMembersDialog";

const meta: Meta<typeof AddMembersDialog> = {
  title: "Admin/Workflows/Garden/AddMembersDialog",
  component: AddMembersDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Multi-add member dialog: role select + address/ENS input staging into a fixed-height list (the dialog never grows), committed as one batch. Failed writes stay staged for retry. Opens from Manage Members.",
      },
    },
  },
  args: {
    open: true,
    onClose: fn(),
    onAdd: fn(async () => ({ success: true })),
    isLoading: false,
    tone: "community",
  },
};

export default meta;
type Story = StoryObj<typeof AddMembersDialog>;

export const Default: Story = {};

export const HostWriteInFlight: Story = {
  args: {
    isLoading: true,
  },
};
