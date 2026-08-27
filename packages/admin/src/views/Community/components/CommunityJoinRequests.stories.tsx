import type { Meta, StoryObj } from "@storybook/react";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { CommunityJoinRequests } from "./CommunityJoinRequests";

const meta = {
  title: "Admin/Workflows/Community/Join Requests",
  component: CommunityJoinRequests,
  tags: ["autodocs"],
  decorators: [withAdminIdentity],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Steward review queue for pending garden membership requests. Loading is explicit so opening the members workspace never triggers a signature prompt.",
      },
    },
  },
  args: {
    gardenAddress: "0x1111111111111111111111111111111111111111",
  },
} satisfies Meta<typeof CommunityJoinRequests>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToCheck: Story = {};
