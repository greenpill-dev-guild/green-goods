import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AddMembersEntryField } from "./AddMembersEntryField";

const meta = {
  title: "Admin/Workflows/Garden/AddMembersEntryField",
  component: AddMembersEntryField,
  tags: ["autodocs"],
  args: {
    value: "",
    onChange: fn(),
    onRoleChange: fn(),
    onPaste: fn(),
    onStage: fn(),
    disabled: false,
    stageDisabled: true,
    invalid: false,
    status: {
      id: "entry-status",
      typed: "",
      isHexAddress: false,
      resolvedAddress: null,
      isEnsName: false,
      isResolvingEns: false,
      check: null,
      selectedRole: "gardener",
    },
  },
} satisfies Meta<typeof AddMembersEntryField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const InvalidEntry: Story = {
  args: { value: "unknown.eth", invalid: true, error: "Could not resolve this ENS name." },
};
