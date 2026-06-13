import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withCanvasFrame } from "../../../.storybook/decorators";
import { MainSheet } from "./MainSheet";

const meta: Meta<typeof MainSheet> = {
  title: "Shared/Canvas/MainSheet",
  component: MainSheet,
  tags: ["autodocs", "storybook-ci"],
  decorators: [withCanvasFrame({ className: "p-4", heightClassName: "min-h-[460px]" })],
  parameters: {
    docs: {
      description: {
        component:
          "Primary content surface inside the admin canvas. Static since the QA refinement pass — it no longer recedes (blur/dim/translate) when side sheets open; sheets portal into CanvasLayout's dedicated sheet layer and carry depth with their own scrim, so the canvas stays crisp and readable behind them.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MainSheet>;

export const Default: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <MainSheet {...args}>
        <div className="flex h-full flex-col gap-4 overflow-auto p-6">
          <div className="text-title-sm text-text-strong-950">Primary canvas surface</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-bg-soft p-4">Main content</div>
            <div className="rounded-xl bg-bg-soft p-4">Stays crisp while sheets open</div>
          </div>
          <div className="rounded-xl bg-bg-soft p-4">Scroll content remains inside the sheet.</div>
        </div>
      </MainSheet>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId("main-sheet");
    const content = canvas.getByTestId("main-sheet-content");

    await expect(root).toHaveAttribute("data-state", "resting");
    // No recession styles — the surface never blurs, dims, or shifts.
    await expect(content.getAttribute("style")).toBeNull();
  },
};
