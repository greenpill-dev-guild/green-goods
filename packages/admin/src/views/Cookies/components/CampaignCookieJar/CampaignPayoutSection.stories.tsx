import type { Meta, StoryObj } from "@storybook/react";
import { CampaignPayoutSection } from "./CampaignPayoutSection";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignPayoutSection> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/PayoutSection",
  component: CampaignPayoutSection,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignPayoutSection>;

export const Default: Story = {
  render: () => <CampaignPayoutSection {...campaignCookieJarCreateFormProps} />,
};
