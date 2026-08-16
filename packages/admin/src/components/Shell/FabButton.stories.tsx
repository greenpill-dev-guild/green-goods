import { RiCheckboxCircleLine, RiFileList3Line, RiSeedlingLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { FabButton } from "./FabButton";

const meta = {
  title: "Admin/Shell/FabButton",
  component: FabButton,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The cockpit's creation FAB (Cockpit M3, finished): circular, tone-action filled, warm chrome shadow at rest. Multi-action configs open the speed dial (the + rotates 45°); single-action configs fire directly and get a hover tooltip. Floats above the nav bar on tablet/mobile only — desktop carries inline header actions instead.",
      },
    },
  },
  decorators: [
    withCanvasFrame({
      className: "relative flex items-end justify-end p-8",
      heightClassName: "min-h-[360px]",
      workspace: "hub",
    }),
  ],
  args: {
    config: {
      icon: RiSeedlingLine,
      label: "Create",
      actions: [
        {
          id: "assessment",
          icon: RiCheckboxCircleLine,
          label: "Create assessment",
          labelId: "cockpit.hub.fab.createAssessment",
        },
        {
          id: "work",
          icon: RiFileList3Line,
          label: "Submit work",
          labelId: "cockpit.hub.fab.submitWork",
        },
      ],
      onAction: fn(),
    },
  },
} satisfies Meta<typeof FabButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpeedDial: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fab = canvas.getByRole("button", { name: /open/i });
    await expect(fab).toHaveAttribute("data-state", "closed");
    await userEvent.click(fab);
    await expect(fab).toHaveAttribute("data-state", "open");
    const items = await canvas.findAllByRole("menuitem");
    await expect(items.length).toBe(2);
    await userEvent.click(items[0]);
    await expect(args.config.onAction).toHaveBeenCalled();
  },
};

export const SingleAction: Story = {
  args: {
    config: {
      icon: RiCheckboxCircleLine,
      label: "Create assessment",
      actions: [
        {
          id: "assessment",
          icon: RiCheckboxCircleLine,
          label: "Create assessment",
          labelId: "cockpit.hub.fab.createAssessment",
        },
      ],
      onAction: fn(),
    },
    mobileFloating: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fab = canvas.getByRole("button", { name: /create assessment/i });
    await userEvent.click(fab);
    await expect(args.config.onAction).toHaveBeenCalledWith("assessment");
  },
};
