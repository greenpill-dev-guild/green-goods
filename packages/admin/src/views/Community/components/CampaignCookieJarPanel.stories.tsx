import type { Meta, StoryObj } from "@storybook/react";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../../shared/.storybook/decorators";
import { CampaignCookieJarPanel } from "./CampaignCookieJarPanel";

const meta: Meta<typeof CampaignCookieJarPanel> = {
  title: "Admin/Workspaces/Community/CampaignCookieJarPanel",
  component: CampaignCookieJarPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Internal campaign Cookie Jar creation and allowlist refresh surface. The story renders inside the Community workspace frame with seeded admin identity.",
      },
    },
  },
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "community",
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarPanel>;

export const Default: Story = {};
