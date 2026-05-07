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
import { DEFAULT_CHAIN_ID, queryKeys } from "@green-goods/shared";
import { CampaignCookieJarPanel } from "./CampaignCookieJarPanel";

const EMPTY_CAMPAIGN_PANEL_SEEDS = [
  ...STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  [queryKeys.cookieJar.campaigns(DEFAULT_CHAIN_ID), []] as const,
] as const;

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
    withSeededQueryClient(EMPTY_CAMPAIGN_PANEL_SEEDS),
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
