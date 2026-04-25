import { RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import { UserAvatar } from "./UserAvatar";

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

const meta: Meta<typeof UserAvatar> = {
  title: "Admin/Shell/UserAvatar",
  component: UserAvatar,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Real `UserAvatar` rendered with Storybook auth. Role-only static references are marked as visual harnesses.",
      },
    },
  },
  args: {
    onOpenProfile: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

export const Operator: Story = {};

export const Deployer: Story = {
  tags: ["visual-harness"],
  render: () => <MockUserAvatar role="deployer" onOpenProfile={fn()} />,
  parameters: {
    docs: {
      description: {
        story:
          "Visual harness for the deployer aria-label variant. The default story above renders the real avatar.",
      },
    },
  },
};
