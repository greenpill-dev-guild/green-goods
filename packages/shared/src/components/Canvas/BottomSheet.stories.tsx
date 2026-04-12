import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BottomSheet } from "./BottomSheet";

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
  title: "Canvas/BottomSheet",
  component: BottomSheet,
  tags: ["autodocs"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the sheet is open.",
    },
    onClose: {
      description:
        "Callback fired when the sheet is dismissed (overlay click, Escape key, close button, or drag-down gesture).",
    },
    title: {
      control: "text",
      description:
        "Optional title displayed in the header. When omitted, only the drag handle is shown.",
    },
    children: {
      control: false,
      description: "Content rendered inside the sheet body.",
    },
    maxHeight: {
      control: { type: "number", min: 30, max: 100, step: 5 },
      description: "Maximum height as a viewport-height percentage. Default is 85.",
    },
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Open bottom sheet with title and sample content. */
export const Default: Story = {
  args: {
    open: true,
    onClose: fn(),
    title: "Work Detail",
    children: sampleContent,
  },
};

/** Open bottom sheet without a title — only the drag handle is visible. */
export const NoTitle: Story = {
  args: {
    open: true,
    onClose: fn(),
    children: sampleContent,
  },
};

/** All variants shown for visual comparison. */
export const Gallery: Story = {
  render: () => (
    <div className="relative min-h-screen bg-bg-white-0">
      <div className="p-6">
        <h3 className="mb-2 text-sm font-semibold text-text-sub">
          Bottom sheets render as portaled overlays at the viewport bottom. Open each story
          individually to see the slide-up animation and drag-to-dismiss behavior.
        </h3>
        <p className="text-sm text-text-sub">
          Variants: Default (with title + close button), NoTitle (drag handle only).
        </p>
      </div>
      {/* Render one open sheet for gallery preview */}
      <BottomSheet open title="Work Detail" onClose={fn()}>
        {sampleContent}
      </BottomSheet>
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
