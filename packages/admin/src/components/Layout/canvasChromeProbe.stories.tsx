import { RiAppsLine, RiHammerLine, RiSeedlingLine, RiTeamLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { type ToolbarSlot } from "@green-goods/shared";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { ProfiledNavigationBar } from "./canvasChromeProbe";

const slots: ToolbarSlot[] = [
  {
    id: "hub",
    label: "Hub",
    labelId: "cockpit.nav.hub",
    icon: RiAppsLine,
    path: "/hub",
    visible: true,
  },
  {
    id: "garden",
    label: "Garden",
    labelId: "cockpit.nav.garden",
    icon: RiSeedlingLine,
    path: "/garden",
    visible: true,
  },
  {
    id: "community",
    label: "Community",
    labelId: "cockpit.nav.community",
    icon: RiTeamLine,
    path: "/community",
    visible: true,
  },
  {
    id: "actions",
    label: "Actions",
    labelId: "app.admin.nav.actions",
    icon: RiHammerLine,
    path: "/actions",
    visible: true,
  },
];

const meta = {
  title: "Admin/Shell/CanvasChromeProbe",
  component: ProfiledNavigationBar,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The profiled navigation wrapper used by CanvasLayout. Local routes also expose bounded render and lifecycle counters on the document root for chrome stability diagnostics.",
      },
    },
  },
  decorators: [
    withCanvasFrame({
      className: "relative",
      heightClassName: "min-h-[420px]",
      workspace: "hub",
    }),
  ],
  args: {
    slots,
    activePath: "/hub",
    onNavigate: fn(),
  },
} satisfies Meta<typeof ProfiledNavigationBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveRoute: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /hub/i })).toHaveAttribute(
      "data-state",
      "active"
    );
    await userEvent.click(canvas.getByRole("button", { name: /garden/i }));
    await expect(args.onNavigate).toHaveBeenCalledWith("/garden");
  },
};
