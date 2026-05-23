import { RiShieldCheckLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { MembersModal } from "./MembersModal";

const MEMBERS = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
];

const meta: Meta<typeof MembersModal> = {
  title: "Admin/Workflows/Garden/MembersModal",
  component: MembersModal,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Scrollable member list inside an AdminDialog. Supports optional remove action and six color schemes (info, success, warning, feature, primary, neutral).",
      },
    },
  },
  argTypes: {
    colorScheme: {
      control: "select",
      options: ["info", "success", "warning", "feature", "primary", "neutral"],
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    title: "Operators",
    members: MEMBERS,
    canManage: true,
    onRemove: fn(async () => undefined),
    icon: <RiShieldCheckLine className="h-6 w-6" />,
    colorScheme: "feature",
  },
};

export default meta;
type Story = StoryObj<typeof MembersModal>;

export const WithMembers: Story = {};

export const Empty: Story = {
  args: { members: [] },
};

export const ReadOnly: Story = {
  args: { canManage: false, onRemove: undefined },
};

export const LoadingMutation: Story = {
  args: { isLoading: true },
};

export const PrimaryScheme: Story = {
  args: {
    colorScheme: "primary",
    title: "Owners",
    members: MEMBERS.slice(0, 1),
  },
};
