import { RiAddLine, RiDownloadLine, RiSettings3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { SectionHeader } from "./SectionHeader";

const meta: Meta<typeof SectionHeader> = {
  title: "Admin/UI/SectionHeader",
  component: SectionHeader,
  tags: ["autodocs"],
  argTypes: {
    title: {
      control: "text",
      description: "Main heading text for the section",
    },
    description: {
      control: "text",
      description: "Optional descriptive subtitle below the title",
    },
    action: {
      control: false,
      description: "Optional ReactNode rendered on the right side (e.g., buttons)",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the root container",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const Default: Story = {
  args: {
    title: "Garden Overview",
  },
};

export const WithDescription: Story = {
  args: {
    title: "Active Actions",
    description: "Manage regenerative actions for your garden members.",
  },
};

export const WithAction: Story = {
  args: {
    title: "Team Members",
    description: "Operators and gardeners with access to this garden.",
    action: (
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-darker transition-colors"
      >
        <RiAddLine className="h-4 w-4" />
        Add Member
      </button>
    ),
  },
};

export const WithMultipleActions: Story = {
  args: {
    title: "Endowments",
    description: "Vault balances, deposits, and withdrawal history.",
    action: (
      <div className="flex gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong hover:bg-bg-soft transition-colors"
        >
          <RiDownloadLine className="h-4 w-4" />
          Export
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong hover:bg-bg-soft transition-colors"
        >
          <RiSettings3Line className="h-4 w-4" />
          Settings
        </button>
      </div>
    ),
  },
};

export const LongContent: Story = {
  args: {
    title: "Biodiversity Regeneration and Environmental Monitoring",
    description:
      "Track long-term environmental impact across all garden sites including carbon sequestration measurements, wildlife habitat restoration, and native species planting records.",
    action: (
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-darker transition-colors whitespace-nowrap"
      >
        <RiAddLine className="h-4 w-4" />
        New Action
      </button>
    ),
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="space-y-8">
      <SectionHeader title="Title Only" />
      <SectionHeader
        title="With Description"
        description="A helpful description about this section."
      />
      <SectionHeader
        title="With Action Button"
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <RiAddLine className="h-4 w-4" />
            Action
          </button>
        }
      />
      <SectionHeader
        title="Full Configuration"
        description="Title, description, and action all provided."
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <RiAddLine className="h-4 w-4" />
            Action
          </button>
        }
      />
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    title: "Garden Overview",
    description: "Manage your garden settings and team.",
    action: (
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <RiAddLine className="h-4 w-4" />
        Add Member
      </button>
    ),
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
