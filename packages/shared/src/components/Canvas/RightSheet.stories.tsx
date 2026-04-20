import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
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
  title: "Canvas/RightSheet",
  component: RightSheet,
  tags: ["autodocs"],
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

export const Default: Story = {};

export const NoTitle: Story = {
  args: {
    title: undefined,
    children: sampleContent,
  },
};

export const BoundedCanvas: Story = {
  render: (args) => {
    const container = document.getElementById("right-sheet-story-container");
    return (
      <div
        id="right-sheet-story-container"
        className="relative h-[520px] overflow-hidden rounded-xl bg-bg-weak p-6"
      >
        <div className="text-sm font-semibold text-text-sub">Canvas overlay root</div>
        <RightSheet {...args} container={container}>
          {sampleContent}
        </RightSheet>
      </div>
    );
  },
};

export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="min-h-screen bg-bg-white-0">
        <Story />
      </div>
    ),
  ],
};
