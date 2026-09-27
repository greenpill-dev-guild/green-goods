import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_GARDENS } from "../../../../../../shared/.storybook/adminFixtures";
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
    gardensByAddress: new Map(
      STORYBOOK_ADMIN_GARDENS.map((garden) => [garden.id.toLowerCase(), garden])
    ),
    onSelect: () => undefined,
  },
};
