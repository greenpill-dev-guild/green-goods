import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ComponentProps } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
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
  title: "Shared/Canvas/BottomSheet",
  component: BottomSheet,
  tags: ["autodocs", "storybook-ci"],
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
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("bottom-sheet-close"));
    await expect(args.onClose).toHaveBeenCalled();
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

export const Closed: Story = {
  args: {
    open: false,
    onClose: fn(),
    title: "Work Detail",
    children: sampleContent,
  },
  render: (args) => (
    <div className="p-6 text-sm text-text-sub">
      BottomSheet is unmounted when closed.
      <BottomSheet {...args}>{sampleContent}</BottomSheet>
    </div>
  ),
};

function BoundedBottomSheetStory(args: ComponentProps<typeof BottomSheet>) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  return (
    <div
      ref={setContainer}
      data-tone="hub"
      className="storybook-canvas-frame relative h-[520px] overflow-hidden rounded-xl p-6"
    >
      <div className="text-sm font-semibold text-text-sub">Canvas overlay root</div>
      <BottomSheet {...args} container={container}>
        {sampleContent}
      </BottomSheet>
    </div>
  );
}

export const BoundedCanvas: Story = {
  args: {
    open: true,
    onClose: fn(),
    title: "Work Detail",
    children: sampleContent,
    maxHeight: 70,
  },
  render: (args) => <BoundedBottomSheetStory {...args} />,
};

/** Agent state catalog for the mobile sheet anatomy. */
export const StateCatalog: Story = {
  args: {
    open: true,
    onClose: fn(),
    title: "Work Detail",
    children: sampleContent,
  },
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
