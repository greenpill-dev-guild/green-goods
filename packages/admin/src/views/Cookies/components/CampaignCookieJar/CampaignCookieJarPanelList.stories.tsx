import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_GARDENS } from "../../../../../../shared/.storybook/adminFixtures";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
  storybookCampaign,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignCookieJarPanelList } from "./CampaignCookieJarPanelList";

const meta: Meta<typeof CampaignCookieJarPanelList> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/PanelList",
  component: CampaignCookieJarPanelList,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarPanelList>;

export const Default: Story = {
  args: {
    formatMessage: campaignCookieJarCreateFormProps.formatMessage,
    campaigns: [storybookCampaign],
    campaignsLoading: false,
    campaignsError: null,
    campaignSearch: "",
    setCampaignSearch: () => undefined,
    visibleCampaigns: [storybookCampaign],
    gardensByAddress: new Map(
      STORYBOOK_ADMIN_GARDENS.map((garden) => [garden.id.toLowerCase(), garden])
    ),
    onSelectCampaign: () => undefined,
  },
};

export const Empty: Story = {
  args: {
    ...Default.args,
    campaigns: [],
    visibleCampaigns: [],
  },
};
