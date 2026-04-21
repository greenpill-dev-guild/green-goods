import { RiAddLine, RiSeedlingLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { EmptyStateShell } from "./EmptyStateShell";

const meta: Meta<typeof EmptyStateShell> = {
  title: "Shared/Canvas/EmptyStateShell",
  component: EmptyStateShell,
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: false,
      description: "Centered empty-state content.",
    },
    className: {
      control: "text",
      description: "Additional classes for the surface wrapper.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyStateShell>;

export const Default: Story = {
  render: (args) => (
    <EmptyStateShell {...args}>
      <div className="flex max-w-md flex-col items-center text-center">
        <RiSeedlingLine className="h-10 w-10 text-primary-base" aria-hidden="true" />
        <h3 className="mt-4 text-title-md text-text-strong">No work selected</h3>
        <p className="mt-2 text-body-md text-text-sub">
          Choose a submission from the queue to review evidence and approvals.
        </p>
      </div>
    </EmptyStateShell>
  ),
};

export const WithAction: Story = {
  render: (args) => (
    <EmptyStateShell {...args}>
      <div className="flex max-w-md flex-col items-center text-center">
        <RiSeedlingLine className="h-10 w-10 text-primary-base" aria-hidden="true" />
        <h3 className="mt-4 text-title-md text-text-strong">Start a garden workspace</h3>
        <p className="mt-2 text-body-md text-text-sub">
          Create a garden before opening work, impact, and community tools.
        </p>
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--edge-rest)] transition-colors hover:bg-primary-darker"
        >
          <RiAddLine className="h-4 w-4" aria-hidden="true" />
          Create Garden
        </button>
      </div>
    </EmptyStateShell>
  ),
};

export const Compact: Story = {
  args: {
    className: "min-h-48",
  },
  render: (args) => (
    <EmptyStateShell {...args}>
      <p className="text-body-md font-semibold text-text-sub">All caught up for this view.</p>
    </EmptyStateShell>
  ),
};
