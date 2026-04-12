import type { Meta, StoryObj } from "@storybook/react";
import { MainSheet } from "./MainSheet";

const meta: Meta<typeof MainSheet> = {
  title: "Canvas/MainSheet",
  component: MainSheet,
  tags: ["autodocs"],
  argTypes: {
    isReceded: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof MainSheet>;

export const Default: Story = {
  args: {
    isReceded: false,
  },
  render: (args) => (
    <div className="h-[420px] rounded-[1.5rem] bg-bg-weak p-4">
      <MainSheet {...args}>
        <div className="flex h-full flex-col gap-4 overflow-auto p-6">
          <div className="text-title-sm text-text-strong-950">Primary canvas surface</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-bg-soft p-4">Main content</div>
            <div className="rounded-xl bg-bg-soft p-4">Bounded overlays portal here</div>
          </div>
          <div className="rounded-xl bg-bg-soft p-4">Scroll content remains inside the sheet.</div>
        </div>
      </MainSheet>
    </div>
  ),
};

export const Receded: Story = {
  args: {
    isReceded: true,
  },
  render: Default.render,
};
