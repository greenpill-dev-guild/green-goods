import type { Meta, StoryObj } from "@storybook/react";
import { CampaignGardenSection } from "./CampaignGardenSection";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignGardenSection> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/GardenSection",
  component: CampaignGardenSection,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignGardenSection>;

export const Default: Story = {
  render: () => <CampaignGardenSection {...campaignCookieJarCreateFormProps} />,
};
