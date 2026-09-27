import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import { PUBLIC_HISTORY_PAGE_SIZE } from "@green-goods/shared/commitment-pooling/public";
import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import GardenDetail from "./GardenDetail";

const gardenId: Address = "0x1111111111111111111111111111111111111111";
const longDescription = "Neighbors grow food and care for the soil together. ".repeat(25).trim();

function seeded(description: string) {
  return withSeededQueryClient([
    [queryKeys.public.gardens(DEFAULT_CHAIN_ID), []],
    [
      queryKeys.public.gardenDetail(gardenId, DEFAULT_CHAIN_ID),
      {
        garden: {
          id: gardenId,
          name: "Community Garden",
          description,
          location: "Austin",
          stewards: [],
          bannerImage: "/images/no-image-placeholder.png",
        },
        fieldNotes: [],
        contributors: [],
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

const meta = {
  title: "Client/Public/GardenDetail/Description",
  component: GardenDetail,
  tags: ["storybook-ci"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={[`/gardens/${gardenId}`]}>
        <Routes>
          <Route path="/gardens/:id" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof GardenDetail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LongDescription: Story = {
  decorators: [seeded(longDescription)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = await canvas.findByRole("button", { name: "See more" });
    const lede = canvas.getByText(longDescription);
    await expect(lede.scrollHeight).toBeGreaterThan(lede.clientHeight);
    await userEvent.click(more);
    await expect(canvasElement.querySelector("#public-garden-description")).toHaveFocus();
    await userEvent.click(canvas.getAllByRole("button", { name: "Show less" })[1]);
    await expect(canvas.getByRole("button", { name: "See more" })).toHaveFocus();
  },
};

export const ShortDescription: Story = {
  decorators: [seeded("A neighborhood garden.")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("A neighborhood garden.")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "See more" })).not.toBeInTheDocument();
  },
};

export const ResizeWhileExpanded: Story = {
  decorators: [
    seeded(
      "Neighbors grow food, share harvests, and care for the soil together. Everyone can join a workday and learn from the community."
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const initialWidth = canvasElement.style.width;
    try {
      canvasElement.style.width = "320px";
      const more = await canvas.findByRole("button", { name: "See more" });
      await userEvent.click(more);
      await expect(canvasElement.querySelector("#public-garden-description")).toHaveFocus();
      canvasElement.style.width = "900px";
      await userEvent.click(canvas.getAllByRole("button", { name: "Show less" })[1]);
      await waitFor(() =>
        expect(canvas.queryByRole("button", { name: "See more" })).not.toBeInTheDocument()
      );
      await expect(canvas.getByText(/^Neighbors grow food/).parentElement).toHaveFocus();
    } finally {
      canvasElement.style.width = initialWidth;
    }
  },
};
