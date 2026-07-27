import type { Meta, StoryObj } from "@storybook/react";
import { CampaignCookieJarPanelView } from "./CampaignCookieJarPanelView";
import {
  campaignCookieJarPanelViewProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignCookieJarPanelView> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/PanelView",
  component: CampaignCookieJarPanelView,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarPanelView>;

export const Default: Story = {
  args: campaignCookieJarPanelViewProps,
};
