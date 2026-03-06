import {
  RiAddLine,
  RiDownloadLine,
  RiFilterLine,
  RiSearchLine,
  RiSettings3Line,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { PageHeader } from "./PageHeader";

const meta: Meta<typeof PageHeader> = {
  title: "Admin/Layout/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
  argTypes: {
    title: { control: "text", description: "Main heading text" },
    description: { control: "text", description: "Subtitle below the title" },
    metadata: { control: false, description: "Additional metadata below the description" },
    actions: {
      control: false,
      description: "Action buttons rendered on a separate row below the title",
    },
    toolbar: {
      control: false,
      description: "Left-aligned toolbar (search, filters) on the action row",
    },
    backLink: { control: false, description: "Back navigation link config" },
    sticky: { control: "boolean", description: "Stick header to top on scroll" },
    className: { control: "text", description: "Additional CSS classes" },
    children: { control: false, description: "Content below the header (e.g. tabs)" },
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: "Dashboard",
  },
};

export const WithDescription: Story = {
  args: {
    title: "Gardens",
    description: "Manage your community gardens and track regenerative impact.",
  },
};

export const WithActions: Story = {
  args: {
    title: "Actions",
    description: "Browse and manage registered actions for your gardens.",
    actions: (
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-darker transition-colors"
      >
        <RiAddLine className="h-4 w-4" />
        New Action
      </button>
    ),
  },
};

export const WithToolbar: Story = {
  args: {
    title: "Work Submissions",
    description: "Review and approve work submitted by gardeners.",
    toolbar: (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-stroke-soft bg-bg-white px-3 py-1.5 text-sm text-text-sub">
          <RiSearchLine className="h-4 w-4" />
          <span>Search...</span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stroke-soft px-3 py-1.5 text-sm text-text-sub hover:bg-bg-soft transition-colors"
        >
          <RiFilterLine className="h-4 w-4" />
          Filter
        </button>
      </div>
    ),
    actions: (
      <div className="flex items-center gap-2">
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

export const WithBackLink: Story = {
  args: {
    title: "Garden Detail",
    description: "View and manage this garden's configuration and members.",
    backLink: { to: "/gardens", label: "Back to gardens" },
  },
};

export const WithTabs: Story = {
  args: {
    title: "Comunidad Verde",
    description: "A regenerative garden in Costa Rica.",
    backLink: { to: "/gardens", label: "Back to gardens" },
    children: (
      <div className="flex gap-4 border-b border-stroke-soft -mb-px">
        <button
          type="button"
          className="border-b-2 border-primary-base px-1 pb-2 text-sm font-medium text-primary-base"
        >
          Overview
        </button>
        <button
          type="button"
          className="border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-text-soft hover:text-text-sub"
        >
          Work
        </button>
        <button
          type="button"
          className="border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-text-soft hover:text-text-sub"
        >
          Community
        </button>
        <button
          type="button"
          className="border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-text-soft hover:text-text-sub"
        >
          Endowments
        </button>
      </div>
    ),
  },
};

export const Sticky: Story = {
  args: {
    title: "Contracts",
    description: "View and manage deployed contracts.",
    sticky: true,
  },
  decorators: [
    (Story) => (
      <div className="h-[300px] overflow-auto">
        <Story />
        <div className="p-6 space-y-4">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="h-16 rounded-lg bg-bg-weak border border-stroke-soft" />
          ))}
        </div>
      </div>
    ),
  ],
};

export const FullFeatured: Story = {
  args: {
    title: "Comunidad Verde",
    description:
      "A regenerative garden community in Costa Rica focused on agroforestry and solar energy.",
    metadata: (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-success-lighter px-2 py-0.5 text-xs font-medium text-success-dark">
          Active
        </span>
        <span>12 members</span>
        <span>3 active actions</span>
      </div>
    ),
    backLink: { to: "/gardens", label: "Back to gardens" },
    toolbar: (
      <div className="flex items-center gap-2 rounded-lg border border-stroke-soft bg-bg-white px-3 py-1.5 text-sm text-text-sub">
        <RiSearchLine className="h-4 w-4" />
        <span>Search work submissions...</span>
      </div>
    ),
    actions: (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong hover:bg-bg-soft transition-colors"
        >
          <RiSettings3Line className="h-4 w-4" />
          Settings
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-darker transition-colors"
        >
          <RiAddLine className="h-4 w-4" />
          New Action
        </button>
      </div>
    ),
    sticky: true,
    children: (
      <div className="flex gap-4 -mb-px">
        <button
          type="button"
          className="border-b-2 border-primary-base px-1 pb-2 text-sm font-medium text-primary-base"
        >
          Overview
        </button>
        <button
          type="button"
          className="border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-text-soft hover:text-text-sub"
        >
          Work
        </button>
        <button
          type="button"
          className="border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-text-soft hover:text-text-sub"
        >
          Impact
        </button>
      </div>
    ),
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="space-y-8">
      <PageHeader title="Title Only" />
      <PageHeader title="With Description" description="A helpful description about this page." />
      <PageHeader
        title="With Actions (Separate Row)"
        description="Actions are always on a separate row below the title."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <RiAddLine className="h-4 w-4" />
            Action
          </button>
        }
      />
      <PageHeader
        title="With Toolbar + Actions"
        description="Toolbar left, actions right."
        toolbar={
          <div className="flex items-center gap-2 rounded-lg border border-stroke-soft bg-bg-white px-3 py-1.5 text-sm text-text-sub">
            <RiSearchLine className="h-4 w-4" />
            <span>Search...</span>
          </div>
        }
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <RiAddLine className="h-4 w-4" />
            Create
          </button>
        }
      />
    </div>
  ),
};
