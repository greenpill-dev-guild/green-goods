import type { Meta, StoryObj } from "@storybook/react";
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
