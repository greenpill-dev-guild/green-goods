import type { Meta, StoryObj } from "@storybook/react";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import {
  withAdminIdentity,
  withSeededQueryClient,
} from "../../../../../shared/.storybook/decorators";
import { CommunityJoinRequests } from "./CommunityJoinRequests";

const meta = {
  title: "Admin/Workflows/Community/Join Requests",
  component: CommunityJoinRequests,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient([[queryKeys.gardenJoinRequests.availability(), { enabled: true }]]),
  ],
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
