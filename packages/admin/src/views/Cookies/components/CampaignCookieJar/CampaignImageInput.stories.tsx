import type { Meta, StoryObj } from "@storybook/react";
import { CampaignImageInput } from "./CampaignImageInput";
import { campaignCookieJarStoryDecorators } from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignImageInput> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/ImageInput",
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
