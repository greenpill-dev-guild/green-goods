import type { Meta, StoryObj } from "@storybook/react";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignCookieJarCreateForm } from "./CampaignCookieJarCreateForm";

const meta: Meta<typeof CampaignCookieJarCreateForm> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/CreateForm",
  component: CampaignCookieJarCreateForm,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarCreateForm>;

export const Default: Story = {
  render: () => <CampaignCookieJarCreateForm {...campaignCookieJarCreateFormProps} />,
};
