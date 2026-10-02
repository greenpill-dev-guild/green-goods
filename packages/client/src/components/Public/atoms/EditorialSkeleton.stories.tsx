import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import { MemoryRouter } from "react-router-dom";
import type { PublicGardenSummary } from "@green-goods/shared/hooks/public/usePublicGardens";
import { PublicGardenRow } from "../PublicGardenRow";
import "../../../styles/editorial.css";
import {
  EditorialCookieJarCardSkeleton,
  EditorialListRowSkeleton,
  EditorialMediaCardSkeleton,
  EditorialSkeleton,
  EditorialStatSkeleton,
  EditorialVaultAssetCardSkeleton,
} from "./EditorialSkeleton";

const meta: Meta<typeof EditorialSkeleton> = {
  title: "Client/Public/Editorial Skeleton",
  component: EditorialSkeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Quiet vellum placeholders for public-browser read states. Motion follows the global reduced-motion preference.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof EditorialSkeleton>;

export const StateCatalog: Story = {
  render: () => (
    <div className="max-w-5xl space-y-12 bg-bg-weak-50 p-8">
      <section>
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
          Media records
        </p>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <EditorialMediaCardSkeleton key={index} />
          ))}
        </div>
      </section>
      <section>
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
          Record rows
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <EditorialListRowSkeleton />
          <EditorialListRowSkeleton />
        </div>
      </section>
      <section>
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
          Published figures
        </p>
        <EditorialStatSkeleton />
      </section>
    </div>
  ),
};

export const MobileRows: Story = {
  globals: { viewport: { value: "mobile" } },
  render: () => (
    <div className="space-y-4 bg-bg-weak-50 p-5">
      <EditorialListRowSkeleton />
      <EditorialMediaCardSkeleton mediaClassName="aspect-[4/3]" />
    </div>
  ),
};

export const Dark: Story = {
  render: () => (
    <div data-theme="dark" className="space-y-8 bg-bg-weak-50 p-8">
      <div className="grid gap-8 sm:grid-cols-3">
        <EditorialMediaCardSkeleton />
        <EditorialMediaCardSkeleton />
        <EditorialMediaCardSkeleton />
      </div>
      <EditorialListRowSkeleton />
      <EditorialStatSkeleton />
    </div>
  ),
};

export const ReducedMotion: Story = {
  decorators: [
    (Story) => (
      <div className="editorial-skeleton-story-static">
        <style>{`.editorial-skeleton-story-static .editorial-skeleton::after { animation: none !important; left: 28%; opacity: 0.4; }`}</style>
        <Story />
      </div>
    ),
  ],
  render: () => <EditorialMediaCardSkeleton />,
};

/** Compare the real Fund row against its placeholder at narrow and desktop widths. */
export const FundingRowFootprints: Story = {
  render: () => (
    <MemoryRouter>
      <div className="space-y-8 bg-bg-weak-50 p-5" data-site="website">
        {[271, 360, 600].map((width) => (
          <div key={width} data-proof-width={width} className="grid max-w-full" style={{ width }}>
            <EditorialListRowSkeleton />
            <PublicGardenRow
              garden={
                {
                  id: "0x1111111111111111111111111111111111111111",
                  address: "0x1111111111111111111111111111111111111111",
                  slug: "community-garden",
                  name: "Community Garden",
                  description: "",
                  location: "Local garden",
                  bannerImage: "",
                  contributorCount: 2,
                  actionCount: 3,
                  lastActivityAt: 0,
                  stewards: [],
                  evaluators: [],
                } satisfies PublicGardenSummary
              }
              onSupport={() => {}}
            />
          </div>
        ))}
      </div>
    </MemoryRouter>
  ),
  play: async ({ canvasElement }) => {
    for (const frame of canvasElement.querySelectorAll("[data-proof-width]")) {
      const skeleton = frame.querySelector("[data-editorial-skeleton-layout='list-row']")!;
      const card = frame.querySelector("[data-component='PublicGardenRow']")!;
      await expect(skeleton.getBoundingClientRect().width).toBe(card.getBoundingClientRect().width);
      await expect(skeleton.getBoundingClientRect().height).toBe(
        card.getBoundingClientRect().height
      );
      await expect(skeleton.querySelectorAll("[data-skeleton-action]")).toHaveLength(2);
    }
  },
};

export const CookieJarAndVaultCards: Story = {
  render: () => (
    <div data-site="website" className="grid items-start gap-8 bg-bg-weak-50 p-5 md:grid-cols-3">
      <EditorialCookieJarCardSkeleton isConnected />
      <EditorialCookieJarCardSkeleton isConnected={false} />
      <EditorialVaultAssetCardSkeleton />
    </div>
  ),
};
