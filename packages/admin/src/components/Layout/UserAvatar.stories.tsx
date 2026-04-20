import { RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

interface MockUserAvatarProps {
  role: "deployer" | "operator" | "user";
  onOpenProfile: () => void;
}

function MockUserAvatar({ role, onOpenProfile }: MockUserAvatarProps) {
  return (
    <button
      type="button"
      onClick={onOpenProfile}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/65 bg-bg-white/70 text-text-sub shadow-[var(--edge-rest)] transition-colors hover:bg-primary-alpha-10 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
      aria-label={`Open ${role} profile`}
    >
      <RiUserLine className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

const meta: Meta<typeof MockUserAvatar> = {
  title: "Admin/Layout/UserAvatar",
  component: MockUserAvatar,
  tags: ["autodocs"],
  args: {
    role: "operator",
    onOpenProfile: fn(),
  },
  argTypes: {
    role: {
      control: "select",
      options: ["deployer", "operator", "user"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MockUserAvatar>;

export const Operator: Story = {};

export const Deployer: Story = {
  args: {
    role: "deployer",
  },
};
