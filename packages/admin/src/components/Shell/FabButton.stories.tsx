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
          label: "Create Assessment",
          labelId: "cockpit.hub.fab.createAssessment",
        },
        {
          id: "work",
          icon: RiFileList3Line,
          label: "Submit Work",
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
    // A menu control stays expandable while collapsed — dropping the attribute
    // reads to assistive tech as a control that cannot open.
    await expect(fab).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(fab);
    await expect(fab).toHaveAttribute("data-state", "open");
    await expect(fab).toHaveAttribute("aria-expanded", "true");
    const items = await canvas.findAllByRole("menuitem");
    await expect(items.length).toBe(2);
    await userEvent.click(items[0]);
    await expect(args.config.onAction).toHaveBeenCalled();
    // The chosen item unmounts with the dial; focus returns to the FAB rather
    // than falling to <body>.
    await expect(fab).toHaveFocus();
  },
};

export const SingleAction: Story = {
  args: {
    config: {
      icon: RiCheckboxCircleLine,
      label: "Create Assessment",
      actions: [
        {
          id: "assessment",
          icon: RiCheckboxCircleLine,
          label: "Create Assessment",
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
    // Single-action mode is a direct-fire button, not a menu.
    await expect(fab).not.toHaveAttribute("aria-expanded");
  },
};

/**
 * Regression guard for WCAG 2.5.3 (Label in Name): the accessible name has to
 * be the visible label. The FAB renders the *translated action* label, so a
 * config whose own `label` differs must not leak into `aria-label` — speech
 * input activates a control by what it says.
 */
export const SingleActionLabelMismatch: Story = {
  args: {
    config: {
      icon: RiCheckboxCircleLine,
      // Deliberately different from the translated action label below.
      label: "Create",
      actions: [
        {
          id: "assessment",
          icon: RiCheckboxCircleLine,
          label: "Create Assessment",
          labelId: "cockpit.hub.fab.createAssessment",
        },
      ],
      onAction: fn(),
    },
    mobileFloating: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Resolving the button by that exact name proves the accessible name is the
    // translated action label, not config.label ("Create").
    const fab = canvas.getByRole("button", { name: "Create Assessment" });
    // The same string is the label rendered inside the button. The hover
    // tooltip carries it too, so scope to the button rather than the canvas.
    await expect(within(fab).getByText("Create Assessment")).toBeInTheDocument();
  },
};
