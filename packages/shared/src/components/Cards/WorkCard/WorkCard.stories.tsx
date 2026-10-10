import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { FIXTURE_WORK_MEDIA, hoursAgo } from "../../../../.storybook/fixtures";
import { WorkCard, type WorkCardData, WorkCardSkeleton } from "./WorkCard";

const mockWork: WorkCardData = {
  id: "work-1",
  title: "Planted 50 native trees",
  status: "approved",
  createdAt: hoursAgo(2),
  mediaPreview: [FIXTURE_WORK_MEDIA[0]],
  gardenerDisplayName: "Alice.eth",
  gardenName: "Community Garden",
  imageCount: 3,
};

const meta: Meta<typeof WorkCard> = {
  title: "Shared/Cards/WorkCard",
  component: WorkCard,
  tags: ["autodocs", "storybook-ci"],
  // A card is a button only when it has something to open.
  args: { onClick: fn() },
  argTypes: {
    variant: {
      control: "select",
      options: ["compact", "detailed", "auto"],
      description: "Card variant style",
    },
    interactive: {
      control: "boolean",
      description: "Whether card is clickable",
    },
    showGardener: {
      control: "boolean",
      description: "Show gardener name",
    },
    showMediaCount: {
      control: "boolean",
      description: "Show media count badge",
    },
    showFeedbackBadge: {
      control: "boolean",
      description: "Show feedback badge",
    },
    showErrorBadge: {
      control: "boolean",
      description: "Show error badge",
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkCard>;

export const Default: Story = {
  args: {
    work: mockWork,
  },
};

export const Rejected: Story = {
  args: {
    work: {
      ...mockWork,
      status: "rejected",
      feedback: "Please include more documentation of the work completed.",
    },
    showFeedbackBadge: true,
  },
};

export const Failed: Story = {
  args: {
    work: {
      ...mockWork,
      status: "sync_failed",
      error: "Network error occurred",
      retryCount: 2,
    },
    showErrorBadge: true,
    showRetryBadge: true,
  },
};

export const WithGardener: Story = {
  args: {
    work: mockWork,
    showGardener: true,
  },
};

export const NoMedia: Story = {
  args: {
    work: {
      ...mockWork,
      mediaPreview: undefined,
      imageCount: 0,
    },
  },
};

export const StatusCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-md">
      <WorkCard work={{ ...mockWork, status: "approved", title: "Approved Work" }} />
      <WorkCard work={{ ...mockWork, status: "pending", title: "Pending Review" }} />
      <WorkCard work={{ ...mockWork, status: "rejected", title: "Rejected Work" }} />
      <WorkCard work={{ ...mockWork, status: "syncing", title: "Syncing to Chain" }} />
      <WorkCard work={{ ...mockWork, status: "sync_failed", title: "Failed Submission" }} />
    </div>
  ),
};

export const NonInteractive: Story = {
  args: {
    work: mockWork,
    interactive: false,
  },
};

/**
 * While a list of compact cards loads, each card is its own frame with nothing in
 * it: the thumbnail, the title line and pill, the meta and count lines land
 * exactly where the loaded card's do, so nothing moves when the list arrives.
 */
export const LoadingPlaceholder: Story = {
  render: () => (
    <div className="grid w-[358px] max-w-full gap-3">
      <WorkCard work={mockWork} variant="compact" showGardener interactive={false} />
      <WorkCardSkeleton />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [card, skeleton] = [...canvasElement.querySelectorAll("div.grid > *")] as HTMLElement[];
    const box = (element: Element) => element.getBoundingClientRect();
    const offset = (element: Element, root: HTMLElement) => ({
      left: Math.round(box(element).left - box(root).left),
      top: Math.round(box(element).top - box(root).top),
      height: Math.round(box(element).height),
    });
    await expect(box(skeleton).height).toBe(box(card).height);
    // The thumbnail, the title line, the pill and the meta line, element for element.
    const title = within(card).getByRole("heading", { level: 4 });
    const pill = title.nextElementSibling as HTMLElement;
    const meta = title.parentElement?.nextElementSibling as HTMLElement;
    const skeletonTitle = skeleton.querySelector("span.h-6") as HTMLElement;
    const skeletonPill = skeletonTitle.nextElementSibling as HTMLElement;
    const skeletonMeta = skeletonTitle.parentElement?.nextElementSibling as HTMLElement;
    await expect(offset(skeleton.firstElementChild as Element, skeleton)).toEqual(
      offset(card.firstElementChild as Element, card)
    );
    await expect(offset(skeletonTitle, skeleton)).toEqual(offset(title, card));
    await expect(offset(skeletonPill, skeleton).top).toBe(offset(pill, card).top);
    await expect(offset(skeletonPill, skeleton).height).toBe(offset(pill, card).height);
    await expect(offset(skeletonMeta, skeleton)).toEqual(offset(meta, card));
  },
};
