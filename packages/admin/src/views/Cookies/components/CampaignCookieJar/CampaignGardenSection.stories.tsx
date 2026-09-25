import type { Meta, StoryObj } from "@storybook/react";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignGardenSection } from "./CampaignGardenSection";

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
