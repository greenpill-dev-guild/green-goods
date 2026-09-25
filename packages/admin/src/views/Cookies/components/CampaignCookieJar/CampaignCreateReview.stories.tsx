import type { Meta, StoryObj } from "@storybook/react";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignCreateReview } from "./CampaignCreateReview";

const meta: Meta<typeof CampaignCreateReview> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/CreateReview",
  component: CampaignCreateReview,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCreateReview>;

export const Default: Story = {
  render: () => <CampaignCreateReview {...campaignCookieJarCreateFormProps} />,
};
