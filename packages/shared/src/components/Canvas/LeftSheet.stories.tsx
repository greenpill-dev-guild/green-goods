import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ComponentProps } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
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
  tags: ["autodocs", "storybook-ci"],
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
    width: {
      control: "select",
      options: ["default", "wide"],
      description:
        "Width preset. `default` (320-480) for read-mostly panels; `wide` (420-640) for forms or two-column workflows.",
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

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("left-sheet-close"));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const NoTitle: Story = {
  args: {
    title: undefined,
    children: sampleContent,
  },
};

export const Wide: Story = {
  args: {
    width: "wide",
  },
};

export const Closed: Story = {
  args: {
    open: false,
  },
  render: (args) => (
    <div className="p-6 text-sm text-text-sub">
      LeftSheet is unmounted when closed.
      <LeftSheet {...args}>{sampleContent}</LeftSheet>
    </div>
  ),
};

function BoundedLeftSheetStory(args: ComponentProps<typeof LeftSheet>) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  return (
    <div
      ref={setContainer}
      data-tone="hub"
      className="storybook-canvas-frame relative h-[520px] overflow-hidden rounded-xl p-6"
    >
      <div className="text-sm font-semibold text-text-sub">Canvas overlay root</div>
      <LeftSheet {...args} container={container}>
        {sampleContent}
      </LeftSheet>
    </div>
  );
}

export const BoundedCanvas: Story = {
  render: (args) => <BoundedLeftSheetStory {...args} />,
};
