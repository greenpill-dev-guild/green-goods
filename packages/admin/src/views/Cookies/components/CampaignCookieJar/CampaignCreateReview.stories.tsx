import type { Meta, StoryObj } from "@storybook/react";
import { CampaignCreateReview } from "./CampaignCreateReview";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignCreateReview> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/CreateReview",
  component: CampaignCreateReview,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCreateReview>;

export const Default: Story = {
  render: () => <CampaignCreateReview {...campaignCookieJarCreateFormProps} />,
};
