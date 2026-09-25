import type { Meta, StoryObj } from "@storybook/react";
import { campaignCookieJarStoryDecorators } from "./CampaignCookieJar.stories.fixtures";
import { CampaignCookieJarCreateWorkspace } from "./CampaignCookieJarCreateWorkspace";

const meta: Meta<typeof CampaignCookieJarCreateWorkspace> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/CreateWorkspace",
  component: CampaignCookieJarCreateWorkspace,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarCreateWorkspace>;

export const Default: Story = {
  render: () => <CampaignCookieJarCreateWorkspace onCancel={() => undefined} />,
};
