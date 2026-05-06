import type { Meta, StoryObj } from "@storybook/react";
import { FIXTURE_WORK_MEDIA, hoursAgo } from "../../../../.storybook/fixtures";
import { WorkCard, type WorkCardData } from "./WorkCard";

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
