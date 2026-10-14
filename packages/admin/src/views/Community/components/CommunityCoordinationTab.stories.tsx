import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  CommunityCoordinationTab,
  type CommunityCoordinationTabProps,
} from "./CommunityCoordinationTab";
import { STORY_GARDEN_ID, storyGarden, storyPools } from "./communityStoryFixtures";

const meta = {
  title: "Admin/Workflows/Community/Coordination",
  component: CommunityCoordinationTab,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/community/coordination"])],
  parameters: { layout: "padded" },
  args: {
    garden: storyGarden,
    gardenId: STORY_GARDEN_ID,
    canManage: true,
    community: { weightScheme: 0 } as CommunityCoordinationTabProps["community"],
    pools: storyPools,
    createPools: fn(),
    isCreatingPools: false,
  },
} satisfies Meta<typeof CommunityCoordinationTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};
export const NeedsPools: Story = { args: { pools: [] } };
