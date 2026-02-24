import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs";

const meta: Meta<typeof Breadcrumbs> = {
  title: "Admin/Layout/Breadcrumbs",
  component: Breadcrumbs,
  tags: ["autodocs"],
  decorators: [
    (Story, context) => (
      <MemoryRouter initialEntries={[context.args._path ?? "/gardens/0x1234/vault"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
  argTypes: {
    _path: {
      control: "select",
      options: [
        "/gardens/0x1234abcd5678ef90/vault",
        "/gardens/0x1234abcd5678ef90",
        "/gardens/create",
        "/actions/action-1",
        "/gardens/0x1234abcd5678ef90/hypercerts/0xabcdef",
        "/dashboard",
      ],
      description: "Simulated URL path (internal — controls which breadcrumbs render)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs & { _path?: string }>;

export const Default: Story = {
  args: {
    _path: "/gardens/0x1234abcd5678ef90/vault",
  },
};

export const TwoLevels: Story = {
  args: {
    _path: "/gardens/0x1234abcd5678ef90",
  },
};

export const CreateSubRoute: Story = {
  args: {
    _path: "/gardens/create",
  },
};

export const DeepNesting: Story = {
  args: {
    _path: "/gardens/0x1234abcd5678ef90/hypercerts/0xabcdef1234567890abcdef",
  },
};

export const SingleSegment: Story = {
  name: "Single Segment (hidden)",
  args: {
    _path: "/dashboard",
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {[
        { label: "Two levels", path: "/gardens/0x1234abcd5678ef90" },
        { label: "Three levels", path: "/gardens/0x1234abcd5678ef90/vault" },
        { label: "Create sub-route", path: "/gardens/create" },
        {
          label: "Deep nesting",
          path: "/gardens/0x1234abcd5678ef90/hypercerts/0xabcdef12345678",
        },
        { label: "Single segment (hidden)", path: "/dashboard" },
      ].map(({ label, path }) => (
        <div key={path}>
          <p className="text-xs text-text-sub-600 mb-1">
            {label} — <code className="text-xs">{path}</code>
          </p>
          <MemoryRouter initialEntries={[path]}>
            <Breadcrumbs />
          </MemoryRouter>
        </div>
      ))}
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    _path: "/gardens/0x1234abcd5678ef90/vault",
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
