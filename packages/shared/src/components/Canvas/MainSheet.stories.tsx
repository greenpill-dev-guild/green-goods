import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withCanvasFrame } from "../../../.storybook/decorators";
import { MainSheet } from "./MainSheet";

const meta: Meta<typeof MainSheet> = {
  title: "Shared/Canvas/MainSheet",
  component: MainSheet,
  tags: ["autodocs", "storybook-ci"],
  decorators: [withCanvasFrame({ className: "p-4", heightClassName: "min-h-[460px]" })],
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
    <div className="h-[420px]">
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
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId("main-sheet")).toHaveAttribute(
      "data-state",
      "resting"
    );
  },
};

export const Receded: Story = {
  args: {
    isReceded: true,
  },
  render: Default.render,
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid h-[560px] gap-4 lg:grid-cols-2">
      <div className="h-full min-h-0">
        <MainSheet isReceded={false} className="h-full">
          <div className="flex h-full flex-col gap-4 overflow-auto p-6">
            <div className="text-title-sm text-text-strong-950">Resting surface</div>
            <div className="rounded-lg bg-bg-soft p-4 shadow-[var(--edge-rest)]">
              Primary work content stays fully present.
            </div>
          </div>
        </MainSheet>
      </div>
      <div className="h-full min-h-0">
        <MainSheet isReceded className="h-full">
          <div className="flex h-full flex-col gap-4 overflow-auto p-6">
            <div className="text-title-sm text-text-strong-950">Receded surface</div>
            <div className="rounded-lg bg-bg-soft p-4 shadow-[var(--edge-rest)]">
              Inspector overlays reduce the main surface emphasis.
            </div>
          </div>
        </MainSheet>
      </div>
    </div>
  ),
};
