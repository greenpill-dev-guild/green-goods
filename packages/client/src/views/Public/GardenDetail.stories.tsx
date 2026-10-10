import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import { PUBLIC_HISTORY_PAGE_SIZE } from "@green-goods/shared/commitment-pooling/public";
import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, waitFor, within } from "storybook/test";
import { withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_BANNER } from "../../../../shared/.storybook/fixtures";
import PublicShell from "../../routes/PublicShell";
import GardenDetail from "./GardenDetail";

const gardenId: Address = "0x1111111111111111111111111111111111111111";
const longDescription = [
  "Neighbors grow food, share harvests, and care for the soil together. Our community garden turns an unused corner of the neighborhood into a place to learn, meet, and grow seasonal produce.",
  "Each week, volunteers tend the vegetable beds, maintain the compost, and collect rainwater. New gardeners work alongside experienced growers, learning how healthy soil, native plants, and careful watering support a resilient garden.",
  "The harvest is shared among the people who care for the garden and with nearby community kitchens. We record what we plant, the work we contribute, and what we learn so the next season can build on that experience.",
  "Everyone is welcome at our open workdays. Bring your questions and a willingness to help; tools and practical guidance are available on site. Together we are creating a garden that can keep nourishing the neighborhood for years to come.",
].join("\n\n");

function seeded(description: string, location = "Austin", name = "Community Garden") {
  return withSeededQueryClient([
    [queryKeys.public.gardens(DEFAULT_CHAIN_ID), []],
    [
      queryKeys.public.gardenDetail(gardenId, DEFAULT_CHAIN_ID),
      {
        garden: {
          id: gardenId,
          name,
          description,
          location,
          stewards: [],
          bannerImage: FIXTURE_IMAGE_BANNER,
        },
        fieldNotes: [],
        gardenerCount: 0,
        assessmentCount: 0,
        totalFieldNotes: 0,
        partialData: false,
        unlisted: false,
        unavailableSources: { works: false, assessments: false },
      },
    ],
    [queryKeys.hypercerts.list(gardenId, DEFAULT_CHAIN_ID), []],
    [
      queryKeys.public.gardenDetail(
        `commitment-pool:${gardenId}:${PUBLIC_HISTORY_PAGE_SIZE}`,
        DEFAULT_CHAIN_ID
      ),
      {
        pool: null,
        openSeason: null,
        openCampaigns: [],
        finishedCycles: [],
        poolUnitSummaries: [],
        cycleUnitSummaries: [],
        partialData: false,
        unavailableSources: { commitmentPool: false, cycleMetadata: false },
      },
    ],
  ]);
}

// The hero's card rises in on arrival (editorial.css), so its content is not visible on the
// first frame. A check on hero content waits for the entrance instead of racing it.
const HERO_ENTRANCE = { timeout: 3000 };

const meta = {
  title: "Client/Public/GardenDetail/Description",
  component: GardenDetail,
  tags: ["storybook-ci"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={[`/gardens/${gardenId}`]}>
        <Routes>
          <Route element={<PublicShell />}>
            <Route path="/gardens/:id" element={<Story />} />
          </Route>
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof GardenDetail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotFound: Story = {
  decorators: [
    withSeededQueryClient([
      [queryKeys.public.gardens(DEFAULT_CHAIN_ID), []],
      [
        queryKeys.public.gardenDetail(gardenId, DEFAULT_CHAIN_ID),
        {
          garden: null,
          fieldNotes: [],
          gardenerCount: 0,
          assessmentCount: 0,
          totalFieldNotes: 0,
          partialData: false,
          unlisted: false,
          unavailableSources: { works: false, assessments: false },
        },
      ],
    ]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hero = await canvas.findByRole("region", { name: "Garden not found" });
    await waitFor(
      () => expect(within(hero).getByRole("heading", { level: 1 })).toBeVisible(),
      HERO_ENTRANCE
    );
    await expect(within(hero).queryByRole("link")).not.toBeInTheDocument();
    const explore = canvas.getByRole("region", { name: "Find a garden to explore" });
    await expect(within(explore).getByRole("link", { name: "Browse Gardens" })).toHaveAttribute(
      "href",
      "/gardens"
    );
    const footer = canvasElement.querySelector("footer")!;
    await expect(footer.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(
      canvasElement.ownerDocument.defaultView!.innerHeight
    );
  },
};

export const LongDescription: Story = {
  decorators: [seeded(longDescription)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hero = await canvas.findByRole("region", { name: "Community Garden" });
    const about = canvas.getByRole("region", { name: "About this garden" });
    const description = within(about).getByText(/Neighbors grow food, share harvests/);
    await expect(description).toBeVisible();
    await expect(description.scrollHeight).toBeLessThanOrEqual(description.clientHeight + 1);
    await expect(within(hero).queryByText(/Neighbors grow food/)).not.toBeInTheDocument();
    await expect(within(hero).queryByRole("button")).not.toBeInTheDocument();
    await expect(within(hero).queryByRole("link")).not.toBeInTheDocument();
  },
};

export const ShortDescription: Story = {
  decorators: [seeded("A neighborhood garden.")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const about = await canvas.findByRole("region", { name: "About this garden" });
    await expect(within(about).getByText("A neighborhood garden.")).toBeVisible();
    await expect(canvas.getAllByText("A neighborhood garden.")).toHaveLength(1);
  },
};

export const MissingDescription: Story = {
  decorators: [seeded("")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const about = await canvas.findByRole("region", { name: "About this garden" });
    await expect(
      within(about).getByText("Garden narrative will appear here as it is published.")
    ).toBeVisible();
  },
};

export const LongLocation: Story = {
  decorators: [
    seeded(
      "A neighborhood garden.",
      "Santa Teresa, Rio de Janeiro, Brasil",
      "Santa Teresa Community Garden"
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hero = await canvas.findByRole("region", { name: "Santa Teresa Community Garden" });
    const title = within(hero).getByRole("heading", { level: 1 });
    const location = within(hero).getByText("Santa Teresa, Rio de Janeiro, Brasil");
    const archive = canvas.getByRole("link", { name: "All Gardens" });
    await waitFor(() => expect(location).toBeVisible(), HERO_ENTRANCE);
    await expect(location.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      title.getBoundingClientRect().bottom
    );
    await expect(location.scrollHeight).toBeLessThanOrEqual(location.clientHeight + 1);
    await expect(
      archive.getBoundingClientRect().top - location.getBoundingClientRect().bottom
    ).toBeLessThanOrEqual(80);
    await expect(getComputedStyle(archive).textDecorationLine).toContain("underline");
  },
};
