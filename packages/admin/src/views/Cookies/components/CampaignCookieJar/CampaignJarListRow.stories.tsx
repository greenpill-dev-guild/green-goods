import type { Meta, StoryObj } from "@storybook/react";
import { CampaignJarListRow } from "./CampaignJarListRow";
import {
  campaignCookieJarStoryDecorators,
  storybookCampaign,
} from "./CampaignCookieJar.stories.fixtures";
import { STORYBOOK_ADMIN_GARDENS } from "../../../../../../shared/.storybook/adminFixtures";

const meta: Meta<typeof CampaignJarListRow> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/ListRow",
  component: CampaignJarListRow,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignJarListRow>;

export const Default: Story = {
  args: {
    campaign: storybookCampaign,
    gardensByAddress: new Map(
      STORYBOOK_ADMIN_GARDENS.map((garden) => [garden.id.toLowerCase(), garden])
    ),
    onSelect: () => undefined,
  },
};
