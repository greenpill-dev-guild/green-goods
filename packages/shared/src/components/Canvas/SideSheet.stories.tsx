import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SideSheet } from "./SideSheet";

// ---------------------------------------------------------------------------
// Shared content helper
// ---------------------------------------------------------------------------

const sampleContent = (
  <div className="space-y-4 p-4">
    <h4 className="text-sm font-semibold text-text-strong">Work Submission #42</h4>
    <p className="text-sm text-text-sub">
      Cleared 120kg of plastic waste from the river bank near Jardim Botafogo. Team of 8 volunteers
      worked over a 4-hour period. Photos and GPS coordinates attached.
    </p>
    <div className="flex gap-2">
      <div className="h-20 w-20 rounded-lg bg-bg-weak" />
      <div className="h-20 w-20 rounded-lg bg-bg-weak" />
      <div className="h-20 w-20 rounded-lg bg-bg-weak" />
    </div>
    <div className="rounded-lg border border-stroke-soft p-3">
      <p className="text-xs text-text-sub">Submitted by 0xabc...def on March 15, 2026</p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Canvas/SideSheet",
  component: SideSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the sheet is open.",
    },
    onClose: {
      description:
        "Callback fired when the sheet is dismissed (overlay click, Escape key, or close button).",
    },
    title: {
      control: "text",
      description:
        "Optional title displayed in the header. When omitted, only a close button is shown.",
    },
    children: {
      control: false,
      description: "Content rendered inside the sheet body.",
    },
    width: {
      control: { type: "number", min: 200, max: 800, step: 50 },
      description: "Width of the sheet in pixels. Default is 400.",
    },
  },
} satisfies Meta<typeof SideSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Open side sheet with title and sample content. */
export const Default: Story = {
  args: {
    open: true,
    onClose: fn(),
    title: "Work Detail",
    children: sampleContent,
  },
};

/** Open side sheet without a title — only a close button in the header area. */
export const NoTitle: Story = {
  args: {
    open: true,
    onClose: fn(),
    children: sampleContent,
  },
};

/** Custom width of 600px for wider content panels. */
export const CustomWidth: Story = {
  args: {
    open: true,
    onClose: fn(),
    title: "Garden Settings",
    children: sampleContent,
    width: 600,
  },
};

/** All variants shown in sequence for visual comparison. */
export const Gallery: Story = {
  render: () => (
    <div className="relative min-h-screen bg-bg-white-0">
      <div className="p-8">
        <h3 className="mb-2 text-sm font-semibold text-text-sub">
          Side sheets render as portaled overlays. Open each story individually to see the sliding
          animation and overlay behavior.
        </h3>
        <p className="text-sm text-text-sub">
          Variants: Default (with title), NoTitle (close button only), CustomWidth (600px).
        </p>
      </div>
      {/* Render one open sheet for gallery preview */}
      <SideSheet open title="Work Detail" onClose={fn()}>
        {sampleContent}
      </SideSheet>
    </div>
  ),
};

/** Dark mode rendering for visual verification. */
export const DarkMode: Story = {
  args: {
    open: true,
    onClose: fn(),
    title: "Work Detail",
    children: sampleContent,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 min-h-screen">
        <Story />
      </div>
    ),
  ],
};
