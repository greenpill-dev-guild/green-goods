import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import {
  STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../../../shared/.storybook/decorators";
import { fn } from "storybook/test";
import { AdminButton } from "@/components/AdminButton";
import { CampaignCookieJarPanel } from "./index";

const EMPTY_CAMPAIGN_PANEL_SEEDS = [
  ...STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  [queryKeys.cookieJar.campaigns(DEFAULT_CHAIN_ID), []] as const,
] as const;

const meta: Meta<typeof CampaignCookieJarPanel> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJars",
  component: CampaignCookieJarPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Campaign Cookie Jars on the protocol garden's Payouts (DL-046): the campaign list with Create Cookie Jar in its header, and the manage dialog that refreshes a jar's allowlist and page. Deployers only.",
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
      workspace: "community",
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarPanel>;

export const Default: Story = {};

/** As Payouts mounts it, with Create Cookie Jar in the list's header. */
export const OnPayouts: Story = {
  args: {
    headerAction: (
      <AdminButton type="button" variant="tonal" size="sm" onClick={fn()}>
        Create Cookie Jar
      </AdminButton>
    ),
  },
};
