import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import {
  STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import { FIXTURE_IMAGE_AGROFORESTRY } from "../../../../shared/.storybook/fixtures";
import {
  withAdminIdentityRole,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../shared/.storybook/decorators";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import { adminCanvasRoutes } from "@/routes/views";
import {
  buildCampaignCookieJarMetadata,
  DEFAULT_CHAIN_ID,
  queryKeys,
  type Address,
  type CampaignCookieJarCampaign,
} from "@green-goods/shared";

const STORYBOOK_CAMPAIGN_JAR = "0x7777777777777777777777777777777777777777" as Address;

const STORYBOOK_COOKIE_CAMPAIGNS: CampaignCookieJarCampaign[] = [
  {
    address: STORYBOOK_CAMPAIGN_JAR,
    jarAddress: STORYBOOK_CAMPAIGN_JAR,
    slug: "earth-week",
    label: "Earth Week Cookie Jar",
    title: "Earth Week Cookie Jar",
    metadata: buildCampaignCookieJarMetadata({
      title: "Earth Week Cookie Jar",
      slug: "earth-week",
      description: "Shared campaign rewards for selected garden operators.",
      image: FIXTURE_IMAGE_AGROFORESTRY,
      externalUrl: "https://greengoods.app/cookies?campaign=earth-week",
      sourceGardens: [STORYBOOK_PRIMARY_ADMIN_GARDEN.id],
      extraAllowlist: [],
      chainId: DEFAULT_CHAIN_ID,
      createdAt: 1770000000,
    }),
    rawMetadata: "",
    creator: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e" as Address,
    createdAt: 1770000000,
    source: "indexed",
  },
];

const COOKIE_CAMPAIGN_SEEDS = [
  ...STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  [queryKeys.cookieJar.campaigns(DEFAULT_CHAIN_ID), STORYBOOK_COOKIE_CAMPAIGNS] as const,
] as const;

const EMPTY_COOKIE_CAMPAIGN_SEEDS = [
  ...STORYBOOK_ADMIN_DEPLOYER_SEEDS,
  [queryKeys.cookieJar.campaigns(DEFAULT_CHAIN_ID), []] as const,
] as const;

function CookiesCanvasStory({ initialPath = "/cookies" }: { initialPath?: string }) {
  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          {
            element: <CanvasLayout />,
            children: adminCanvasRoutes,
          },
        ],
        { initialEntries: [initialPath] }
      ),
    [initialPath]
  );

  return <RouterProvider router={router} />;
}

const meta: Meta<typeof CookiesCanvasStory> = {
  title: "Admin/Workspaces/Cookies",
  component: CookiesCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    withAdminIdentityRole("deployer"),
    withSeededQueryClient(COOKIE_CAMPAIGN_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof CookiesCanvasStory>;

export const TeamCookies: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/cookies" },
};

export const Empty: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/cookies" },
  decorators: [withSeededQueryClient(EMPTY_COOKIE_CAMPAIGN_SEEDS)],
};

export const DeployRoute: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/cookies/deploy" },
};
