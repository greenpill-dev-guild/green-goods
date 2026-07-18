import type { Meta, StoryObj } from "@storybook/react";
import { CampaignAdvancedSection } from "./CampaignAdvancedSection";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignAdvancedSection> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/AdvancedSection",
  component: CampaignAdvancedSection,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignAdvancedSection>;

export const Default: Story = {
  render: () => <CampaignAdvancedSection {...campaignCookieJarCreateFormProps} advancedOpen />,
};
