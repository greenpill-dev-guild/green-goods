import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
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
import {
  ADMIN_ROUTE_STORY_QUERY_OPTIONS,
  StorybookAdminCanvasRoute,
} from "../storybookCanvasHarness";
import {
  buildCampaignCookieJarMetadata,
  DEFAULT_CHAIN_ID,
  queryKeys,
  type Address,
  type CampaignCookieJarCampaign,
  type Garden,
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

const MANY_COOKIE_GARDENS: Garden[] = Array.from({ length: 24 }, (_, index) => {
  const address = `0x${(0x2000 + index).toString(16).padStart(40, "0")}` as Address;
  const operators = index % 7 === 0 ? [] : STORYBOOK_PRIMARY_ADMIN_GARDEN.operators;

  return {
    ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
    id: address,
    tokenAddress: address,
    tokenID: BigInt(index + 100),
    name:
      index % 7 === 0
        ? `Campaign Garden ${index + 1} - operator missing`
        : `Campaign Garden ${index + 1}`,
    operators,
  };
});

const MANY_COOKIE_GARDEN_SEEDS = [
  ...EMPTY_COOKIE_CAMPAIGN_SEEDS,
  [queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), MANY_COOKIE_GARDENS] as const,
] as const;

function CookiesCanvasStory({ initialPath = "/cookies" }: { initialPath?: string }) {
  return <StorybookAdminCanvasRoute initialPath={initialPath} />;
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const createActions = await canvas.findAllByRole(
      "button",
      { name: "Create cookie jar" },
      ADMIN_ROUTE_STORY_QUERY_OPTIONS
    );
    await expect(createActions).toHaveLength(1);
  },
};

export const DeployRoute: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/cookies/deploy" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByLabelText("Campaign name", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
    await expect(
      await canvas.findByLabelText(
        "Claim amount per operator",
        undefined,
        ADMIN_ROUTE_STORY_QUERY_OPTIONS
      )
    ).toBeVisible();
    await expect(
      await canvas.findByText("Review", undefined, ADMIN_ROUTE_STORY_QUERY_OPTIONS)
    ).toBeVisible();
    await expect(canvas.queryByText("Campaign page URL")).toBeNull();
    await expect(canvas.queryByLabelText("ERC20 token address")).toBeNull();
  },
};

export const DeployRouteManyGardens: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/cookies/deploy" },
  decorators: [withSeededQueryClient(MANY_COOKIE_GARDEN_SEEDS)],
};

export const DeployRouteMobile: Story = {
  tags: ["visual-harness"],
  args: { initialPath: "/cookies/deploy" },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
