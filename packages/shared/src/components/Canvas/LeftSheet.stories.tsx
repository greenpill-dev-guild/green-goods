import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { LeftSheet } from "./LeftSheet";

const sampleContent = (
  <div className="space-y-4 p-4">
    <p className="text-sm text-text-sub">
      Submit a new work record with supporting evidence, location notes, and reviewer context.
    </p>
    <label className="block">
      <span className="text-label-sm text-text-soft">Work title</span>
      <input
        className="mt-1 w-full rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong"
        defaultValue="River bank cleanup"
      />
    </label>
    <div className="rounded-lg bg-bg-soft p-3 text-sm text-text-sub shadow-[var(--edge-rest)]">
      Draft evidence is saved before the sheet closes.
    </div>
  </div>
);

const meta: Meta<typeof LeftSheet> = {
  title: "Shared/Canvas/LeftSheet",
  component: LeftSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    open: true,
    onClose: fn(),
    title: "Submit Work",
    children: sampleContent,
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the sheet is open.",
    },
    title: {
      control: "text",
      description: "Optional title announced by the native dialog.",
    },
    description: {
      control: "text",
      description: "Optional screen-reader description.",
    },
    children: {
      control: false,
      description: "Sheet body content.",
    },
    container: {
      control: false,
      description: "Optional bounded canvas overlay container.",
    },
    onClose: {
      description: "Dismiss callback for overlay, close button, Escape, and drag gestures.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof LeftSheet>;

export const Default: Story = {};

export const NoTitle: Story = {
  args: {
    title: undefined,
    children: sampleContent,
  },
};

export const BoundedCanvas: Story = {
  render: (args) => {
    const container = document.getElementById("left-sheet-story-container");
    return (
      <div
        id="left-sheet-story-container"
        data-workspace="hub"
        className="storybook-canvas-frame relative h-[520px] overflow-hidden rounded-xl p-6"
      >
        <div className="text-sm font-semibold text-text-sub">Canvas overlay root</div>
        <LeftSheet {...args} container={container}>
          {sampleContent}
        </LeftSheet>
      </div>
    );
  },
};
