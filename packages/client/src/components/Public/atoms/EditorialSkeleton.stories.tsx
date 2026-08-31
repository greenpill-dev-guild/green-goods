import type { Meta, StoryObj } from "@storybook/react";
import {
  EditorialListRowSkeleton,
  EditorialMediaCardSkeleton,
  EditorialSkeleton,
  EditorialStatSkeleton,
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
