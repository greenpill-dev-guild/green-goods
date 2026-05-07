import type { Meta, StoryObj } from "@storybook/react";
import {
  STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../../shared/.storybook/decorators";
import { CampaignCookieJarPanel } from "./CampaignCookieJarPanel";

const meta: Meta<typeof CampaignCookieJarPanel> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJarPanel",
  component: CampaignCookieJarPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Internal campaign Cookie Jar creation and allowlist refresh surface. The story renders inside the team Cookies workspace frame with seeded admin identity.",
      },
    },
  },
  decorators: [
    withAdminIdentityRole("deployer"),
    withSeededQueryClient(STORYBOOK_ADMIN_DEPLOYER_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarPanel>;

export const Default: Story = {};
