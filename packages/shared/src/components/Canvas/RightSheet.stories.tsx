import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ComponentProps } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { RightSheet } from "./RightSheet";

const sampleContent = (
  <div className="space-y-4 p-4">
    <section className="rounded-lg bg-bg-soft p-4 shadow-[var(--edge-rest)]">
      <h3 className="text-sm font-semibold text-text-strong">Account</h3>
      <p className="mt-1 text-sm text-text-sub">Wallet, network, and display preferences.</p>
    </section>
    <section className="rounded-lg bg-bg-soft p-4 shadow-[var(--edge-rest)]">
      <h3 className="text-sm font-semibold text-text-strong">Notifications</h3>
      <p className="mt-1 text-sm text-text-sub">Recent approvals and queue updates.</p>
    </section>
  </div>
);

const meta: Meta<typeof RightSheet> = {
  title: "Shared/Canvas/RightSheet",
  component: RightSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    open: true,
    onClose: fn(),
    title: "Settings",
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
        "Width preset. `default` (320–480) for read-mostly panels; `wide` (420–640) for forms or two-column workflows.",
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
type Story = StoryObj<typeof RightSheet>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("right-sheet-close"));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const NoTitle: Story = {
  args: {
    title: undefined,
    children: sampleContent,
  },
};

export const Closed: Story = {
  args: {
    open: false,
  },
  render: (args) => (
    <div className="p-6 text-sm text-text-sub">
      RightSheet is unmounted when closed.
      <RightSheet {...args}>{sampleContent}</RightSheet>
    </div>
  ),
};

function BoundedRightSheetStory(args: ComponentProps<typeof RightSheet>) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  return (
    <div
      ref={setContainer}
      data-tone="profile"
      className="storybook-canvas-frame relative h-[520px] overflow-hidden rounded-xl p-6"
    >
      <div className="text-sm font-semibold text-text-sub">Canvas overlay root</div>
      <RightSheet {...args} container={container}>
        {sampleContent}
      </RightSheet>
    </div>
  );
}

export const BoundedCanvas: Story = {
  render: (args) => <BoundedRightSheetStory {...args} />,
};

export const Wide: Story = {
  args: {
    width: "wide",
    title: "Account settings",
    children: (
      <div className="space-y-4 p-4">
        <section className="rounded-lg bg-bg-soft p-4 shadow-[var(--edge-rest)]">
          <h3 className="text-sm font-semibold text-text-strong">Display name</h3>
          <p className="mt-1 text-sm text-text-sub">
            Wide variant gives forms breathing room across two-column field rows.
          </p>
        </section>
        <section className="rounded-lg bg-bg-soft p-4 shadow-[var(--edge-rest)]">
          <h3 className="text-sm font-semibold text-text-strong">Wallet addresses</h3>
          <p className="mt-1 text-sm text-text-sub">
            Operator, treasury, and recovery addresses live alongside one another at desktop.
          </p>
        </section>
      </div>
    ),
  },
};
