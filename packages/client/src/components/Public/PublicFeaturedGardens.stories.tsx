import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { PublicGardenSummary } from "@green-goods/shared/hooks/public/usePublicGardens";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withRouter, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { publicCuration } from "../../content/publicCuration";
import { PublicFeaturedGardens } from "./PublicFeaturedGardens";

const names = ["TAS HUB", "GreenSofa", "Vida Verde", "Rifai Sicilia"];
// Display fixtures only. Counts and images here are not a live impact report.
const gardens: PublicGardenSummary[] = publicCuration.featuredGardens.map((id, index) => ({
  id,
  address: id.toLowerCase() as Address,
  name: names[index],
  slug: names[index].toLowerCase().replaceAll(" ", "-"),
  location: "",
  bannerImage: index === 0 ? "/missing-featured-banner.jpg" : "/images/hero-garden.webp",
  description: "",
  lastActivityAt: 1_780_000_000,
  actionCount: 1,
  gardenerCount: 1,
  stewards: [],
  evaluators: [],
}));

const meta = {
  title: "Public/PublicFeaturedGardens",
  component: PublicFeaturedGardens,
  parameters: { layout: "fullscreen" },
  decorators: [
    withRouter(),
    withSeededQueryClient([[queryKeys.public.gardens(DEFAULT_CHAIN_ID), [...gardens].reverse()]]),
  ],
} satisfies Meta<typeof PublicFeaturedGardens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CuratedWithImageFallback: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = await canvas.findByTestId("public-featured-grid");
    await expect(
      within(grid)
        .getAllByRole("link")
        .map((link) => link.getAttribute("aria-label"))
    ).toEqual(names);
  },
};
