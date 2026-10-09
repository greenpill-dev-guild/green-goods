import type { Meta, StoryObj } from "@storybook/react";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignPayoutSection } from "./CampaignPayoutSection";

const meta: Meta<typeof CampaignPayoutSection> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/PayoutSection",
  component: CampaignPayoutSection,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignPayoutSection>;

export const Default: Story = {
  render: () => <CampaignPayoutSection {...campaignCookieJarCreateFormProps} />,
};
