import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { MainSheet } from "./MainSheet";

const meta = {
  title: "Admin/Shell/MainSheet",
  component: MainSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Admin fork of the Canvas MainSheet (Cockpit M3, finished). A transparent content zone — the linen canvas and its faint tone wash are the page ground, and route content sits directly on it. No glass, no recession.",
      },
    },
  },
  decorators: [withCanvasFrame({ heightClassName: "min-h-[320px]", workspace: "hub" })],
  args: {
    children: (
      <div className="p-6 text-body-md text-text-sub">
        Route content renders directly on the canvas.
      </div>
    ),
  },
} satisfies Meta<typeof MainSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = canvas.getByTestId("main-sheet-content");
    await expect(surface).toBeInTheDocument();
    await expect(surface.className).not.toContain("glass-surface");
  },
};
