import type { Meta, StoryObj } from "@storybook/react";
import { CampaignDetailsSection } from "./CampaignDetailsSection";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignDetailsSection> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/DetailsSection",
  component: CampaignDetailsSection,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignDetailsSection>;

export const Default: Story = {
  render: () => <CampaignDetailsSection {...campaignCookieJarCreateFormProps} />,
};
