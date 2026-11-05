import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ActionMenu } from "./ActionMenu";
const meta = {
  title: "Shared/ActionMenu",
  component: ActionMenu,
  tags: ["autodocs"],
  args: {
    label: "Garden Actions",
    actions: [{ label: "Leave Garden", danger: true, onSelect: fn() }],
  },
} satisfies Meta<typeof ActionMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = {
  args: { actions: [{ label: "Leave Garden", danger: true, disabled: true, onSelect: fn() }] },
};
export const MultipleActions: Story = {
  args: {
    actions: [
      { label: "Share Garden", onSelect: fn() },
      { label: "Leave Garden", danger: true, onSelect: fn() },
    ],
  },
};
