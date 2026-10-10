import type { Meta, StoryObj } from "@storybook/react";
import { campaignCookieJarStoryDecorators } from "./CampaignCookieJar.stories.fixtures";
import { CampaignImageInput } from "./CampaignImageInput";

const meta: Meta<typeof CampaignImageInput> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/ImageInput",
  component: CampaignImageInput,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignImageInput>;

export const Empty: Story = {
  args: {
    value: "",
    onChange: () => undefined,
    file: null,
    onFileChange: () => undefined,
    source: "campaign-cookie-jar-story",
  },
};
