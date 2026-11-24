import type { Meta, StoryObj } from "@storybook/react";
import {
  campaignCookieJarStoryDecorators,
  storybookCampaign,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignJarListRow } from "./CampaignJarListRow";

const meta: Meta<typeof CampaignJarListRow> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/ListRow",
  component: CampaignJarListRow,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignJarListRow>;

export const Default: Story = {
  args: {
    campaign: storybookCampaign,
    onSelect: () => undefined,
  },
};
